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
  streak: streakProp,
  hasReadToday = false,
  weeklyHistory = [],
  onCheckIn,
}) {
  const greeting = useMemo(() => {
    const name = user?.displayName || "Reader";
    return `${getTimeGreeting(new Date())}, ${name}`;
  }, [user]);

  const scanStreak = useMemo(() => {
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

  const activeStreak = typeof streakProp === "number" ? streakProp : scanStreak;

  const totalBooks = Array.isArray(readingList) ? readingList.length : 0;
  const totalScans = Array.isArray(scanHistory) ? scanHistory.length : 0;

  const dailyInsight = useMemo(() => {
    const insights = [
      { icon: "📚", title: "Keep the momentum", text: `You've scanned ${totalScans} books. Your curiosity is building a knowledge network.` },
      { icon: "🧠", title: "Neural connections forming", text: readingDna?.length > 0 ? `Your reading DNA shows ${readingDna.length} unique traits.` : "Scan more books to discover your reading DNA." },
      { icon: "🌟", title: "Consistency wins", text: activeStreak > 0 ? `${activeStreak} day streak! Small daily actions compound into wisdom.` : "Start your streak today!" },
      { icon: "🔮", title: "Knowledge awaits", text: "Every book you scan adds to your personal knowledge graph." },
    ];
    return insights[getTodayKey().split("-").reduce((sum, part) => sum + Number(part), 0) % insights.length];
  }, [totalScans, readingDna, activeStreak]);

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
      {/* Compact Header & Stats Bar */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        flexWrap: "wrap", 
        gap: "12px",
        marginBottom: "16px",
        paddingBottom: "12px",
        borderBottom: "1px solid var(--border)"
      }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <h1 style={{ fontSize: "clamp(18px, 5vw, 22px)", fontWeight: "800", margin: "0 0 4px 0", color: "var(--text)" }}>
            {greeting}
          </h1>
          <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "var(--text-l)", margin: 0 }}>
            Your knowledge is growing. What will you discover today?
          </p>
        </div>

        {/* Compact Horizontal Stats Bar (Pill Design) */}
        <div style={{ 
          display: "flex", 
          gap: "6px", 
          backgroundColor: "var(--card-bg)", 
          border: "1px solid var(--border)", 
          borderRadius: "20px", 
          padding: "6px 12px",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "clamp(11px, 3vw, 13px)" }}>
            <span style={{ color: "var(--accent)", fontWeight: "800" }}>{activeStreak}</span>
            <span style={{ color: "var(--text-l)", fontSize: "clamp(10px, 2.5vw, 11px)", fontWeight: "600" }}>Streak</span>
          </div>
          <span style={{ color: "var(--border)", fontSize: "clamp(10px, 2.5vw, 12px)" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "clamp(11px, 3vw, 13px)" }}>
            <span style={{ color: "#8b5cf6", fontWeight: "800" }}>{totalBooks}</span>
            <span style={{ color: "var(--text-l)", fontSize: "clamp(10px, 2.5vw, 11px)", fontWeight: "600" }}>Saved</span>
          </div>
          <span style={{ color: "var(--border)", fontSize: "clamp(10px, 2.5vw, 12px)" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "clamp(11px, 3vw, 13px)" }}>
            <span style={{ color: "#06b6d4", fontWeight: "800" }}>{totalScans}</span>
            <span style={{ color: "var(--text-l)", fontSize: "clamp(10px, 2.5vw, 11px)", fontWeight: "600" }}>Scans</span>
          </div>
        </div>
      </div>

      {/* Reading Habit & Streak Tracker Widget */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)",
        borderRadius: "16px",
        padding: "16px 20px",
        marginBottom: "16px",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🔥</span>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--text)" }}>
                {activeStreak > 0 ? `${activeStreak} Day Reading Streak` : "Start Your Daily Reading Habit"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-l)" }}>
                {hasReadToday ? "Goal achieved today! Keep the flame alive ✨" : "Check in today to keep your streak burning"}
              </div>
            </div>
          </div>
          {!hasReadToday && onCheckIn && (
            <button
              type="button"
              onClick={onCheckIn}
              style={{
                background: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(249, 115, 22, 0.3)",
                transition: "transform 0.15s ease",
              }}
            >
              Check In Today ⚡
            </button>
          )}
        </div>

        {Array.isArray(weeklyHistory) && weeklyHistory.length > 0 && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg)",
            borderRadius: "12px",
            padding: "8px 12px",
            border: "1px solid var(--border)",
          }}>
            {weeklyHistory.map((day) => (
              <div
                key={day.date}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{
                  fontSize: "10px",
                  fontWeight: day.isToday ? "800" : "600",
                  color: day.isToday ? "var(--accent)" : "var(--text-l)",
                  textTransform: "uppercase",
                }}>
                  {day.dayName}
                </span>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: "800",
                  background: day.active
                    ? "linear-gradient(135deg, #f97316 0%, #ef4444 100%)"
                    : day.isToday
                    ? "rgba(249, 115, 22, 0.15)"
                    : "var(--border)",
                  color: day.active ? "#fff" : day.isToday ? "#ea580c" : "var(--text-l)",
                  border: day.isToday ? "2px solid #f97316" : "none",
                  boxShadow: day.active ? "0 2px 6px rgba(249, 115, 22, 0.35)" : "none",
                }}>
                  {day.active ? "✓" : day.isToday ? "•" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Insight Card */}
      <div style={{ 
        background: "linear-gradient(135deg, var(--accent-bg) 0%, rgba(139, 92, 246, 0.1) 100%)",
        borderRadius: "16px", 
        padding: "clamp(16px, 4vw, 20px)", 
        marginBottom: "24px",
        border: "1px solid var(--accent-border)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "clamp(12px, 3vw, 16px)" }}>
          <span style={{ fontSize: "clamp(32px, 8vw, 40px)", lineHeight: 1 }}>{dailyInsight.icon}</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "clamp(16px, 4vw, 18px)", fontWeight: "700", margin: "0 0 8px 0", color: "var(--text)" }}>
              {dailyInsight.title}
            </h3>
            <p style={{ fontSize: "clamp(13px, 3vw, 14px)", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              {dailyInsight.text}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "clamp(16px, 4vw, 18px)", fontWeight: "700", margin: "0 0 16px 0", color: "var(--text)" }}>
          Quick Actions
        </h2>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
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
                padding: "clamp(16px, 4vw, 20px) clamp(12px, 3vw, 16px)",
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
              <span style={{ fontSize: "clamp(28px, 7vw, 32px)", display: "block", marginBottom: "8px" }}>
                {action.icon}
              </span>
              <div style={{ fontSize: "clamp(14px, 3.5vw, 15px)", fontWeight: "700", color: action.color, marginBottom: "4px" }}>
                {action.label}
              </div>
              <div style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color: "#64748b" }}>
                {action.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentScans.length > 0 && (
        <div>
          <h2 style={{ fontSize: "clamp(16px, 4vw, 18px)", fontWeight: "700", margin: "0 0 16px 0", color: "var(--text)" }}>
            Recent Scans
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                style={{
                  background: "var(--card-bg)",
                  borderRadius: "12px",
                  padding: "clamp(12px, 3vw, 16px)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "clamp(10px, 3vw, 12px)",
                }}
              >
                <div style={{
                  width: "clamp(40px, 10vw, 48px)",
                  height: "clamp(40px, 10vw, 48px)",
                  borderRadius: "8px",
                  background: "var(--accent-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "clamp(20px, 5vw, 24px)"
                }}>
                  📚
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "clamp(13px, 3vw, 14px)", fontWeight: "600", color: "var(--text)" }}>
                    {scan.bookCount} {scan.bookCount === 1 ? "book" : "books"} scanned
                  </div>
                  <div style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color: "#64748b" }}>
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
          padding: "clamp(24px, 6vw, 32px)",
          textAlign: "center",
          border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: "clamp(40px, 10vw, 48px)", display: "block", marginBottom: "16px" }}>🚀</span>
          <h3 style={{ fontSize: "clamp(16px, 4vw, 18px)", fontWeight: "700", margin: "0 0 8px 0", color: "var(--text)" }}>
            Start Your Knowledge Journey
          </h3>
          <p style={{ fontSize: "clamp(13px, 3vw, 14px)", color: "#64748b", margin: "0 0 20px 0", lineHeight: 1.5 }}>
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
              padding: "clamp(10px, 3vw, 12px) clamp(20px, 5vw, 24px)",
              fontSize: "clamp(13px, 3vw, 14px)",
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
