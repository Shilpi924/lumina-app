import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUserDisplayName, sanitizeDisplayName, getTodayKey } from "../utils/stringUtils";

export const APP_STATE_DOC = "bookCompass";
export const API_USAGE_COLLECTION = "developerApiUsage";

export function getUserAppStateRef(uid) {
  if (!db || !uid) return null;
  return doc(db, "users", uid, "appData", APP_STATE_DOC);
}

export async function saveUserAppState(uid, appState) {
  if (!db || !uid) return;

  const { readingList, savedFiles, scanHistory, ...mainState } = appState;

  const mainRef = doc(db, "users", uid, "appData", APP_STATE_DOC);
  const readingListRef = doc(db, "users", uid, "appData", `${APP_STATE_DOC}_readingList`);
  const savedFilesRef = doc(db, "users", uid, "appData", `${APP_STATE_DOC}_savedFiles`);
  const scanHistoryRef = doc(db, "users", uid, "appData", `${APP_STATE_DOC}_scanHistory`);

  const now = serverTimestamp();

  await Promise.all([
    setDoc(mainRef, { ...mainState, updatedAt: now }, { merge: true }),
    setDoc(readingListRef, { items: readingList || [], updatedAt: now }, { merge: true }),
    setDoc(savedFilesRef, { items: savedFiles || [], updatedAt: now }, { merge: true }),
    setDoc(scanHistoryRef, { items: scanHistory || [], updatedAt: now }, { merge: true }),
  ]);
}

export async function saveUserScan(uid, scanData) {
  if (!db || !uid) return;

  await addDoc(collection(db, "users", uid, "scans"), {
    ...scanData,
    createdAt: serverTimestamp(),
  });
}

export function getDeveloperUsageRef(dateKey = getTodayKey()) {
  if (!db) return null;
  return doc(db, API_USAGE_COLLECTION, dateKey);
}

export async function recordSuccessfulLogin(user, method = "password") {
  if (!db || !user?.uid) return;

  const userRef = doc(db, "users", user.uid);
  const now = serverTimestamp();

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email || "",
      displayName: sanitizeDisplayName(getUserDisplayName(user)),
      emailVerified: Boolean(user.emailVerified),
      lastLoginAt: now,
      loginCount: increment(1),
      provider: method,
    },
    { merge: true }
  );

  await addDoc(collection(db, "loginEvents"), {
    userId: user.uid,
    email: user.email || "",
    displayName: sanitizeDisplayName(getUserDisplayName(user)),
    method,
    date: getTodayKey(),
    createdAtMs: Date.now(),
    createdAt: now,
  });
}
