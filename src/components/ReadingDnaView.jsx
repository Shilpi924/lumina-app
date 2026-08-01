import { useState } from "react";
import { generateClaudeContent } from "../services/claudeService";
import { safeParseJson } from "../utils/stringUtils";

export default function ReadingDnaView({ readingList, readingDna, onUpdateDna }) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");

  const center = 150;
  const rMax = 100;
  const axes = [
    { key: "narrativeComplexity", label: "Complexity" },
    { key: "emotionalTone", label: "Emotional Tone" },
    { key: "readingPace", label: "Reading Pace" },
    { key: "speculativeRealism", label: "Speculative" },
    { key: "characterFocus", label: "Character Focus" },
    { key: "modernity", label: "Modernity" },
  ];

  // Map values to display names for labels
  const axisLabelsMap = {
    narrativeComplexity: { low: "Simple", high: "Scholarly" },
    emotionalTone: { low: "Dark / Gritty", high: "Uplifting" },
    readingPace: { low: "Reflective", high: "Fast-paced" },
    speculativeRealism: { low: "Real-world", high: "Imaginative" },
    characterFocus: { low: "Plot-driven", high: "Character-driven" },
    modernity: { low: "Classic", high: "Modern" },
  };

  async function handleAnalyze() {
    if (!readingList || readingList.length === 0) {
      setError("Add books to your Stash to analyze your Reading DNA.");
      return;
    }

    setLoading(true);
    setError("");
    setLoadingText("Reading titles...");

    const booksText = readingList
      .map((b) => `- ${b.title} by ${b.author || "Unknown"} (Genre: ${b.genre || "Not specified"})`)
      .join("\n");

    const promptText = `
You are Lumina's Literary DNA analyzer. Analyze this user's library of books:
${booksText}

Evaluate the user's reading taste profile along 6 axes on a scale from 0 to 100:
1. narrativeComplexity (0 = simple/straightforward/cozy, 100 = highly intricate/dense/scholarly/multi-layered)
2. emotionalTone (0 = dark/melancholic/gritty/angsty, 100 = uplifting/warm/lighthearted/humorous)
3. readingPace (0 = slow/reflective/meditative, 100 = fast-paced/action-heavy/thrilling)
4. speculativeRealism (0 = realistic/factual/biographical/non-fiction, 100 = imaginative/speculative/fantasy/sci-fi)
5. characterFocus (0 = plot & concept driven/worldbuilding focus, 100 = character & relationship driven/internal journey focus)
6. modernity (0 = classic/historical/period pieces, 100 = modern/contemporary/futuristic)

Also determine:
1. A unique, creative "Reading Persona" title (e.g., "The Meditative Explorer", "The Cyberpunk Philosopher", "The Whimsical Historian").
2. A detailed 2-3 sentence personalized analysis description of their reading DNA.
3. Their top 3 genres based on the list.
4. Three signature themes or topics they love (e.g., "Existential survival", "Found family", "Political intrigue").

Return ONLY a raw JSON object matching this structure:
{
  "persona": "...",
  "description": "...",
  "scores": {
    "narrativeComplexity": 80,
    "emotionalTone": 30,
    "readingPace": 40,
    "speculativeRealism": 85,
    "characterFocus": 70,
    "modernity": 60
  },
  "topGenres": ["...", "...", "..."],
  "signatureThemes": ["...", "...", "..."]
}
`;

    // Rotate loading text tags to keep user entertained
    const textInterval = setInterval(() => {
      setLoadingText((prev) => {
        if (prev.includes("titles")) return "Deconstructing styles...";
        if (prev.includes("styles")) return "Mapping DNA axes...";
        if (prev.includes("axes")) return "Formulating reading persona...";
        return "Reading titles...";
      });
    }, 2500);

    try {
      const response = await generateClaudeContent(
        [{ parts: [{ text: promptText }] }],
        { maxOutputTokens: 1000 },
        "ReadingDNA",
        { modelTier: "strong", requiresJson: true }
      );

      clearInterval(textInterval);

      const jsonText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = safeParseJson(jsonText);

      if (parsed && parsed.scores && parsed.persona) {
        onUpdateDna(parsed);
      } else {
        throw new Error("Invalid response format received from AI. Please try again.");
      }
    } catch (err) {
      clearInterval(textInterval);
      console.error(err);
      setError(err?.message || "Failed to analyze Reading DNA. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Draw SVG Grid and Polygon elements if we have scores
  const scores = readingDna?.scores || {};
  
  const points = axes
    .map((axis, i) => {
      const score = scores[axis.key] ?? 50;
      const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2; // Offset by -90 deg (straight up)
      const r = (score / 100) * rMax;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  const levels = [25, 50, 75, 100];
  const gridPolygons = levels.map((level) => {
    const r = (level / 100) * rMax;
    const pointsStr = axes
      .map((_, i) => {
        const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <polygon
        key={level}
        points={pointsStr}
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.5"
        strokeDasharray={level === 100 ? "0" : "2 3"}
      />
    );
  });

  const spokes = axes.map((axis, i) => {
    const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
    const x = center + rMax * Math.cos(angle);
    const y = center + rMax * Math.sin(angle);
    return (
      <line
        key={axis.key}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        stroke="var(--border)"
        strokeWidth="0.5"
      />
    );
  });

  const labels = axes.map((axis, i) => {
    const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
    const offset = 24;
    const x = center + (rMax + offset) * Math.cos(angle);
    const y = center + (rMax + offset) * Math.sin(angle);

    let textAnchor = "middle";
    if (Math.cos(angle) > 0.1) textAnchor = "start";
    else if (Math.cos(angle) < -0.1) textAnchor = "end";

    return (
      <g key={axis.key}>
        <text
          x={x}
          y={y + 2}
          textAnchor={textAnchor}
          fill="var(--text-h)"
          fontSize="11px"
          fontWeight="700"
        >
          {axis.label}
        </text>
        <text
          x={x}
          y={y + 12}
          textAnchor={textAnchor}
          fill="var(--text)"
          fontSize="8px"
          opacity="0.75"
        >
          {scores[axis.key] !== undefined ? `${scores[axis.key]}%` : ""}
        </text>
      </g>
    );
  });

  const dots = axes.map((axis, i) => {
    const score = scores[axis.key] ?? 50;
    const angle = (i * 60 * Math.PI) / 180 - Math.PI / 2;
    const r = (score / 100) * rMax;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return (
      <circle
        key={axis.key}
        cx={x}
        cy={y}
        r="4"
        fill="var(--bg)"
        stroke="var(--accent)"
        strokeWidth="2"
      />
    );
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Literary DNA 🧬</h2>
        <p style={styles.subtitle}>
          Discover your unique reader personality mapped across your library tastes.
        </p>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>{loadingText}</p>
        </div>
      ) : readingDna ? (
        <div style={styles.dnaGrid}>
          {/* Radar Chart Card */}
          <div style={styles.card}>
            <div style={styles.radarWrapper}>
              <svg width="100%" height="100%" viewBox="0 0 300 300">
                <defs>
                  <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
                  </radialGradient>
                </defs>
                {gridPolygons}
                {spokes}
                {labels}
                <polygon
                  points={points}
                  fill="url(#radarGradient)"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {dots}
              </svg>
            </div>
            
            {/* Axis Descriptions */}
            <div style={styles.axesExplanation}>
              <h4 style={styles.subhead}>DNA Dimensions</h4>
              <div style={styles.axesList}>
                {axes.map(ax => {
                  const val = scores[ax.key] || 50;
                  const labelMap = axisLabelsMap[ax.key];
                  const lowLabel = labelMap?.low || "";
                  const highLabel = labelMap?.high || "";
                  return (
                    <div key={ax.key} style={styles.axisItem}>
                      <div style={styles.axisItemHeader}>
                        <span style={styles.axisItemName}>{ax.label}</span>
                        <span style={styles.axisItemValue}>{val}%</span>
                      </div>
                      <div style={styles.axisSliderTrack}>
                        <div style={{ ...styles.axisSliderFill, width: `${val}%` }} />
                      </div>
                      <div style={styles.axisLabelsRange}>
                        <span>{lowLabel}</span>
                        <span>{highLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Persona Card */}
          <div style={{ ...styles.card, ...styles.personaCard }}>
            <div style={styles.personaBadge}>READER PROFILE</div>
            <h3 style={styles.personaTitle}>{readingDna.persona}</h3>
            <p style={styles.personaDesc}>{readingDna.description}</p>

            <div style={styles.sectionDivider} />

            <h4 style={styles.subhead}>Top Genres</h4>
            <div style={styles.tagsContainer}>
              {readingDna.topGenres?.map((genre, idx) => (
                <span key={idx} style={styles.genreTag}>
                  📚 {genre}
                </span>
              ))}
            </div>

            <div style={styles.sectionDivider} />

            <h4 style={styles.subhead}>Signature Themes</h4>
            <div style={styles.tagsContainer}>
              {readingDna.signatureThemes?.map((theme, idx) => (
                <span key={idx} style={styles.themeTag}>
                  ✨ {theme}
                </span>
              ))}
            </div>

            <button style={styles.reanalyzeBtn} onClick={handleAnalyze}>
              🔄 Re-Analyze Library
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>🧬</div>
          <h3>Create Your Literary DNA</h3>
          <p style={styles.emptyText}>
            We'll analyze the titles, authors, and genres in your collection to map your custom Reading DNA chart and discover your literary persona.
          </p>
          {readingList && readingList.length > 0 ? (
            <button style={styles.analyzeBtn} onClick={handleAnalyze}>
              Begin AI Analysis ({readingList.length} books)
            </button>
          ) : (
            <div style={styles.noBooksAlert}>
              Your library is currently empty. Scan books or add them to your Stash to generate your profile.
            </div>
          )}
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
  dnaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    width: "100%",
  },
  card: {
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "var(--shadow)",
  },
  radarWrapper: {
    width: "100%",
    maxWidth: "300px",
    aspectRatio: "1",
    margin: "0 auto",
  },
  subhead: {
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: "800",
    color: "var(--text-h)",
    margin: "0 0 8px 0",
  },
  axesExplanation: {
    marginTop: "8px",
  },
  axesList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  axisItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  axisItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    fontWeight: "700",
  },
  axisItemName: {
    color: "var(--text-h)",
  },
  axisItemValue: {
    color: "var(--accent)",
  },
  axisSliderTrack: {
    height: "6px",
    background: "var(--border)",
    borderRadius: "3px",
    overflow: "hidden",
  },
  axisSliderFill: {
    height: "100%",
    background: "var(--accent)",
    borderRadius: "3px",
    transition: "width 0.8s ease-out",
  },
  axisLabelsRange: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "9px",
    color: "var(--text)",
    opacity: "0.7",
  },
  personaCard: {
    background: "var(--glass-bg)",
    border: "1px solid var(--accent-border)",
    backdropFilter: "var(--glass-blur)",
  },
  personaBadge: {
    alignSelf: "flex-start",
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    color: "var(--accent)",
    fontSize: "10px",
    fontWeight: "800",
    padding: "3px 8px",
    borderRadius: "12px",
    letterSpacing: "0.05em",
  },
  personaTitle: {
    fontSize: "22px",
    fontWeight: "800",
    margin: "0",
    color: "var(--text-h)",
    background: "linear-gradient(90deg, var(--accent) 0%, #a855f7 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  personaDesc: {
    fontSize: "14px",
    lineHeight: "1.5",
    color: "var(--text)",
    margin: "0",
  },
  sectionDivider: {
    height: "1px",
    background: "var(--border)",
    width: "100%",
    margin: "8px 0",
  },
  tagsContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  genreTag: {
    fontSize: "12px",
    padding: "5px 12px",
    borderRadius: "16px",
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-h)",
    fontWeight: "600",
  },
  themeTag: {
    fontSize: "12px",
    padding: "5px 12px",
    borderRadius: "16px",
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    color: "var(--accent)",
    fontWeight: "600",
  },
  reanalyzeBtn: {
    marginTop: "auto",
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s",
  },
  emptyContainer: {
    textAlign: "center",
    padding: "48px 24px",
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "8px",
  },
  emptyText: {
    fontSize: "14px",
    color: "var(--text)",
    maxWidth: "400px",
    margin: "0 0 8px 0",
    lineHeight: "1.4",
  },
  analyzeBtn: {
    padding: "12px 24px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
  },
  noBooksAlert: {
    fontSize: "13px",
    color: "var(--accent)",
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    padding: "8px 16px",
    borderRadius: "8px",
    maxWidth: "380px",
  },
};
