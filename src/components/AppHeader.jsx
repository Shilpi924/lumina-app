import playStoreLogo from "../../play-store-assets/app-icon-512.png";

export default function AppHeader({
  currentPage,
  resetPage,
  setCurrentPage,
  user,
  styles,
}) {
  return (
    <div style={styles.hero}>
      <div style={styles.heroText}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            style={{ ...styles.brandButton, flex: 1 }}
            onClick={resetPage}
            aria-label="Reset Lumina"
          >
            <div style={styles.brandMark} aria-hidden="true">
              <img src={playStoreLogo} alt="" style={styles.brandMarkImage} />
            </div>
            <h1 style={styles.title}>Lumina</h1>
          </button>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              backgroundColor: "rgba(34, 49, 71, 0.05)",
            }}
            onClick={() => setCurrentPage("account")}
            aria-label="Account"
          >
            {user?.customPhotoURL || user?.photoURL ? (
              <img
                src={user.customPhotoURL || user.photoURL}
                alt="Profile"
                style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="#1e293b"/>
              </svg>
            )}
          </button>
        </div>
        {currentPage === "scan" && (
          <div style={{ marginTop: "12px", textAlign: "center" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0", color: "#1e293b", textAlign: "center" }}>
              Take a photo of your bookshelf
            </h2>
            <p style={{ ...styles.homeSubtitleBody, textAlign: "center", color: "#1e293b" }}>
              Lumina will identify the books, organize them, and help you
              choose what to read next.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
