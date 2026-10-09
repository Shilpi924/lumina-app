import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "lumina_reading_streak_v2";

function formatDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return Infinity;
  const d1 = new Date(dateStr1 + "T00:00:00");
  const d2 = new Date(dateStr2 + "T00:00:00");
  const diffTime = Math.abs(d2 - d1);
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function useReadingStreak() {
  const [streakData, setStreakData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to parse reading streak from storage:", e);
    }
    return {
      streak: 0,
      lastActiveDate: null,
      history: {}, // { "YYYY-MM-DD": true }
    };
  });

  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  // Compute active streak taking current date into account
  const currentStreak = useMemo(() => {
    if (!streakData.lastActiveDate || streakData.streak === 0) return 0;
    const diff = getDayDifference(streakData.lastActiveDate, todayKey);
    // If last active was today or yesterday, streak is intact; otherwise broken
    if (diff <= 1) {
      return streakData.streak;
    }
    return 0;
  }, [streakData, todayKey]);

  const hasReadToday = useMemo(() => {
    return streakData.lastActiveDate === todayKey;
  }, [streakData, todayKey]);

  // Last 7 days status for weekly habit tracker
  const weeklyHistory = useMemo(() => {
    const days = [];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      const isToday = key === todayKey;
      const active = Boolean(streakData.history?.[key]);
      days.push({
        date: key,
        dayName: dayLabels[d.getDay()],
        active,
        isToday,
      });
    }
    return days;
  }, [streakData.history, todayKey]);

  const recordActivity = useCallback(() => {
    const today = formatDateKey(new Date());
    setStreakData((prev) => {
      if (prev.lastActiveDate === today) {
        // Already recorded today
        return prev;
      }

      let newStreak = 1;
      if (prev.lastActiveDate) {
        const diff = getDayDifference(prev.lastActiveDate, today);
        if (diff === 1) {
          // Yesterday was active, increment streak
          newStreak = (prev.streak || 0) + 1;
        } else if (diff === 0) {
          newStreak = prev.streak || 1;
        } else {
          // Streak broken, reset to 1
          newStreak = 1;
        }
      }

      const nextData = {
        streak: newStreak,
        lastActiveDate: today,
        history: {
          ...(prev.history || {}),
          [today]: true,
        },
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      } catch (e) {
        console.warn("Failed to persist reading streak:", e);
      }

      return nextData;
    });
  }, []);

  return {
    streak: currentStreak,
    hasReadToday,
    weeklyHistory,
    recordActivity,
  };
}
