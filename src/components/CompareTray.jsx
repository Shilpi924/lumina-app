export default function CompareTray({
  compare,
  e,
  setCompare,
  setCompareOpen,
  styles,
}) {
  if (compare.length === 0) {
    return null;
  }

  return (
    <section style={styles.compareTray}>
      <div>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>{e("⚖️", "Compare Books")}</h2>
        <p style={styles.countText}>
          {compare.length === 1
            ? "Choose one more book to compare side by side."
            : `${compare[0].title} vs ${compare[1].title}`}
        </p>
      </div>

      <div style={styles.compareTrayActions}>
        <button style={styles.smallButton} onClick={() => setCompareOpen(true)}>
          {compare.length < 2 ? "View Selection" : "Open Compare"}
        </button>
        <button style={styles.deleteButton} onClick={() => setCompare([])}>
          Clear
        </button>
      </div>
    </section>
  );
}
