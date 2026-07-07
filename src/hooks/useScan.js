import { useState } from "react";
import localforage from "localforage";
import { doc, setDoc } from "firebase/firestore";

export function useScan({ db, user }) {
  const [scanHistory, setScanHistory] = useState([]);
  
  // Scan Limit Tracking
  const [scanLimitModalState, setScanLimitModalState] = useState(null); // null, "login_required", "plus_required"
  const [anonymousScanCount, setAnonymousScanCount] = useState(0);
  const [isAnonymousPlus, setIsAnonymousPlus] = useState(false);
  const [userScanCount, setUserScanCount] = useState(0);
  const [isUserPlus, setIsUserPlus] = useState(false);
  const [lastScanDate, setLastScanDate] = useState("");

  const checkScanLimit = () => {
    // Only allow Plus for logged-in users
    const activePlus = user ? isUserPlus : false;
    if (activePlus) return true;

    const today = new Date().toISOString().split("T")[0];
    const isNewDay = lastScanDate !== today;

    if (user) {
      const currentCount = isNewDay ? 0 : userScanCount;
      if (currentCount >= 10) {
        setScanLimitModalState("plus_required");
        return false;
      }
    } else {
      const currentCount = isNewDay ? 0 : anonymousScanCount;
      if (currentCount >= 3) {
        setScanLimitModalState("login_required");
        return false;
      }
    }
    return true;
  };

  const incrementScanCount = async () => {
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = lastScanDate !== today;
    
    setLastScanDate(today);

    if (user) {
      const newCount = (isNewDay ? 0 : userScanCount) + 1;
      setUserScanCount(newCount);
      if (db) {
        try {
          await setDoc(doc(db, "users", user.uid), { scanCount: newCount, lastScanDate: today }, { merge: true });
        } catch (err) {
          console.error("Could not update scan count:", err);
        }
      }
    } else {
      const newCount = (isNewDay ? 0 : anonymousScanCount) + 1;
      setAnonymousScanCount(newCount);
      await localforage.setItem("luminaAnonymousScanCount", newCount);
      await localforage.setItem("luminaLastScanDate", today);
    }
  };

  function resetScanLimits() {
    setUserScanCount(0);
    setAnonymousScanCount(0);
    setScanLimitModalState(null);
  }

  return {
    scanHistory, setScanHistory,
    scanLimitModalState, setScanLimitModalState,
    anonymousScanCount, setAnonymousScanCount,
    isAnonymousPlus, setIsAnonymousPlus,
    userScanCount, setUserScanCount,
    isUserPlus, setIsUserPlus,
    lastScanDate, setLastScanDate,
    checkScanLimit,
    incrementScanCount,
    resetScanLimits
  };
}
