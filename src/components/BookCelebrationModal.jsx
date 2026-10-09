import { useEffect, useRef, useState } from "react";

export default function BookCelebrationModal({ book, onClose, onShare }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Canvas confetti animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#3b82f6", "#f43f5e"];
    const particles = Array.from({ length: 90 }).map(() => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 100,
      y: canvas.height * 0.4 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 4,
      gravity: 0.35,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      alpha: 1,
    }));

    let animationFrame;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.007;

        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
        }
      });

      if (particles.some((p) => p.alpha > 0)) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  if (!book) return null;

  const handleShare = async () => {
    const shareText = `🎉 I just finished reading "${book.title}" by ${book.author || "Unknown Author"} on Lumina! 📚✨ #BookTok #ReadingJourney #LuminaApp`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Finished reading: ${book.title}`,
          text: shareText,
          url: window.location.origin,
        });
        if (onShare) onShare();
        return;
      } catch (err) {
        // Fallback to clipboard if user cancelled or unsupported
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "380px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "linear-gradient(145deg, #1e1e38 0%, #0f172a 100%)",
          borderRadius: "24px",
          padding: "24px 20px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(139, 92, 246, 0.2)",
          color: "#ffffff",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div style={{ fontSize: "40px", marginBottom: "4px" }}>🏆</div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 4px 0", color: "#f8fafc" }}>
            You Finished It!
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Another incredible world completed.
          </p>
        </div>

        {/* 9:16 Shareable Vertical Story Card */}
        <div
          style={{
            width: "100%",
            maxWidth: "260px",
            aspectRatio: "9/14",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "18px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
            backdropFilter: "blur(12px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top Tag */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "800",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                background: "rgba(255, 255, 255, 0.2)",
                padding: "3px 8px",
                borderRadius: "10px",
              }}
            >
              Completed ✦
            </span>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </div>

          {/* Book Hero */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                style={{
                  width: "90px",
                  height: "130px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "115px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                }}
              >
                📖
              </div>
            )}
            <div>
              <div style={{ fontSize: "15px", fontWeight: "800", lineHeight: "1.2", marginBottom: "4px" }}>
                {book.title}
              </div>
              <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                {book.author || "Unknown Author"}
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <div
            style={{
              borderTop: "1px solid rgba(255, 255, 255, 0.15)",
              paddingTop: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "10px",
              color: "#94a3b8",
            }}
          >
            <span style={{ fontWeight: "700", color: "#e2e8f0" }}>Lumina Reading</span>
            <span>{book.genre || "Book"}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", width: "100%" }}>
          <button
            type="button"
            onClick={handleShare}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
              transition: "transform 0.15s ease",
            }}
          >
            {copied ? "Copied to Clipboard! ✨" : "Share Story 📤"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 18px",
              borderRadius: "14px",
              background: "rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
