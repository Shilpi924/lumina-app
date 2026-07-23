import React, { useState } from "react";
import { generateClaudeContent, getClaudeText } from "../services/claudeService";

export default function CompareBooksModal({
  compare,
  setCompare,
  setCompareOpen,
  styles,
}) {
  const [aiReport, setAiReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const book1 = compare[0];
  const book2 = compare[1];

  async function generateCompareReport() {
    if (!book1 || !book2) return;
    setLoading(true);
    setError("");
    setAiReport("");

    try {
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: `Compare these two books:
Book 1:
Title: ${book1.title}
Author: ${book1.author}
Genre: ${book1.genre}
Description/Summary: ${book1.summary || "Not listed"}
Why Read: ${book1.whyRead || "Not listed"}

Book 2:
Title: ${book2.title}
Author: ${book2.author}
Genre: ${book2.genre}
Description/Summary: ${book2.summary || "Not listed"}
Why Read: ${book2.whyRead || "Not listed"}

Write a clean, insightful analysis in exactly 3 short paragraphs:
Paragraph 1: The core thematic similarities between the two books.
Paragraph 2: The key differences in narrative pace, tone, or style.
Paragraph 3: A clear recommendation on who would prefer which book, or which one to read first.

Use friendly, readable language. Do not output markdown titles or headers.`
            }
          ]
        }
      ];

      const result = await generateClaudeContent(contents, { maxOutputTokens: 1024 }, "Book comparison");
      const text = getClaudeText(result);
      if (text) {
        setAiReport(text);
      } else {
        setError("AI comparison failed to return analysis text.");
      }
    } catch (err) {
      console.error("AI Comparison Error:", err);
      setError("Failed to generate AI report. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function getComparedValue(book, field) {
    if (!book) return "—";
    return book[field] || "Not listed";
  }

  return (
    <div style={styles.modal} onClick={() => setCompareOpen(false)}>
      <div 
        style={{
          ...styles.compareModalContent,
          maxWidth: "760px",
          width: "90%",
          padding: "24px",
          borderRadius: "16px",
          backdropFilter: "blur(16px)",
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow)"
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ ...styles.previewHeader, borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "16px" }}>
          <div>
            <h2 style={{ ...styles.modalTitle, margin: 0, fontSize: "22px", fontWeight: "800", color: "var(--text-h)" }}>
              ⚖️ Side-by-Side Comparison
            </h2>
            <p style={{ ...styles.previewSubtitle, margin: "4px 0 0", fontSize: "14px", color: "var(--text)" }}>
              Compare ratings, themes, levels, and summaries of selected books.
            </p>
          </div>
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "bold",
              color: "var(--text)",
              padding: "4px 8px"
            }}
            onClick={() => setCompareOpen(false)}
            aria-label="Close compare"
          >
            ✕
          </button>
        </div>

        {/* Comparison grid content */}
        <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr", gap: "12px", fontSize: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <div style={{ fontWeight: "700", color: "var(--text-l)" }}>Feature</div>
            <div style={{ fontWeight: "800", color: "var(--accent)", fontSize: "15px" }}>{book1?.title || "Book 1"}</div>
            <div style={{ fontWeight: "800", color: "var(--accent)", fontSize: "15px" }}>{book2?.title || "Book 2"}</div>
          </div>

          {[
            { label: "Author", field: "author" },
            { label: "Rating", field: "rating" },
            { label: "Genre", field: "genre" },
            { label: "Reading Level", field: "readingLevel" },
            { label: "Grade Band", field: "gradeBand" },
            { label: "Age Group", field: "ageRecommendation" },
            { label: "Why Read", field: "whyRead" },
            { label: "Summary", field: "summary" },
          ].map((row, idx) => (
            <div 
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 1fr",
                gap: "12px",
                padding: "10px 0",
                fontSize: "14px",
                borderBottom: "1px solid var(--border)",
                backgroundColor: idx % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent"
              }}
            >
              <div style={{ fontWeight: "700", color: "var(--text-l)" }}>{row.label}</div>
              <div style={{ color: "var(--text)" }}>{getComparedValue(book1, row.field)}</div>
              <div style={{ color: "var(--text)" }}>{getComparedValue(book2, row.field)}</div>
            </div>
          ))}

          {/* AI Comparison Analysis */}
          {book1 && book2 && (
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "2px dashed var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--text-h)" }}>
                  ✨ Lumina AI Match Report
                </h3>
                {!aiReport && !loading && (
                  <button
                    onClick={generateCompareReport}
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    Generate Report
                  </button>
                )}
              </div>

              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text)", padding: "12px", background: "var(--code-bg)", borderRadius: "8px" }}>
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "50%",
                    border: "2px solid var(--accent-border)",
                    borderTopColor: "var(--accent)",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <span style={{ fontSize: "13px", fontStyle: "italic" }}>Claude is reading between the lines...</span>
                </div>
              )}

              {error && (
                <p style={{ margin: 0, padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#ef4444", fontSize: "13px" }}>
                  ⚠️ {error}
                </p>
              )}

              {aiReport && (
                <div 
                  style={{
                    padding: "16px",
                    background: "var(--code-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    lineHeight: "1.6",
                    fontSize: "14px",
                    color: "var(--text)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}
                >
                  {aiReport.split("\n\n").filter(Boolean).map((para, i) => (
                    <p key={i} style={{ margin: 0 }}>{para}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button
            style={{
              background: "transparent",
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer"
            }}
            onClick={() => {
              setCompare([]);
              setCompareOpen(false);
            }}
          >
            Clear Selection
          </button>
          <button
            style={{
              background: "var(--code-bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer"
            }}
            onClick={() => setCompareOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
