import { useState } from "react";

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
  const [sortOrder, setSortOrder] = useState("dateSaved");
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
    const list = [...booksMap.values()];

    if (sortOrder === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortOrder === "author") {
      list.sort((a, b) => (a.author || "").localeCompare(b.author || ""));
    } else if (sortOrder === "readingStatus") {
      const weight = { "Reading": 1, "Finished": 2, "To Read": 3 };
      list.sort((a, b) => (weight[a.readingStatus || "To Read"] || 3) - (weight[b.readingStatus || "To Read"] || 3));
    } else {
      list.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
    }

    return list;
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
        <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>Sort by</span>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card-bg)",
            color: "var(--text)",
            fontWeight: "600",
            fontSize: "13px",
          }}
        >
          <option value="dateSaved">Date Saved</option>
          <option value="title">Title</option>
          <option value="author">Author</option>
          <option value="readingStatus">Reading Status</option>
        </select>
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
