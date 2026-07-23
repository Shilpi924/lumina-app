import React from "react";

export default function SavedBooksPage({
  folders,
  readingList,
  savedFiles,
  bookFolders,
  bookTags,
  activeTagFilter,
  setActiveTagFilter,
  createFolder,
  deleteFolder,
  styles,
  getBookKey,
  getVisibleFolders,
  getFolderDisplayLabel,
  renderCollapsibleSection,
  renderBookCard,
  saveStatus,
  AVAILABLE_TAGS,
  renderFavorites,
  renderSavedFiles,
  renderScanHistory,
}) {
  const visibleFolders = getVisibleFolders(folders);

  const unifiedBooks = (() => {
    const booksMap = new Map();
    readingList.forEach((book) => {
      booksMap.set(getBookKey(book), book);
    });
    savedFiles.forEach((file) => {
      if (file.payload?.catalogBook) {
        const key = getBookKey(file.payload.catalogBook);
        if (!booksMap.has(key)) {
          booksMap.set(key, file.payload.catalogBook);
        }
      }
    });
    return [...booksMap.values()];
  })();

  return (
    <section style={styles.pagePanel}>
      <div style={styles.authHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={styles.authTitle}>My Haul 📚</h2>
          <button
            type="button"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              color: "var(--accent)",
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}
            onClick={createFolder}
            aria-label="Add folder"
          >
            +
          </button>
        </div>
      </div>

      {saveStatus?.type === "folder" && (
        <p style={styles.saveStatus}>{saveStatus.message}</p>
      )}

      <div style={{ display: "flex", gap: "8px", padding: "0 16px", overflowX: "auto" }}>
        {AVAILABLE_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
            style={{
              background: activeTagFilter === tag ? "var(--accent-bg)" : "var(--card-bg)",
              border: activeTagFilter === tag ? "1px solid var(--accent)" : "1px solid var(--border)",
              color: activeTagFilter === tag ? "var(--accent)" : "inherit",
              borderRadius: "16px",
              padding: "4px 12px",
              fontSize: "14px",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
        {visibleFolders.map((folderName) => {
          const folderBooks = unifiedBooks.filter(
            (book) => {
              const bookKey = getBookKey(book);
              const matchesFolder = (bookFolders[bookKey] || "Want to read") === folderName;
              const matchesTag = !activeTagFilter || (bookTags[bookKey] && bookTags[bookKey].includes(activeTagFilter));
              return matchesFolder && matchesTag;
            }
          );
          const isDeletable = folderName !== "Want to read";

          return renderCollapsibleSection({
            id: `folder-${folderName}`,
            title: getFolderDisplayLabel(folderName),
            meta: `${folderBooks.length}`,
            defaultOpen: folderName === "Want to read" || folderBooks.length > 0,
            style: {
              background: "var(--code-bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              margin: 0,
            },
            headerAction: isDeletable ? (
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(folderName);
                }}
              >
                Delete
              </button>
            ) : null,
            children: (
              <>
                {folderBooks.length === 0 ? (
                  <p style={{ ...styles.countText, padding: "12px 0 0" }}>No books in this folder.</p>
                ) : (
                  <div style={{ ...styles.grid, padding: "12px 0 0" }}>
                    {folderBooks.map((book, index) =>
                      renderBookCard(book, index, { prefix: "library" })
                    )}
                  </div>
                )}
              </>
            )
          });
        })}
      </div>

      {renderFavorites("library")}
      {renderSavedFiles("library")}
      {renderScanHistory("library")}
    </section>
  );
}
