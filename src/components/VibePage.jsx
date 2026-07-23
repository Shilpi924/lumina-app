import React from "react";

export default function VibePage({
  user,
  vibeAiLoading,
  handleVibeAiAnalysis,
  vibePhotoInputRef,
  savedFiles,
  readingList,
  books,
  scanHistory,
  vibeAiResult,
  vibeAiPreviews,
  isUserPlus,
  isAnonymousPlus,
  selectedPlusPlan,
  handleStartPlusPurchase,
  PLUS_PLANS,
  vibeStatus,
  setCurrentPage,
  styles,
}) {
  if (!user) {
    return (
      <section style={styles.vibePage}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "64px 24px",
          gap: "16px",
        }}>
          <span style={{ fontSize: "48px" }}>✨</span>
          <h2 style={styles.vibeTitle}>Your shelf has a personality.</h2>
          <p style={{ ...styles.vibeText, maxWidth: "320px" }}>
            Sign in to unlock your Shelf Vibe — a reading personality profile built from your scans and saved books.
          </p>
          <button
            type="button"
            style={styles.authPrimaryButton}
            onClick={() => setCurrentPage("account")}
          >
            Sign in to see your vibe
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.vibePage}>
      <div style={styles.vibeHero}>
        <div>
          <span style={styles.vibeKicker}>Your shelf. Your personality. Uncovered.</span>
          <h2 style={styles.vibeTitle}>We read your shelf. Here&apos;s what we found.</h2>
          <p style={styles.vibeText}>
            Based on the books you scan, save, and keep — Lumina reads between the lines.
            Pick a mood to shift the lens.
          </p>
        </div>
      </div>

      {/* ── AI Personality Reader ── */}
      <div style={styles.vibeSection}>
        <div style={styles.vibeSectionHeader}>
          <div>
            <h3 style={styles.vibeSectionTitle}>✨ AI Reads You</h3>
            <p style={styles.vibeText}>Let AI analyse your shelf and reveal who you really are as a reader.</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
          {/* Photo button */}
          <label
            style={{
              ...styles.authPrimaryButton,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: vibeAiLoading ? "not-allowed" : "pointer",
              opacity: vibeAiLoading ? 0.6 : 1,
            }}
          >
            📷 {vibeAiLoading === "photo" ? "Analysing photo…" : "Scan a shelf photo"}
            <input
              ref={vibePhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              disabled={!!vibeAiLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVibeAiAnalysis("photo", file);
                e.target.value = "";
              }}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              style={{
                ...styles.authSecondaryButton,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                opacity: (vibeAiLoading || (savedFiles.length === 0 && readingList.length === 0)) ? 0.6 : 1,
              }}
              disabled={!!vibeAiLoading || (savedFiles.length === 0 && readingList.length === 0)}
              onClick={() => handleVibeAiAnalysis("saved")}
            >
              📚 {vibeAiLoading === "saved" ? "Reading your shelf…" : "Read my saved books"}
            </button>
            {savedFiles.length === 0 && readingList.length === 0 && (
              <span style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center" }}>
                No saved books yet. Cannot generate AI text.
              </span>
            )}
          </div>

          <button
            type="button"
            style={{
              ...styles.authSecondaryButton,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              opacity: (vibeAiLoading || (books.length === 0 && scanHistory.length === 0)) ? 0.6 : 1,
            }}
            disabled={!!vibeAiLoading || (books.length === 0 && scanHistory.length === 0)}
            onClick={() => handleVibeAiAnalysis("scan")}
          >
            🔍 {vibeAiLoading === "scan" ? "Reading last scan…" : "Read last scan"}
          </button>
        </div>

        {/* Loading state */}
        {vibeAiLoading && (
          <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px", color: "var(--text)" }}>
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%",
              border: "2px solid var(--accent-border)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "14px", fontStyle: "italic" }}>Reading your shelf… this takes a moment.</span>
          </div>
        )}

        {/* AI Result */}
        {vibeAiResult && (
          <div style={{ marginTop: "20px", display: "grid", gap: "20px" }}>
            {/* Personality profile card */}
            <div style={{
              borderRadius: "14px",
              background: "#0d1117",
              color: "#ffffff",
              overflow: "hidden",
              border: "1px solid rgba(37, 99, 235, 0.22)",
              boxShadow: "0 20px 50px rgba(37, 99, 235, 0.12)",
            }}>
              <div style={{
                padding: "20px",
                borderBottom: "1px solid rgba(37, 99, 235, 0.12)",
                background: "rgba(37, 99, 235, 0.06)",
              }}>
                <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#93c5fd", display: "block", marginBottom: "6px" }}>AI reads you</span>
                <h3 style={{ margin: 0, fontSize: "26px", fontWeight: "900", lineHeight: 1.1, color: "#ffffff" }}>{vibeAiResult.personalityTitle}</h3>
              </div>
              <div style={{ padding: "20px", borderBottom: "1px solid rgba(37,99,235,0.08)" }}>
                <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.09em", color: "#60a5fa", display: "block", marginBottom: "10px" }}>Your reader portrait</span>
                {(vibeAiResult.personalityEssay || "").split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : "12px 0 0", color: "rgba(255,255,255,0.88)", fontSize: "15px", lineHeight: 1.65 }}>{para}</p>
                ))}
              </div>
              {vibeAiResult.readingDNA?.length > 0 && (
                <div style={{ padding: "16px 20px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.09em", color: "#a5b4fc", display: "block", marginBottom: "10px" }}>Your reading DNA</span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {vibeAiResult.readingDNA.map((trait) => (
                      <span key={trait} style={{ background: "rgba(37,99,235,0.18)", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", color: "#bfdbfe", fontWeight: "600" }}>{trait}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Book suggestions */}
            {vibeAiResult.suggestions?.length > 0 && (
              <div>
                <h3 style={{ ...styles.vibeSectionTitle, marginBottom: "4px" }}>📖 Your Books</h3>
                <p style={{ fontSize: "13px", color: "var(--text-h)", marginBottom: "16px", fontStyle: "italic", opacity: 0.8 }}>
                  {vibeAiResult.mode === "photo" && "These are personalized AI recommendations based on the books visible in your photo."}
                  {vibeAiResult.mode === "saved" && "These are personalized AI recommendations based on your saved books and reading list."}
                  {vibeAiResult.mode === "scan" && "These are personalized AI recommendations based on your most recently scanned shelf."}
                </p>
                <div style={{ display: "grid", gap: "16px" }}>
                  {vibeAiResult.suggestions.map((book, idx) => {
                    const preview = vibeAiPreviews[book.title];
                    return (
                      <div key={book.title} style={{
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        background: "var(--social-bg)",
                        overflow: "hidden",
                        boxShadow: "0 8px 24px rgba(31,45,61,0.07)",
                      }}>
                        {/* Book header */}
                        <div style={{ padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          <span style={{
                            flexShrink: 0,
                            width: "28px", height: "28px",
                            borderRadius: "8px",
                            background: "var(--accent-bg)",
                            color: "var(--accent)",
                            fontWeight: "800",
                            fontSize: "13px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>{idx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--text-h)", lineHeight: 1.2 }}>{book.title}</h4>
                            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--accent)", fontWeight: "600" }}>{book.author}</p>
                            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text)", lineHeight: 1.45, fontStyle: "italic" }}>{book.reason}</p>
                          </div>
                        </div>
                        {/* Preview embed */}
                        {preview?.status === "ready" && preview.embedUrl && (
                          <div style={{ borderTop: "1px solid var(--border)" }}>
                            <iframe
                              title={`Preview: ${book.title}`}
                              src={preview.embedUrl}
                              style={{ width: "100%", height: "380px", border: "none", display: "block" }}
                            />
                            <div style={{ padding: "8px 16px", background: "var(--code-bg)", display: "flex", justifyContent: "flex-end" }}>
                              <a
                                href={preview.googleBooksReaderLink || `https://books.google.com/books?q=${encodeURIComponent(book.title)}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: "12px", color: "var(--accent)", fontWeight: "600" }}
                              >
                                Open in Google Books →
                              </a>
                            </div>
                          </div>
                        )}
                        {preview?.status === "unavailable" && (
                          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--code-bg)" }}>
                            <span style={{ fontSize: "12px", color: "var(--text)", fontStyle: "italic" }}>No preview available</span>
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(book.title + " " + book.author)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: "10px", fontSize: "12px", color: "var(--accent)", fontWeight: "600" }}
                            >
                              Search online →
                            </a>
                          </div>
                        )}
                        {!preview && (
                          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--code-bg)" }}>
                            <span style={{ fontSize: "12px", color: "var(--text)", fontStyle: "italic" }}>Loading preview…</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!(user ? isUserPlus : isAnonymousPlus) && (
        <div style={styles.vibeSection}>
          <div style={styles.vibeSectionHeader}>
            <div>
              <h3 style={styles.vibeSectionTitle}>Lumina Plus</h3>
            </div>
          </div>
          <div style={styles.vibePlanGrid}>
            {PLUS_PLANS.map((plan) => {
              const isSelected = selectedPlusPlan === plan.id;
              return (
                <article
                  key={plan.id}
                  style={{
                    ...styles.vibePlanCard,
                    ...(isSelected ? styles.vibePlanCardActive : {}),
                  }}
                >
                  <div style={styles.vibeSectionHeader}>
                    <div>
                      <h4 style={styles.vibePlanTitle}>{plan.name}</h4>
                      <p style={styles.vibeText}>{plan.caption}</p>
                    </div>
                    <strong style={styles.vibePlanPrice}>{plan.price}</strong>
                  </div>
                  <ul style={styles.vibePerkList}>
                    {plan.perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    style={isSelected ? styles.authPrimaryButton : styles.authSecondaryButton}
                    onClick={() => handleStartPlusPurchase(plan)}
                  >
                    {isSelected ? "Beta Plus Unlocked" : "Unlock Beta Plus"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {vibeStatus && <p style={styles.vibeStatus}>{vibeStatus}</p>}
    </section>
  );
}
