export default function BookDetailsModal({
  badgeStyle,
  children,
  onClose,
  selectedBook,
  styles,
  theme,
}) {
  return (
    <div
      className="scan-modal-scroll"
      style={styles.modal}
      onClick={onClose}
    >
      <div
        style={{
          ...styles.modalContent,
          border: `4px solid ${theme.border}`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={{ ...styles.modalIcon, background: theme.imageBg }}>
            <span className="detail-orbit" style={styles.detailOrbit} />
            <span className="detail-book-core" style={styles.detailBookCore} />
            <span className="detail-lens-core" style={styles.detailLensCore} />
            <span className="detail-spark-one" style={styles.detailSparkOne} />
            <span className="detail-spark-two" style={styles.detailSparkTwo} />
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
