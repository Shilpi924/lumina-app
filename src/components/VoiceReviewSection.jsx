import { useState, useRef, useEffect } from "react";
import { generateClaudeContent } from "../services/claudeService";
import { safeParseJson } from "../utils/stringUtils";
import { isAndroidApp, hasNativeSpeech, NativeSpeech } from "../utils/nativeSpeech";

export default function VoiceReviewSection({ selectedBook, reviews = {}, onSaveReview }) {
  const [transcription, setTranscription] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const recognitionRef = useRef(null);

  const bookKey = `${selectedBook?.title || ""}-${selectedBook?.author || ""}`.toLowerCase();
  const currentReview = reviews[bookKey];

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  async function toggleListening() {
    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setListening(false);
      return;
    }

    setTranscription("");
    setError("");
    setStatusText("");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const microphoneSettingsMessage = isAndroidApp
      ? "Microphone permission is needed. Open Settings > Apps > Lumina > Permissions > Microphone."
      : "Microphone permission is needed. Please allow access in browser settings.";

    // Capacitor Native Speech
    if (isAndroidApp && hasNativeSpeech && NativeSpeech?.start) {
      setListening(true);
      setStatusText("Listening... Speak now.");
      try {
        const result = await NativeSpeech.start({ language: "en-US" });
        const transcript = String(
          result?.transcript || result?.text || result?.value || result?.matches?.[0] || ""
        ).trim();

        if (transcript) {
          setTranscription(transcript);
          setStatusText("Transcription complete.");
        } else {
          setStatusText("Could not catch any audio. Try speaking again.");
        }
      } catch (err) {
        console.error("Native dictation failed:", err);
        setError(microphoneSettingsMessage);
      } finally {
        setListening(false);
      }
      return;
    }

    // Web Browser Speech
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported on this browser/device. You can type your review thoughts below instead.");
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.error("Microphone permission failed:", err);
        setError(microphoneSettingsMessage);
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setStatusText("Listening... Speak now.");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();

      if (transcript) {
        setTranscription(transcript);
        setStatusText("Speech captured!");
      } else {
        setStatusText("No speech recognized. Try again.");
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error", event.error);
      if (event.error === "not-allowed") {
        setError(microphoneSettingsMessage);
      } else {
        setError(`Speech capture error: ${event.error}. Try again.`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setListening(false);
    }
  }

  async function handleAnalyzeReview() {
    if (!transcription.trim()) {
      setError("Please speak or type some review thoughts first.");
      return;
    }

    setLoading(true);
    setError("");
    setLoadingText("Analyzing thoughts...");

    const promptText = `
You are Lumina's review structures engine. The user has provided their spoken or typed review thoughts about the book "${selectedBook.title}" by "${selectedBook.author}".

User thoughts:
"${transcription}"

Extract a clean, structured JSON review containing:
1. rating (an integer 1 to 5 based on their sentiment)
2. summary (a polished 2-3 sentence overview of their review)
3. themes (an array of up to 3 short theme tags mentioned or implied, e.g., "Existentialist", "Rich Worldbuilding", "Slow Burn")
4. quote (a highlight or key quote from their dictation, or a memorable synthesis of their thoughts in quotes)

Return ONLY a raw JSON object matching this structure:
{
  "rating": 4,
  "summary": "...",
  "themes": ["...", "...", "..."],
  "quote": "..."
}
`;

    // Entertain user while waiting
    const textInterval = setInterval(() => {
      setLoadingText((prev) => {
        if (prev.includes("Analyzing")) return "Polishing sentences...";
        if (prev.includes("Polishing")) return "Extracting themes...";
        if (prev.includes("themes")) return "Synthesizing ratings...";
        return "Analyzing thoughts...";
      });
    }, 2000);

    try {
      const response = await generateClaudeContent(
        [{ parts: [{ text: promptText }] }],
        { maxOutputTokens: 500 },
        "ReviewAnalysis",
        { modelTier: "strong", requiresJson: true }
      );

      clearInterval(textInterval);

      const jsonText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = safeParseJson(jsonText);

      if (parsed && parsed.rating !== undefined) {
        onSaveReview(bookKey, {
          ...parsed,
          transcription,
          updatedAt: new Date().toISOString(),
        });
        setStatusText("Review generated and saved!");
        setTranscription("");
      } else {
        throw new Error("Invalid response format received from AI.");
      }
    } catch (err) {
      clearInterval(textInterval);
      console.error(err);
      setError(err?.message || "Failed to analyze review. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteReview() {
    if (confirm("Are you sure you want to delete this review?")) {
      onSaveReview(bookKey, null);
    }
  }

  const renderStars = (rating) => {
    return "⭐".repeat(rating || 5);
  };

  return (
    <div style={styles.sectionContainer}>
      {/* Current Saved AI Review */}
      {currentReview ? (
        <div style={styles.savedReviewCard}>
          <div style={styles.reviewHeader}>
            <div style={styles.starsRow}>{renderStars(currentReview.rating)}</div>
            <button style={styles.deleteBtn} onClick={handleDeleteReview} title="Delete Review">
              🗑️ Delete
            </button>
          </div>
          <blockquote style={styles.blockquote}>
            "{currentReview.quote}"
          </blockquote>
          <p style={styles.summaryText}>{currentReview.summary}</p>
          <div style={styles.themesRow}>
            {currentReview.themes?.map((theme, idx) => (
              <span key={idx} style={styles.themeBadge}>
                🏷️ {theme}
              </span>
            ))}
          </div>
          <div style={styles.originalSpeech}>
            <strong>Original Notes:</strong> "{currentReview.transcription}"
          </div>
        </div>
      ) : null}

      {/* Dictate / Edit review */}
      <div style={styles.dictateCard}>
        <h4 style={styles.subhead}>
          {currentReview ? "Update Voice Review" : "Record Your Thoughts"}
        </h4>
        <p style={styles.promptLabel}>
          Talk about what you liked, disliked, or how the book made you feel.
        </p>

        {error && <div style={styles.errorText}>{error}</div>}
        {statusText && <div style={styles.statusText}>{statusText}</div>}

        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.miniSpinner}></div>
            <span>{loadingText}</span>
          </div>
        ) : (
          <div style={styles.controlRow}>
            <button
              onClick={toggleListening}
              style={{
                ...styles.micButton,
                background: listening ? "#ef4444" : "var(--accent)",
                transform: listening ? "scale(1.08)" : "scale(1)",
              }}
              title={listening ? "Stop recording" : "Start recording"}
            >
              {listening ? "⏹️" : "🎙️"}
            </button>
            <div style={{ flex: 1 }}>
              <span style={styles.statusLabel}>
                {listening ? "Recording..." : transcription ? "Edit transcription below or record again" : "Tap mic to dictate review"}
              </span>
            </div>
          </div>
        )}

        <textarea
          style={styles.textarea}
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Your notes will appear here. Or just start typing your thoughts directly..."
          disabled={loading || listening}
        />

        {transcription.trim() && !loading && !listening && (
          <button style={styles.analyzeBtn} onClick={handleAnalyzeReview}>
            ✨ Format with AI Review
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  sectionContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    boxSizing: "border-box",
  },
  savedReviewCard: {
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  reviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  starsRow: {
    fontSize: "18px",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  blockquote: {
    fontStyle: "italic",
    fontSize: "15px",
    borderLeft: "3px solid var(--accent)",
    paddingLeft: "12px",
    margin: "4px 0",
    color: "var(--text-h)",
    lineHeight: "1.4",
  },
  summaryText: {
    fontSize: "14px",
    margin: "0",
    color: "var(--text)",
    lineHeight: "1.5",
  },
  themesRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  themeBadge: {
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: "700",
    color: "var(--text-h)",
  },
  originalSpeech: {
    fontSize: "11px",
    opacity: "0.75",
    color: "var(--text)",
    borderTop: "1px dashed var(--border)",
    paddingTop: "8px",
    marginTop: "4px",
  },
  dictateCard: {
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    textAlign: "left",
  },
  subhead: {
    fontSize: "14px",
    fontWeight: "800",
    color: "var(--text-h)",
    margin: "0",
  },
  promptLabel: {
    fontSize: "12px",
    color: "var(--text)",
    margin: "0 0 4px",
    opacity: "0.85",
  },
  errorText: {
    fontSize: "13px",
    color: "#b91c1c",
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    padding: "8px 12px",
    borderRadius: "6px",
  },
  statusText: {
    fontSize: "13px",
    color: "var(--accent)",
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    padding: "8px 12px",
    borderRadius: "6px",
  },
  controlRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "4px 0",
  },
  micButton: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    fontSize: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    transition: "all 0.2s ease-in-out",
  },
  statusLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--text-h)",
  },
  textarea: {
    width: "100%",
    height: "80px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    padding: "10px",
    fontSize: "13px",
    fontFamily: "inherit",
    resize: "none",
    boxSizing: "border-box",
  },
  analyzeBtn: {
    alignSelf: "flex-end",
    padding: "8px 16px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--text-h)",
    background: "var(--bg)",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
  },
  miniSpinner: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid var(--border)",
    borderTopColor: "var(--accent)",
    animation: "spin 1s linear infinite",
  },
};
