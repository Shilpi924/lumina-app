export default function ScanLandingSection({
  anonymousScanCount,
  authReady,
  books,
  cameraIdle,
  e,
  error,
  handleBarcodeScan,
  handleImage,
  handleScanPickerClick,
  homeGreeting,
  imagePreview,
  isAnonymousPlus,
  isFirebaseConfigured,
  isOffline,
  isUserPlus,
  loading,
  openManualBookModal,
  renderFilterControls,
  setBooks,
  setCameraIdle,
  setCompare,
  setCompareOpen,
  setError,
  setImagePreview,
  setSaveStatus,
  setSelectedBook,
  setSimilarBooksView,
  shelfPhotoHistory,
  styles,
  user,
  userScanCount,
}) {
  return (
    <>
      <section
        className="greeting-enter"
        style={{
          ...styles.homeGreetingPanel,
          textAlign: "center",
          border: "none",
          boxShadow: "none",
          background: "transparent",
          padding: "0",
          margin: "16px 0 0",
        }}
      >
        {authReady && (
          <h2 style={{ ...styles.homeGreetingTitle, fontSize: "24px", fontWeight: "700" }}>
            {homeGreeting}
          </h2>
        )}
        <div
          style={{
            marginTop: "8px",
            fontSize: "14px",
            color: "#64748b",
            display: "flex",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          {(user ? isUserPlus : isAnonymousPlus) ? (
            <span
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent)",
                padding: "4px 10px",
                borderRadius: "12px",
                fontWeight: "600",
              }}
            >
              ✨ Plus: Unlimited Scans
            </span>
          ) : (user ? userScanCount : anonymousScanCount) > 0 ? (
            <>
              <span>
                Scans used: <strong>{user ? userScanCount : anonymousScanCount} / {user ? 10 : 3}</strong>
              </span>
              <span>Plus: <strong>Unlimited</strong></span>
            </>
          ) : null}
        </div>
      </section>

      <div
        className="scan-buttons-enter"
        style={{ ...styles.uploadBox, display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}
      >
        <label
          className={`btn-press${cameraIdle && !books.length && !imagePreview && !loading ? " camera-btn-pulse" : ""}`}
          style={{
            ...styles.cameraButton,
            ...(!isFirebaseConfigured ? styles.scanButtonNeedsAuth : {}),
            ...(isOffline ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            margin: 0,
          }}
          onClick={() => {
            setCameraIdle(false);
            handleScanPickerClick();
          }}
        >
          {e("📷", "Take Photo")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={isOffline}
            onChange={(event) => handleImage(event.target.files[0])}
          />
        </label>

        <label
          className="btn-press"
          style={{
            ...styles.uploadPhotoButton,
            ...(isOffline ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            margin: 0,
          }}
          onClick={() => {
            setCameraIdle(false);
          }}
        >
          {e("➕", "Upload Photo")}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={isOffline}
            onChange={(event) => handleImage(event.target.files[0])}
          />
        </label>

        <button
          type="button"
          className="btn-press"
          style={{
            ...styles.uploadPhotoButton,
            ...(isOffline ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            margin: 0,
            background: "var(--accent-bg)",
            color: "var(--accent)",
          }}
          onClick={handleBarcodeScan}
          disabled={isOffline || loading}
        >
          {e("🏷️", "Scan Barcode")}
        </button>

        <button
          type="button"
          className="btn-press"
          style={{
            ...styles.manualBookButton,
            ...(isOffline ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            margin: 0,
          }}
          disabled={isOffline}
          onClick={openManualBookModal}
        >
          {e("✍️", "Add Book Manually")}
        </button>
      </div>

      {renderFilterControls()}

      {imagePreview && (
        <div style={styles.previewBlock}>
          <img src={imagePreview} alt="Bookshelf" style={styles.preview} />
          <button
            type="button"
            style={styles.clearPreviewButton}
            onClick={() => {
              setImagePreview(null);
              setBooks([]);
              setSelectedBook(null);
              setCompare([]);
              setCompareOpen(false);
              setSimilarBooksView(null);
              setError("");
              setSaveStatus(null);
            }}
          >
            Clear scanned image
          </button>
        </div>
      )}

      {shelfPhotoHistory.length > 1 && (
        <div style={{ padding: "0 16px 12px" }}>
          <p style={{ fontSize: "12px", color: "#718096", marginBottom: "8px", fontWeight: "600" }}>
            Shelf Photo History ({shelfPhotoHistory.length}/5)
          </p>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
            {shelfPhotoHistory.map((url, idx) => (
              <button
                key={url}
                type="button"
                onClick={() => setImagePreview(url)}
                aria-label={`Shelf photo ${idx + 1}`}
                style={{
                  padding: 0,
                  border: url === imagePreview ? "2px solid #6366f1" : "2px solid transparent",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: "none",
                  flexShrink: 0,
                }}
              >
                <img
                  src={url}
                  alt={`Shelf ${idx + 1}`}
                  style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px", display: "block" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </>
  );
}
