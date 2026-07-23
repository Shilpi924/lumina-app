import { useState } from "react";
import { generateClaudeContent } from "../services/claudeService";
import { safeParseJson } from "../utils/stringUtils";

export default function ReadingJourneyTimeline({
  readingList,
  readingDna,
  readingJourney,
  onUpdateJourney,
  onAddBookToLibrary,
  isBookInReadingList,
}) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [userGoal, setUserGoal] = useState("");
  const [error, setError] = useState("");

  async function handleGenerateJourney() {
    setLoading(true);
    setError("");
    setLoadingText("Analyzing your Reading DNA...");

    const booksListText = readingList?.length
      ? readingList.map((b) => `- ${b.title} by ${b.author}`).join("\n")
      : "No books in stash yet.";

    const dnaProfileText = readingDna
      ? `Persona: ${readingDna.persona}. Genres: ${readingDna.topGenres?.join(", ")}. Themes: ${readingDna.signatureThemes?.join(", ")}.`
      : "No DNA mapped yet.";

    const promptText = `
You are Lumina's Literary Pathweaver. Create a custom 4-book reading journey for this user based on their current library and Reading DNA.

User's Saved Books:
${booksListText}

User's Reading DNA Profile:
${dnaProfileText}

User's Goal/Theme:
"${userGoal.trim() || "Explore themes similar to their current library but expanding their horizons"}"

Curate a sequence of exactly 4 books. The books should be acclaimed or highly recommended titles that match or constructively expand their taste. For each book, provide:
1. title
2. author
3. whyNow (1-2 sentences explaining why this book fits at this exact point in the journey)
4. connectingThread (1 sentence explaining the transition or connection from the previous book in the sequence. For the first book, connect it to their current reading profile.)
5. estimatedReadingTime (e.g., "8 hours")
6. genre

Return ONLY a raw JSON array matching this structure:
[
  {
    "title": "...",
    "author": "...",
    "whyNow": "...",
    "connectingThread": "...",
    "estimatedReadingTime": "...",
    "genre": "..."
  },
  ...
]
`;

    const textInterval = setInterval(() => {
      setLoadingText((prev) => {
        if (prev.includes("DNA")) return "Sifting through acclaimed titles...";
        if (prev.includes("acclaimed")) return "Constructing matching threads...";
        if (prev.includes("threads")) return "Polishing reading curriculum...";
        return "Analyzing your Reading DNA...";
      });
    }, 2000);

    try {
      const response = await generateClaudeContent(
        [{ parts: [{ text: promptText }] }],
        { maxOutputTokens: 1200 },
        "ReadingJourney",
        { modelTier: "strong", requiresJson: true }
      );

      clearInterval(textInterval);

      const jsonText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = safeParseJson(jsonText);

      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdateJourney(parsed);
      } else {
        throw new Error("Invalid response format received from AI.");
      }
    } catch (err) {
      clearInterval(textInterval);
      console.error(err);
      setError(err?.message || "Failed to generate reading journey. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleAddToStash(journeyBook) {
    const bookPayload = {
      title: journeyBook.title,
      author: journeyBook.author,
      genre: journeyBook.genre,
      summary: journeyBook.whyNow,
      whyRead: journeyBook.connectingThread,
      shelfLocation: "AI Recommended",
      shelfPick: "AI Journey",
    };
    onAddBookToLibrary(bookPayload);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Reading Journey 🧭</h2>
        <p style={styles.subtitle}>
          Your custom-sequenced reading path built around your literary aspirations.
        </p>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>{loadingText}</p>
        </div>
      ) : readingJourney ? (
        <div style={styles.journeyWrapper}>
          {/* Goal Header */}
          {userGoal && (
            <div style={styles.goalDisplay}>
              <strong>Current Focus:</strong> "{userGoal}"
            </div>
          )}

          {/* Timeline */}
          <div style={styles.timeline}>
            {readingJourney.map((book, index) => {
              const saved = isBookInReadingList(book);
              return (
                <div key={index} style={styles.timelineItem}>
                  {/* Spine connection line */}
                  <div style={styles.timelineLineWrapper}>
                    <div style={{
                      ...styles.timelineBadge,
                      background: saved ? "var(--accent)" : "var(--border)",
                      color: saved ? "#fff" : "var(--text)",
                    }}>
                      {index + 1}
                    </div>
                    {index < readingJourney.length - 1 && <div style={styles.timelineLine} />}
                  </div>

                  {/* Card content */}
                  <div style={{
                    ...styles.timelineCard,
                    borderLeft: saved ? "4px solid var(--accent)" : "1px solid var(--border)",
                  }}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.bookTitle}>{book.title}</h3>
                        <p style={styles.bookAuthor}>by {book.author}</p>
                      </div>
                      <span style={styles.durationBadge}>🕒 {book.estimatedReadingTime || "N/A"}</span>
                    </div>

                    <p style={styles.threadText}>
                      <strong>Connecting Thread:</strong> {book.connectingThread}
                    </p>

                    <p style={styles.whyNowText}>
                      <strong>Why read it now?</strong> {book.whyNow}
                    </p>

                    <div style={styles.actionRow}>
                      <span style={styles.genreLabel}>🏷️ {book.genre}</span>
                      <button
                        onClick={() => handleAddToStash(book)}
                        disabled={saved}
                        style={{
                          ...styles.stashBtn,
                          background: saved ? "var(--accent-bg)" : "var(--accent)",
                          color: saved ? "var(--accent)" : "#fff",
                          border: saved ? "1px solid var(--accent-border)" : "none",
                        }}
                      >
                        {saved ? "✓ Saved in Stash" : "📥 Add to Stash"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.regenerateSection}>
            <button style={styles.rebuildBtn} onClick={() => onUpdateJourney(null)}>
              🗺️ Plan a New Journey
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.setupCard}>
          <div style={styles.icon}>🧭</div>
          <h3>Plan Your Next Chapter</h3>
          <p style={styles.setupText}>
            Where do you want your reading journey to take you? Choose a learning goal, a specific topic, or leave it blank for a general horizon-expanding roadmap.
          </p>

          <div style={styles.inputWrapper}>
            <label style={styles.inputLabel}>Define your roadmap goal (optional):</label>
            <input
              type="text"
              value={userGoal}
              onChange={(e) => setUserGoal(e.target.value)}
              placeholder="e.g., Deep dive into space operas, build emotional intelligence, explore classics"
              style={styles.input}
            />
          </div>

          <button style={styles.generateBtn} onClick={handleGenerateJourney}>
            Draft Sequencing Roadmap (4 Books)
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "0 16px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    textAlign: "left",
  },
  header: {
    marginBottom: "8px",
  },
  title: {
    fontSize: "24px",
    margin: "0 0 4px",
    fontWeight: "800",
    color: "var(--text-h)",
  },
  subtitle: {
    fontSize: "14px",
    margin: "0",
    color: "var(--text)",
    opacity: "0.85",
  },
  errorBox: {
    padding: "12px 16px",
    borderRadius: "8px",
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    color: "#b91c1c",
    fontSize: "14px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    background: "var(--code-bg)",
    borderRadius: "12px",
    border: "1px solid var(--border)",
  },
  spinner: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "3px solid var(--border)",
    borderTopColor: "var(--accent)",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
  loadingText: {
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--text-h)",
    margin: "0",
  },
  setupCard: {
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "14px",
  },
  icon: {
    fontSize: "48px",
  },
  setupText: {
    fontSize: "14px",
    color: "var(--text)",
    maxWidth: "460px",
    lineHeight: "1.5",
    margin: "0 0 8px 0",
  },
  inputWrapper: {
    width: "100%",
    maxWidth: "460px",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  inputLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--text-h)",
  },
  input: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: "14px",
    outline: "none",
  },
  generateBtn: {
    padding: "12px 24px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
    marginTop: "8px",
  },
  goalDisplay: {
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    color: "var(--accent)",
    fontSize: "13px",
    padding: "10px 14px",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  journeyWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  timelineItem: {
    display: "flex",
    gap: "16px",
  },
  timelineLineWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "36px",
  },
  timelineBadge: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "800",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    zIndex: 1,
  },
  timelineLine: {
    width: "2px",
    flex: 1,
    background: "var(--border)",
    margin: "4px 0",
  },
  timelineCard: {
    flex: 1,
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bookTitle: {
    fontSize: "16px",
    fontWeight: "800",
    color: "var(--text-h)",
    margin: "0 0 2px 0",
  },
  bookAuthor: {
    fontSize: "13px",
    color: "var(--text)",
    margin: "0",
    opacity: "0.85",
  },
  durationBadge: {
    fontSize: "11px",
    fontWeight: "700",
    color: "var(--text-h)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "3px 8px",
    borderRadius: "12px",
  },
  threadText: {
    fontSize: "13px",
    color: "var(--text)",
    lineHeight: "1.4",
    margin: "0",
    background: "var(--bg)",
    padding: "8px 12px",
    borderRadius: "8px",
    borderLeft: "3px solid var(--accent)",
  },
  whyNowText: {
    fontSize: "13px",
    lineHeight: "1.4",
    color: "var(--text)",
    margin: "0",
  },
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px dashed var(--border)",
    paddingTop: "10px",
    marginTop: "4px",
  },
  genreLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "var(--text-h)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  stashBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  regenerateSection: {
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
  },
  rebuildBtn: {
    padding: "10px 20px",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
};
