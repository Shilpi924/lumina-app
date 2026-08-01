import { useMemo } from "react";
import { getTodayKey, getTimeGreeting } from "../utils/stringUtils";

export default function HomeDashboard({
  readingList,
  readingDna,
  scanHistory,
  user,
  onNavigateToScan,
  onNavigateToVibe,
  onNavigateToDna,
  onNavigateToSaved,
}) {
  const greeting = useMemo(() => {
    const name = user?.displayName || "Reader";
    return `${getTimeGreeting(new Date())}, ${name}`;
  }, [user]);

  const streak = useMemo(() => {
    const sortedHistory = Array.isArray(scanHistory) ? [...scanHistory].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ) : [];

    let currentStreak = 0;
    let checkDate = new Date();

    for (const scan of sortedHistory) {
      if (!scan?.createdAt) continue;
      const scanDate = new Date(scan.createdAt).toISOString().split("T")[0];
      const checkDateStr = checkDate.toISOString().split("T")[0];

      if (scanDate === checkDateStr) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (scanDate === new Date(checkDate.getTime() - 86400000).toISOString().split("T")[0]) {
        checkDate.setDate(checkDate.getDate() - 1);
        currentStreak++;
      } else {
        break;
      }
    }

    return currentStreak;
  }, [scanHistory]);

  const totalBooks = Array.isArray(readingList) ? readingList.length : 0;
  const totalScans = Array.isArray(scanHistory) ? scanHistory.length : 0;

  const dailyInsight = useMemo(() => {
    const insights = [
      { icon: "📚", title: "Keep the momentum", text: `You've scanned ${totalScans} books. Your curiosity is building a knowledge network.` },
      { icon: "🧠", title: "Neural connections forming", text: readingDna?.length > 0 ? `Your reading DNA shows ${readingDna.length} unique traits.` : "Scan more books to discover your reading DNA." },
      { icon: "🌟", title: "Consistency wins", text: streak > 0 ? `${streak} day streak! Small daily actions compound into wisdom.` : "Start your streak today!" },
      { icon: "🔮", title: "Knowledge awaits", text: "Every book you scan adds to your personal knowledge graph." },
    ];
    return insights[getTodayKey().split("-").reduce((sum, part) => sum + Number(part), 0) % insights.length];
  }, [totalScans, readingDna, streak]);

  const quickActions = [
    {
      icon: "📷",
      label: "Scan Book",
      description: "Digitize your shelf",
      onClick: onNavigateToScan,
      color: "var(--accent)",
      bg: "var(--accent-bg)",
    },
    {
      icon: "✦",
      label: "Get Vibe",
      description: "AI recommendations",
      onClick: onNavigateToVibe,
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.1)",
    },
    {
      icon: "🧬",
      label: "View DNA",
      description: "Your reading profile",
      onClick: onNavigateToDna,
      color: "#06b6d4",
      bg: "rgba(6, 182, 212, 0.1)",
    },
    {
      icon: "▤",
      label: "My Stash",
      description: `${totalBooks} books saved`,
      onClick: onNavigateToSaved,
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
    },
  ];

  const recentScans = useMemo(() => {
    if (!Array.isArray(scanHistory)) return [];
    return [...scanHistory]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
  }, [scanHistory]);

  return (
    <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", margin: "0 0 8px 0", color: "var(--text)" }}>
          {greeting}
        </h1>
        <p style={{ fontSize: "15px", color: "#64748b", margin: 0 }}>
          Your knowledge is growing. What will you discover today?
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
        gap: "12px", 
        marginBottom: "24px" 
      }}>
        <div style={{ 
          background: "var(--card-bg)", 
          borderRadius: "12px", 
          padding: "16px", 
          border: "1px solid var(--border)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "var(--accent)", margin: "0 0 4px 0" }}>
            {streak}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
            Day Streak
          </div>
        </div>
        <div style={{ 
          background: "var(--card-bg)", 
          borderRadius: "12px", 
          padding: "16px", 
          border: "1px solid var(--border)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#8b5cf6", margin: "0 0 4px 0" }}>
            {totalBooks}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
            Books Saved
          </div>
        </div>
        <div style={{ 
          background: "var(--card-bg)", 
          borderRadius: "12px", 
          padding: "16px", 
          border: "1px solid var(--border)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#06b6d4", margin: "0 0 4px 0" }}>
            {totalScans}
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
            Total Scans
          </div>
        </div>
      </div>

      {/* Daily Insight Card */}
      <div style={{ 
        background: "linear-gradient(135deg, var(--accent-bg) 0%, rgba(139, 92, 246, 0.1) 100%)",
        borderRadius: "16px", 
        padding: "20px", 
        marginBottom: "24px",
        border: "1px solid var(--accent-border)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
          <span style={{ fontSize: "40px", lineHeight: 1 }}>{dailyInsight.icon}</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 8px 0", color: "var(--text)" }}>
              {dailyInsight.title}
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              {dailyInsight.text}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 16px 0", color: "var(--text)" }}>
          Quick Actions
        </h2>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
          gap: "12px" 
        }}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              style={{
                background: action.bg,
                border: `1px solid ${action.color}20`,
                borderRadius: "12px",
                padding: "20px 16px",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = `0 4px 12px ${action.color}30`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>
                {action.icon}
              </span>
              <div style={{ fontSize: "15px", fontWeight: "700", color: action.color, marginBottom: "4px" }}>
                {action.label}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                {action.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentScans.length > 0 && (
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 16px 0", color: "var(--text)" }}>
            Recent Scans
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                style={{
                  background: "var(--card-bg)",
                  borderRadius: "12px",
                  padding: "16px",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div style={{ 
                  width: "48px", 
                  height: "48px", 
                  borderRadius: "8px", 
                  background: "var(--accent-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px"
                }}>
                  📚
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>
                    {scan.bookCount} {scan.bookCount === 1 ? "book" : "books"} scanned
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {new Date(scan.createdAt).toLocaleDateString()} · {scan.model}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for New Users */}
      {totalScans === 0 && (
        <div style={{
          background: "var(--card-bg)",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
          border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🚀</span>
          <h3 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 8px 0", color: "var(--text)" }}>
            Start Your Knowledge Journey
          </h3>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px 0", lineHeight: 1.5 }}>
            Scan your first book to begin building your personal knowledge graph. 
            Lumina will help you discover patterns, track your growth, and surface intelligent recommendations.
          </p>
          <button
            type="button"
            onClick={onNavigateToScan}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Scan Your First Book
          </button>
        </div>
      )}
    </div>
  );
}
