export default function ScanResultsSection({
  books,
  detectedBooks,
  filteredBooks,
  renderBookCard,
  renderCollapsibleSection,
  styles,
  topBooks,
}) {
  if (books.length === 0) {
    return null;
  }

  if (filteredBooks.length === 1) {
    return renderCollapsibleSection({
      id: "scannedBook",
      title: "Scanned book",
      meta: "1",
      defaultOpen: true,
      children: (
        <div style={styles.grid}>
          {filteredBooks.map((book, index) =>
            renderBookCard(book, index, { prefix: "single", topPick: true })
          )}
        </div>
      ),
    });
  }

  return (
    <>
      {renderCollapsibleSection({
        id: "topPicks",
        title: "Top picks",
        meta: `${topBooks.length}`,
        defaultOpen: true,
        children:
          topBooks.length === 0 ? (
            <p style={styles.error}>No top picks match your search.</p>
          ) : (
            <div style={styles.grid}>
              {topBooks.map((book, index) =>
                renderBookCard(book, index, { prefix: "top", topPick: true })
              )}
            </div>
          ),
      })}

      {books.length > 3 &&
        renderCollapsibleSection({
          id: "detectedBooks",
          title: "Detected books",
          meta: `${detectedBooks.length}`,
          defaultOpen: true,
          children: (
            <div style={styles.grid}>
              {detectedBooks.length === 0 ? (
                <p style={styles.error}>
                  {filteredBooks.length === 0
                    ? "No matching books found. Try another word."
                    : "All matching books are already shown in Top Picks."}
                </p>
              ) : (
                detectedBooks.map((book, index) =>
                  renderBookCard(book, index, { prefix: "detected" })
                )
              )}
            </div>
          ),
        })}
    </>
  );
}
