export default function BookDetailsModal({
  badgeStyle,
  children,
  onClose,
  selectedBook,
  styles,
  theme,
}) {
  const glowColor = theme?.border || "var(--accent, #6366f1)";

  return (
    <div
      className="scan-modal-scroll"
      style={styles.modal}
      onClick={onClose}
    >
      <div
        style={{
          ...styles.modalContent,
          border: `3px solid ${theme.border}`,
          boxShadow: `0 24px 64px rgba(0, 0, 0, 0.18), 0 0 60px ${glowColor}33`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          transition: "box-shadow 0.3s ease",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                width: "140%",
                height: "140%",
                background: `radial-gradient(circle, ${glowColor}40 0%, transparent 70%)`,
                filter: "blur(14px)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            <div style={{ ...styles.modalIcon, background: theme.imageBg, position: "relative", zIndex: 1 }}>
              <span className="detail-orbit" style={styles.detailOrbit} />
              <span className="detail-book-core" style={styles.detailBookCore} />
              <span className="detail-lens-core" style={styles.detailLensCore} />
              <span className="detail-spark-one" style={styles.detailSparkOne} />
              <span className="detail-spark-two" style={styles.detailSparkTwo} />
            </div>
          </div>

          <div>
            <h2 style={{ ...styles.modalTitle, color: theme.title }}>
              {selectedBook.title}
            </h2>

            <p style={badgeStyle}>
              {selectedBook.shelfPick}
            </p>
          </div>

          <button
            type="button"
            style={{ ...styles.closeIconButton, position: "absolute", top: "16px", right: "16px" }}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="Close details"
            title="Close details"
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
