export default function BookDetailSummaryGrid({
  bookFolders,
  folders,
  getBookKey,
  getScanConfidenceDisplayLabel,
  getVisibleFolders,
  handleFolderSelect,
  newFolderOption,
  selectedBook,
  styles,
}) {
  return (
    <div style={styles.detailGrid}>
      <div style={styles.detailMiniCard}>
        <b>⭐ Rating</b>
        <p>{selectedBook.rating}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>🔎 Source</b>
        <p>{selectedBook.ratingSource || "Estimated"}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>🎨 Genre</b>
        <p>{selectedBook.genre}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>🎯 Age</b>
        <p>{selectedBook.ageRecommendation}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>📈 Level</b>
        <p>{selectedBook.readingLevel}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>🏫 Grade</b>
        <p>{selectedBook.gradeBand || "Not listed"}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>✅ Confidence</b>
        <p>{getScanConfidenceDisplayLabel(selectedBook)}</p>
      </div>

      <div style={styles.detailMiniCard}>
        <b>📁 Folder</b>
        <select
          style={{
            ...styles.inlineSelect,
            width: "100%",
            marginTop: "6px",
            fontSize: "12px",
            border: "1px solid rgba(34, 49, 71, 0.15)",
            background: "#fff",
            cursor: "pointer",
          }}
          value={bookFolders[getBookKey(selectedBook)] || "Want to read"}
          onChange={(event) => handleFolderSelect(selectedBook, event.target.value)}
          aria-label="Book folder"
        >
          {getVisibleFolders(folders).map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
          <option value={newFolderOption}>Add new folder...</option>
        </select>
      </div>
    </div>
  );
}
