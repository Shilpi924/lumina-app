import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getTodayKey } from "../utils/stringUtils";
import { getDeveloperUsageRef } from "../services/firebaseService";

const DEVELOPER_EMAILS = ["shilpispin@gmail.com"];

export function hasDeveloperAccess(user) {
  return DEVELOPER_EMAILS.includes(String(user?.email || "").toLowerCase());
}

export function useDeveloper(user) {
  const [developerStats, setDeveloperStats] = useState({
    geminiSuccessCalls: 0,
    claudeSuccessCalls: 0,
    apiCallsToday: 0,
    apiCallsWeek: 0,
    apiCallsMonth: 0,
    totalLoginEvents: 0,
    todayLoginEvents: 0,
    recentUniqueUsers: 0,
    registeredUsers: 0,
    lastLoginEmail: "",
    lastLoginMethod: "",
    lastLoginAt: "",
    recentApiLog: [],
  });
  const [developerUsage, setDeveloperUsage] = useState({
    apiCalls: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    successCalls: 0,
    failedCalls: 0,
    lastCallType: "",
    lastStatus: "",
    lastProvider: "",
    lastModel: "",
    lastUserEmail: "",
    lastDurationMs: 0,
  });
  const [developerIpUsage, setDeveloperIpUsage] = useState([]);
  const [developerEvents, setDeveloperEvents] = useState([]);
  const [developerStatsStatus, setDeveloperStatsStatus] = useState("");

  useEffect(() => {
    if (!db || !hasDeveloperAccess(user)) {
      return undefined;
    }

    let cancelled = false;

    async function loadDeveloperStats() {
      try {
        const todayKey = getTodayKey();
        const userCountSnapshot = await getCountFromServer(collection(db, "users"));
        const totalLoginSnapshot = await getCountFromServer(collection(db, "loginEvents"));
        const todayLoginQuery = query(
          collection(db, "loginEvents"),
          where("date", "==", todayKey)
        );
        const todayLoginSnapshot = await getCountFromServer(todayLoginQuery);
        const recentLoginQuery = query(
          collection(db, "loginEvents"),
          orderBy("createdAtMs", "desc"),
          limit(50)
        );
        const recentLoginSnapshot = await getDocs(recentLoginQuery);
        const recentLogins = recentLoginSnapshot.docs.map((eventDoc) => eventDoc.data());
        const lastLogin = recentLogins[0] || {};
        const recentUniqueUsers = new Set(
          recentLogins.map((loginEvent) => loginEvent.userId).filter(Boolean)
        ).size;

        const geminiSuccessSnapshot = await getCountFromServer(
          query(collection(db, "developerApiUsageEvents"), where("provider", "==", "gemini"), where("status", "==", "Success"))
        );
        const claudeSuccessSnapshot = await getCountFromServer(
          query(collection(db, "developerApiUsageEvents"), where("provider", "==", "claude"), where("status", "==", "Success"))
        );

        // Time-windowed API call counts
        const nowDate = new Date();
        const weekAgoKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000));
        const monthAgoKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000));

        const apiCallsTodaySnapshot = await getCountFromServer(
          query(collection(db, "developerApiUsageEvents"), where("date", "==", todayKey))
        );
        const apiCallsWeekSnapshot = await getCountFromServer(
          query(collection(db, "developerApiUsageEvents"), where("date", ">=", weekAgoKey))
        );
        const apiCallsMonthSnapshot = await getCountFromServer(
          query(collection(db, "developerApiUsageEvents"), where("date", ">=", monthAgoKey))
        );

        const recentApiQuery = query(
          collection(db, "developerApiUsageEvents"),
          orderBy("createdAtMs", "desc"),
          limit(20)
        );
        const recentApiSnapshot = await getDocs(recentApiQuery);
        const recentApiLog = recentApiSnapshot.docs.map((eventDoc) => eventDoc.data());

        if (cancelled) return;

        setDeveloperStats({
          geminiSuccessCalls: geminiSuccessSnapshot.data().count || 0,
          claudeSuccessCalls: claudeSuccessSnapshot.data().count || 0,
          apiCallsToday: apiCallsTodaySnapshot.data().count || 0,
          apiCallsWeek: apiCallsWeekSnapshot.data().count || 0,
          apiCallsMonth: apiCallsMonthSnapshot.data().count || 0,
          totalLoginEvents: totalLoginSnapshot.data().count || 0,
          todayLoginEvents: todayLoginSnapshot.data().count || 0,
          recentUniqueUsers,
          registeredUsers: userCountSnapshot.data().count || 0,
          lastLoginEmail: lastLogin.email || "",
          lastLoginMethod: lastLogin.method || "",
          lastLoginAt: lastLogin.createdAtMs
            ? new Date(lastLogin.createdAtMs).toISOString()
            : "",
          recentApiLog,
        });
        setDeveloperStatsStatus("");
      } catch (err) {
        console.error("Could not load developer stats:", err);
        if (!cancelled) {
          setDeveloperStatsStatus("Could not load Firebase developer stats.");
        }
      }
    }

    loadDeveloperStats();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!db || !hasDeveloperAccess(user)) {
      return undefined;
    }

    const usageRef = getDeveloperUsageRef();
    if (!usageRef) return undefined;

    return onSnapshot(
      usageRef,
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setDeveloperUsage({
          apiCalls: Number(data.apiCalls || 0),
          promptTokens: Number(data.promptTokens || 0),
          outputTokens: Number(data.outputTokens || 0),
          totalTokens: Number(data.totalTokens || 0),
          successCalls: Number(data.successCalls || 0),
          failedCalls: Number(data.failedCalls || 0),
          lastCallType: data.lastCallType || "",
          lastStatus: data.lastStatus || "",
          lastProvider: data.lastProvider || "",
          lastModel: data.lastModel || "",
          lastUserEmail: data.lastUserEmail || "",
          lastDurationMs: Number(data.lastDurationMs || 0),
        });
      },
      (err) => {
        console.error("Could not load developer API usage:", err);
      }
    );
  }, [user]);

  useEffect(() => {
    if (!db || !hasDeveloperAccess(user)) {
      return undefined;
    }

    const todayEventsQuery = query(
      collection(db, "developerApiUsageEvents"),
      where("date", "==", getTodayKey())
    );

    return onSnapshot(
      todayEventsQuery,
      (snapshot) => {
        const ipUsageByAddress = new Map();
        const recentEvents = [];

        snapshot.docs.forEach((eventDoc) => {
          const eventData = eventDoc.data();
          recentEvents.push(eventData);

          const ipAddress = eventData.ipAddress || "Unknown IP";
          const totalTokens = Number(
            eventData.totalTokens || eventData.promptTokens || 0
          );
          const currentUsage = ipUsageByAddress.get(ipAddress) || {
            ipAddress,
            apiCalls: 0,
            totalTokens: 0,
            lastCallAt: null,
            emails: new Set(),
            callTypes: new Set(),
          };

          currentUsage.apiCalls += 1;
          currentUsage.totalTokens += totalTokens;
          if (eventData.userEmail) currentUsage.emails.add(eventData.userEmail);
          if (eventData.callType)
            currentUsage.callTypes.add(eventData.callType);
          if (
            !currentUsage.lastCallAt ||
            (eventData.createdAtMs &&
              eventData.createdAtMs > currentUsage.lastCallAt)
          ) {
            currentUsage.lastCallAt = eventData.createdAtMs;
          }

          ipUsageByAddress.set(ipAddress, currentUsage);
        });

        recentEvents.sort((a, b) => {
          return (b.createdAtMs || 0) - (a.createdAtMs || 0);
        });

        const ipUsageList = Array.from(ipUsageByAddress.values())
          .map((usage) => ({
            ...usage,
            emails: Array.from(usage.emails),
            callTypes: Array.from(usage.callTypes),
          }))
          .sort((a, b) => b.apiCalls - a.apiCalls);

        setDeveloperIpUsage(ipUsageList);
        setDeveloperEvents(recentEvents);
      },
      (err) => {
        console.error("Could not load developer IP usage:", err);
      }
    );
  }, [user]);

  return {
    developerStats,
    developerUsage,
    developerIpUsage,
    developerEvents,
    developerStatsStatus,
  };
}
