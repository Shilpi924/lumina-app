import { useState, useEffect } from "react";
import { soundscapes } from "../utils/soundscapes";

export default function SoundscapePlayer({ style }) {
  const [state, setState] = useState(() => soundscapes.getState());

  useEffect(() => {
    return soundscapes.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  const tracks = [
    { id: "rain", label: "Cozy Rain", icon: "🌧️" },
    { id: "fireplace", label: "Fireplace", icon: "🔥" },
    { id: "library", label: "Library", icon: "📖" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px",
        padding: "8px 12px",
        borderRadius: "14px",
        background: "var(--card-bg, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "4px" }}>
        <span style={{ fontSize: "14px" }}>🎧</span>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text)" }}>Soundscapes</span>
      </div>

      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        {tracks.map((t) => {
          const isActive = state.isPlaying && state.activeType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => soundscapes.play(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 9px",
                borderRadius: "16px",
                border: isActive ? "1px solid var(--accent, #6366f1)" : "1px solid var(--border)",
                background: isActive ? "var(--accent-bg, rgba(99,102,241,0.12))" : "var(--bg)",
                color: isActive ? "var(--accent, #6366f1)" : "var(--text)",
                fontSize: "11px",
                fontWeight: isActive ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={isActive ? `Playing ${t.label} (Click to pause)` : `Play ${t.label} soundscape`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {isActive && (
                <span
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--accent, #6366f1)",
                    animation: "pulse 1.2s infinite",
                  }}
                />
              )}
            </button>
          );
        })}

        {state.isPlaying && (
          <button
            type="button"
            onClick={() => soundscapes.stop()}
            style={{
              padding: "4px 8px",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
            title="Stop audio"
          >
            ⏹ Stop
          </button>
        )}
      </div>
    </div>
  );
}
