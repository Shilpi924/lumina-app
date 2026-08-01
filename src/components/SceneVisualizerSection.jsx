import { useState, useRef, useEffect } from "react";
import { generateClaudeContent } from "../services/claudeService";
import { isAndroidApp, hasNativeSpeech, NativeSpeech } from "../utils/nativeSpeech";

export default function SceneVisualizerSection({ selectedBook, scenes = {}, onSaveScene }) {
  const [description, setDescription] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const recognitionRef = useRef(null);

  const bookKey = `${selectedBook?.title || ""}-${selectedBook?.author || ""}`.toLowerCase();
  const bookScenes = scenes[bookKey] || [];

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

    setDescription("");
    setError("");
    setStatusText("");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const microphoneSettingsMessage = isAndroidApp
      ? "Microphone permission is needed. Open Settings > Apps > Lumina > Permissions > Microphone."
      : "Microphone permission is needed. Please allow access in browser settings.";

    if (isAndroidApp && hasNativeSpeech && NativeSpeech?.start) {
      setListening(true);
      setStatusText("Listening... Speak now.");
      try {
        const result = await NativeSpeech.start({ language: "en-US" });
        const transcript = String(
          result?.transcript || result?.text || result?.value || result?.matches?.[0] || ""
        ).trim();

        if (transcript) {
          setDescription(transcript);
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

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported on this browser/device.");
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

    recognition.onstart = () => {
      setListening(true);
      setStatusText("Listening... Describe the scene.");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();

      if (transcript) {
        setDescription(transcript);
        setStatusText("Speech captured!");
      }
    };

    recognition.onerror = () => {
      setError(microphoneSettingsMessage);
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

  async function handleGenerateVisual() {
    if (!description.trim()) {
      setError("Please describe a scene first.");
      return;
    }

    setLoading(true);
    setError("");
    setLoadingText("Expanding scene description with AI...");

    const promptText = `
You are Lumina's Cinematic Prompt Architect. Take the user's brief scene description for the book "${selectedBook.title}" by "${selectedBook.author}".

Brief scene: "${description}"

Expand this into an extremely vivid, detailed image generation prompt. Specify:
- The exact visual details of the characters, setting, objects, and atmosphere matching the book's specific genre.
- Dynamic camera angles, cinematic lens types, color grading, and lighting conditions (e.g. volumetric lighting, golden hour, neon noir shadows).
- Art style: digital illustration, concept art, atmospheric oil painting, matte painting, or cinematic film still.

Return ONLY the expanded visual prompt string. Do not include introductory text, Markdown formatting, or instructions.
`;

    // Entertain user
    const textInterval = setInterval(() => {
      setLoadingText((prev) => {
        if (prev.includes("Expanding")) return "Refining cinematic lighting...";
        if (prev.includes("lighting")) return "Polishing details and style...";
        if (prev.includes("style")) return "Rendering canvas...";
        return "Expanding scene description...";
      });
    }, 2000);

    try {
      const response = await generateClaudeContent(
        [{ parts: [{ text: promptText }] }],
        { maxOutputTokens: 250 },
        "ScenePromptExpansion",
        { modelTier: "cheap" }
      );

      clearInterval(textInterval);

      const expandedPrompt = (response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      if (!expandedPrompt) {
        throw new Error("Could not construct prompt expansion. Try again.");
      }

      // Encode and call pollination image URL
      const encoded = encodeURIComponent(expandedPrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=600&height=400&nologo=true`;

      // Save scene to collection
      const newScene = {
        id: `scene-${crypto.randomUUID()}`,
        description: description.trim(),
        expandedPrompt,
        imageUrl,
        createdAt: new Date().toISOString(),
      };

      onSaveScene(bookKey, [...bookScenes, newScene]);
      setStatusText("Scene visualized successfully!");
      setDescription("");
    } catch (err) {
      clearInterval(textInterval);
      console.error(err);
      setError(err?.message || "Failed to generate visualization. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteScene(sceneId) {
    if (confirm("Are you sure you want to delete this visualization?")) {
      const updated = bookScenes.filter((s) => s.id !== sceneId);
      onSaveScene(bookKey, updated.length > 0 ? updated : null);
    }
  }

  return (
    <div style={styles.container}>
      {/* Gallery Carousel */}
      {bookScenes.length > 0 && (
        <div style={styles.gallery}>
          <h5 style={styles.galleryHead}>Saved Visualizations ({bookScenes.length})</h5>
          <div style={styles.carousel}>
            {bookScenes.map((scene) => (
              <div key={scene.id} style={styles.carouselItem}>
                <div style={styles.imageWrapper}>
                  <img src={scene.imageUrl} alt={scene.description} style={styles.image} />
                  <button
                    onClick={() => handleDeleteScene(scene.id)}
                    style={styles.deleteOverlayBtn}
                    title="Delete Image"
                  >
                    ✕
                  </button>
                </div>
                <div style={styles.sceneCaption}>
                  <span style={styles.captionTitle}>" {scene.description} "</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dictation/Input panel */}
      <div style={styles.inputCard}>
        <h4 style={styles.subhead}>Create a Scene Illustration</h4>
        <p style={styles.promptLabel}>
          Describe a scene from the book, and we'll use Stable Diffusion to bring it to life.
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
                ...styles.micBtn,
                background: listening ? "#ef4444" : "var(--accent)",
              }}
              title={listening ? "Stop dictation" : "Start dictation"}
            >
              {listening ? "⏹️" : "🎙️"}
            </button>
            <span style={styles.statusLabel}>
              {listening ? "Listening..." : "Tap mic to dictate or write below"}
            </span>
          </div>
        )}

        <textarea
          style={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A solitary astronaut standing on the rings of Saturn, looking down at a small mechanical spider."
          disabled={loading || listening}
        />

        {description.trim() && !loading && !listening && (
          <button style={styles.generateBtn} onClick={handleGenerateVisual}>
            🎨 Visualize Scene
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    boxSizing: "border-box",
  },
  gallery: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  galleryHead: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0",
    color: "var(--text-h)",
    fontWeight: "800",
  },
  carousel: {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    paddingBottom: "8px",
  },
  carouselItem: {
    flex: "0 0 280px",
    background: "var(--bg)",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: "1.5",
    background: "#000",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  deleteOverlayBtn: {
    position: "absolute",
    top: "8px",
    right: "8px",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "rgba(15, 23, 42, 0.65)",
    border: "none",
    color: "#fff",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    backdropFilter: "blur(4px)",
  },
  sceneCaption: {
    padding: "10px",
    textAlign: "left",
  },
  captionTitle: {
    fontSize: "12px",
    fontStyle: "italic",
    lineHeight: "1.4",
    color: "var(--text)",
  },
  inputCard: {
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
  micBtn: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    transition: "all 0.2s",
  },
  statusLabel: {
    fontSize: "13px",
    fontWeight: "750",
    color: "var(--text-h)",
  },
  textarea: {
    width: "100%",
    height: "70px",
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
  generateBtn: {
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
