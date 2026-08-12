import { useEffect, useRef, useState } from "react";
import { generateClaudeContent } from "../services/claudeService";
import { safeParseJson } from "../utils/stringUtils";

export default function ArShelfSync({
  onClose,
  onAddBookToLibrary,
  isBookInReadingList,
  readingDna,
  readingList,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectedBooks, setDetectedBooks] = useState([]);
  const [error, setError] = useState("");
  const [scannerMsg, setScannerMsg] = useState("Initializing camera...");

  useEffect(() => {
    async function startCamera() {
      setError("");
      setScannerMsg("Requesting camera access...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setActive(true);
          setScannerMsg("AR Camera Active. Scanning spines every 3 seconds...");
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError(
          "Could not access the environment camera. Ensure microphone/camera permissions are allowed in settings."
        );
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // Frame Capture and AI Scanning loop
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      captureAndScan();
    }, 3500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, readingDna, readingList]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActive(false);
  }

  async function captureAndScan() {
    if (loading || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    setLoading(true);
    setScannerMsg("AI analyzing frame...");

    // Draw video frame onto hidden canvas
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const base64Data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      
      const promptText = `
You are Lumina's AR Shelf Vision assistant. Analyze this frame from a live camera scanning a bookshelf. Identify the books that are fully or partially visible. 

For each book, determine:
1. title
2. author
3. estimated rating (1.0 to 5.0)
4. genre
5. summary (brief 1-sentence synopsis)
6. relative bounding box coordinates in the frame (x, y, width, height as integer percentages of the image size from 0 to 100).
   - "x" is the horizontal starting position from the left (0 to 100).
   - "y" is the vertical starting position from the top (0 to 100).
   - "width" is the horizontal thickness of the spine/cover (0 to 100).
   - "height" is the vertical height of the spine/cover (0 to 100).

Return ONLY a raw JSON object matching this structure:
{
  "books": [
    {
      "title": "Book Title",
      "author": "Author Name or Unknown",
      "rating": 4.2,
      "genre": "...",
      "summary": "...",
      "x": 20,
      "y": 10,
      "width": 8,
      "height": 70
    }
  ]
}
`;

      const response = await generateClaudeContent(
        [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        { maxOutputTokens: 800 },
        "ARScan",
        { modelTier: "strong", requiresVision: true, requiresJson: true }
      );

      const jsonText = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = safeParseJson(jsonText);

      if (parsed && Array.isArray(parsed.books)) {
        setDetectedBooks(parsed.books);
        setScannerMsg(`Scan updated. Found ${parsed.books.length} books.`);
      }
    } catch (err) {
      console.warn("AR capture error:", err);
      // Fail silently to avoid breaking the camera feed experience
    } finally {
      setLoading(false);
    }
  }

  function handleSaveDetectedBook(book) {
    const bookPayload = {
      title: book.title,
      author: book.author,
      genre: book.genre,
      summary: book.summary,
      whyRead: "Detected via Live AR Bookshelf Scanner.",
      shelfLocation: "AR Live Scan",
      shelfPick: "Top Rated",
    };
    onAddBookToLibrary(bookPayload);
  }

  return (
    <div style={styles.fullscreenOverlay}>
      {/* Header Controls */}
      <div style={styles.topControlHeader}>
        <div style={styles.headerInfo}>
          <span style={styles.pulseDot} />
          <span style={styles.headerTitle}>Live AR Shelf Mode</span>
        </div>
        <button style={styles.closeBtn} onClick={() => { stopCamera(); onClose(); }}>
          ✕ Close AR
        </button>
      </div>

      {/* Main Viewfinder wrapper */}
      <div style={styles.viewfinderContainer}>
        {error ? (
          <div style={styles.errorCard}>
            <p>{error}</p>
            <button style={styles.actionBtn} onClick={() => window.location.reload()}>
              Reload App
            </button>
          </div>
        ) : (
          <div style={styles.videoWrapper}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={styles.videoStream}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Live scanning target indicators */}
            <div style={styles.scannerCrosshairs} />

            {/* Bounding box visual overrides */}
            {active &&
              detectedBooks.map((book, idx) => {
                const saved = isBookInReadingList(book);
                return (
                  <div
                    key={idx}
                    style={{
                      ...styles.overlayBox,
                      left: `${book.x}%`,
                      top: `${book.y}%`,
                      width: `${book.width}%`,
                      height: `${book.height}%`,
                      border: saved ? "2px solid #10b981" : "2px dashed var(--accent)",
                      boxShadow: saved ? "0 0 10px rgba(16, 185, 129, 0.4)" : "0 0 10px rgba(37, 99, 235, 0.4)",
                    }}
                  >
                    <div style={{
                      ...styles.overlayBadge,
                      background: saved ? "#10b981" : "rgba(37, 99, 235, 0.85)",
                    }}>
                      <div style={styles.badgeRow}>
                        <span style={styles.badgeTitle}>{book.title}</span>
                        <span style={styles.badgeRating}>⭐ {book.rating || "4.0"}</span>
                      </div>
                      {!saved && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveDetectedBook(book);
                          }}
                          style={styles.addOverlayBtn}
                        >
                          ➕ Stash
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Footer log */}
      <div style={styles.bottomBar}>
        <span style={styles.scannerMsg}>{scannerMsg}</span>
        {loading && <span style={styles.scanMiniLoader}>Scanning...</span>}
      </div>
    </div>
  );
}

const styles = {
  fullscreenOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    background: "#090d16",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
  },
  topControlHeader: {
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(15, 23, 42, 0.85)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  },
  headerInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  pulseDot: {
    width: "10px",
    height: "10px",
    background: "#ef4444",
    borderRadius: "50%",
    animation: "pulse 1.2s infinite",
  },
  headerTitle: {
    color: "#fff",
    fontSize: "15px",
    fontWeight: "780",
    letterSpacing: "0.03em",
  },
  closeBtn: {
    padding: "6px 14px",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
  },
  viewfinderContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  errorCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "320px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  actionBtn: {
    padding: "10px 16px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "700",
  },
  videoWrapper: {
    position: "relative",
    width: "100%",
    height: "100%",
    maxWidth: "640px",
    maxHeight: "480px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
  },
  videoStream: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  scannerCrosshairs: {
    position: "absolute",
    top: "10%",
    left: "10%",
    right: "10%",
    bottom: "10%",
    border: "1px solid rgba(255,255,255,0.15)",
    pointerEvents: "none",
  },
  overlayBox: {
    position: "absolute",
    boxSizing: "border-box",
    borderRadius: "6px",
    transition: "all 0.3s ease-out",
    pointerEvents: "auto",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-end",
  },
  overlayBadge: {
    position: "absolute",
    bottom: "-25px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "max-content",
    maxWidth: "140px",
    borderRadius: "8px",
    padding: "4px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    zIndex: 10,
  },
  badgeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
  },
  badgeTitle: {
    color: "#fff",
    fontSize: "9px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "80px",
  },
  badgeRating: {
    color: "#ffd700",
    fontSize: "8px",
    fontWeight: "800",
  },
  addOverlayBtn: {
    padding: "2px 6px",
    background: "#fff",
    color: "#000",
    border: "none",
    borderRadius: "4px",
    fontSize: "8px",
    fontWeight: "800",
    cursor: "pointer",
  },
  bottomBar: {
    padding: "16px",
    background: "rgba(15, 23, 42, 0.85)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scannerMsg: {
    color: "#a0aec0",
    fontSize: "12px",
    fontWeight: "700",
  },
  scanMiniLoader: {
    color: "var(--accent)",
    fontSize: "11px",
    fontWeight: "800",
  },
};
