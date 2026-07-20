import {
  getTimeGreeting,
  sanitizeDisplayName,
  getDisplayTime,
  getTimestamp,
  cleanJsonText,
  safeParseJson,
  normalizeBookText,
  getUserDisplayName,
  getFirstName,
  getTodayKey,
  getBookKey,
  getSavedFileKey,
} from "./utils/stringUtils";
import {
  APP_STATE_DOC,
  getUserAppStateRef,
  saveUserAppState,
  saveUserScan,
} from "./services/firebaseService";
import {
  getPromptTokenCount,
  getTotalTokenCount,
  getClaudeText,
  generateClaudeContent,
  getFriendlyScanError,
} from "./services/claudeService";
import { useDeveloper, hasDeveloperAccess } from "./hooks/useDeveloper";
import { useAuth } from "./hooks/useAuth";
import { DEFAULT_FOLDERS, useLibrary } from "./hooks/useLibrary";
import { useAppUI } from "./hooks/useAppUI";
import { useScan } from "./hooks/useScan";
import { NativeSpeech, hasNativeSpeech, isAndroidApp, isNativeApp } from "./utils/nativeSpeech";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import {
  signInAnonymously,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  analytics,
  auth,
  cloudFunctions,
  db,
  isFirebaseConfigured,
  logEvent,
} from "./firebase";
import ChatBox from "./components/ChatBox";
import AppHeader from "./components/AppHeader";
import BookDetailsModal from "./components/BookDetailsModal";
import BookDetailSummaryGrid from "./components/BookDetailSummaryGrid";
import CompareTray from "./components/CompareTray";
import ScanLandingSection from "./components/ScanLandingSection";
import ScanResultsSection from "./components/ScanResultsSection";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import localforage from "localforage";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
const IS_BETA_MODE = true;

const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "lumina-kaboom";
const firestoreConsoleUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/-default-/data/~2Fusers`;
const firebaseAuthConsoleUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/users`;
const isAndroidGoogleSsoConfigured =
  import.meta.env.VITE_ANDROID_GOOGLE_SSO_READY === "true";
const isClaudeConfigured = isFirebaseConfigured;
const BOOK_BARCODE_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
];
const MODEL_NAME = "claude-haiku-4-5";
const GOOGLE_BOOKS_PREVIEW_TIMEOUT_MS = 10000;
const GOOGLE_BOOKS_PREVIEW_STALE_MS = GOOGLE_BOOKS_PREVIEW_TIMEOUT_MS + 3000;
const ONE_MINUTE_MS = 60 * 1000;
const DEFAULT_FILTERS = {
  vibe: "",
  genre: "",
  minRating: "",
  readingLevel: "",
  gradeBand: "",
  ageRecommendation: "",
};
const FILTER_OPTIONS = {
  vibe: [
    "Spicy 🌶️",
    "Dark Academia 🕯️",
    "Crying uncontrollably 😭",
    "Enemies to lovers 💕",
    "Cozy Reset ☕",
    "Plot twist 🤯",
  ],
  minRating: ["3", "3.5", "4", "4.5"],
  readingLevel: ["Easy", "Intermediate", "Advanced", "Young Adult", "Middle Grade", "Adult"],
  gradeBand: ["K-3", "4-6", "7-9", "10-12", "Adult"],
  ageRecommendation: ["All ages", "Ages 5+", "Ages 8+", "Ages 12+", "Ages 14+", "Ages 18+"],
};
const PLUS_PLANS = [
  {
    id: "lumina_plus_monthly",
    name: "Lumina Plus",
    price: "Free",
    caption: "For readers who scan often and want prettier shares.",
    perks: ["Higher scan limits", "Premium shelf reports", "Share cards", "Cloud library polish"],
  },
];

const MAX_DISPLAY_NAME_LENGTH = 24;

const ANONYMOUS_SCAN_LIMIT = 3;
const DAILY_USER_SCAN_LIMIT = 10;

const HIDDEN_FOLDER_NAMES = new Set(["read aloud", "school"]);
const NEW_FOLDER_OPTION = "__new_folder__";
const MAX_LIBRARY_CARDS = 10;
const MAX_LIBRARY_CARD_NAME_LENGTH = 36;
const MAX_LIBRARY_CARD_NUMBER_LENGTH = 64;
const CODE_128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
];

function normalizeFilters(filters) {
  return {
    ...DEFAULT_FILTERS,
    ...(filters && typeof filters === "object" ? filters : {}),
  };
}








function isSyncUser(user) {
  return Boolean(user?.uid && !user.isAnonymous);
}





function getDailyScanUsageKey(user) {
  return `scanUsage:${user?.uid || "guest"}:${getTodayKey()}`;
}

function getDailyScanUsage(user) {
  return readStoredJson(getDailyScanUsageKey(user), {
    count: 0,
    date: getTodayKey(),
  });
}

function canStartScan(user) {
  const usage = getDailyScanUsage(user);
  const scanLimit = user ? DAILY_USER_SCAN_LIMIT : ANONYMOUS_SCAN_LIMIT;

  return Number(usage.count || 0) < scanLimit;
}

function recordLocalScanUsage(user) {
  const usageKey = getDailyScanUsageKey(user);
  const usage = getDailyScanUsage(user);

  localStorage.setItem(
    usageKey,
    JSON.stringify({
      date: getTodayKey(),
      count: Number(usage.count || 0) + 1,
    })
  );
}

function getScanLimitMessage(user) {
  const scanLimit = user ? DAILY_USER_SCAN_LIMIT : ANONYMOUS_SCAN_LIMIT;

  return `Scan limit reached. ${user ? "" : "Continue with Google to keep scanning. "}Limit: ${scanLimit} scans.`;
}





function getDefaultGeminiUsage() {
  return {
    date: getTodayKey(),
    count: 0,
    promptTokens: 0,
    requestEvents: [],
    tokenEvents: [],
    lastStatus: "Idle",
    lastType: "",
    lastUpdatedAt: "",
  };
}

function normalizeGeminiUsage(usage) {
  const fallback = getDefaultGeminiUsage();

  if (!usage || usage.date !== fallback.date) return fallback;

  return {
    date: fallback.date,
    count: Number(usage.count || 0),
    promptTokens: Number(usage.promptTokens || 0),
    requestEvents: Array.isArray(usage.requestEvents) ? usage.requestEvents : [],
    tokenEvents: Array.isArray(usage.tokenEvents) ? usage.tokenEvents : [],
    lastStatus: usage.lastStatus || "Idle",
    lastType: usage.lastType || "",
    lastUpdatedAt: usage.lastUpdatedAt || "",
  };
}

function getInitialGeminiUsage() {
  return normalizeGeminiUsage(readStoredJson("geminiDailyUsage", getDefaultGeminiUsage()));
}

function mergeGeminiUsage(cloudUsage, localUsage) {
  const normalizedCloud = normalizeGeminiUsage(cloudUsage);
  const normalizedLocal = normalizeGeminiUsage(localUsage);
  const mergedRequestEvents = Array.from(
    new Set([
      ...getRecentEvents(normalizedCloud.requestEvents),
      ...getRecentEvents(normalizedLocal.requestEvents),
    ])
  );
  const mergedTokenEvents = [
    ...normalizedCloud.tokenEvents,
    ...normalizedLocal.tokenEvents,
  ].filter((event) => {
    if (!event?.at) return false;
    return new Date(event.at).getTime() > Date.now() - ONE_MINUTE_MS;
  });
  const cloudUpdatedAt = new Date(normalizedCloud.lastUpdatedAt || 0).getTime();
  const localUpdatedAt = new Date(normalizedLocal.lastUpdatedAt || 0).getTime();
  const latestUsage = localUpdatedAt > cloudUpdatedAt ? normalizedLocal : normalizedCloud;

  return {
    date: getTodayKey(),
    count: Math.max(normalizedCloud.count, normalizedLocal.count),
    promptTokens: Math.max(
      normalizedCloud.promptTokens,
      normalizedLocal.promptTokens
    ),
    requestEvents: mergedRequestEvents,
    tokenEvents: mergedTokenEvents,
    lastStatus: latestUsage.lastStatus || "Idle",
    lastType: latestUsage.lastType || "",
    lastUpdatedAt: latestUsage.lastUpdatedAt || "",
  };
}



function getRecentEvents(events, now = Date.now()) {
  return (events || []).filter((event) => {
    const eventTime = new Date(event?.at || event).getTime();
    return Number.isFinite(eventTime) && now - eventTime < ONE_MINUTE_MS;
  });
}


const encodeFileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
  });

const compressImage = (file, maxWidth = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let { width, height } = img;
      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("Canvas to Blob failed"));
          else resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
  });
};







function mergeUniqueByKey(primary = [], secondary = [], getKey = (item) => item?.id) {
  const merged = [];
  const seen = new Set();

  [...primary, ...secondary].forEach((item) => {
    const key = getKey(item);
    if (!item || !key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

function hasActiveFilters(filters) {
  return Object.values(filters || {}).some(Boolean);
}

function getVisibleFolders(folders) {
  return (Array.isArray(folders) ? folders : DEFAULT_FOLDERS).filter(
    (folder) => !HIDDEN_FOLDER_NAMES.has(normalizeBookText(folder))
  );
}

/* eslint-disable-next-line react-refresh/only-export-components */
export function getFolderDisplayLabel(folderName) {
  return folderName;
}



function hasAuthorMatch(book, item) {
  const expectedAuthor = normalizeBookText(book?.author);
  const candidateAuthors = (item?.volumeInfo?.authors || [])
    .map(normalizeBookText)
    .filter(Boolean);

  if (!expectedAuthor || expectedAuthor === "unknown") return true;

  return candidateAuthors.some(
    (author) =>
      author === expectedAuthor ||
      author.includes(expectedAuthor) ||
      expectedAuthor.includes(author)
  );
}

const formatVariantRules = [
  {
    terms: ["graphic novel", "comic", "comics", "manga"],
    allowedBy: ["graphic novel", "comic", "comics", "manga"],
  },
  {
    terms: ["cookbook", "recipe", "recipes", "cooking"],
    allowedBy: ["cookbook", "recipe", "recipes", "cooking"],
  },
  {
    terms: ["study guide", "sparknotes", "cliffsnotes", "summary", "summaries"],
    allowedBy: ["study guide", "sparknotes", "cliffsnotes", "summary"],
  },
  {
    terms: ["coloring book", "activity book", "sticker book"],
    allowedBy: ["coloring book", "activity book", "sticker book"],
  },
];

function hasTextTerm(text, terms) {
  const normalizedText = normalizeBookText(text);
  return terms.some((term) => normalizedText.includes(normalizeBookText(term)));
}

function hasFormatVariantMismatch(book, item) {
  const catalogText = [
    book?.title,
    book?.genre,
    book?.summary,
    book?.whyRead,
    book?.shelfPick,
    book?.readingLevel,
  ].join(" ");
  const candidateText = [
    item?.volumeInfo?.title,
    item?.volumeInfo?.subtitle,
    item?.volumeInfo?.description,
    ...(item?.volumeInfo?.categories || []),
  ].join(" ");

  return formatVariantRules.some(
    ({ terms, allowedBy }) =>
      hasTextTerm(candidateText, terms) && !hasTextTerm(catalogText, allowedBy)
  );
}

function getTitleMatchScore(expectedTitle, candidateTitle) {
  if (candidateTitle === expectedTitle) return 100;
  if (candidateTitle.startsWith(`${expectedTitle} `)) return 75;
  if (expectedTitle.startsWith(`${candidateTitle} `) && candidateTitle.length > 6) {
    return 55;
  }
  if (expectedTitle.length > 12 && candidateTitle.includes(expectedTitle)) return 50;

  return -1;
}

function getLoosePreviewScore(book, item) {
  const expectedTitle = normalizeBookText(book?.title);
  const candidateText = normalizeBookText(
    [
      item?.volumeInfo?.title,
      item?.volumeInfo?.subtitle,
      item?.volumeInfo?.description,
      ...(item?.volumeInfo?.categories || []),
    ].join(" ")
  );
  const words = expectedTitle
    .split(" ")
    .filter((word) => word.length > 2);

  if (words.length < 3) return -1;

  const candidateWords = candidateText.split(" ");
  const matchedWords = words.filter((word) => candidateWords.includes(word));
  const matchRatio = matchedWords.length / words.length;

  if (matchRatio < 0.9) return -1;

  return Math.round(matchRatio * 40);
}

function scoreGoogleBooksMatch(book, item) {
  const expectedTitle = normalizeBookText(book?.title);
  const candidateTitle = normalizeBookText(item?.volumeInfo?.title);
  const expectedAuthor = normalizeBookText(book?.author);
  const expectedWords = expectedTitle.split(" ").filter(Boolean);

  if (!expectedTitle || !candidateTitle) return -1;
  if (hasFormatVariantMismatch(book, item)) return -1;
  if (
    expectedWords.length <= 2 &&
    (!expectedAuthor || expectedAuthor === "unknown") &&
    candidateTitle !== expectedTitle
  ) {
    return -1;
  }

  let score = getTitleMatchScore(expectedTitle, candidateTitle);

  if (score < 0) score = getLoosePreviewScore(book, item);
  if (score < 0) return -1;

  if (hasAuthorMatch(book, item)) score += 25;

  if (item?.accessInfo?.embeddable) score += 10;
  if (item?.accessInfo?.viewability && item.accessInfo.viewability !== "NO_PAGES") {
    score += 5;
  }

  return score;
}

function getGoogleBooksSimilarQuery(book) {
  const terms = [
    book?.genre && `subject:${book.genre}`,
    book?.author &&
      normalizeBookText(book.author) !== "unknown" &&
      `inauthor:${book.author}`,
    book?.title && `intitle:${book.title}`,
  ].filter(Boolean);

  if (terms.length) return terms.join(" ");

  return [book?.title, book?.genre, book?.ageRecommendation]
    .filter(Boolean)
    .join(" ");
}

function mapGoogleBookToCatalogBook(item, selectedBook) {
  const info = item?.volumeInfo || {};
  const categories = Array.isArray(info.categories) ? info.categories : [];
  const title = info.title || "Recommended book";
  const authors = Array.isArray(info.authors) && info.authors.length
    ? info.authors.join(", ")
    : "Unknown";
  const averageRating = Number(info.averageRating || 0);

  return enrichScannedBook({
    title,
    author: authors,
    authorBio: authors === "Unknown"
      ? "Author information unavailable."
      : `${authors} is listed as the author on Google Books.`,
    rating: averageRating || Number(selectedBook?.rating || 4),
    ratingSource: averageRating ? "Google Books" : "Estimated",
    summary: info.description || "Google Books did not provide a description for this recommendation.",
    genre: categories[0] || selectedBook?.genre || "Book",
    readingLevel: selectedBook?.readingLevel || "Intermediate",
    gradeBand: selectedBook?.gradeBand || "",
    ageRecommendation: selectedBook?.ageRecommendation || "All ages",
    whyRead: `Recommended because it shares signals with ${selectedBook?.title || "the selected book"}.`,
    shelfPick: averageRating >= 4 ? "Top Rated" : "Popular",
    googleBooksId: item?.id || "",
    googleBooksCategories: categories,
  });
}

function scoreSimilarGoogleBook(selectedBook, item) {
  const info = item?.volumeInfo || {};
  const selectedTitle = normalizeBookText(selectedBook?.title);
  const candidateTitle = normalizeBookText(info.title);

  if (!candidateTitle || candidateTitle === selectedTitle) return -1;

  const selectedGenre = normalizeBookText(selectedBook?.genre);
  const selectedAuthor = normalizeBookText(selectedBook?.author);
  const selectedAge = normalizeBookText(selectedBook?.ageRecommendation);
  const selectedLevel = normalizeBookText(selectedBook?.readingLevel);
  const candidateText = normalizeBookText(
    [
      info.title,
      info.subtitle,
      info.description,
      ...(info.categories || []),
      ...(info.authors || []),
    ].join(" ")
  );

  let score = 0;
  if (selectedGenre && candidateText.includes(selectedGenre)) score += 35;
  if (
    selectedAuthor &&
    selectedAuthor !== "unknown" &&
    (info.authors || []).map(normalizeBookText).some((author) => author.includes(selectedAuthor))
  ) {
    score += 18;
  }
  if (selectedAge && candidateText.includes(selectedAge)) score += 12;
  if (selectedLevel && candidateText.includes(selectedLevel)) score += 8;
  score += Math.min(Number(info.averageRating || 0) * 6, 30);
  if (info.description) score += 6;
  if ((info.categories || []).length) score += 5;

  return score;
}

function scoreShelfSimilarBook(selectedBook, candidateBook) {
  if (!selectedBook || !candidateBook) return 0;

  const selectedTitle = normalizeBookText(selectedBook.title);
  const candidateTitle = normalizeBookText(candidateBook.title);
  if (!candidateTitle || candidateTitle === selectedTitle) return 0;

  let score = 0;
  const selectedGenre = normalizeBookText(selectedBook.genre);
  const candidateGenre = normalizeBookText(candidateBook.genre);
  const selectedAuthor = normalizeBookText(selectedBook.author);
  const candidateAuthor = normalizeBookText(candidateBook.author);
  const selectedAge = normalizeBookText(selectedBook.ageRecommendation);
  const candidateAge = normalizeBookText(candidateBook.ageRecommendation);
  const selectedLevel = normalizeBookText(selectedBook.readingLevel);
  const candidateLevel = normalizeBookText(candidateBook.readingLevel);
  const selectedGrade = normalizeBookText(selectedBook.gradeBand);
  const candidateGrade = normalizeBookText(candidateBook.gradeBand);
  const selectedPick = normalizeBookText(selectedBook.shelfPick);
  const candidatePick = normalizeBookText(candidateBook.shelfPick);

  if (selectedGenre && selectedGenre === candidateGenre) score += 35;
  if (
    selectedAuthor &&
    selectedAuthor !== "unknown" &&
    selectedAuthor === candidateAuthor
  ) {
    score += 25;
  }
  if (selectedAge && selectedAge === candidateAge) score += 14;
  if (selectedLevel && selectedLevel === candidateLevel) score += 12;
  if (selectedGrade && selectedGrade === candidateGrade) score += 10;
  if (selectedPick && selectedPick === candidatePick) score += 8;

  const ratingGap = Math.abs(
    Number(selectedBook.rating || 0) - Number(candidateBook.rating || 0)
  );
  if (ratingGap <= 0.5) score += 8;
  if (ratingGap <= 1) score += 4;

  return score;
}

function getSafeFileName(text) {
  return normalizeBookText(text).replace(/\s+/g, "-") || "book-preview";
}



function readStoredJson(key, fallbackValue) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
  } catch (err) {
    console.error(`Could not read ${key} from local storage:`, err);
    return fallbackValue;
  }
}

function writeStoredJson(key, value) {
  try {
    localforage.setItem(key, value).catch(err => {
      console.error(`Could not write ${key} to localforage:`, err);
    });
  } catch (err) {
    console.error(`Could not write ${key}:`, err);
  }
}

function getBookDetailsPayload(book) {
  return {
    title: book.title,
    author: book.author,
    authorBio: book.authorBio,
    rating: book.rating,
    ratingSource: book.ratingSource,
    genre: book.genre,
    readingLevel: book.readingLevel,
    gradeBand: book.gradeBand,
    ageRecommendation: book.ageRecommendation,
    shelfPick: book.shelfPick,
    whyRead: book.whyRead,
    summary: book.summary,
  };
}

function getSavedFileType(file) {
  return file?.payload?.preview ? "preview" : "details";
}

function normalizeSavedFile(file) {
  const type = file?.type || getSavedFileType(file);
  const bookTitle = file?.bookTitle || file?.payload?.catalogBook?.title || "Saved book";

  return {
    ...file,
    id: getSavedFileKey(bookTitle, type),
    name: file?.name || `${bookTitle} ${type}`,
    bookTitle,
    location: file?.location || "This phone",
    type,
  };
}

function normalizeSavedFiles(files) {
  const savedById = new Map();

  files.map(normalizeSavedFile).forEach((file) => {
    if (!savedById.has(file.id)) {
      savedById.set(file.id, file);
    }
  });

  return [...savedById.values()];
}

function sanitizeLibraryCardName(name) {
  return String(name || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LIBRARY_CARD_NAME_LENGTH);
}

function sanitizeLibraryCardNumber(number) {
  return String(number || "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LIBRARY_CARD_NUMBER_LENGTH);
}

function normalizeLibraryCard(card) {
  const cardNumber = sanitizeLibraryCardNumber(card?.cardNumber);
  const normalizedCardNumber = normalizeBookText(cardNumber).replace(/\s+/g, "-");
  const fallbackId = normalizedCardNumber
    ? `library-card-${normalizedCardNumber}`
    : `library-card-${Date.now()}`;

  return {
    id: card?.id || fallbackId,
    name: sanitizeLibraryCardName(card?.name) || "Library card",
    cardNumber,
    barcodeFormat: card?.barcodeFormat || "CODE_128",
    imageDataUrl:
      typeof card?.imageDataUrl === "string" && card.imageDataUrl.startsWith("data:image/")
        ? card.imageDataUrl
        : "",
    imageName: sanitizeLibraryCardName(card?.imageName) || "",
    addedAt: card?.addedAt || new Date().toISOString(),
  };
}

function normalizeLibraryCards(cards) {
  const cardsById = new Map();

  (Array.isArray(cards) ? cards : [])
    .map(normalizeLibraryCard)
    .filter((card) => card.cardNumber)
    .forEach((card) => {
      if (!cardsById.has(card.id)) cardsById.set(card.id, card);
    });

  return [...cardsById.values()]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, MAX_LIBRARY_CARDS);
}

function getCode128Pattern(value) {
  const text = sanitizeLibraryCardNumber(value);
  if (!text) return "";

  const values = [104];
  for (const character of text) {
    const code = character.charCodeAt(0);
    values.push(code >= 32 && code <= 126 ? code - 32 : 0);
  }

  const checksum =
    values[0] + values.slice(1).reduce((sum, code, index) => sum + code * (index + 1), 0);
  values.push(checksum % 103, 106);

  return values.map((code) => CODE_128_PATTERNS[code]).join("");
}

function getCode128Bars(value) {
  const pattern = getCode128Pattern(value);
  let x = 0;
  const bars = [];

  pattern.split("").forEach((widthText, index) => {
    const width = Number(widthText);
    if (index % 2 === 0) bars.push({ x, width });
    x += width;
  });

  return { bars, width: x };
}

function getImageDataUrl(file, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(1, image.width));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.60));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getSavedBookGroups(files) {
  const savedByBook = new Map();

  files.forEach((file) => {
    const bookTitle = file?.bookTitle || file?.payload?.catalogBook?.title || "Saved book";
    const bookAuthor = file?.payload?.catalogBook?.author || "";
    const bookKey =
      [normalizeBookText(bookTitle), normalizeBookText(bookAuthor)]
        .filter(Boolean)
        .join("-") ||
      file?.id ||
      bookTitle;
    const savedAt = file?.savedAt || new Date().toISOString();
    const preview = file?.payload?.preview;
    const existing = savedByBook.get(bookKey) || {
      id: bookKey,
      ids: [],
      bookTitle,
      catalogBook: null,
      preview: null,
      location: file?.location || "This phone",
      savedAt,
    };

    existing.ids.push(file.id);
    existing.bookTitle = existing.bookTitle || bookTitle;
    existing.location = file?.location || existing.location;

    if (!existing.catalogBook || getSavedFileType(file) === "details") {
      existing.catalogBook = file?.payload?.catalogBook || existing.catalogBook;
    }

    if (
      preview &&
      (!existing.preview ||
        preview.status === "ready" ||
        existing.preview.status !== "ready")
    ) {
      existing.preview = preview;
    }

    if (new Date(savedAt).getTime() > new Date(existing.savedAt).getTime()) {
      existing.savedAt = savedAt;
    }

    savedByBook.set(bookKey, existing);
  });

  return [...savedByBook.values()].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

function canOpenSavedBookPreview(savedBook) {
  return (
    savedBook?.preview?.status === "ready" && Boolean(savedBook.preview.embedUrl)
  );
}

function getScopedSaveStatus(saveStatus, book, type) {
  if (!saveStatus?.message || !book?.title) return "";

  return saveStatus.bookKey === getSavedFileKey(book.title, type)
    ? saveStatus.message
    : "";
}

function getComparedValue(book, field, fallback = "Not listed") {
  return book?.[field] || fallback;
}

function getShelfPickStyle(shelfPick) {
  const pick = normalizeBookText(shelfPick);

  if (pick.includes("popular")) {
    return {
      background: "rgba(26, 115, 232, 0.16)",
      color: "#2563eb",
      border: "1px solid rgba(37, 99, 235, 0.32)",
    };
  }

  if (pick.includes("top rated")) {
    return {
      background: "rgba(245, 158, 11, 0.14)",
      color: "#92400e",
      border: "1px solid rgba(245, 158, 11, 0.32)",
    };
  }

  if (pick.includes("hidden gem")) {
    return {
      background: "rgba(24, 121, 78, 0.14)",
      color: "#A7D7B8",
      border: "1px solid rgba(24, 121, 78, 0.32)",
    };
  }

  if (pick.includes("beginner")) {
    return {
      background: "rgba(220, 38, 38, 0.14)",
      color: "#b91c1c",
      border: "1px solid rgba(220, 38, 38, 0.32)",
    };
  }

  return {
    background: "rgba(154, 160, 166, 0.16)",
    color: "#243044",
    border: "1px solid rgba(154, 160, 166, 0.28)",
  };
}

function getGoogleBooksQuery(book) {
  const title = book?.title || "";
  const author =
    book?.author && book.author !== "Unknown" ? book.author : "";

  return [title, author].filter(Boolean).join(" ");
}

function getGoogleBooksEmbedUrl(volumeId) {
  if (!volumeId) return "";

  const params = new URLSearchParams({
    id: volumeId,
    output: "embed",
    pg: "PP1",
  });

  return `https://books.google.com/books?${params}`;
}

function getTheme(book) {
  const text = `${book?.gradeBand || ""} ${book?.readingLevel || ""} ${
    book?.ageRecommendation || ""
  }`.toLowerCase();

  if (
    text.includes("k-3") ||
    text.includes("grade 3") ||
    text.includes("kids") ||
    text.includes("easy")
  ) {
    return {
      name: "kids",
      cardBg: "var(--social-bg)",
      imageBg: "linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(24, 121, 78, 0.16))",
      border: "var(--border)",
      title: "var(--text-h)",
      badgeBg: "rgba(37, 99, 235, 0.14)",
      badgeText: "#2563eb",
    };
  }

  if (
    text.includes("4-6") ||
    text.includes("grade 4") ||
    text.includes("grade 5") ||
    text.includes("grade 6") ||
    text.includes("young") ||
    text.includes("intermediate")
  ) {
    return {
      name: "young",
      cardBg: "var(--social-bg)",
      imageBg: "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(220, 38, 38, 0.14))",
      border: "var(--border)",
      title: "var(--text-h)",
      badgeBg: "rgba(245, 158, 11, 0.13)",
      badgeText: "#f97316",
    };
  }

  return {
    name: "teen",
    cardBg: "var(--social-bg)",
    imageBg: "linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(168, 85, 247, 0.14))",
    border: "var(--border)",
    title: "var(--text-h)",
    badgeBg: "rgba(24, 121, 78, 0.14)",
    badgeText: "#10b981",
  };
}

function getBookSearchText(book) {
  return [
    book?.title,
    book?.author,
    book?.authorBio,
    book?.genre,
    book?.summary,
    book?.shelfPick,
    book?.readingLevel,
    book?.gradeBand,
    book?.ageRecommendation,
    book?.whyRead,
    book?.ratingSource,
    String(book?.rating || ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSearchIntent(searchText) {
  const numberWords = {
    zero: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10"
  };
  let rawSearch = String(searchText || "").toLowerCase();
  
  // Convert word numbers to digits so voice search works correctly
  Object.entries(numberWords).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    rawSearch = rawSearch.replace(regex, digit);
  });

  const normalized = normalizeBookText(rawSearch);
  const minRatingMatch = rawSearch.match(
    /\b(?:rating|rated|stars?)?\s*(?:above|over|at least|more than|greater than)\s*(\d(?:\.\d)?)\b/
  );
  const directRatingMatch = rawSearch.match(
    /\b(?:rating|rated|stars?)\s*(\d(?:\.\d)?)\b/
  );
  const gradeMatch = normalized.match(/\bgrade\s*(\d+)\b/);
  const minRating = Number(minRatingMatch?.[1] || directRatingMatch?.[1] || 0);
  const gradeNumber = Number(gradeMatch?.[1] || 0);
  const gradeBand =
    rawSearch.includes("k-3") || (gradeNumber > 0 && gradeNumber <= 3)
      ? "k-3"
      : rawSearch.includes("4-6") || (gradeNumber >= 4 && gradeNumber <= 6)
        ? "4-6"
        : rawSearch.includes("7+") || normalized.includes("teen") || gradeNumber >= 7
          ? "7+"
          : "";
  const ageTerms = ["kids", "young readers", "teen", "adult", "all ages"];
  const levelTerms = ["easy", "intermediate", "advanced"];
  const shelfTerms = [
    "top rated",
    "hidden gem",
    "beginner friendly",
    "popular",
    "educational",
  ];
  const age = ageTerms.find((term) => normalized.includes(normalizeBookText(term))) || "";
  const readingLevel =
    levelTerms.find((term) => normalized.includes(term)) ||
    (normalized.includes("beginner") ? "easy" : "");
  const shelfPick =
    shelfTerms.find((term) => normalized.includes(normalizeBookText(term))) ||
    (normalized.includes("beginner") ? "beginner friendly" : "");
  const stopWords = new Set([
    "a",
    "all",
    "and",
    "are",
    "book",
    "books",
    "find",
    "filter",
    "for",
    "give",
    "i",
    "in",
    "is",
    "list",
    "me",
    "of",
    "please",
    "recommend",
    "recommendation",
    "recommendations",
    "search",
    "show",
    "that",
    "the",
    "to",
    "with",
  ]);
  const conditionWords = new Set([
    "above",
    "adult",
    "advanced",
    "ages",
    "at",
    "beginner",
    "easy",
    "educational",
    "friendly",
    "gem",
    "grade",
    "greater",
    "hidden",
    "kids",
    "least",
    "more",
    "over",
    "popular",
    "rated",
    "rating",
    "stars",
    "teen",
    "than",
    "top",
    "young",
  ]);
  const terms = normalized
    .split(" ")
    .filter((term) => term.length > 1)
    .filter((term) => !stopWords.has(term))
    .filter((term) => !conditionWords.has(term))
    .filter((term) => !/^\d+(\.\d+)?$/.test(term));

  return {
    normalized,
    minRating: Number.isFinite(minRating) ? minRating : 0,
    gradeBand,
    age,
    readingLevel,
    shelfPick,
    terms,
  };
}

function matchesSearchIntent(book, intent) {
  const searchText = getBookSearchText(book);

  if (!intent.normalized) return true;
  if (intent.minRating && Number(book?.rating || 0) < intent.minRating) return false;
  if (
    intent.gradeBand &&
    normalizeBookText(book?.gradeBand) !== normalizeBookText(intent.gradeBand)
  ) {
    return false;
  }
  if (intent.age && !normalizeBookText(book?.ageRecommendation).includes(intent.age)) {
    return false;
  }
  if (
    intent.readingLevel &&
    !normalizeBookText(book?.readingLevel).includes(intent.readingLevel)
  ) {
    return false;
  }
  if (
    intent.shelfPick &&
    !normalizeBookText(book?.shelfPick).includes(normalizeBookText(intent.shelfPick))
  ) {
    return false;
  }

  if (intent.terms.length === 0) return true;

  return intent.terms.every((term) => searchText.includes(term));
}

function getScanConfidence(book) {
  const title = String(book?.title || "").trim();
  const author = String(book?.author || "").trim().toLowerCase();
  const source = String(book?.ratingSource || "").trim().toLowerCase();

  if (!title || title.length < 4 || author === "unknown") {
    return { label: "Confidence: low", reason: "Title or author may need correction." };
  }
  if (source === "estimated" || title.split(" ").length < 2) {
    return { label: "Confidence: medium", reason: "Lumina estimated some details." };
  }
  return { label: "Confidence: high", reason: "Title and metadata look complete." };
}

function getScanConfidenceDisplayLabel(book) {
  const label = String(book?.scanConfidence || getScanConfidence(book).label || "");

  if (/please check title/i.test(label)) return "Confidence: low";
  if (/best guess/i.test(label)) return "Confidence: medium";
  if (/looks correct/i.test(label)) return "Confidence: high";
  if (/needs review/i.test(label)) return "Confidence: low";
  if (/high confidence/i.test(label)) return "Confidence: high";

  return label;
}

function enrichScannedBook(book) {
  const confidence = getScanConfidence(book);
  const shelfLocation = String(book?.shelfLocation || "").trim();

  return {
    ...book,
    shelfLocation:
      shelfLocation ||
      "Shelf location was not captured for this book. Scan the shelf again to get row, side, and order details.",
    scanConfidence: book?.scanConfidence || confidence.label,
    confidenceReason: book?.confidenceReason || confidence.reason,
    reviewed: Boolean(book?.reviewed),
  };
}

function getContentGuidance(book) {
  const age = normalizeBookText(book?.ageRecommendation);
  const level = normalizeBookText(book?.readingLevel);
  const grade = normalizeBookText(book?.gradeBand);

  if (age.includes("adult")) return "Best reviewed by an adult before sharing with younger readers.";
  if (age.includes("teen") || grade.includes("7")) return "Good for older readers; skim themes if choosing for a child.";
  if (level.includes("advanced")) return "May need support for younger or developing readers.";
  return "Generally approachable for the listed age and level.";
}

function matchesStructuredFilters(book, filters) {
  const genre = normalizeBookText(filters.genre);
  const vibe = normalizeBookText(filters.vibe);
  const minRating = Number(filters.minRating || 0);
  const readingLevel = normalizeBookText(filters.readingLevel);
  const gradeBand = normalizeBookText(filters.gradeBand);
  const ageRecommendation = normalizeBookText(filters.ageRecommendation);

  if (genre && !normalizeBookText(book?.genre).includes(genre)) return false;
  if (vibe && !normalizeBookText(book?.description).includes(vibe) && !normalizeBookText(book?.genre).includes(vibe)) return false;
  if (minRating && Number(book?.rating || 0) < minRating) return false;
  if (readingLevel && !normalizeBookText(book?.readingLevel).includes(readingLevel)) return false;
  if (gradeBand && !normalizeBookText(book?.gradeBand).includes(gradeBand)) return false;
  if (ageRecommendation && !normalizeBookText(book?.ageRecommendation).includes(ageRecommendation)) return false;

  return true;
}

/* eslint-disable react-refresh/only-export-components */
export {
  canOpenSavedBookPreview,
  cleanJsonText,
  enrichScannedBook,
  getBookKey,
  getCode128Bars,
  getContentGuidance,
  getFriendlyScanError,
  getSafeFileName,
  getSavedBookGroups,
  getSavedFileKey,
  getScanConfidenceDisplayLabel,
  getSearchIntent,
  getTimeGreeting,
  matchesSearchIntent,
  matchesStructuredFilters,
  mergeUniqueByKey,
  normalizeBookText,
  normalizeLibraryCards,
  normalizeSavedFiles,
  safeParseJson,
  sanitizeDisplayName,
  scoreGoogleBooksMatch,
};
/* eslint-enable react-refresh/only-export-components */

const AppleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "12px" }}>
    <path d="M16.35 11.23c0-3.32 2.71-4.91 2.83-4.98-1.55-2.26-3.95-2.57-4.81-2.61-2.04-.2-4 1.2-5.04 1.2-1.03 0-2.64-1.18-4.32-1.15-2.21.03-4.25 1.29-5.38 3.25-2.3 4-1.4 10.32.74 13.41 1.05 1.52 2.3 3.23 3.94 3.17 1.58-.06 2.18-1.02 4.1-1.02 1.91 0 2.47 1.02 4.12.99 1.68-.03 2.76-1.55 3.8-3.07 1.2-1.74 1.69-3.42 1.72-3.51-.03-.02-3.3-1.26-3.32-5.08A5.4 5.4 0 0116.35 11.23zm-2.9-7.14c.85-1.03 1.43-2.47 1.27-3.9-.11.02-1.63.1-2.53.64-1.07.65-1.72 1.83-1.53 3.01 1.48.11 2.92-1.01 2.79-2.75z" fill="currentColor"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "12px" }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    <path d="M1 1h22v22H1z" fill="none"/>
  </svg>
);

const CARTOONS = [
  {
    name: "Cat",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#fbcfe8"/><polygon points="25,40 15,10 40,25" fill="#ec4899"/><polygon points="75,40 85,10 60,25" fill="#ec4899"/><circle cx="50" cy="55" r="30" fill="#f472b6"/><circle cx="40" cy="50" r="4" fill="#000"/><circle cx="60" cy="50" r="4" fill="#000"/><ellipse cx="50" cy="58" rx="4" ry="2" fill="#db2777"/></svg>`
  },
  {
    name: "Bear",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#fed7aa"/><circle cx="25" cy="25" r="12" fill="#ea580c"/><circle cx="75" cy="25" r="12" fill="#ea580c"/><circle cx="50" cy="55" r="32" fill="#f97316"/><circle cx="40" cy="48" r="4" fill="#000"/><circle cx="60" cy="48" r="4" fill="#000"/><ellipse cx="50" cy="56" rx="8" ry="6" fill="#ffedd5"/><polygon points="47,54 53,54 50,57" fill="#000"/></svg>`
  },
  {
    name: "Frog",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#bbf7d0"/><circle cx="35" cy="28" r="10" fill="#22c55e"/><circle cx="65" cy="28" r="10" fill="#22c55e"/><circle cx="35" cy="28" r="4" fill="#000"/><circle cx="65" cy="28" r="4" fill="#000"/><path d="M 30 55 Q 50 70 70 55" stroke="#15803d" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    name: "Bird",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#fef08a"/><circle cx="40" cy="46" r="4" fill="#000"/><circle cx="60" cy="46" r="4" fill="#000"/><polygon points="46,52 54,52 50,60" fill="#f97316"/><ellipse cx="32" cy="52" rx="6" ry="4" fill="#f87171" opacity="0.5"/><ellipse cx="68" cy="52" rx="6" ry="4" fill="#f87171" opacity="0.5"/></svg>`
  },
  {
    name: "Dog",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#e2e8f0"/><ellipse cx="22" cy="40" rx="10" ry="18" fill="#475569"/><ellipse cx="78" cy="40" rx="10" ry="18" fill="#475569"/><circle cx="40" cy="48" r="4" fill="#000"/><circle cx="60" cy="48" r="4" fill="#000"/><ellipse cx="50" cy="58" rx="7" ry="5" fill="#94a3b8"/><polygon points="48,56 52,56 50,59" fill="#000"/></svg>`
  },
  {
    name: "Rabbit",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="30" cy="20" rx="8" ry="18" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2"/><ellipse cx="70" cy="20" rx="8" ry="18" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2"/><circle cx="50" cy="55" r="38" fill="#f9fafb"/><circle cx="38" cy="48" r="4" fill="#000"/><circle cx="62" cy="48" r="4" fill="#000"/><ellipse cx="50" cy="54" rx="4" ry="3" fill="#fda4af"/><ellipse cx="50" cy="62" rx="6" ry="4" fill="#f3f4f6"/><line x1="30" y1="56" x2="16" y2="52" stroke="#9ca3af" stroke-width="1.5"/><line x1="30" y1="60" x2="14" y2="60" stroke="#9ca3af" stroke-width="1.5"/><line x1="70" y1="56" x2="84" y2="52" stroke="#9ca3af" stroke-width="1.5"/><line x1="70" y1="60" x2="86" y2="60" stroke="#9ca3af" stroke-width="1.5"/></svg>`
  },
  {
    name: "Panda",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="28" cy="28" r="14" fill="#111827"/><circle cx="72" cy="28" r="14" fill="#111827"/><circle cx="50" cy="55" r="40" fill="#ffffff" stroke="#111827" stroke-width="2"/><ellipse cx="38" cy="50" rx="9" ry="11" fill="#111827" transform="rotate(-15 38 50)"/><ellipse cx="62" cy="50" rx="9" ry="11" fill="#111827" transform="rotate(15 62 50)"/><circle cx="38" cy="48" r="3.5" fill="#fff"/><circle cx="62" cy="48" r="3.5" fill="#fff"/><ellipse cx="50" cy="62" rx="6" ry="4" fill="#111827"/></svg>`
  },
  {
    name: "Fox",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#ea580c"/><polygon points="20,30 10,5 35,22" fill="#c2410c"/><polygon points="80,30 90,5 65,22" fill="#c2410c"/><polygon points="12,50 50,90 88,50" fill="#fff"/><circle cx="35" cy="48" r="4.5" fill="#000"/><circle cx="65" cy="48" r="4.5" fill="#000"/><polygon points="46,65 54,65 50,72" fill="#000"/></svg>`
  }
];

function getAvatarSvgContent({ bgColor, accentColor, accessory, eyeSize, mouth, bgImage }) {
  const mouthY = 56;
  const mouthSvg =
    mouth === "smile"
      ? `<path d="M 35 ${mouthY} Q 50 ${mouthY + 10} 65 ${mouthY}" stroke="${accentColor}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : mouth === "circle"
        ? `<ellipse cx="50" cy="${mouthY}" rx="6" ry="6" fill="${accentColor}"/>`
        : `<ellipse cx="50" cy="${mouthY}" rx="8" ry="4" fill="${accentColor}"/>`;

  let accessorySvg = "";
  if (accessory === "bunny") {
    accessorySvg = `<ellipse cx="30" cy="18" rx="8" ry="20" fill="${bgColor || "#fed7aa"}" stroke="${accentColor}" stroke-width="2"/>
                    <ellipse cx="70" cy="18" rx="8" ry="20" fill="${bgColor || "#fed7aa"}" stroke="${accentColor}" stroke-width="2"/>`;
  } else if (accessory === "round") {
    accessorySvg = `<circle cx="22" cy="28" r="14" fill="${bgColor || "#fed7aa"}" stroke="${accentColor}" stroke-width="2"/>
                    <circle cx="78" cy="28" r="14" fill="${bgColor || "#fed7aa"}" stroke="${accentColor}" stroke-width="2"/>`;
  } else if (accessory === "horn") {
    accessorySvg = `<polygon points="50,5 38,25 62,25" fill="${accentColor}"/>`;
  } else if (accessory === "blush") {
    accessorySvg = `<circle cx="30" cy="54" r="6" fill="#f43f5e" opacity="0.4"/>
                    <circle cx="70" cy="54" r="6" fill="#f43f5e" opacity="0.4"/>`;
  }

  const bgShape = bgImage
    ? `<defs>
         <clipPath id="circle-clip">
           <circle cx="50" cy="50" r="42" />
         </clipPath>
       </defs>
       <image href="${bgImage}" x="8" y="8" width="84" height="84" clip-path="url(#circle-clip)" preserveAspectRatio="xMidYMid slice"/>
       <circle cx="50" cy="50" r="42" fill="none" stroke="${accentColor}" stroke-width="3"/>`
    : `<circle cx="50" cy="50" r="42" fill="${bgColor}" stroke="${accentColor}" stroke-width="3"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${accessorySvg}
    ${bgShape}
    <circle cx="38" cy="46" r="${eyeSize}" fill="#000"/>
    <circle cx="62" cy="46" r="${eyeSize}" fill="#000"/>
    ${mouthSvg}
  </svg>`;
}

const THEMES = [
  { id: "classic-blue", name: "Default", emoji: "◐" },
  { id: "dark", name: "Dark Mode", emoji: "🌙" },
  { id: "sunset", name: "Sunset Orange", emoji: "🍊" },
  { id: "forest", name: "Forest Green", emoji: "🌲" },
  { id: "lavender", name: "Lavender Purple", emoji: "🍇" },
  { id: "ocean", name: "Ocean Teal", emoji: "🐳" },
];

export default function App() {
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [appTheme, setAppTheme] = useState("classic-blue");
  const [disableEmojis, setDisableEmojis] = useState(false);
  const e = (emoji, text = "") => {
    if (disableEmojis) return text;
    return text ? `${emoji} ${text}` : emoji;
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
    writeStoredJson("appTheme", appTheme);
  }, [appTheme]);

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarBgColor, setAvatarBgColor] = useState("#fbcfe8");
  const [avatarAccentColor, setAvatarAccentColor] = useState("#db2777");
  const [avatarAccessory, setAvatarAccessory] = useState("none");
  const [avatarEyeSize, setAvatarEyeSize] = useState(4);
  const [avatarMouth, setAvatarMouth] = useState("smile");
  const [avatarBgImage, setAvatarBgImage] = useState(null);

  const [imagePreview, setImagePreview] = useState(null);
  const [shelfPhotoHistory, setShelfPhotoHistory] = useState([]);
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("q") || "";
    } catch { return ""; }
  });
  const [filters, setFilters] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {
        vibe: params.get("vibe") || "",
        genre: params.get("genre") || "",
        minRating: params.get("minRating") || "",
      };
      // Use URL params if any are set, otherwise fall back to default
      const hasUrlFilters = Object.values(fromUrl).some(Boolean);
      return normalizeFilters(hasUrlFilters ? fromUrl : DEFAULT_FILTERS);
    } catch { return normalizeFilters(DEFAULT_FILTERS); }
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState("scan");
  const {
    user,
    setUser,
    authReady,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    authMessage,
    setAuthMessage,
    authLoading,
    setAuthLoading,
    handleAuthSubmit,
    handleGoogleLogin,
    handleAppleLogin,
    handleForgotPassword,
    handleResendVerification,
    handleRefreshVerification,
    handleSignOut,
    userDataLoadedRef,
  } = useAuth({ setCurrentPage });
  const {
    developerStats,
    developerUsage,
    developerIpUsage,
    developerEvents,
    developerStatsStatus,
  } = useDeveloper(user);




  const [selectedBook, setSelectedBook] = useState(null);
  const [similarBooksView, setSimilarBooksView] = useState(null);



  const [geminiUsage, setGeminiUsage] = useState(getInitialGeminiUsage);
  const [previewCache, setPreviewCache] = useState({});
  const [similarBooksCache, setSimilarBooksCache] = useState({});
  const [selectedLibraryCard, setSelectedLibraryCard] = useState(null);
  const previewCacheRef = useRef({});
  const previewRequestId = useRef(0);
  
  const {
    folderModal, setFolderModal,
    tagModal, setTagModal,
    openShelfLocations, setOpenShelfLocations,
    compare, setCompare,
    compareOpen, setCompareOpen,
    previewModal, setPreviewModal,
    manualBookForm, setManualBookForm,
    manualBookModalOpen, setManualBookModalOpen,
    betaUnlockPopupOpen, setBetaUnlockPopupOpen,
    libraryCardLoginPromptOpen, setLibraryCardLoginPromptOpen,
    scanLimitPromptOpen, setScanLimitPromptOpen,
    openSections, setOpenSections,
    discoverIndex, setDiscoverIndex,
    swipeHistory, setSwipeHistory,
    swipeDirection, setSwipeDirection,
    selectedDiscoverFolder, setSelectedDiscoverFolder,
    closeFolderModal,
    closeTagModal,
    openManualBookModal,
    closeManualBookModal,
    handleManualBookChange,
  } = useAppUI();
  
  const {
    scanHistory, setScanHistory,
    scanLimitModalState, setScanLimitModalState,
    anonymousScanCount, setAnonymousScanCount,
    isAnonymousPlus, setIsAnonymousPlus,
    userScanCount, setUserScanCount,
    isUserPlus, setIsUserPlus,
    setLastScanDate,
    checkScanLimit,
    incrementScanCount,
  } = useScan({ db, user });
  const [saveStatus, setSaveStatus] = useState(null);

  const {
    readingList, setReadingList,
    savedFiles, setSavedFiles,
    folders, setFolders,
    bookFolders, setBookFolders,
    bookTags, setBookTags,
    setActiveFolder,
    activeTagFilter, setActiveTagFilter,
    isBookInReadingList,
    hasSavedPreview,
    hasSavedDetails,
    toggleReadingList,
    assignBookFolder,
    deleteFolder,
    toggleBookTag,
    saveLocalPreviewFile,
  } = useLibrary({ setSaveStatus });
  const [idleBursts, setIdleBursts] = useState([]);
  const [savedArtActive, setSavedArtActive] = useState(false);

  const [fypBooks, setFypBooks] = useState([]);
  const [fypLoading, setFypLoading] = useState(false);
  const [fypError, setFypError] = useState("");



  const [filtersOpen, setFiltersOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" ? !navigator.onLine : false);
  const recognitionRef = useRef(null);
  const filterSearchRef = useRef(null);
  const libraryCardScanInputRef = useRef(null);

  const [libraryCards, setLibraryCards] = useState([]);
  const [libraryCardForm, setLibraryCardForm] = useState({
    name: "",
    cardNumber: "",
    imageDataUrl: "",
    imageName: "",
  });
  const [libraryCardMessage, setLibraryCardMessage] = useState("");


  const [cameraIdle, setCameraIdle] = useState(false);
  const [selectedPlusPlan, setSelectedPlusPlan] = useState(PLUS_PLANS[0].id);
  const [vibeStatus, setVibeStatus] = useState("");
  const [vibeAiResult, setVibeAiResult] = useState(null);
  const [vibeAiLoading, setVibeAiLoading] = useState("");
  const [vibeAiPreviews, setVibeAiPreviews] = useState({});
  const vibePhotoInputRef = useRef(null);
  const vibeAiCacheRef = useRef({});
  const [referralShares] = useState(0);


  const localUserStateRef = useRef({
    readingList,
    savedFiles,
    filters,
    books,
    geminiUsage,
    scanHistory,
    folders,
    bookFolders,
    libraryCards,
  });

  useEffect(() => {
    let listener = null;
    CapacitorApp.addListener("backButton", () => {
      if (selectedBook) {
        setSelectedBook(null);
      } else if (compareOpen) {
        setCompareOpen(false);
      } else if (similarBooksView) {
        setSimilarBooksView(null);
      } else if (previewModal) {
        setPreviewModal(null);
      } else if (folderModal.isOpen) {
        setFolderModal({ isOpen: false, name: "", book: null });
      } else if (manualBookModalOpen) {
        setManualBookModalOpen(false);
      } else if (scanLimitPromptOpen) {
        setScanLimitPromptOpen(false);
      } else if (currentPage !== "scan") {
        setCurrentPage("scan");
      } else {
        CapacitorApp.exitApp();
      }
    }).then((l) => {
      listener = l;
    });

    return () => {
      if (listener) listener.remove();
    };
  }, [
    currentPage,
    selectedBook,
    compareOpen,
    similarBooksView,
    previewModal,
    folderModal.isOpen,
    manualBookModalOpen,
    scanLimitPromptOpen
  ]);

  useEffect(() => {
    async function initStorage() {
      const isMigrated = await localforage.getItem("isMigratedToForage");
      if (!isMigrated) {
        for (const key of ["readingList", "savedPreviewFiles", "scanHistory", "folders", "bookFolders", "bookTags", "appTheme", "disableEmojis", "luminaAnonymousScanCount", "luminaIsPlusActive", "libraryCards"]) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            try {
              await localforage.setItem(key, JSON.parse(val));
            } catch {
              await localforage.setItem(key, val);
            }
          }
        }
        await localforage.setItem("isMigratedToForage", true);
      }

      const [
         rl, svf, sh, fldr, bfldr, btgs, 
         appT, disE, anonCount, anonPlus, lc, storedLastDate, storedUserPlus
      ] = await Promise.all([
         localforage.getItem("readingList"),
         localforage.getItem("savedPreviewFiles"),
         localforage.getItem("scanHistory"),
         localforage.getItem("folders"),
         localforage.getItem("bookFolders"),
         localforage.getItem("bookTags"),
         localforage.getItem("appTheme"),
         localforage.getItem("disableEmojis"),
         localforage.getItem("luminaAnonymousScanCount"),
         localforage.getItem("luminaIsPlusActive"),
         localforage.getItem("libraryCards"),
         localforage.getItem("luminaLastScanDate"),
         localforage.getItem("luminaIsUserPlusActive"),
      ]);
      
      if (rl) setReadingList(rl);
      if (svf) setSavedFiles(normalizeSavedFiles(svf));
      if (sh) setScanHistory(sh);
      if (fldr) setFolders(fldr);
      if (bfldr) setBookFolders(bfldr);
      if (btgs) setBookTags(btgs);
      if (appT) setAppTheme(appT);
      if (disE !== null) setDisableEmojis(disE);
      if (anonCount !== null) setAnonymousScanCount(anonCount);
      if (anonPlus !== null) setIsAnonymousPlus(anonPlus);
      if (storedUserPlus === true) setIsUserPlus(true); // Restore Plus status immediately without waiting for Firestore
      if (lc) setLibraryCards(normalizeLibraryCards(lc));
      if (storedLastDate) setLastScanDate(storedLastDate);

      setIsStoreLoaded(true);
    }
    initStorage();
  }, []);

  useEffect(() => {
    writeStoredJson("luminaReferralShares", referralShares);
  }, [referralShares]);

  useEffect(() => {
    logEvent(analytics, "app_opened");
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => Math.min(prev + 1, 3));
      }, 1800);
    } else {
      setLoadingStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  useEffect(() => {
    if (selectedBook) {
      window.scrollTo(0, 0);
      setTimeout(() => {
        const scrollEl = document.querySelector(".scan-modal-scroll");
        if (scrollEl) {
          scrollEl.scrollTop = 0;
        }
      }, 0);
    }
  }, [selectedBook]);

  useEffect(() => {
    writeStoredJson("readingList", readingList);
  }, [readingList]);

  useEffect(() => {
    writeStoredJson("savedPreviewFiles", savedFiles);

  }, [savedFiles]);

  useEffect(() => {
    writeStoredJson("geminiDailyUsage", geminiUsage);
  }, [geminiUsage]);

  useEffect(() => {
    writeStoredJson("openSections", openSections);
  }, [openSections]);

  // Sync search + filters to URL so the link is shareable
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filters.vibe) params.set("vibe", filters.vibe);
      if (filters.genre) params.set("genre", filters.genre);
      if (filters.minRating) params.set("minRating", filters.minRating);
      const qs = params.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    } catch { /* ignore */ }
  }, [search, filters]);

  // Camera idle pulse — starts 3s after landing on the scan page with nothing loaded
  useEffect(() => {
    if (currentPage !== "scan" || books.length > 0 || imagePreview || loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCameraIdle(false);
      return;
    }
    const t = setTimeout(() => setCameraIdle(true), 3000);
    return () => clearTimeout(t);
  }, [currentPage, books.length, imagePreview, loading]);

  useEffect(() => {
    writeStoredJson("scanHistory", scanHistory);
  }, [scanHistory]);

  useEffect(() => {
    writeStoredJson("disableEmojis", disableEmojis);
  }, [disableEmojis]);

  useEffect(() => {
    writeStoredJson("folders", folders);
  }, [folders]);

  useEffect(() => {
    writeStoredJson("bookFolders", bookFolders);
  }, [bookFolders]);

  useEffect(() => {
    writeStoredJson("bookTags", bookTags);
  }, [bookTags]);

  useEffect(() => {
    writeStoredJson("libraryCards", libraryCards);
  }, [libraryCards]);

  useEffect(() => {
    const initRevenueCat = async () => {
      if (isNativeApp && !IS_BETA_MODE) {
        try {
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
          if (isAndroidApp) {
            await Purchases.configure({ apiKey: "test_nhJMYDdQJKSDFIFhVBzrtniTUJi" });
          } else {
            await Purchases.configure({ apiKey: "test_nhJMYDdQJKSDFIFhVBzrtniTUJi" });
          }
        } catch (e) {
          console.error("Error initializing RevenueCat", e);
        }
      }
    };
    initRevenueCat();
  }, []);

  useEffect(() => {
    if (!authLoading) return undefined;

    const authTimeout = window.setTimeout(() => {
      setAuthLoading(false);
      setAuthMessage("Sign-in is taking too long. Try Google again, or use email login.");
    }, 20000);

    return () => window.clearTimeout(authTimeout);
  }, [authLoading]);

  useEffect(() => {
    localUserStateRef.current = {
      readingList,
      savedFiles,
      filters,
      books,
      geminiUsage,
      scanHistory,
      folders,
      bookFolders,
      bookTags,
      libraryCards,
    };
  }, [readingList, savedFiles, filters, books, geminiUsage, scanHistory, folders, bookFolders, bookTags, libraryCards]);

  useEffect(() => {
    if (
      selectedBook ||
      previewModal ||
      folderModal.isOpen ||
      manualBookModalOpen ||
      compareOpen ||
      scanLimitPromptOpen ||
      libraryCardLoginPromptOpen ||
      avatarModalOpen ||
      selectedLibraryCard ||
      betaUnlockPopupOpen ||
      scanLimitModalState
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [
    selectedBook,
    previewModal,
    folderModal.isOpen,
    manualBookModalOpen,
    compareOpen,
    scanLimitPromptOpen,
    libraryCardLoginPromptOpen,
    avatarModalOpen,
    selectedLibraryCard,
    betaUnlockPopupOpen,
    scanLimitModalState,
  ]);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (userDataLoadedRef.current) return;

    async function loadUserSyncData() {
      try {
        const firebaseUser = user;
        const userRef = doc(db, "users", firebaseUser.uid);
        
        // Fetch existing customPhotoURL and disableEmojis from Firestore
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        if (userData.customPhotoURL) {
          await localforage.setItem("profilePic_" + firebaseUser.uid, userData.customPhotoURL);
          setUser((prev) => ({ ...prev, customPhotoURL: userData.customPhotoURL }));
        }
        
        if (userData.scanCount !== undefined) {
          setUserScanCount(userData.scanCount);
        }
        if (userData.lastScanDate) {
          setLastScanDate(userData.lastScanDate);
        }
        if (userData.isPlusActive !== undefined) {
          setIsUserPlus(userData.isPlusActive);
          // Persist so Plus status is immediately available on next load
          localforage.setItem("luminaIsUserPlusActive", userData.isPlusActive);
        }

        let mergedDisableEmojis = disableEmojis;
        if (userData.disableEmojis !== undefined) {
          mergedDisableEmojis = userData.disableEmojis;
          setDisableEmojis(mergedDisableEmojis);
        }

        let mergedAppTheme = appTheme;
        if (userData.appTheme !== undefined) {
          mergedAppTheme = userData.appTheme;
          setAppTheme(mergedAppTheme);
        }

        await setDoc(
          userRef,
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: sanitizeDisplayName(getUserDisplayName(firebaseUser)),
            emailVerified: Boolean(firebaseUser.emailVerified),
            updatedAt: serverTimestamp(),
            disableEmojis: mergedDisableEmojis,
            appTheme: mergedAppTheme,
          },
          { merge: true }
        );
        const appStateRef = getUserAppStateRef(firebaseUser.uid);
        const readingListRef = doc(db, "users", firebaseUser.uid, "appData", `${APP_STATE_DOC}_readingList`);
        const savedFilesRef = doc(db, "users", firebaseUser.uid, "appData", `${APP_STATE_DOC}_savedFiles`);
        const scanHistoryRef = doc(db, "users", firebaseUser.uid, "appData", `${APP_STATE_DOC}_scanHistory`);

        const [mainSnap, readingListSnap, savedFilesSnap, scanHistorySnap] = await Promise.all([
          getDoc(appStateRef),
          getDoc(readingListRef),
          getDoc(savedFilesRef),
          getDoc(scanHistoryRef)
        ]);

        const cloudState = mainSnap?.exists() ? mainSnap.data() : null;
        if (cloudState) {
          if (readingListSnap?.exists()) cloudState.readingList = readingListSnap.data().items || [];
          if (savedFilesSnap?.exists()) cloudState.savedFiles = savedFilesSnap.data().items || [];
          if (scanHistorySnap?.exists()) cloudState.scanHistory = scanHistorySnap.data().items || [];
        }

        if (cloudState) {
          const localState = localUserStateRef.current;
          const cloudFilters = normalizeFilters(cloudState.filters);
          const localFilters = normalizeFilters(localState.filters);
          const mergedReadingList = mergeUniqueByKey(
            localState.readingList,
            Array.isArray(cloudState.readingList) ? cloudState.readingList : [],
            getBookKey
          );
          const mergedSavedFiles = mergeUniqueByKey(
            normalizeSavedFiles(localState.savedFiles || []),
            normalizeSavedFiles(cloudState.savedFiles || []),
            (file) => file.id
          );

          const mergedScanHistory = mergeUniqueByKey(
            Array.isArray(localState.scanHistory) ? localState.scanHistory : [],
            Array.isArray(cloudState.scanHistory) ? cloudState.scanHistory : [],
            (scan) => scan.id
          ).slice(0, 30);
          const mergedFolders = mergeUniqueByKey(
            Array.isArray(localState.folders) ? localState.folders : [],
            Array.isArray(cloudState.folders) ? cloudState.folders : [],
            (folder) => folder
          );
          const mergedBookFolders = {
            ...(cloudState.bookFolders && typeof cloudState.bookFolders === "object" ? cloudState.bookFolders : {}),
            ...(localState.bookFolders && typeof localState.bookFolders === "object" ? localState.bookFolders : {}),
          };
          const mergedBookTags = {
            ...(cloudState.bookTags && typeof cloudState.bookTags === "object" ? cloudState.bookTags : {}),
            ...(localState.bookTags && typeof localState.bookTags === "object" ? localState.bookTags : {}),
          };
          const mergedLibraryCards = mergeUniqueByKey(
            normalizeLibraryCards(localState.libraryCards || []),
            normalizeLibraryCards(cloudState.libraryCards || []),
            (card) => card.id
          ).slice(0, MAX_LIBRARY_CARDS);

          setReadingList(mergedReadingList);
          setSavedFiles(mergedSavedFiles);
          setFilters(hasActiveFilters(localFilters) ? localFilters : cloudFilters);
          setScanHistory(mergedScanHistory);
          setFolders(mergedFolders.length ? mergedFolders : DEFAULT_FOLDERS);
          setBookFolders(mergedBookFolders);
          setBookTags(mergedBookTags);
          setLibraryCards(mergedLibraryCards);
          setGeminiUsage(
            mergeGeminiUsage(
              cloudState.geminiUsage,
              localUserStateRef.current.geminiUsage
            )
          );
        } else {
          await saveUserAppState(firebaseUser.uid, localUserStateRef.current);
        }

        userDataLoadedRef.current = true;
      } catch (err) {
        console.error("Could not load user app data:", err);
        userDataLoadedRef.current = true;
      }
    }

    loadUserSyncData();
  }, [user]);

  useEffect(() => {
    if (!isSyncUser(user) || !userDataLoadedRef.current) {
      return undefined;
    }

    const saveTimer = window.setTimeout(() => {
      saveUserAppState(user.uid, {
        readingList,
        savedFiles,
        filters,
        books,
        geminiUsage,
        scanHistory,
        folders,
        bookFolders,
        bookTags,
        libraryCards,
      }).catch((err) => {
        console.error("Could not save user app data:", err);
      });
    }, 500);

    return () => window.clearTimeout(saveTimer);
  }, [user, readingList, savedFiles, filters, books, geminiUsage, scanHistory, folders, bookFolders, bookTags, libraryCards]);

  useEffect(() => {
    previewCacheRef.current = previewCache;
  }, [previewCache]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);


  function beginClaudeCall(callType) {
    const todayKey = getTodayKey();
    const now = new Date().toISOString();

    setGeminiUsage((currentUsage) => {
      const currentCount =
        currentUsage?.date === todayKey ? Number(currentUsage.count || 0) : 0;

      return {
        date: todayKey,
        count: currentCount + 1,
        promptTokens: Number(currentUsage?.promptTokens || 0),
        requestEvents: [
          ...getRecentEvents(currentUsage?.requestEvents, new Date(now).getTime()),
          now,
        ],
        tokenEvents: getRecentEvents(
          currentUsage?.tokenEvents,
          new Date(now).getTime()
        ),
        lastStatus: "Running",
        lastType: callType,
        lastUpdatedAt: now,
      };
    });
  }

  function finishClaudeCall(callType, status, tokenCount = 0) {
    const todayKey = getTodayKey();
    const now = new Date().toISOString();
    const nowTime = new Date(now).getTime();
    const tokens = Number(tokenCount || 0);

    setGeminiUsage((currentUsage) => ({
      date: todayKey,
      count:
        currentUsage?.date === todayKey ? Number(currentUsage.count || 0) : 0,
      promptTokens:
        (currentUsage?.date === todayKey
          ? Number(currentUsage.promptTokens || 0)
          : 0) + tokens,
      requestEvents: getRecentEvents(currentUsage?.requestEvents, nowTime),
      tokenEvents:
        tokens > 0
          ? [
              ...getRecentEvents(currentUsage?.tokenEvents, nowTime),
              { at: now, count: tokens },
            ]
          : getRecentEvents(currentUsage?.tokenEvents, nowTime),
      lastStatus: status,
      lastType: callType,
      lastUpdatedAt: now,
    }));
  }

  function handleScanPickerClick(event) {
    if (isFirebaseConfigured) return;

    event.preventDefault();
    setError("Firebase is not configured yet.");
  }

  async function ensureScanAuth() {
    if (!auth) {
      throw new Error("Firebase Authentication is not configured.");
    }
    if (auth.currentUser?.uid) {
      return auth.currentUser;
    }

    try {
      const credential = await signInAnonymously(auth);
      return credential.user;
    } catch (err) {
      if (String(err?.code || "").includes("admin-restricted-operation")) {
        throw new Error(
          "Guest scanning needs Anonymous sign-in enabled in Firebase Authentication. Open Firebase Console > Authentication > Sign-in method, then enable Anonymous.",
          { cause: err }
        );
      }
      throw err;
    }
  }

  async function ensureBarcodeScannerReady() {
    if (!isNativeApp) {
      throw new Error("Barcode scanning is only available in the iOS or Android app. Use Upload Photo on web.");
    }

    const support = await BarcodeScanner.isSupported();
    if (!support?.supported) {
      throw new Error("Barcode scanning is not supported on this device.");
    }

    if (isAndroidApp) {
      const moduleState = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!moduleState?.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        throw new Error("Installing the Google barcode scanner. Wait a moment, then tap Scan Barcode again.");
      }
      return;
    }

    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== "granted" && camera !== "limited") {
      throw new Error("Camera permission is required to scan barcodes.");
    }
  }

  function updateAuthForm(field, value) {
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setAuthMessage("");
  }

  function updateLibraryCardForm(field, value) {
    setLibraryCardForm((currentForm) => ({
      ...currentForm,
      [field]: field === "name" ? sanitizeLibraryCardName(value) : sanitizeLibraryCardNumber(value),
    }));
    setLibraryCardMessage("");
  }

  function requireLoginForLibraryCards() {
    setAuthMode("signin");
    setCurrentPage("account");
    setLibraryCardLoginPromptOpen(true);
  }

  function addLibraryCardFromForm(event) {
    event.preventDefault();

    if (!isSyncUser(user)) {
      requireLoginForLibraryCards();
      return;
    }

    if (libraryCards.length >= MAX_LIBRARY_CARDS) {
      setLibraryCardMessage(`You can keep up to ${MAX_LIBRARY_CARDS} library cards.`);
      return;
    }

    const cardNumber = sanitizeLibraryCardNumber(libraryCardForm.cardNumber);
    const name = sanitizeLibraryCardName(libraryCardForm.name) || "Library card";

    if (!cardNumber) {
      setLibraryCardMessage("Enter or scan a library card barcode.");
      return;
    }

    if (
      libraryCards.some(
        (card) =>
          sanitizeLibraryCardNumber(card.cardNumber).toLowerCase() ===
          cardNumber.toLowerCase()
      )
    ) {
      setLibraryCardMessage("That library card is already saved.");
      return;
    }

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `library-card-${Date.now()}`;

    setLibraryCards((currentCards) =>
      normalizeLibraryCards([
        {
          id,
          name,
          cardNumber,
          barcodeFormat: "CODE_128",
          imageDataUrl: libraryCardForm.imageDataUrl,
          imageName: libraryCardForm.imageName,
          addedAt: new Date().toISOString(),
        },
        ...currentCards,
      ])
    );
    setLibraryCardForm({ name: "", cardNumber: "", imageDataUrl: "", imageName: "" });
    setLibraryCardMessage("Library card saved.");
  }

  async function handleLibraryCardScan(file) {
    if (!file) return;

    if (!isSyncUser(user)) {
      requireLoginForLibraryCards();
      if (libraryCardScanInputRef.current) {
        libraryCardScanInputRef.current.value = "";
      }
      return;
    }

    setLibraryCardMessage("Scanning library card photo...");

    try {
      const imageDataUrl = await getImageDataUrl(file);
      const bitmap = await createImageBitmap(file);
      let barcodeValue = "";
      let detectedLibraryName = "";

      if ("BarcodeDetector" in window) {
        const detector = new window.BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"],
        });
        const barcodes = await detector.detect(bitmap);
        barcodeValue = sanitizeLibraryCardNumber(barcodes[0]?.rawValue || "");
      }

      bitmap.close?.();

      if (isClaudeConfigured) {
        try {
          await ensureScanAuth();
          const compressedFile = await compressImage(file);
          const base64 = await encodeFileToBase64(compressedFile);
          beginClaudeCall("Library card scan");
          const result = await generateClaudeContent([
            {
              role: "user",
              parts: [
                {
                  text: `
Read this library card image. Return ONLY valid JSON:
{
  "libraryName": "Library name visible on the card, or empty string",
  "cardNumber": "Barcode or card number visible on the card, or empty string"
}
Do not include explanations.
                  `,
                },
                {
                  inlineData: {
                    mimeType: file.type || "image/jpeg",
                    data: base64,
                  },
                },
              ],
            },
          ], {
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          }, "Library card scan");
          const parsed = safeParseJson(getClaudeText(result));
          detectedLibraryName = sanitizeLibraryCardName(parsed?.libraryName);
          barcodeValue =
            barcodeValue || sanitizeLibraryCardNumber(parsed?.cardNumber);
          finishClaudeCall(
            "Library card scan",
            "Success",
            getTotalTokenCount(result)
          );
        } catch (ocrErr) {
          console.error("Library card text scan failed:", ocrErr);
          finishClaudeCall("Library card scan", "Failed");
        }
      }

      setLibraryCardForm((currentForm) => ({
        ...currentForm,
        name: detectedLibraryName || currentForm.name,
        cardNumber: barcodeValue || currentForm.cardNumber,
        imageDataUrl,
        imageName: sanitizeLibraryCardName(file.name),
      }));
      setLibraryCardMessage(
        barcodeValue
          ? "Card photo saved and barcode scanned. Review, then save it."
          : "Card photo saved. Type the barcode number if it was not detected."
      );
    } catch (err) {
      console.error("Library card barcode scan failed:", err);
      setLibraryCardMessage("Could not scan that card photo. Try again or type it.");
    } finally {
      if (libraryCardScanInputRef.current) {
        libraryCardScanInputRef.current.value = "";
      }
    }
  }

  function deleteLibraryCard(cardId) {
    setLibraryCards((currentCards) =>
      currentCards.filter((card) => card.id !== cardId)
    );
    setLibraryCardMessage("Library card removed.");
  }
  async function handleBarcodeScan() {
    try {
      if (isOffline) {
        setError("You must be online to scan barcodes.");
        return;
      }
      if (!checkScanLimit()) return;
      
      setLoading(true);
      setLoadingStep(0);
      setError("");

      await ensureBarcodeScannerReady();
      const result = await BarcodeScanner.scan({
        formats: BOOK_BARCODE_FORMATS,
        autoZoom: true,
      });
      
      if (result.barcodes && result.barcodes.length > 0) {
        const barcode = sanitizeLibraryCardNumber(
          result.barcodes[0].displayValue || result.barcodes[0].rawValue || ""
        );
        if (!barcode) {
          setError("No ISBN barcode was detected. Try again with the back cover barcode centered.");
          return;
        }
        incrementScanCount();
        
        const searchGoogleBooks = httpsCallable(cloudFunctions, 'searchGoogleBooks');
        const res = await searchGoogleBooks({ query: `isbn:${barcode}`, limit: 1 });
        
        if (res.data?.items && res.data.items.length > 0) {
          const item = res.data.items[0];
          const volumeInfo = item.volumeInfo;
          
          setManualBookForm({
            title: volumeInfo.title || "",
            author: volumeInfo.authors ? volumeInfo.authors.join(", ") : "",
            genre: volumeInfo.categories ? volumeInfo.categories[0] : "",
            readingLevel: "Intermediate",
            rating: "4.0",
            summary: volumeInfo.description || "",
            whyRead: "Found via barcode scan",
            shelfLocation: "Unsorted",
            shelfPick: "Popular"
          });
          setManualBookModalOpen(true);
        } else {
          setError("No book found for ISBN " + barcode);
        }
      } else {
        setError("No ISBN barcode was detected. Try again with the back cover barcode centered.");
      }
    } catch (err) {
      console.error("Barcode scan failed:", err);
      const message = String(err?.message || "");
      setError(message || "Failed to scan barcode. Try again.");
    } finally {
      setLoading(false);
    }
  }


  async function handleImage(file) {
    if (!file) return;
    if (!checkScanLimit()) return;
    incrementScanCount();
    if (isOffline) {
      setError("You are offline. Scans are temporarily disabled.");
      return;
    }
    if (!isClaudeConfigured) {
      setError("Firebase is not configured yet.");
      return;
    }
    const quotaUser = isSyncUser(user) ? user : null;
    if (!canStartScan(quotaUser)) {
      setError(getScanLimitMessage(quotaUser));
      return;
    }

    setError("");
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setBooks([]);
    setPreviewCache({});
    setSearch("");
    setVoiceStatus("");
    setVoiceListening(false);
    recognitionRef.current?.abort();
    const newObjectUrl = URL.createObjectURL(file);
    setImagePreview(newObjectUrl);
    setShelfPhotoHistory((prev) => {
      const next = [newObjectUrl, ...prev.filter((u) => u !== newObjectUrl)];
      return next.slice(0, 5);
    });

    let geminiCallStarted = false;
    try {
      if (!canStartScan(quotaUser)) {
        setLoading(false);
        setError("Scan limit reached. Continue with Google to keep scanning.");
        setScanLimitPromptOpen(true);
        return;
      }

      await ensureScanAuth();
      const compressedFile = await compressImage(file);
      const base64 = await encodeFileToBase64(compressedFile);
      recordLocalScanUsage(quotaUser);
      beginClaudeCall("Bookshelf scan");
      geminiCallStarted = true;

      const result = await generateClaudeContent([
        {
          role: "user",
          parts: [
            {
              text: `
You are a careful library bookshelf assistant.

Look at this bookshelf image. Detect visible book titles from every readable surface: front covers, back covers, tilted books, stacked books, and book spines. Do not focus only on spines.

Return ONLY valid JSON in this exact format:

{
  "books": [
    {
      "title": "Book title",
      "author": "Author name or Unknown",
      "authorBio": "Short 1-2 sentence description of the author",
      "rating": 4.5,
      "ratingSource": "Goodreads, Amazon, Google Books, or Estimated",
      "summary": "Short useful summary",
      "genre": "Genre",
      "readingLevel": "Easy / Intermediate / Advanced",
      "gradeBand": "K-3 / 4-6 / 7+",
      "ageRecommendation": "Kids / Young Readers / Teen / Adult / All ages",
      "whyRead": "Why someone may like this book",
      "shelfPick": "Top Rated / Hidden Gem / Beginner Friendly / Popular / Educational",
      "shelfLocation": "Very detailed location in the photo, such as top row left side, middle row center, bottom row right side, third book from the left, leaning behind another book, or partly hidden",
      "scanConfidence": "Confidence: high / Confidence: medium / Confidence: low",
      "confidenceReason": "Brief note about what readable text or visual evidence supports this identification"
    }
  ]
}

Important:
- Inspect front cover faces and large cover titles before spines when covers are visible.
- Prefer a partial but honest title over a confident wrong title. If the title is partly visible, include the readable words and set scanConfidence to low.
- If rating is not visible, estimate a general public rating.
- If exact rating source is unknown, use "Estimated".
- Include a short author biography.
- Choose gradeBand carefully:
  - K-3 for grade 3 and below
  - 4-6 for grade 4 to grade 6
  - 7+ for grade 7 and above or teen/adult books
- Include at most 12 books.
- Do NOT hallucinate, guess, or invent books.
- Only list books if at least one meaningful title or author word is readable on a spine, front cover, or back cover.
- If an object is not clearly a book with readable text, ignore it.
- If several books are visible but not readable, omit them rather than filling in likely titles.
- For shelfLocation, describe exactly where the book appears in the image:
  row from top to bottom, left/middle/right section, order from left or right,
  whether it is vertical, horizontal, leaning, stacked, partly hidden, or near
  another visible book.
- Keep summaries short.
                `,
            },
            {
              inlineData: {
                mimeType: file.type || "image/jpeg",
                data: base64,
              },
            },
          ],
        },
      ], {
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      }, "Bookshelf scan");

      const text = getClaudeText(result);

      const parsed = safeParseJson(text);

      if (!parsed?.books || !Array.isArray(parsed.books)) {
        throw new Error("No books returned from Claude");
      }

      const scannedBooks = parsed.books.map(enrichScannedBook);
      const promptTokenCount = getPromptTokenCount(result);
      const totalTokenCount = getTotalTokenCount(result);
      const scanEntry = {
        id: `scan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        imageName: file.name || "bookshelf image",
        bookCount: scannedBooks.length,
        provider: result.provider || "claude",
        model: result.model || MODEL_NAME,
        promptTokens: promptTokenCount,
        totalTokens: totalTokenCount,
        books: scannedBooks,
      };
      setBooks(scannedBooks);
      if (isSyncUser(user)) {
        setScanHistory((currentHistory) => [scanEntry, ...currentHistory].slice(0, 30));
        await saveUserScan(user.uid, {
          books: scannedBooks,
          bookCount: scannedBooks.length,
          filters,
          image: {
            name: file.name || "bookshelf image",
            type: file.type || "image/jpeg",
            size: Number(file.size || 0),
          },
          model: result.model || MODEL_NAME,
          provider: result.provider || "claude",
          promptTokens: promptTokenCount,
          totalTokens: totalTokenCount,
          scannedAtLocalDate: getTodayKey(),
        });
      }
      finishClaudeCall("Bookshelf scan", "Success", totalTokenCount);
    } catch (err) {
      console.error("SCAN ERROR:", err);
      if (geminiCallStarted) {
        finishClaudeCall("Bookshelf scan", "Failed");
      }
      setError(getFriendlyScanError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVoiceSearch() {
    if (voiceListening) {
      recognitionRef.current?.stop();
      setVoiceListening(false);
      setVoiceStatus("Voice search stopped.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const microphoneSettingsMessage = isAndroidApp
      ? "Microphone permission is needed. Open Android Settings > Apps > Lumina > Permissions > Microphone, allow it, then try again."
      : "Microphone permission is needed. Allow microphone access for this app in your browser or device settings, then try again.";

    if (isAndroidApp && hasNativeSpeech && NativeSpeech?.start) {
      setVoiceListening(true);
      setVoiceStatus("Listening...");
      setError("");

      try {
        const result = await NativeSpeech.start({ language: "en-US" });
        const transcript = String(
          result?.transcript ||
            result?.text ||
            result?.value ||
            result?.matches?.[0] ||
            ""
        ).trim();

        if (!transcript) {
          setVoiceStatus("I did not catch that. Try again.");
          return;
        }

        setSearch(transcript);
        setVoiceStatus(`Voice searched: "${transcript}"`);
      } catch (err) {
        console.error("Native voice search failed:", err);
        filterSearchRef.current?.focus();
        setVoiceStatus(
          String(err?.message || "").toLowerCase().includes("permission")
            ? microphoneSettingsMessage
            : "Voice search could not hear you. Try again."
        );
      } finally {
        setVoiceListening(false);
      }
      return;
    }

    if (!SpeechRecognition) {
      filterSearchRef.current?.focus();
      setVoiceStatus(
        "Voice dictation is not available on this device. Type your search instead."
      );
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.error("Microphone permission failed:", err);
        filterSearchRef.current?.focus();
        setVoiceStatus(microphoneSettingsMessage);
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceStatus("Listening...");
      setError("");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      if (!transcript) {
        setVoiceStatus("I did not catch that. Try again.");
        return;
      }

      setSearch(transcript);
      setVoiceStatus(`Voice searched: "${transcript}"`);
    };

    recognition.onerror = (event) => {
      const blocked = event.error === "not-allowed" || event.error === "service-not-allowed";
      filterSearchRef.current?.focus();
      setVoiceStatus(
        blocked
          ? microphoneSettingsMessage
          : "Voice search could not hear you. Try again."
      );
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Voice search failed:", err);
      setVoiceListening(false);
      recognitionRef.current = null;
      setVoiceStatus("Voice search could not start. Try again.");
    }
  }

  const genreOptions = useMemo(() => {
    return [...new Set(books.map((book) => book.genre).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [books]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length + (search.trim() ? 1 : 0);
  }, [filters, search]);

  function updateFilter(filterName, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterName]: value,
    }));
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS });
    setSearch("");
    setVoiceStatus("");
    setFiltersOpen(false);
  }

  const filteredBooks = useMemo(() => {
    const intent = getSearchIntent(search);

    return books.filter(
      (book) =>
        matchesStructuredFilters(book, filters) &&
        matchesSearchIntent(book, intent)
    );
  }, [books, filters, search]);

  const topBooks = useMemo(() => {
    return [...filteredBooks]
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 3);
  }, [filteredBooks]);

  const detectedBooks = useMemo(() => {
    const topBookKeys = new Set(topBooks.map(getBookKey));
    return filteredBooks.filter((book) => !topBookKeys.has(getBookKey(book)));
  }, [filteredBooks, topBooks]);

  const selectedBookKey = selectedBook ? getBookKey(selectedBook) : "";
  const similarBooksState = selectedBookKey
    ? similarBooksCache[selectedBookKey]
    : null;
  const similarBooks = similarBooksState?.books || [];
  const shelfSimilarBooks = useMemo(() => {
    if (!selectedBookKey) return [];

    return books
      .filter((book) => getBookKey(book) !== selectedBookKey)
      .map((book) => ({
        book,
        score: scoreShelfSimilarBook(selectedBook, book),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ book }) => book);
  }, [books, selectedBook, selectedBookKey]);











  function saveManualBook(event) {
    event.preventDefault();
    const title = manualBookForm.title.trim();
    if (!title) {
      alert("Please enter a book title.");
      return;
    }

    const newBook = {
      title,
      author: manualBookForm.author.trim() || "Unknown",
      authorBio: "Manually entered book details.",
      rating: Number(manualBookForm.rating) || 4.0,
      ratingSource: "Estimated",
      summary: manualBookForm.summary.trim() || "Manual summary entry.",
      genre: manualBookForm.genre.trim() || "Book",
      readingLevel: manualBookForm.readingLevel || "Intermediate",
      gradeBand: manualBookForm.readingLevel === "Easy" ? "K-3" : manualBookForm.readingLevel === "Advanced" ? "7+" : "4-6",
      ageRecommendation: "All ages",
      whyRead: manualBookForm.whyRead.trim() || "Added manually by you.",
      shelfPick: manualBookForm.shelfPick || "Popular",
      shelfLocation: manualBookForm.shelfLocation.trim() || "Manual Entry",
      scanConfidence: "high confidence",
      confidenceReason: "Manually entered details.",
      reviewed: true,
    };

    setBooks((current) => [newBook, ...current]);
    
    setReadingList((currentList) => {
      const bookKey = getBookKey(newBook);
      if (currentList.some((b) => getBookKey(b) === bookKey)) {
        return currentList;
      }
      return [{ ...newBook, savedAt: new Date().toISOString() }, ...currentList];
    });

    setSaveStatus({
      message: `Manual entry "${newBook.title}" saved.`,
      bookKey: getSavedFileKey(newBook.title, "favorite"),
      type: "favorite",
    });

    closeManualBookModal();
  }

  const AVAILABLE_TAGS = ["🌶️", "😭", "✨", "🤯", "💀", "📖", "🎧"];





  function saveFolderFromModal(event) {
    event.preventDefault();

    const cleanName = folderModal.name.trim();
    if (!cleanName) return;

    const existingFolder = folders.find(
      (folder) => folder.toLowerCase() === cleanName.toLowerCase()
    );
    const nextFolder = existingFolder || cleanName;

    if (!existingFolder) {
      setFolders((currentFolders) => [...currentFolders, nextFolder]);
    }

    setActiveFolder(nextFolder);
    if (folderModal.book) {
      assignBookFolder(folderModal.book, nextFolder);
    }
    setSaveStatus({
      message: existingFolder
        ? `${nextFolder} folder opened.`
        : folderModal.book
          ? `${nextFolder} folder created and ${folderModal.book.title} was added.`
          : `${nextFolder} folder created.`,
      bookKey: folderModal.book
        ? getSavedFileKey(folderModal.book.title, "favorite")
        : "folder",
      type: folderModal.book ? "favorite" : "folder",
    });
    closeFolderModal();
  }

  function createFolder() {
    setFolderModal({ isOpen: true, book: null, name: "" });
  }

  function createFolderForBook(book) {
    setFolderModal({ isOpen: true, book: book, name: "" });
  }

  function handleFolderSelect(book, folderName) {
    if (folderName === NEW_FOLDER_OPTION) {
      createFolderForBook(book);
      return;
    }

    assignBookFolder(book, folderName);
  }


  function getPreviewButtonState(book) {
    const cachedPreview = previewCache[getBookKey(book)];

    if (cachedPreview?.status === "ready") {
      return {
        label: hasSavedPreview(book) ? "Saved Preview" : "Preview Available",
        disabled: false,
        saved: hasSavedPreview(book),
      };
    }

    if (cachedPreview?.status === "loading") {
      return {
        label: "Checking preview...",
        disabled: true,
        saved: false,
      };
    }

    if (cachedPreview?.status === "unavailable") {
      return {
        label: "No preview available",
        disabled: true,
        saved: false,
      };
    }

    if (cachedPreview?.status === "error") {
      return {
        label: "No preview available",
        disabled: false,
        saved: false,
      };
    }

    return {
      label: hasSavedPreview(book) ? "Saved Preview" : "Preview",
      disabled: false,
      saved: hasSavedPreview(book),
    };
  }

  function updateBookPreviewCache(key, previewResult) {
    previewCacheRef.current = {
      ...previewCacheRef.current,
      [key]: previewResult,
    };
    setPreviewCache(previewCacheRef.current);
  }

  function deleteSavedBook(savedBook) {
    const idsToDelete = new Set(savedBook.ids);

    setSavedFiles((currentFiles) =>
      currentFiles.filter((file) => !idsToDelete.has(file.id))
    );
    setSaveStatus({
      message: `${savedBook.bookTitle} deleted from this phone.`,
      bookKey: savedBook.id,
      type: "delete",
    });
  }

  function toggleCompare(book) {
    setCompare((currentCompare) => {
      const exists = currentCompare.some((b) => getBookKey(b) === getBookKey(book));

      if (exists) {
        return currentCompare.filter((b) => getBookKey(b) !== getBookKey(book));
      }

      const nextCompare =
        currentCompare.length < 2
          ? [...currentCompare, book]
          : [currentCompare[1], book];

      if (nextCompare.length === 2) setCompareOpen(true);
      return nextCompare;
    });
  }

  const loadSimilarBooks = useCallback(async (book) => {
    const bookKey = getBookKey(book);
    if (!bookKey) return;

    if (!isFirebaseConfigured || !cloudFunctions) {
      setSimilarBooksCache((currentCache) => ({
        ...currentCache,
        [bookKey]: {
          status: "error",
          message:
            "Backend is not configured, so global similar books cannot be loaded.",
          books: [],
        },
      }));
      return;
    }

    setSimilarBooksCache((currentCache) => ({
      ...currentCache,
      [bookKey]: {
        status: "loading",
        message: "Finding similar books across Google Books...",
        books: currentCache[bookKey]?.books || [],
      },
    }));

    try {
      const searchGoogleBooks = httpsCallable(cloudFunctions, 'searchGoogleBooks');
      const response = await searchGoogleBooks({
        params: {
          q: getGoogleBooksSimilarQuery(book),
          maxResults: "30",
          printType: "books",
          orderBy: "relevance",
          fields:
            "items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,categories,averageRating))",
        }
      });

      const data = response.data;
      const seen = new Set([normalizeBookText(book.title)]);
      const recommendedBooks = (data.items || [])
        .map((item) => ({
          item,
          score: scoreSimilarGoogleBook(book, item),
        }))
        .filter(({ item, score }) => {
          const titleKey = normalizeBookText(item?.volumeInfo?.title);
          if (score <= 0 || !titleKey || seen.has(titleKey)) return false;
          seen.add(titleKey);
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ item }) => mapGoogleBookToCatalogBook(item, book));

      setSimilarBooksCache((currentCache) => ({
        ...currentCache,
        [bookKey]: {
          status: recommendedBooks.length ? "ready" : "empty",
          message: recommendedBooks.length
            ? "Similar books loaded from Google Books."
            : "No global similar books were found for this title right now.",
          books: recommendedBooks,
        },
      }));
    } catch (err) {
      console.error("Similar books lookup failed:", err);
      setSimilarBooksCache((currentCache) => ({
        ...currentCache,
        [bookKey]: {
          status: "error",
          message:
            "Could not load global similar books. Check your connection and try again.",
          books: [],
        },
      }));
    }
  }, []);

  const loadFypRecommendations = useCallback(async () => {
    if (!isFirebaseConfigured || !cloudFunctions || savedFiles.length === 0) {
      setFypError("Save some books first to get FYP recommendations!");
      return;
    }
    setFypLoading(true);
    setFypError("");
    try {
      const validBooks = savedFiles.map(f => f.payload?.catalogBook).filter(Boolean);
      if (validBooks.length === 0) {
         setFypLoading(false);
         setFypError("Save some books first to get FYP recommendations!");
         return;
      }
      
      const baseBook = validBooks[Math.floor(Math.random() * validBooks.length)];
      const searchGoogleBooks = httpsCallable(cloudFunctions, 'searchGoogleBooks');
      const response = await searchGoogleBooks({
        params: {
          q: getGoogleBooksSimilarQuery(baseBook),
          maxResults: "40",
          printType: "books",
          orderBy: "relevance",
          fields: "items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,categories,averageRating))",
        }
      });
      
      const data = response.data;
      const seen = new Set(validBooks.map(b => normalizeBookText(b.title)));
      const recommendedBooks = (data.items || [])
        .map((item) => ({
          item,
          score: scoreSimilarGoogleBook(baseBook, item),
        }))
        .filter(({ item, score }) => {
          const titleKey = normalizeBookText(item?.volumeInfo?.title);
          if (score <= 0 || !titleKey || seen.has(titleKey)) return false;
          seen.add(titleKey);
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(({ item }) => {
          const book = mapGoogleBookToCatalogBook(item, baseBook);
          const tags = [];
          const genre = item?.volumeInfo?.categories?.[0] || "";
          const desc = item?.volumeInfo?.description || "";
          if (genre.toLowerCase().includes("romance") || desc.toLowerCase().includes("love")) tags.push("✨");
          if (genre.toLowerCase().includes("thriller") || genre.toLowerCase().includes("horror")) tags.push("💀");
          if (desc.toLowerCase().includes("drama") || desc.toLowerCase().includes("secret")) tags.push("☕️");
          if (item?.volumeInfo?.averageRating >= 4.5) tags.push("🔥");
          if (tags.length === 0) tags.push("📚");
          book.emojiTags = tags;
          return book;
        });

      setFypBooks(recommendedBooks);
      setDiscoverIndex(0);
      setSwipeHistory([]);
    } catch (err) {
      console.error("FYP recommendations failed:", err);
      setFypError("Failed to load FYP recommendations.");
    } finally {
      setFypLoading(false);
    }
  }, [isFirebaseConfigured, cloudFunctions, savedFiles]);

  useEffect(() => {
    if (currentPage === "discover" && fypBooks.length === 0 && !fypLoading && !fypError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadFypRecommendations();
    }
  }, [currentPage, fypBooks.length, fypLoading, fypError, loadFypRecommendations]);

  const findBookPreview = useCallback(async (book) => {
    if (!isFirebaseConfigured || !cloudFunctions) {
      return {
        status: "error",
        message:
          "Backend is not configured. Google Books preview cannot be loaded.",
      };
    }

    const query = getGoogleBooksQuery(book);
    if (!query) {
      return {
        status: "error",
        message: "Could not search Google Books because this book is missing a title.",
      };
    }

    try {
      const searchGoogleBooks = httpsCallable(cloudFunctions, 'searchGoogleBooks');
      const response = await searchGoogleBooks({
        params: {
          q: query,
          maxResults: "20",
          printType: "books",
          fields:
            "items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,categories),accessInfo(embeddable,viewability,webReaderLink))",
        }
      });

      const data = response.data;
      const rankedBooks = (data.items || [])
        .map((item) => ({ item, score: scoreGoogleBooksMatch(book, item) }))
        .sort((a, b) => b.score - a.score);
      const matchingBooks = rankedBooks.filter(({ score }) => score >= 50);
      const embeddableBook = matchingBooks.find(
        ({ item }) =>
          item?.id &&
          item?.accessInfo?.embeddable &&
          item?.accessInfo?.viewability !== "NO_PAGES"
      )?.item;

      if (!embeddableBook) {
        return {
          status: "unavailable",
          message: "No preview available",
          checkedResults: data.items?.length || 0,
        };
      }

      return {
        status: "ready",
        title: embeddableBook.volumeInfo?.title || book.title,
        embedUrl: getGoogleBooksEmbedUrl(embeddableBook.id),
        googleBooksTitle: embeddableBook.volumeInfo?.title || "",
        googleBooksAuthors: embeddableBook.volumeInfo?.authors || [],
        googleBooksDescription: embeddableBook.volumeInfo?.description || "",
        googleBooksCategories: embeddableBook.volumeInfo?.categories || [],
        googleBooksViewability: embeddableBook.accessInfo?.viewability || "",
        googleBooksReaderLink: embeddableBook.accessInfo?.webReaderLink || "",
      };
    } catch (err) {
      console.error("Google Books preview lookup failed:", err);
      if (err?.name === "AbortError") {
        return {
          status: "unavailable",
          message: "No preview available",
        };
      }

      return {
        status: "error",
        message:
          "Could not load the preview. Check your connection and try again.",
      };
    }
  }, []);

  useEffect(() => {
    if (books.length === 0) return;

    let cancelled = false;
    const fallbackTimers = [];

    books.forEach((book) => {
      const key = getBookKey(book);
      const cachedPreview = previewCacheRef.current[key];
      const loadingAge =
        cachedPreview?.status === "loading"
          ? getTimestamp() - Number(cachedPreview.startedAt || 0)
          : 0;

      if (
        !key ||
        (cachedPreview &&
          cachedPreview.status !== "loading" &&
          cachedPreview.status !== "error") ||
        (cachedPreview?.status === "loading" &&
          loadingAge < GOOGLE_BOOKS_PREVIEW_STALE_MS)
      ) {
        return;
      }

      const loadingPreview = {
        status: "loading",
        message: "Checking preview availability...",
        startedAt: getTimestamp(),
      };

      updateBookPreviewCache(key, loadingPreview);

      const fallbackTimer = window.setTimeout(() => {
        if (
          !cancelled &&
          previewCacheRef.current[key]?.status === "loading" &&
          previewCacheRef.current[key]?.startedAt === loadingPreview.startedAt
        ) {
          updateBookPreviewCache(key, {
            status: "unavailable",
            message: "No preview available",
          });
        }
      }, GOOGLE_BOOKS_PREVIEW_STALE_MS);
      fallbackTimers.push(fallbackTimer);

      findBookPreview(book).then((previewResult) => {
        window.clearTimeout(fallbackTimer);
        if (cancelled) return;

        updateBookPreviewCache(key, previewResult);
      });
    });

    return () => {
      cancelled = true;
      fallbackTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [books, findBookPreview]);

  async function openPreview(book) {
    if (!book?.title) {
      setPreviewModal({
        book: book || { title: "Book preview" },
        status: "error",
        message: "Preview needs a book title first.",
      });
      return;
    }

    const key = getBookKey(book);
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;

    const savedFile = savedFiles.find((f) => f.payload?.catalogBook && getBookKey(f.payload.catalogBook) === key);
    if (savedFile?.payload?.preview) {
      setPreviewModal({
        book,
        ...savedFile.payload.preview,
        status: savedFile.payload.preview.status || "error",
        message: savedFile.payload.preview.message || "",
        source: "saved",
      });
      return;
    }

    setPreviewModal({
      book,
      status: "loading",
      message: "Loading Google Books preview...",
    });

    const cachedPreview = previewCache[key];
    const cachedPreviewIsFreshLoading =
      cachedPreview?.status === "loading" &&
      getTimestamp() - Number(cachedPreview.startedAt || 0) <
        GOOGLE_BOOKS_PREVIEW_STALE_MS;

    if (
      cachedPreview &&
      cachedPreview.status !== "error" &&
      cachedPreview.status !== "loading"
    ) {
      setPreviewModal({ book, ...previewCache[key] });
      return;
    }

    if (cachedPreviewIsFreshLoading) return;

    let previewResult;
    try {
      previewResult = await findBookPreview(book);
    } catch (err) {
      console.error("Preview failed unexpectedly:", err);
      previewResult = {
        status: "error",
        message: "Preview could not be opened right now.",
      };
    }

    if (previewRequestId.current !== requestId) return;

    setPreviewCache((currentCache) => ({
      ...currentCache,
      [key]: previewResult,
    }));
    setPreviewModal({ book, ...previewResult });
  }

  function closePreview() {
    previewRequestId.current += 1;
    setPreviewModal(null);
  }



  function downloadPreviewDetails() {
    if (!previewModal?.book) return;

    const book = previewModal.book;
    const fileName = `${getSafeFileName(book.title)}-preview-details.json`;
    const payload = {
      savedAt: new Date().toISOString(),
      catalogBook: getBookDetailsPayload(book),
      preview: {
        status: previewModal.status,
        message: previewModal.message || "",
        embedUrl: previewModal.embedUrl || "",
        googleBooksTitle: previewModal.googleBooksTitle || "",
        googleBooksAuthors: previewModal.googleBooksAuthors || [],
        googleBooksCategories: previewModal.googleBooksCategories || [],
        googleBooksViewability: previewModal.googleBooksViewability || "",
        googleBooksReaderLink: previewModal.googleBooksReaderLink || "",
      },
      note:
        "This file saves Lumina and Google Books preview metadata. Preview pages are displayed by Google Books and are not downloaded.",
    };

    saveLocalPreviewFile(
      fileName,
      payload,
      book.title,
      `${book.title} preview`,
      "preview"
    );
  }

  function downloadBookDetails(book) {
    if (!book) return;

    const payload = {
      savedAt: new Date().toISOString(),
      catalogBook: getBookDetailsPayload(book),
    };

    saveLocalPreviewFile(
      `${getSafeFileName(book.title)}-details.json`,
      payload,
      book.title,
      `${book.title} details`,
      "details"
    );
  }

  function openSavedBookPreview(savedBook) {
    if (!savedBook?.catalogBook || !savedBook?.preview) return;

    setPreviewModal({
      book: savedBook.catalogBook,
      ...savedBook.preview,
      status: savedBook.preview.status || "error",
      message: savedBook.preview.message || "",
      source: "saved",
    });
  }

  function showPreviewBookDetails() {
    if (!previewModal?.book) return;

    setSelectedBook(previewModal.book);
    closePreview();
  }

  function renderBookCard(book, index, options = {}) {
    const theme = getTheme(book);
    const favoriteSaved = isBookInReadingList(book);
    const compareSelected = compare.some((selectedBook) => getBookKey(selectedBook) === getBookKey(book));
    const confidence = getScanConfidenceDisplayLabel(book);
    const bookKey = getBookKey(book) || `${book.title}-${index}`;
    const shelfLocationOpen = Boolean(openShelfLocations[bookKey]);

    return (
      <div
        key={`${book.title}-${options.prefix || "book"}-${index}`}
        className="book-card"
        style={{
          ...styles.card,
          background: theme.cardBg,
          border: `3px solid ${theme.border}`,
        }}
        onClick={() => {
          setSelectedBook(book);
          setSimilarBooksView(null);
        }}
      >
        {!options.compact && (
          <button
            type="button"
            style={{
              ...styles.favoriteButtonFloating,
              color: favoriteSaved ? "#ef4444" : "#94a3b8",
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleReadingList(book);
            }}
            aria-label={favoriteSaved ? "Remove favorite" : "Add favorite"}
            title={favoriteSaved ? "Remove favorite" : "Add favorite"}
          >
            ♥
          </button>
        )}

        <div style={styles.bookImage}>
          <span style={styles.cardBookOne} />
          <span style={styles.cardBookTwo} />
          <span style={styles.cardBookThree} />
          <span style={styles.cardLens} />
        </div>

        <h3 style={{ ...styles.cardTitle, color: theme.title }}>{book.title}</h3>

        {options.prefix !== "library" && options.prefix !== "saved-file" && (
          <div style={styles.metaPillRow}>
            <span style={styles.metaPill}>{confidence}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", margin: "8px 0" }}>
          {(bookTags[bookKey] || []).map(tag => (
            <span key={tag} style={{ fontSize: "14px", padding: "2px 6px", background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "12px" }}>
              {tag}
            </span>
          ))}
          {options.prefix === "library" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTagModal({ isOpen: true, bookKey });
              }}
              style={{ fontSize: "12px", padding: "2px 8px", background: "none", border: "1px dashed var(--border)", borderRadius: "12px", cursor: "pointer", color: "var(--text-l)" }}
            >
              + 🏷️
            </button>
          )}
        </div>

        {options.compact ? (
          <>
            <p>⭐ {book.rating}</p>
            <p>{book.readingLevel}</p>
            <p>{book.whyRead}</p>
          </>
        ) : (
          <>
            <p>
              <b>Author:</b> {book.author}
            </p>

            <p style={styles.rating}>
              <b>Rating:</b> ⭐ {book.rating}
            </p>

            <p>
              <b>Genre:</b> {book.genre}
            </p>

            <p>
              <b>Level:</b> {book.readingLevel}
            </p>

            <p>
              <b>Grade:</b> {book.gradeBand || "Not listed"}
            </p>

            <p>{book.summary}</p>

            {options.prefix === "library" && (
              <div style={{ marginTop: "12px", width: "100%" }}>
                <select
                  value={bookFolders[bookKey] || "Want to read"}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    setBookFolders((prev) => ({
                      ...prev,
                      [bookKey]: e.target.value
                    }));
                  }}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    fontSize: "13px",
                    color: "var(--text)",
                    outline: "none"
                  }}
                >
                  {["Want to read", ...folders].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={styles.buttonRow}>
              {options.prefix === "saved-file" ? (
                <>

                  {canOpenSavedBookPreview(options.savedBook) && (
                    <button
                      type="button"
                      style={styles.smallButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        openSavedBookPreview(options.savedBook);
                      }}
                    >
                      Open Preview
                    </button>
                  )}
                  <button
                    type="button"
                    style={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete the downloaded file for "${book.title}"?`)) {
                        deleteSavedBook(options.savedBook);
                      }
                    }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                options.prefix !== "library" && (
                  <button
                    type="button"
                    disabled={books.length < 3}
                    style={{
                      ...styles.smallButton,
                      ...(shelfLocationOpen ? styles.selectedButton : {}),
                      ...(books.length < 3 ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenShelfLocations((locations) => ({
                        ...locations,
                        [bookKey]: !shelfLocationOpen,
                      }));
                    }}
                  >
                    {e("📍", "Locate on Shelf")}
                  </button>
                )
              )}

              <button
                type="button"
                style={{
                  ...styles.smallButton,
                  ...(compareSelected ? styles.selectedButton : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompare(book);
                }}
              >
                {compareSelected ? "Remove from Compare" : e("⚖️", "Compare")}
              </button>
            </div>

            {options.prefix !== "library" && shelfLocationOpen && (
              <p style={styles.shelfLocationNote}>
                <b>Where it is:</b> {book.shelfLocation}
              </p>
            )}
          </>
        )}

        {options.topPick && (
          <p
            style={{
              ...styles.badge,
              ...getShelfPickStyle(book.shelfPick),
            }}
          >
            {book.shelfPick}
          </p>
        )}
      </div>
    );
  }

  function renderFilterControls() {
    return (
      <section style={styles.filterPanel}>
        <div style={styles.filterHeader}>
          <button
            type="button"
            style={styles.filterTitleButton}
            onClick={() => setFiltersOpen((isOpen) => !isOpen)}
            aria-expanded={filtersOpen}
          >
            <span style={styles.filterTitle}>Filters</span>
            <span style={styles.filterCountBadge}>{activeFilterCount}</span>
            <span style={styles.filterChevron}>{filtersOpen ? "▲" : "▼"}</span>
          </button>
          <div style={styles.filterHeaderActions}>
            <button
              type="button"
              style={styles.clearFilterButton}
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={styles.filterComposer}>
          <input
            ref={filterSearchRef}
            style={styles.filterSearchInput}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder={
              voiceListening
                ? "Listening for genre, age, rating, or level..."
                : "Search or speak filters..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const trimmedSearch = search.trim();
                setVoiceStatus(
                  trimmedSearch
                    ? `Searched: "${trimmedSearch}"`
                    : "Type or speak a filter search first."
                );
              }
            }}
          />
          <button
            type="button"
            style={{
              ...styles.iconComposerButton,
              ...(voiceListening ? styles.iconComposerButtonActive : {}),
            }}
            onClick={handleVoiceSearch}
            aria-label={voiceListening ? "Stop voice search" : "Start voice search"}
            aria-pressed={voiceListening}
          >
            {voiceListening ? "■" : "🎙"}
          </button>
          <button
            type="button"
            style={styles.clearComposerButton}
            onClick={() => {
              setSearch("");
              setVoiceStatus("Search cleared.");
            }}
            aria-label="Clear search"
            title="Clear search"
          >
            ✕
          </button>
          <button
            type="button"
            style={styles.sendComposerButton}
            onClick={() => {
              const trimmedSearch = search.trim();
              setVoiceStatus(
                trimmedSearch
                  ? `Searched: "${trimmedSearch}"`
                  : "Type or speak a filter search first."
              );
            }}
            aria-label="Search filters"
          >
            ↑
          </button>

        </div>

        {voiceStatus && <p style={styles.voiceStatus}>{voiceStatus}</p>}

        {!filtersOpen && activeFilterCount > 0 && (
          <p style={styles.filterSummary}>
            {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
          </p>
        )}

        {filtersOpen && <div style={styles.filterGrid}>
          <label style={styles.filterLabel}>
            <span>Genre</span>
            <select
              style={styles.filterControl}
              value={filters.genre || ""}
              onChange={(event) => updateFilter("genre", event.target.value)}
            >
              <option value="">Any genre</option>
              {genreOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.filterLabel}>
            <span>Vibe Check</span>
            <select
              style={styles.filterControl}
              value={filters.vibe || ""}
              onChange={(event) => updateFilter("vibe", event.target.value)}
            >
              <option value="">Any vibe</option>
              {FILTER_OPTIONS.vibe.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.filterLabel}>
            <span>Rating</span>
            <select
              style={styles.filterControl}
              value={filters.minRating}
              onChange={(event) => updateFilter("minRating", event.target.value)}
            >
              <option value="">Any rating</option>
              {FILTER_OPTIONS.minRating.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}+ stars
                </option>
              ))}
            </select>
          </label>

          <label style={styles.filterLabel}>
            <span>Reading Level</span>
            <select
              style={styles.filterControl}
              value={filters.readingLevel || ""}
              onChange={(event) => updateFilter("readingLevel", event.target.value)}
            >
              <option value="">Any level</option>
              {FILTER_OPTIONS.readingLevel.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>

          <label style={styles.filterLabel}>
            <span>Grade Band</span>
            <select
              style={styles.filterControl}
              value={filters.gradeBand || ""}
              onChange={(event) => updateFilter("gradeBand", event.target.value)}
            >
              <option value="">Any grade</option>
              {FILTER_OPTIONS.gradeBand.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </label>

          <label style={styles.filterLabel}>
            <span>Age</span>
            <select
              style={styles.filterControl}
              value={filters.ageRecommendation || ""}
              onChange={(event) => updateFilter("ageRecommendation", event.target.value)}
            >
              <option value="">Any age</option>
              {FILTER_OPTIONS.ageRecommendation.map((age) => (
                <option key={age} value={age}>{age}</option>
              ))}
            </select>
          </label>
        </div>}
      </section>
    );
  }

  function renderLoginPage() {
    const isSignUp = authMode === "signup";
    const accountUser = isSyncUser(user) ? user : null;

    const handleProfilePictureUpload = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_SIZE = 512;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round(height * (MAX_SIZE / width));
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round(width * (MAX_SIZE / height));
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

          try {
            setAuthLoading(true);
            if (auth.currentUser) {
              localforage.setItem("profilePic_" + auth.currentUser.uid, dataUrl);
              setUser((prev) => ({ ...prev, customPhotoURL: dataUrl }));
              
              if (db) {
                const userRef = doc(db, "users", auth.currentUser.uid);
                await setDoc(userRef, { customPhotoURL: dataUrl }, { merge: true });
              }

              setAuthMessage("Profile picture updated!");
            }
          } catch (error) {
            console.error("Error updating profile picture", error);
            setAuthMessage("Failed to update profile picture: " + error.message);
          } finally {
            setAuthLoading(false);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    if (accountUser) {
      return (
        <section style={styles.authPanel}>
          <div style={styles.authHeader}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <label style={{ cursor: "pointer", position: "relative", flexShrink: 0 }}>
                    {accountUser.customPhotoURL || accountUser.photoURL ? (
	                    <img src={accountUser.customPhotoURL || accountUser.photoURL} alt="Profile" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent)" }} />
	                  ) : (
	                    <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--code-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
	                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
	                        <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="var(--text)"/>
	                      </svg>
	                    </div>
	                  )}
	                  <div style={{ position: "absolute", bottom: "-4px", right: "-4px", background: "var(--social-bg)", border: "1px solid var(--border)", borderRadius: "50%", padding: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
	                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfilePictureUpload} disabled={authLoading} />
                  </label>
                  <div>
                    <h2 style={{ ...styles.authTitle, marginBottom: "4px" }}>Account</h2>
                    <p style={{ ...styles.authSubtitle, margin: 0 }}>
                      Signed in as {getUserDisplayName(accountUser)}
                      {accountUser.email ? ` (${accountUser.email})` : ""}.
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  style={{...styles.authSecondaryButton, padding: "6px 12px", fontSize: "12px", background: "transparent", color: "#ef4444", border: "1px solid #ef4444"}} 
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>

              {/* Cartoon Selection */}
	              <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
	                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>Choose a cartoon character:</span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {CARTOONS.map((cartoon) => {
                    const cartoonUrl = "data:image/svg+xml;utf8," + encodeURIComponent(cartoon.svg);
                    const isSelected = accountUser.customPhotoURL === cartoonUrl;
                    return (
                      <button
                        key={cartoon.name}
                        type="button"
                        style={{
                          padding: 0,
	                          border: isSelected ? "3px solid var(--accent)" : "1.5px solid var(--border)",
                          background: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          transition: "all 150ms",
                          transform: isSelected ? "scale(1.1)" : "none",
	                          backgroundColor: "var(--code-bg)"
                        }}
                        onClick={async () => {
                          try {
                            setAuthLoading(true);
                            localforage.setItem("profilePic_" + auth.currentUser.uid, cartoonUrl);
                            setUser((prev) => ({ ...prev, customPhotoURL: cartoonUrl }));
                            
                            if (db) {
                              const userRef = doc(db, "users", auth.currentUser.uid);
                              await setDoc(userRef, { customPhotoURL: cartoonUrl }, { merge: true });
                            }
                            setAuthMessage("Profile picture updated with cartoon!");
                          } catch (err) {
                            console.error("Error setting cartoon profile", err);
                          } finally {
                            setAuthLoading(false);
                          }
                        }}
                        title={cartoon.name}
                      >
                        <div dangerouslySetInnerHTML={{ __html: cartoon.svg }} style={{ width: "100%", height: "100%" }} />
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    style={{
                      ...styles.authSecondaryButton,
                      fontSize: "12px",
                      padding: "6px 12px",
                      borderRadius: "6px",
	                      background: "var(--accent)",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setAvatarBgColor("#fbcfe8");
                      setAvatarAccentColor("#db2777");
                      setAvatarAccessory("none");
                      setAvatarEyeSize(4);
                      setAvatarMouth("smile");
                      setAvatarBgImage(null);
                      setAvatarModalOpen(true);
                    }}
                  >
                    🎨 Create Character
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!accountUser.emailVerified && (
            <p style={styles.authNotice}>
              Your email is not verified yet. Verify it to protect the account
              and unlock full saved-list sync.
            </p>
          )}

          {/* Personalize Section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "16px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px" }}>✨</span>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-h)", margin: 0 }}>Personalize</h3>
            </div>

            {/* Theme selector */}
            {renderThemeSelector({ compact: true })}

            {/* Emoji preference */}
            <div style={{ background: "var(--code-bg)", borderRadius: "12px", padding: "14px 16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={disableEmojis}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setDisableEmojis(val);
                    if (auth.currentUser && db) {
                      try {
                        const userRef = doc(db, "users", auth.currentUser.uid);
                        await setDoc(userRef, { disableEmojis: val }, { merge: true });
                      } catch (err) {
                        console.error("Error saving emoji preference", err);
                      }
                    }
                  }}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent)" }}
                />
                <div>
                  <span style={{ fontSize: "14px", color: "var(--text)", fontWeight: "600", display: "block" }}>Remove all emojis</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted, var(--text))", opacity: 0.7 }}>Strip emojis from labels and buttons</span>
                </div>
              </label>
            </div>
          </div>

          <div style={styles.authActionRow}>
            {!accountUser.emailVerified && (
              <>
                <button
                  type="button"
                  style={styles.authSecondaryButton}
                  onClick={handleResendVerification}
                  disabled={authLoading || !isFirebaseConfigured}
                >
                  Resend verification
                </button>
                <button
                  type="button"
                  style={styles.authTextButton}
                  onClick={handleRefreshVerification}
                  disabled={authLoading || !isFirebaseConfigured}
                >
                  I verified, refresh
                </button>
              </>
            )}
          </div>

          {authMessage && <p style={styles.authMessage}>{authMessage}</p>}
        </section>
      );
    }

    return (
      <section style={styles.authPanel}>
        <div style={styles.authHeader}>
          <h2 style={styles.authTitle}>{isSignUp ? "Create account" : "Log in"}</h2>
          <p style={styles.authSubtitle}>
            Use Google single sign-on or create an email/password account to
            keep your saved books and filters synced.
          </p>
        </div>

        {!isFirebaseConfigured && (
          <p style={styles.authNotice}>
            Firebase is not configured yet. Add your Firebase web config in
            `.env.local`, then enable Authentication and Firestore.
          </p>
        )}

        {isAndroidApp && !isAndroidGoogleSsoConfigured && (
          <p style={styles.authNotice}>
            Phone Google SSO needs `android/app/google-services.json` and
            `VITE_ANDROID_GOOGLE_SSO_READY=true` before the Android build can sign in.
          </p>
        )}

        {accountUser && !accountUser.emailVerified && (
          <p style={styles.authNotice}>
            Your email is not verified yet. Verify it to protect the account and
            reduce spam signups.
          </p>
        )}

        <form style={styles.authForm} onSubmit={handleAuthSubmit}>
          {isSignUp && (
            <label style={styles.filterLabel}>
              <span>Name</span>
              <input
                style={styles.filterControl}
                value={authForm.name}
                placeholder="Reader name"
                autoComplete="name"
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                onChange={(event) => updateAuthForm("name", event.target.value)}
              />
            </label>
          )}

          <label style={styles.filterLabel}>
            <span>Email</span>
            <input
              style={styles.filterControl}
              value={authForm.email}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              onChange={(event) => updateAuthForm("email", event.target.value)}
            />
          </label>

          <label style={styles.filterLabel}>
            <span>Password</span>
            <input
              style={styles.filterControl}
              value={authForm.password}
              type="password"
              placeholder="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              onChange={(event) => updateAuthForm("password", event.target.value)}
            />
            {isSignUp && (
              <span style={styles.passwordHint}>
                At least 8 characters with an uppercase letter, a number, and a special character.
              </span>
            )}
          </label>

          {isSignUp && (
            <label style={styles.filterLabel}>
              <span>Confirm Password</span>
              <input
                style={styles.filterControl}
                value={authForm.confirmPassword}
                type="password"
                placeholder="Confirm Password"
                autoComplete="new-password"
                onChange={(event) => updateAuthForm("confirmPassword", event.target.value)}
              />
            </label>
          )}

          <button
            type="submit"
            style={styles.authPrimaryButton}
            disabled={authLoading || !isFirebaseConfigured}
          >
            {authLoading ? "Working..." : isSignUp ? "Create Account" : "Log In"}
          </button>
        </form>

        <div style={styles.authActionRow}>
          <button
            type="button"
            style={styles.googleSignInButton}
            onClick={handleGoogleLogin}
            disabled={authLoading || !isFirebaseConfigured}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
          {/* Apple Sign-In hidden until Developer Account is configured
          <button
            type="button"
            style={styles.appleSignInButton}
            onClick={handleAppleLogin}
            disabled={authLoading || !isFirebaseConfigured}
          >
            <AppleIcon />
            <span>Continue with Apple</span>
          </button>
          */}
          <button
            type="button"
            style={styles.authTextButton}
            onClick={handleForgotPassword}
            disabled={authLoading || !isFirebaseConfigured}
          >
            Forgot password
          </button>
          {accountUser && !accountUser.emailVerified && (
            <>
              <button
                type="button"
                style={styles.authTextButton}
                onClick={handleResendVerification}
                disabled={authLoading || !isFirebaseConfigured}
              >
                Resend verification
              </button>
              <button
                type="button"
                style={styles.authTextButton}
                onClick={handleRefreshVerification}
                disabled={authLoading || !isFirebaseConfigured}
              >
                I verified, refresh
              </button>
            </>
          )}
        </div>

        <div style={styles.authFooter}>
          <button
            type="button"
            style={styles.authTextButton}
            onClick={() => {
              setAuthMode(isSignUp ? "signin" : "signup");
              setAuthMessage("");
            }}
          >
            {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>

        {authMessage && <p style={styles.authMessage}>{authMessage}</p>}
      </section>
    );
  }

  function renderBarcodeSvg(cardNumber) {
    const { bars, width } = getCode128Bars(cardNumber);
    const viewBoxWidth = Math.max(width + 24, 120);

    if (!bars.length) return null;

    return (
      <svg
        style={styles.libraryCardBarcode}
        viewBox={`0 0 ${viewBoxWidth} 92`}
        role="img"
        aria-label="Scannable library card barcode"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width={viewBoxWidth} height="92" fill="#ffffff" />
        {bars.map((bar, index) => (
          <rect
            key={`${bar.x}-${index}`}
            x={bar.x + 12}
            y="10"
            width={bar.width}
            height="58"
            fill="#111111"
          />
        ))}
        <text
          x={viewBoxWidth / 2}
          y="84"
          textAnchor="middle"
          fontFamily="ui-monospace, Consolas, monospace"
          fontSize="8"
          fill="#111111"
        >
          {cardNumber}
        </text>
      </svg>
    );
  }

  function renderLibraryCards() {
    const canUseLibraryCards = isSyncUser(user);
    const canAddCard = libraryCards.length < MAX_LIBRARY_CARDS;
    const visibleLibraryCards = canUseLibraryCards ? libraryCards : [];

    return renderCollapsibleSection({
      id: "libraryCards",
      title: "Library cards",
      meta: "",
      defaultOpen: true,
      style: styles.authPanel,
      bodyStyle: styles.libraryCardBody,
      children: (
        <>
          <form style={styles.libraryCardForm} onSubmit={addLibraryCardFromForm}>
            <div style={styles.walletAddHeader}>
              <span style={styles.walletAddIcon}>+</span>
              <div>
                <h3 style={styles.walletAddTitle}>Add library card</h3>
                <p style={styles.savedFileMeta}>
                  {canUseLibraryCards
                    ? "Take a photo or upload the card."
                    : "Sign in to unlock saved library cards."}
                </p>
              </div>
            </div>

            <label style={styles.filterLabel}>
              <span>Library</span>
              <input
                style={styles.filterControl}
                value={libraryCardForm.name}
                placeholder="City Library"
                maxLength={MAX_LIBRARY_CARD_NAME_LENGTH}
                onChange={(event) => updateLibraryCardForm("name", event.target.value)}
                disabled={!canUseLibraryCards || !canAddCard}
              />
            </label>

            <label style={styles.filterLabel}>
              <span>Card barcode</span>
              <input
                style={styles.filterControl}
                value={libraryCardForm.cardNumber}
                placeholder="Scan or type card number"
                inputMode="text"
                maxLength={MAX_LIBRARY_CARD_NUMBER_LENGTH}
                onChange={(event) =>
                  updateLibraryCardForm("cardNumber", event.target.value)
                }
                disabled={!canUseLibraryCards || !canAddCard}
              />
            </label>

            <div style={styles.libraryCardActions}>
              <label
                style={{
                  ...styles.authSecondaryButton,
                  ...styles.libraryCardScanButton,
                  ...(!canUseLibraryCards || !canAddCard ? styles.disabledButton : {}),
                }}
                onClick={() => {
                  if (!canUseLibraryCards) requireLoginForLibraryCards();
                }}
              >
                Take card photo
                <input
                  ref={libraryCardScanInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  disabled={!canUseLibraryCards || !canAddCard}
                  onChange={(event) => handleLibraryCardScan(event.target.files[0])}
                />
              </label>
              <button
                type="submit"
                style={styles.authPrimaryButton}
                disabled={canUseLibraryCards && !canAddCard}
              >
                {canUseLibraryCards ? "Add card" : "Log in to add"}
              </button>
            </div>

            {libraryCardForm.imageDataUrl && (
              <div style={styles.libraryCardPhotoPreview}>
                <img
                  src={libraryCardForm.imageDataUrl}
                  alt="Library card preview"
                  style={styles.libraryCardPhoto}
                />
              </div>
            )}

            {!canAddCard && (
              <p style={styles.countText}>Remove a card before adding another one.</p>
            )}
            {libraryCardMessage && (
              <p style={styles.authMessage}>{libraryCardMessage}</p>
            )}
          </form>

          <div style={styles.libraryCardList}>
            {visibleLibraryCards.length === 0 ? (
              <p style={styles.countText}>
                {canUseLibraryCards
                  ? "No library cards saved yet."
                  : "Saved cards appear here after login."}
              </p>
            ) : (
              visibleLibraryCards.map((card) => (
                <article key={card.id} style={styles.libraryCardTile}>
                  <button
                    type="button"
                    style={styles.libraryCardWalletButton}
                    onClick={() => setSelectedLibraryCard(card)}
                    aria-label={`Open ${card.name}`}
                  >
                    <span style={styles.walletAccent} />
                    <div>
                      <p style={styles.walletEyebrow}>Library card</p>
                      <h3 style={styles.libraryCardName}>{card.name}</h3>
                      <p style={styles.walletMaskedNumber}>
                        •••• {card.cardNumber.slice(-4) || "card"}
                      </p>
                    </div>
                    <span style={styles.walletTapHint}>Show</span>
                  </button>
                  <div style={styles.libraryCardTileActions}>
                    <button
                      type="button"
                      style={styles.smallButton}
                      onClick={() => setSelectedLibraryCard(card)}
                    >
                      Barcode
                    </button>
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={() => deleteLibraryCard(card.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ),
    });
  }

  function renderCollapsibleSection({
    id,
    title,
    meta = "",
    defaultOpen = false,
    children,
    style = {},
    bodyStyle = {},
    headerAction = null,
  }) {
    const isOpen = Boolean(openSections[id] ?? defaultOpen);
    const headerButton = (
      <button
        type="button"
        style={{
          ...styles.collapsibleHeader,
          ...(headerAction ? styles.collapsibleHeaderToggle : {}),
        }}
        onClick={() =>
          setOpenSections((sections) => ({
            ...sections,
            [id]: !isOpen,
          }))
        }
        aria-expanded={isOpen}
      >
        <span style={styles.collapsibleTitle}>{title}</span>
        <span style={styles.collapsibleMeta}>
          {meta}
          <span style={styles.collapsibleChevron}>{isOpen ? "▲" : "▼"}</span>
        </span>
      </button>
    );

    return (
      <section style={{ ...styles.collapsibleSection, ...style }}>
        {headerAction ? (
          <div style={styles.collapsibleHeaderWithAction}>
            {headerButton}
            {headerAction}
          </div>
        ) : (
          headerButton
        )}
        {isOpen && <div style={{ ...styles.collapsibleBody, ...bodyStyle }}>{children}</div>}
      </section>
    );
  }

  function renderSavedFiles(sectionKey) {
    const savedFileBooks = getSavedBookGroups(savedFiles).map((savedBook) => ({
      ...savedBook,
      preview:
        previewCache[getBookKey(savedBook.catalogBook)]?.status === "ready"
          ? previewCache[getBookKey(savedBook.catalogBook)]
          : savedBook.preview,
      favorite: false,
      source: "file",
    }));
    const savedBooksByKey = new Map();

    savedFileBooks.forEach((savedBook) => {
      const key = getBookKey(savedBook.catalogBook) || savedBook.id;
      savedBooksByKey.set(key, savedBook);
    });

    // Favorites are now rendered in their own section

    const savedBooks = [...savedBooksByKey.values()].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );

    return renderCollapsibleSection({
      id: `${sectionKey}-savedBooks`,
      title: "Saved",
      meta: `${savedBooks.length}`,
      defaultOpen: sectionKey !== "results",
      style: styles.savedFilesSection,
      children: (
        <>
        <div style={styles.savedFilesTop}>
          <button
            type="button"
            className={savedArtActive ? "saved-files-art is-active" : "saved-files-art"}
            style={styles.savedFilesArt}
            onClick={triggerMagicBurst}
            aria-label="Spark saved files"
            title="Spark saved files"
          >
            <span style={styles.savedArtBookOne} />
            <span style={styles.savedArtBookTwo} />
            <span style={styles.savedArtBookThree} />
            <span style={styles.savedArtSpark} />
          </button>

          <span style={styles.fileCountBadge}>{savedBooks.length}</span>
        </div>

        {saveStatus?.message && sectionKey === "home" && (
          <p style={styles.saveStatus}>{saveStatus.message}</p>
        )}

        {savedBooks.filter((sb) => sb.catalogBook).length === 0 ? (
          <p style={styles.countText}>
            No books yet. Add favorites from Details, or save preview/details
            from a popup.
          </p>
        ) : (
          <div style={styles.grid}>
            {savedBooks
              .filter((savedBook) => savedBook.catalogBook)
              .map((savedBook, idx) =>
                renderBookCard(savedBook.catalogBook, idx, {
                  prefix: "saved-file",
                  savedBook,
                })
              )}
          </div>
        )}
        </>
      ),
    });
  }

  function renderFavorites(sectionKey) {
    const favoriteBooksByKey = new Map();

    readingList.forEach((book) => {
      const key = getBookKey(book);
      favoriteBooksByKey.set(key, {
        id: `favorite-${key}`,
        ids: [],
        bookTitle: book.title,
        catalogBook: book,
        preview:
          previewCache[getBookKey(book)]?.status === "ready"
            ? previewCache[getBookKey(book)]
            : null,
        favorite: true,
        location: "Favorite",
        savedAt: book.savedAt || new Date().toISOString(),
        source: "favorite",
      });
    });

    const favoriteBooks = [...favoriteBooksByKey.values()].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );

    return renderCollapsibleSection({
      id: `${sectionKey}-favorites`,
      title: "Favorites",
      meta: `${favoriteBooks.length}`,
      defaultOpen: sectionKey !== "results",
      style: styles.savedFilesSection,
      children: (
        <>
        <div style={styles.savedFilesTop}>
          <span style={styles.fileCountBadge}>{favoriteBooks.length}</span>
        </div>

        {favoriteBooks.filter((sb) => sb.catalogBook).length === 0 ? (
          <p style={styles.countText}>
            No favorites yet. Add favorites by clicking the heart icon.
          </p>
        ) : (
          <div style={styles.grid}>
            {favoriteBooks
              .filter((favoriteBook) => favoriteBook.catalogBook)
              .map((favoriteBook, idx) =>
                renderBookCard(favoriteBook.catalogBook, idx, {
                  prefix: "favorite-book",
                  savedBook: favoriteBook,
                })
              )}
          </div>
        )}
        </>
      ),
    });
  }

  function renderCompareRow(label, field) {
    return (
      <div className="compare-row" style={styles.compareRow}>
        <div style={styles.compareLabel}>{label}</div>
        {compare.map((book) => (
          <div key={`${book.title}-${label}`} style={styles.compareValue}>
            {getComparedValue(book, field)}
          </div>
        ))}
      </div>
    );
  }

  function handleIdleBookTap(event, color) {
    const burstId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    setIdleBursts((currentBursts) => [
      ...currentBursts,
      {
        id: burstId,
        color,
        x: event.clientX,
        y: event.clientY,
      },
    ]);

    window.setTimeout(() => {
      setIdleBursts((currentBursts) =>
        currentBursts.filter((burst) => burst.id !== burstId)
      );
    }, 900);
  }

  function triggerMagicBurst(event) {
    setSavedArtActive(true);
    handleIdleBookTap(event, "#f59e0b");
    window.setTimeout(() => handleIdleBookTap(event, "#2563eb"), 120);
    window.setTimeout(() => handleIdleBookTap(event, "#A7D7B8"), 220);
    window.setTimeout(() => setSavedArtActive(false), 520);
  }

  function resetPage() {
    setCurrentPage("scan");
    setImagePreview(null);
    setBooks([]);
    setSearch("");
    setLoading(false);
    setError("");
    setSelectedBook(null);
    setSimilarBooksView(null);
    setCompare([]);
    setCompareOpen(false);
    setPreviewCache({});
    previewCacheRef.current = {};
    setPreviewModal(null);
    previewRequestId.current += 1;
    setSaveStatus(null);
    setVoiceStatus("");
    setVoiceListening(false);
    recognitionRef.current?.abort();
  }
  const syncUser = isSyncUser(user) ? user : null;
  const signedInName = syncUser ? getFirstName(syncUser) : "";
  const canOpenDeveloper = hasDeveloperAccess(syncUser);
  const homeGreeting = syncUser
    ? `Hi ${signedInName}, ${getTimeGreeting()}.`
    : "Welcome to Lumina.";


  function renderSavedBooksPage() {
    const visibleFolders = getVisibleFolders(folders);
    const unifiedBooks = (() => {
      const booksMap = new Map();
      readingList.forEach((book) => {
        booksMap.set(getBookKey(book), book);
      });
      savedFiles.forEach((file) => {
        if (file.payload?.catalogBook) {
          const key = getBookKey(file.payload.catalogBook);
          if (!booksMap.has(key)) {
            booksMap.set(key, file.payload.catalogBook);
          }
        }
      });
      return [...booksMap.values()];
    })();

    return (
      <section style={styles.pagePanel}>
        <div style={styles.authHeader}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={styles.authTitle}>My Haul 📚</h2>
            <button
              type="button"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent)",
                fontSize: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
              }}
              onClick={createFolder}
              aria-label="Add folder"
            >
              +
            </button>
          </div>
        </div>

        {saveStatus?.type === "folder" && (
          <p style={styles.saveStatus}>{saveStatus.message}</p>
        )}

        <div style={{ display: "flex", gap: "8px", padding: "0 16px", overflowX: "auto" }}>
          {AVAILABLE_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              style={{
                background: activeTagFilter === tag ? "var(--accent-bg)" : "var(--card-bg)",
                border: activeTagFilter === tag ? "1px solid var(--accent)" : "1px solid var(--border)",
                color: activeTagFilter === tag ? "var(--accent)" : "inherit",
                borderRadius: "16px",
                padding: "4px 12px",
                fontSize: "14px",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
          {visibleFolders.map((folderName) => {
            const folderBooks = unifiedBooks.filter(
              (book) => {
                const bookKey = getBookKey(book);
                const matchesFolder = (bookFolders[bookKey] || "Want to read") === folderName;
                const matchesTag = !activeTagFilter || (bookTags[bookKey] && bookTags[bookKey].includes(activeTagFilter));
                return matchesFolder && matchesTag;
              }
            );
            const isDeletable = folderName !== "Want to read";

            return renderCollapsibleSection({
              id: `folder-${folderName}`,
              title: getFolderDisplayLabel(folderName),
              meta: `${folderBooks.length}`,
              defaultOpen: folderName === "Want to read" || folderBooks.length > 0,
              style: {
                background: "var(--code-bg)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                margin: 0,
              },
              headerAction: isDeletable ? (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(folderName);
                  }}
                >
                  Delete
                </button>
              ) : null,
              children: (
                <>
                  {folderBooks.length === 0 ? (
                    <p style={{ ...styles.countText, padding: "12px 0 0" }}>No books in this folder.</p>
                  ) : (
                    <div style={{ ...styles.grid, padding: "12px 0 0" }}>
                      {folderBooks.map((book, index) =>
                        renderBookCard(book, index, { prefix: "library" })
                      )}
                    </div>
                  )}
                </>
              )
            });
          })}
        </div>

        {renderFavorites("library")}
        {renderSavedFiles("library")}
        {renderScanHistory("library")}
      </section>
    );
  }

  function renderScanHistory(sectionKey) {
    const recentScans = (scanHistory || []).slice(0, 5);

    return renderCollapsibleSection({
      id: `${sectionKey}-scanHistory`,
      title: "Recent Scans",
      meta: `${recentScans.length}`,
      defaultOpen: false,
      style: styles.savedFilesSection,
      children: (
        <>
          {recentScans.length === 0 ? (
            <p style={styles.countText}>
              No scan history yet. Scan a bookshelf to get started!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "4px 0" }}>
              {recentScans.map((scan, idx) => {
                const scanDate = scan.createdAt
                  ? new Date(scan.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : "Unknown date";
                const scanTime = scan.createdAt
                  ? new Date(scan.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                  : "";
                return (
                  <div
                    key={scan.id || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      background: "var(--card-bg)",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      padding: "12px 14px",
                      cursor: scan.books?.length ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (scan.books?.length) {
                        setBooks(scan.books);
                        setCurrentPage("scan");
                        setImagePreview(null);
                      }
                    }}
                    title={scan.books?.length ? "Tap to reload this scan" : ""}
                  >
                    <div style={{
                      width: "42px", height: "42px", borderRadius: "10px",
                      background: "var(--accent-bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "22px", flexShrink: 0,
                    }}>
                      📚
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                        {scan.bookCount ?? scan.books?.length ?? 0} book{(scan.bookCount ?? scan.books?.length ?? 0) !== 1 ? "s" : ""} detected
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-l)", marginTop: "2px" }}>
                        {scanDate} {scanTime && `· ${scanTime}`}
                      </div>
                      {scan.imageName && (
                        <div style={{ fontSize: "11px", color: "var(--text-l)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {scan.imageName}
                        </div>
                      )}
                    </div>
                    {scan.books?.length > 0 && (
                      <div style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>
                        Reload ↗
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ),
    });
  }



  function renderAccountPage() {
    return (
      <>
        {renderLoginPage()}
        {renderLibraryCards()}
        {canOpenDeveloper && renderDeveloperPage()}
        <div style={{ marginTop: '32px', textAlign: 'center', color: 'var(--text-l)', fontSize: '12px', paddingBottom: '24px' }}>
          &copy; 2026 Shilpi Sharma. All rights reserved.
        </div>
      </>
    );
  }




  async function handleStartPlusPurchase(plan) {
    if (!user) {
      alert("Hey bestie! ✨ You get 3 free scans a day without an account. Log in to snag 10 free daily scans, or unlock Beta Plus (when logged in) for literally unlimited scans! Limits reset at midnight. 🌙");
      setCurrentPage("account");
      return;
    }

    if (!IS_BETA_MODE && isNativeApp) {
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
          const packageToBuy = offerings.current.availablePackages[0];
          await Purchases.purchasePackage({ aPackage: packageToBuy });
        }
      } catch (e) {
        console.error("Purchase failed", e);
        if (!e.userCancelled) {
          alert("Purchase failed. Please try again.");
        }
        return;
      }
    }

    setSelectedPlusPlan(plan.id);
    writeStoredJson("luminaSelectedPlusPlan", {
      planId: plan.id,
      selectedAt: new Date().toISOString(),
    });
    
    if (user && db) {
      setIsUserPlus(true);
      try {
        await setDoc(doc(db, "users", user.uid), { isPlusActive: true }, { merge: true });
      } catch (err) {
        console.error("Could not activate plus:", err);
      }
    } else {
      setIsAnonymousPlus(true);
      writeStoredJson("luminaIsPlusActive", true);
    }

    if (IS_BETA_MODE) {
      setBetaUnlockPopupOpen(true);
    } else {
      alert("Lumina Plus unlocked successfully!");
    }
  }

  function handleSwipe(direction, book) {
    setSwipeHistory((prev) => [...prev, { index: discoverIndex, action: direction, book, prevFolder: bookFolders[getBookKey(book)] }]);
    setSwipeDirection(direction);
    
    if (direction === "right") {
      setBookFolders((prev) => ({
        ...prev,
        [getBookKey(book)]: selectedDiscoverFolder,
      }));
    } else if (direction === "left") {
      const currentFolder = bookFolders[getBookKey(book)] || "Want to read";
      if (currentFolder === selectedDiscoverFolder) {
        setBookFolders((prev) => {
          const next = { ...prev };
          delete next[getBookKey(book)];
          return next;
        });
      }
    }
    
    setTimeout(() => {
      setSwipeDirection(null);
      setDiscoverIndex(i => i + 1);
    }, 300);
  }

  function handleRewind() {
    if (swipeHistory.length === 0) return;
    const lastAction = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((prev) => prev.slice(0, -1));
    setDiscoverIndex(lastAction.index);
    
    setBookFolders((prev) => {
      const next = { ...prev };
      if (lastAction.prevFolder) {
        next[getBookKey(lastAction.book)] = lastAction.prevFolder;
      } else {
        delete next[getBookKey(lastAction.book)];
      }
      return next;
    });
  }

  function handleDiscoverDelete(book) {
    const savedBook = getSavedBookGroups(savedFiles).find(
      (group) => getBookKey(group.catalogBook) === getBookKey(book)
    );
    if (!savedBook) return;

    setSwipeDirection("left");
    deleteSavedBook(savedBook);

    setTimeout(() => {
      setSwipeDirection(null);
      setDiscoverIndex((currentIndex) => {
        const nextLength = Math.max(0, savedFiles.length - 1);
        return Math.min(currentIndex, Math.max(0, nextLength - 1));
      });
    }, 300);
  }

  function renderDiscoverPage() {
    const discoverBooks = savedFiles.map(f => f.payload?.catalogBook).filter(Boolean);
    const currentBook = discoverBooks[discoverIndex];
    const visibleFolders = getVisibleFolders(folders);

    return (
      <section style={{...styles.pagePanel, display: "flex", flexDirection: "column", height: "100%"}}>
        <div style={styles.authHeader}>
          <h2 style={styles.authTitle}>Organize Library</h2>
          <p style={styles.authSubtitle}>Swipe right to add to '{selectedDiscoverFolder}'</p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "0 16px" }}>
          <select
            value={selectedDiscoverFolder}
            onChange={(e) => setSelectedDiscoverFolder(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              color: "var(--text)",
              fontSize: "14px",
              fontWeight: "600",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {visibleFolders.map(folder => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "16px" }}>
          {!currentBook ? (
            <div style={{ textAlign: "center", color: "var(--text-l)" }}>
              <p>You've organized all your saved books!</p>
              <button style={{...styles.authPrimaryButton, marginTop: "16px"}} onClick={() => { setDiscoverIndex(0); setSwipeHistory([]); }}>Restart</button>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                maxWidth: "340px",
                aspectRatio: "3/4",
                background: "var(--card-bg)",
                borderRadius: "16px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
                transition: "transform 0.3s ease, opacity 0.3s ease",
                transform: swipeDirection === "left" ? "translateX(-150%) rotate(-15deg)" : swipeDirection === "right" ? "translateX(150%) rotate(15deg)" : "translateX(0) rotate(0)",
                opacity: swipeDirection ? 0 : 1,
              }}
            >
              <div style={{ flex: 1, position: "relative" }}>
                <img 
                  src={currentBook?.imageLinks?.thumbnail || currentBook?.coverUrl || ""} 
                  style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "var(--bg)" }} 
                  alt={currentBook.title} 
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} 
                />
                <div style={{ display: (currentBook?.imageLinks?.thumbnail || currentBook?.coverUrl) ? 'none' : 'flex', width: "100%", height: "100%", backgroundColor: "var(--border)", alignItems: "center", justifyContent: "center", fontSize: "64px" }}>
                  📚
                </div>
                <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: "8px", flexDirection: "column" }}>
                  {(currentBook.emojiTags || []).map((tag, i) => (
                     <span key={i} style={{ background: "rgba(255,255,255,0.9)", padding: "8px", borderRadius: "50%", fontSize: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                       {tag}
                     </span>
                  ))}
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 16px 16px", background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)", color: "#fff" }}>
                  <h3 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 4px", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{currentBook.title}</h3>
                  <p style={{ margin: "0 0 8px", opacity: 0.9 }}>{currentBook.author}</p>
                  <p style={{ margin: 0, fontSize: "14px", fontStyle: "italic", opacity: 0.8 }}>{currentBook.hook || (currentBook.description ? currentBook.description.substring(0, 100) + "..." : "")}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {currentBook && (
          <div style={{ display: "flex", justifyContent: "center", gap: "24px", padding: "16px", paddingBottom: "32px", alignItems: "center" }}>
            <button
              style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--card-bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "var(--text)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: swipeHistory.length > 0 ? "pointer" : "default", opacity: swipeHistory.length > 0 ? 1 : 0.5 }}
              onClick={handleRewind}
              disabled={swipeHistory.length === 0}
            >
              ⏪
            </button>
            <button
              style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--card-bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#ef4444", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: "pointer" }}
              onClick={() => handleDiscoverDelete(currentBook)}
              aria-label="Delete saved book"
            >
              ❌
            </button>
            <button
              style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--card-bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#22c55e", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: "pointer" }}
              onClick={() => handleSwipe("right", currentBook)}
            >
              💚
            </button>
          </div>
        )}
      </section>
    );
  }

  async function handleThemeSelect(themeId) {
    setAppTheme(themeId);

    if (auth.currentUser && db) {
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, { appTheme: themeId }, { merge: true });
      } catch (err) {
        console.error("Error saving theme preference", err);
      }
    }
  }

  function renderThemeSelector({ compact = false } = {}) {
    return (
      <div style={compact ? styles.themeSelectorCompact : styles.themeSelectorPanel}>
        <div style={styles.themeSelectorHeader}>
          <h3 style={compact ? styles.themeSelectorTitleSmall : styles.themeSelectorTitle}>
            Default Mode
          </h3>
          <span style={styles.themeSelectorMeta}>Website theme</span>
        </div>
        <div style={styles.themeSelectorGrid}>
          {THEMES.map((themeItem) => {
            const isSelected = appTheme === themeItem.id;
            return (
              <button
                key={themeItem.id}
                type="button"
                style={{
                  ...styles.themeChoiceButton,
                  ...(isSelected ? styles.themeChoiceButtonActive : {}),
                }}
                onClick={() => handleThemeSelect(themeItem.id)}
                aria-pressed={isSelected}
              >
                <span style={styles.themeChoiceIcon}>{themeItem.emoji}</span>
                <span>{themeItem.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  async function handleVibeAiAnalysis(mode, photoFile = null) {
    if (!checkScanLimit()) return;
    incrementScanCount();
    if (!isClaudeConfigured) {
      setVibeStatus("AI is not configured.");
      return;
    }
    setVibeAiResult(null);
    setVibeAiPreviews({});
    setVibeAiLoading(mode);
    setVibeStatus("");

    try {
      await ensureScanAuth();
      let parts = [];
      let currentCacheKey = null;

      if (mode === "photo" && photoFile) {
        const compressed = await compressImage(photoFile);
        const base64 = await encodeFileToBase64(compressed);
        parts = [
          {
            text: `You are a literary personality analyst with the gift of eloquent, poetic language.

Look at this bookshelf photo. Identify the books you can see. Based on them, write a rich, vivid personality profile of this reader. Use beautiful, evocative language — not clinical analysis.

Return ONLY valid JSON:
{
  "personalityTitle": "A creative 3-5 word title for this reader archetype (e.g. 'The Midnight Wanderer', 'The Quiet Revolutionary')",
  "personalityEssay": "A super short 2-3 sentence personality portrait using poetic, insightful language. Speak directly to the reader as 'you'.",
  "readingDNA": ["3 short punchy traits, each under 6 words"],
  "suggestions": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "One compelling sentence on why this reader needs this book"
    }
  ]
}

Make suggestions array exactly 3 books. These should be globally acclaimed books that perfectly match this reader's soul. No placeholders.`,
          },
          {
            inlineData: {
              mimeType: photoFile.type || "image/jpeg",
              data: base64,
            },
          },
        ];
      } else {
        let bookList = [];
        if (mode === "saved") {
          const savedGroups = getSavedBookGroups(savedFiles).map((s) => s.catalogBook).filter(Boolean);
          bookList = [...readingList, ...savedGroups];
        } else if (mode === "scan") {
          bookList = books.length > 0 ? books : (scanHistory[0]?.books || []);
        }
        if (!bookList.length) {
          setVibeStatus(mode === "scan" ? "No scan results found. Scan a shelf first." : "No saved books found. Save some books first.");
          setVibeAiLoading("");
          return;
        }
        const bookLines = bookList
          .filter((b) => b?.title)
          .slice(0, 40)
          .map((b) => `- "${b.title}"${b.author ? ` by ${b.author}` : ""}`);
          
        currentCacheKey = mode + ":" + bookLines.join("|");
        if (vibeAiCacheRef.current[currentCacheKey]) {
          setVibeAiResult(vibeAiCacheRef.current[currentCacheKey].result);
          setVibeAiPreviews(vibeAiCacheRef.current[currentCacheKey].previews);
          setVibeAiLoading("");
          return;
        }

        parts = [{
          text: `You are a literary personality analyst with the gift of eloquent, poetic language.

Here are the books this reader has on their shelf:
${bookLines.join("\n")}

Write a rich, vivid personality profile of this reader. Use beautiful, evocative language — not clinical analysis.

Return ONLY valid JSON:
{
  "personalityTitle": "A creative 3-5 word title for this reader archetype (e.g. 'The Midnight Wanderer', 'The Quiet Revolutionary')",
  "personalityEssay": "A super short 2-3 sentence personality portrait using poetic, insightful language. Speak directly to the reader as 'you'.",
  "readingDNA": ["3 short punchy traits, each under 6 words"],
  "suggestions": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "One compelling sentence on why this reader needs this book"
    }
  ]
}

Make suggestions array exactly 3 globally acclaimed books that perfectly match this reader's soul.`,
        }];
      }

      beginClaudeCall("Vibe personality");
      const result = await generateClaudeContent(
        [{ role: "user", parts }],
        { maxOutputTokens: 2048 },
        "Vibe personality"
      );
      finishClaudeCall("Vibe personality", "Success", getTotalTokenCount(result));

      const parsed = safeParseJson(getClaudeText(result));
      if (!parsed?.personalityTitle) {
        setVibeStatus("AI couldn't read that. Try again with a clearer photo or more books.");
        setVibeAiLoading("");
        return;
      }
      parsed.mode = mode; // Inject mode so we can explain the suggestions later
      setVibeAiResult(parsed);

      // Fetch Google Books previews for suggestions asynchronously so it doesn't block UI
      if (mode !== "photo" && currentCacheKey) {
        vibeAiCacheRef.current[currentCacheKey] = { result: parsed, previews: {} };
      }

      setVibeAiLoading(""); // stop spinner immediately

      if (parsed.suggestions?.length) {
        parsed.suggestions.forEach(async (suggestion) => {
          const preview = await findBookPreview({ title: suggestion.title, author: suggestion.author });
          if (preview) {
            setVibeAiPreviews((prev) => {
              const updated = { ...prev, [suggestion.title]: preview };
              if (currentCacheKey && vibeAiCacheRef.current[currentCacheKey]) {
                vibeAiCacheRef.current[currentCacheKey].previews = updated;
              }
              return updated;
            });
          }
        });
      }
    } catch (err) {
      console.error("Vibe AI analysis failed:", err);
      finishClaudeCall("Vibe personality", "Failed");
      setVibeStatus("Analysis failed. Check your connection and try again.");
    } finally {
      setVibeAiLoading("");
    }
  }

  function renderVibePage() {
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

  const renderDeveloperPage = () =>
    renderCollapsibleSection({
      id: "developer",
      title: "Developer",
      meta: developerStatsStatus ? "Stats" : "",
      style: styles.pagePanel,
      children: (
        <>
          <div style={styles.developerLinkRow}>
            <a
              style={styles.developerLinkButton}
              href={firestoreConsoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              Firebase Console
            </a>
            <a
              style={styles.developerLinkButton}
              href={firebaseAuthConsoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              Firebase Auth
            </a>
          </div>

      <div style={styles.developerStatsGrid}>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>API calls today</span>
          <strong style={styles.developerStatValue}>
            {developerUsage.apiCalls.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Prompt tokens today</span>
          <strong style={styles.developerStatValue}>
            {developerUsage.promptTokens.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Output tokens today</span>
          <strong style={styles.developerStatValue}>
            {developerUsage.outputTokens.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Total tokens today</span>
          <strong style={styles.developerStatValue}>
            {developerUsage.totalTokens.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Success / failed</span>
          <strong style={styles.developerStatValueSmall}>
            {developerUsage.successCalls.toLocaleString()} / {developerUsage.failedCalls.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Last API call</span>
          <strong style={styles.developerStatValueSmall}>
            {developerUsage.lastCallType || "No API calls yet"}
            {developerUsage.lastStatus ? ` · ${developerUsage.lastStatus}` : ""}
            {developerUsage.lastProvider ? ` · ${developerUsage.lastProvider}` : ""}
            {developerUsage.lastModel ? ` · ${developerUsage.lastModel}` : ""}
            {developerUsage.lastDurationMs ? ` · ${(developerUsage.lastDurationMs / 1000).toFixed(1)}s` : ""}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Last customer</span>
          <strong style={styles.developerStatValueSmall}>
            {developerUsage.lastUserEmail || "No API calls yet"}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Tokens by IP</span>
          <div style={styles.developerIpList}>
            {developerIpUsage.length === 0 ? (
              <strong style={styles.developerStatValueSmall}>No IP usage yet</strong>
            ) : (
              developerIpUsage.map((usage) => (
                <div key={usage.ipAddress} style={styles.developerIpRow}>
                  <strong>{usage.ipAddress}</strong>
                  <span>
                    {usage.totalTokens.toLocaleString()} tokens · {usage.apiCalls.toLocaleString()} calls
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Registered users</span>
          <strong style={styles.developerStatValue}>
            {developerStats.registeredUsers.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Total logins</span>
          <strong style={styles.developerStatValue}>
            {developerStats.totalLoginEvents.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Logins today</span>
          <strong style={styles.developerStatValue}>
            {developerStats.todayLoginEvents.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Recent unique users</span>
          <strong style={styles.developerStatValue}>
            {developerStats.recentUniqueUsers.toLocaleString()}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Gemini Success</span>
          <strong style={styles.developerStatValue}>
            {developerStats.geminiSuccessCalls?.toLocaleString() || "0"}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Claude Success</span>
          <strong style={styles.developerStatValue}>
            {developerStats.claudeSuccessCalls?.toLocaleString() || "0"}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>API calls today</span>
          <strong style={styles.developerStatValue}>
            {developerStats.apiCallsToday?.toLocaleString() ?? "0"}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>API calls — last 7 days</span>
          <strong style={styles.developerStatValue}>
            {developerStats.apiCallsWeek?.toLocaleString() ?? "0"}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>API calls — last 30 days</span>
          <strong style={styles.developerStatValue}>
            {developerStats.apiCallsMonth?.toLocaleString() ?? "0"}
          </strong>
        </div>
        <div style={styles.developerStatCard}>
          <span style={styles.developerStatLabel}>Last login</span>
          <strong style={styles.developerStatValueSmall}>
            {developerStats.lastLoginEmail || "No logins yet"}
            {developerStats.lastLoginMethod ? ` · ${developerStats.lastLoginMethod}` : ""}
            {developerStats.lastLoginAt ? ` · ${getDisplayTime(developerStats.lastLoginAt)}` : ""}
          </strong>
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h3 style={{ ...styles.cardTitle, marginBottom: "12px" }}>Recent API Calls</h3>
        {developerEvents.length === 0 ? (
          <p style={styles.countText}>No recent calls.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {developerEvents.map((ev, i) => (
              <div key={i} style={{ ...styles.card, padding: "12px", background: "var(--card-bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold" }}>{ev.callType || "API Call"}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-l)" }}>
                    {ev.createdAt?.toDate ? getDisplayTime(ev.createdAt.toDate()) : (ev.date || "")}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  <span style={{ fontSize: "12px", padding: "2px 8px", background: "var(--bg)", borderRadius: "4px" }}>
                    {ev.provider} {ev.model ? `(${ev.model})` : ""}
                  </span>
                  <span style={{ fontSize: "12px", padding: "2px 8px", background: "var(--bg)", borderRadius: "4px" }}>
                    {(ev.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span style={{ fontSize: "12px", padding: "2px 8px", background: "var(--bg)", borderRadius: "4px", color: ev.status === "Success" ? "var(--green)" : "var(--red)" }}>
                    {ev.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      ),
    });

  if (!isStoreLoaded) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
        <h2>Lumina is initializing...</h2>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {isOffline && (
        <div style={styles.offlineBanner} role="alert">
          {e("📡", "You are offline. Scans and cloud synchronization are temporarily disabled.")}
        </div>
      )}
      <div className="idle-background" aria-hidden="true">
        <span className="gravity-line gravity-line-one" />
        <span className="gravity-line gravity-line-two" />
        <span className="gravity-line gravity-line-three" />
        <span className="gravity-line gravity-line-four" />
        <span className="gravity-dot gravity-dot-blue gravity-dot-one" />
        <span className="gravity-dot gravity-dot-green gravity-dot-two" />
        <span className="gravity-dot gravity-dot-yellow gravity-dot-three" />
        <span className="gravity-dot gravity-dot-red gravity-dot-four" />
        <span className="gravity-dot gravity-dot-blue gravity-dot-five" />
        <span className="gravity-dot gravity-dot-green gravity-dot-six" />
        <span className="gravity-dot gravity-dot-yellow gravity-dot-seven" />
        <span className="gravity-dot gravity-dot-red gravity-dot-eight" />
        <span className="idle-scan idle-scan-one" />
        <span className="idle-scan idle-scan-two" />
        <span
          className="idle-book idle-book-blue"
          onPointerDown={(event) => handleIdleBookTap(event, "#2563eb")}
        />
        <span
          className="idle-book idle-book-green"
          onPointerDown={(event) => handleIdleBookTap(event, "#A7D7B8")}
        />
        <span
          className="idle-book idle-book-yellow"
          onPointerDown={(event) => handleIdleBookTap(event, "#92400e")}
        />
        <span
          className="idle-book idle-book-red"
          onPointerDown={(event) => handleIdleBookTap(event, "#b91c1c")}
        />
        <span className="idle-star idle-star-one" />
        <span className="idle-star idle-star-two" />
        <span className="idle-star idle-star-three" />
        {idleBursts.map((burst) => (
          <span
            key={burst.id}
            className="idle-burst"
            style={{
              "--burst-color": burst.color,
              left: burst.x,
              top: burst.y,
            }}
          />
        ))}
      </div>

      <AppHeader
        currentPage={currentPage}
        resetPage={resetPage}
        setCurrentPage={setCurrentPage}
        user={user}
        styles={styles}
      />

      {currentPage === "account" && renderAccountPage()}
      {currentPage === "saved" && renderSavedBooksPage()}
      {currentPage === "vibe" && renderVibePage()}
      {currentPage === "discover" && renderDiscoverPage()}

      {currentPage === "scan" && (
        <>
          <ScanLandingSection
            anonymousScanCount={anonymousScanCount}
            authReady={authReady}
            books={books}
            cameraIdle={cameraIdle}
            e={e}
            error={error}
            handleBarcodeScan={handleBarcodeScan}
            handleImage={handleImage}
            handleScanPickerClick={handleScanPickerClick}
            homeGreeting={homeGreeting}
            imagePreview={imagePreview}
            isAnonymousPlus={isAnonymousPlus}
            isFirebaseConfigured={isFirebaseConfigured}
            isOffline={isOffline}
            isUserPlus={isUserPlus}
            loading={loading}
            openManualBookModal={openManualBookModal}
            renderFilterControls={renderFilterControls}
            setBooks={setBooks}
            setCameraIdle={setCameraIdle}
            setCompare={setCompare}
            setCompareOpen={setCompareOpen}
            setError={setError}
            setImagePreview={setImagePreview}
            setSaveStatus={setSaveStatus}
            setSelectedBook={setSelectedBook}
            setSimilarBooksView={setSimilarBooksView}
            shelfPhotoHistory={shelfPhotoHistory}
            styles={styles}
            user={user}
            userScanCount={userScanCount}
          />
          <ScanResultsSection
            books={books}
            detectedBooks={detectedBooks}
            filteredBooks={filteredBooks}
            renderBookCard={renderBookCard}
            renderCollapsibleSection={renderCollapsibleSection}
            styles={styles}
            topBooks={topBooks}
          />
        </>
      )}

      {currentPage === "scan" && (
        <CompareTray
          compare={compare}
          e={e}
          setCompare={setCompare}
          setCompareOpen={setCompareOpen}
          styles={styles}
        />
      )}

	      {selectedBook &&
	        (() => {
	          const theme = getTheme(selectedBook);
	          const detailSaveStatus = getScopedSaveStatus(
	            saveStatus,
            selectedBook,
            "details"
	          );
	          const detailsSaved = hasSavedDetails(selectedBook);
	          const previewButton = getPreviewButtonState(selectedBook);
            const closeDetails = () => {
              if (window.location.hash === "#details") window.history.back();
              else setSelectedBook(null);
            };
            const badgeStyle = {
              ...styles.badge,
              ...getShelfPickStyle(selectedBook.shelfPick),
            };

	          return (
	            <BookDetailsModal
                badgeStyle={badgeStyle}
                onClose={closeDetails}
                selectedBook={selectedBook}
                styles={styles}
                theme={theme}
              >

	                {renderCollapsibleSection({
	                  id: "detailAuthor",
	                  title: "Author",
                  meta: selectedBook.author,
                  defaultOpen: true,
                  children: (
                    <p style={styles.detailText}>
                      {selectedBook.authorBio || "Author information unavailable."}
                    </p>
                  ),
                  style: styles.detailCollapse,
                })}

	                <BookDetailSummaryGrid
                    bookFolders={bookFolders}
                    folders={folders}
                    getBookKey={getBookKey}
                    getScanConfidenceDisplayLabel={getScanConfidenceDisplayLabel}
                    getVisibleFolders={getVisibleFolders}
                    handleFolderSelect={handleFolderSelect}
                    newFolderOption={NEW_FOLDER_OPTION}
                    selectedBook={selectedBook}
                    styles={styles}
                  />

                {renderCollapsibleSection({
                  id: "detailNotes",
                  title: "Notes",
                  meta: selectedBook.genre || "Book",
                  defaultOpen: true,
                  children: (
                    <div style={styles.detailNoteGrid}>
                      <p style={styles.detailText}>
                        <b>Why read it?</b>
                        <br />
                        {selectedBook.whyRead}
                      </p>
                      <p style={styles.detailText}>
                        <b>Summary</b>
                        <br />
                        {selectedBook.summary}
                      </p>
                      <p style={styles.detailText}>
                        <b>Suitability</b>
                        <br />
                        {getContentGuidance(selectedBook)}
                      </p>
                    </div>
                  ),
                  style: styles.detailCollapse,
                })}

                {similarBooksView &&
                  renderCollapsibleSection({
                    id: "detailSimilarBooks",
                    title:
                      similarBooksView === "shelf"
                        ? "Similar books on this shelf"
                        : "Recommendations for you",
                    meta: `${
                      similarBooksView === "shelf"
                        ? shelfSimilarBooks.length
                        : similarBooks.length
                    }`,
                    defaultOpen: true,
                    headerAction: (
                      <button
                        type="button"
                        style={styles.collapsibleCloseButton}
                        onClick={() => setSimilarBooksView(null)}
                        aria-label="Close similar books"
                        title="Close similar books"
                      >
                        X
                      </button>
                    ),
                    children:
                      similarBooksView === "shelf" ? (
                        shelfSimilarBooks.length === 0 ? (
                          <p style={styles.countText}>
                            No close shelf matches were found in this scan.
                          </p>
                        ) : (
                          <div style={styles.grid}>
                            {shelfSimilarBooks.map((book, index) =>
                              renderBookCard(book, index, {
                                prefix: "shelf-similar",
                                compact: true,
                              })
                            )}
                          </div>
                        )
                      ) : similarBooksState?.status === "loading" ? (
                        <p style={styles.countText}>
                          Finding similar books across Google Books...
                        </p>
                      ) : similarBooks.length === 0 ? (
                        <p style={styles.countText}>
                          {similarBooksState?.message ||
                            "No global similar books were found for this title right now."}
                        </p>
                      ) : (
                        <div style={styles.grid}>
                          {similarBooks.map((book, index) =>
                            renderBookCard(book, index, {
                              prefix: "similar",
                              compact: true,
                            })
                          )}
                        </div>
                      ),
                    style: styles.detailCollapse,
                  })}

                {detailSaveStatus && (
                  <p style={styles.saveStatus}>{detailSaveStatus}</p>
                )}

                <div style={styles.previewActionRow}>
                  <button
                    style={{
                      ...styles.secondaryButton,
                      ...(previewButton.saved ? styles.savedButton : {}),
                      ...(previewButton.disabled ? styles.disabledButton : {}),
                    }}
                    onClick={() => openPreview(selectedBook)}
                    disabled={previewButton.disabled}
                    aria-disabled={previewButton.disabled}
                  >
	                    {e("📖", previewButton.label)}
	                  </button>

                  <button
                    style={{
                      ...styles.secondaryButton,
                      ...(detailsSaved ? styles.savedButton : {}),
                    }}
                    onClick={() => downloadBookDetails(selectedBook)}
                    disabled={detailsSaved}
                  >
                    {detailsSaved ? "Saved Details" : "Save Details"}
                  </button>

                  {currentPage !== "saved" && (
                    <button
                      style={{
                        ...styles.secondaryButton,
                        ...(similarBooksView === "shelf" ? styles.selectedButton : {}),
                      }}
                      onClick={() => {
                        setSimilarBooksView((currentView) => {
                          const nextView = currentView === "shelf" ? null : "shelf";
                          if (nextView) {
                            setOpenSections((prev) => ({ ...prev, detailNotes: false, detailAuthor: false }));
                          }
                          return nextView;
                        });
                      }}
                    >
                      Similar on shelf
                    </button>
                  )}

                  <button
                    style={{
                      ...styles.secondaryButton,
                      ...(similarBooksView === "global" ? styles.selectedButton : {}),
                    }}
                    onClick={() => {
                      const nextOpen = similarBooksView !== "global";
                      setSimilarBooksView(nextOpen ? "global" : null);
                      if (nextOpen) {
                        setOpenSections((prev) => ({ ...prev, detailNotes: false, detailAuthor: false }));
                      }
                      if (
                        nextOpen &&
                        selectedBook &&
                        selectedBookKey &&
                        !similarBooksCache[selectedBookKey]?.status
                      ) {
                        loadSimilarBooks(selectedBook);
                      }
                    }}
                  >
                    Similar in general
                  </button>

                  <button
                    style={{ ...styles.closeButton, marginTop: 0 }}
                    onClick={(e) => { e.stopPropagation(); if(window.location.hash === "#details") window.history.back(); else setSelectedBook(null); }}
                  >
                    Close
                  </button>
                </div>
	            </BookDetailsModal>
	          );
	        })()}

      {loading && (
        <div style={styles.processingOverlay}>
          <section
            style={{ ...styles.processingPanel, display: "flex", flexDirection: "column", gap: "20px", width: "min(100%, 450px)" }}
            role="status"
            aria-live="polite"
            aria-label="Processing bookshelf photo"
          >
            <div className="playful-loader-container" aria-hidden="true">
              <div className="playful-bookshelf">
                <div className="playful-book book-left"></div>
                <div className="playful-book book-middle">
                  <div className="page-flip"></div>
                </div>
                <div className="playful-book book-right"></div>
              </div>
              <div className="floating-sparkles">
                <span className="sparkle star-1">⭐</span>
                <span className="sparkle star-2">✨</span>
                <span className="sparkle star-3">📖</span>
                <span className="sparkle star-4">✨</span>
                <span className="sparkle star-5">⭐</span>
              </div>
            </div>

            <div style={{ textAlign: "center", alignSelf: "stretch" }}>
              <h2 style={{ ...styles.processingTitle, margin: "0 0 4px 0" }}>Lumina AI is scanning...</h2>
              <p style={{ ...styles.processingText, margin: 0 }}>Reading shelf layout & book spines</p>
            </div>

            {imagePreview && (
              <div style={{ position: "relative", width: "100%", borderRadius: "8px", overflow: "hidden", height: "200px" }}>
                <img src={imagePreview} alt="Scanning..." style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div className="scan-laser-line"></div>
              </div>
            )}
            
            <div style={styles.progressStepsList}>
              {[
                "Reading the books...",
                "Analyzing the books...",
                "Sorting by categories...",
                "Getting info about the books...",
              ].map((stepText, index) => {
                const isDone = loadingStep > index;
                const isActive = loadingStep === index;
                return (
                  <div
                    key={index}
                    style={{
                      ...styles.progressStepRow,
                      opacity: isDone || isActive ? 1 : 0.45,
                    }}
                  >
                    <div
                      style={{
                        ...styles.progressStepDot,
                        backgroundColor: isDone ? "#18794e" : isActive ? "#2563eb" : "#94a3b8",
                        boxShadow: isActive ? "0 0 10px rgba(37, 99, 235, 0.6)" : "none",
                      }}
                    >
                      {isDone ? "✓" : isActive ? "●" : ""}
                    </div>
                    <span
                      style={{
                        ...styles.progressStepText,
                        color: isDone ? "#18794e" : isActive ? "#172033" : "#718096",
                        fontWeight: isActive ? "600" : "400",
                      }}
                    >
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {compareOpen && compare.length > 0 && (
        <div style={styles.modal} onClick={() => setCompareOpen(false)}>
          <div style={styles.compareModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHeader}>
              <div>
                <h2 style={styles.modalTitle}>Compare Books</h2>
                <p style={styles.previewSubtitle}>
                  {compare.length < 2
                    ? "Pick one more book to unlock side-by-side comparison."
                    : "Ratings, levels, age, and summaries side by side."}
                </p>
              </div>

              <button
                style={styles.closeIconButton}
                onClick={() => setCompareOpen(false)}
                aria-label="Close compare"
              >
                X
              </button>
            </div>

            <div style={styles.compareTableScroll}>
              <div style={styles.compareTable}>
                <div className="compare-row" style={styles.compareRow}>
                  <div style={styles.compareLabel}>Book</div>
                  {compare.map((book) => (
                    <div
                      key={`${book.title}-compare-title`}
                      style={styles.compareValueStrong}
                    >
                      {book.title}
                    </div>
                  ))}
                </div>
                {renderCompareRow("Author", "author")}
                {renderCompareRow("Rating", "rating")}
                {renderCompareRow("Genre", "genre")}
                {renderCompareRow("Level", "readingLevel")}
                {renderCompareRow("Grade", "gradeBand")}
                {renderCompareRow("Age", "ageRecommendation")}
                {renderCompareRow("Why read", "whyRead")}
                {renderCompareRow("Summary", "summary")}
              </div>
            </div>

            <div style={styles.previewActionRow}>
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setCompare([]);
                  setCompareOpen(false);
                }}
              >
                Clear Compare
              </button>
              <button
                style={{ ...styles.closeButton, marginTop: 0 }}
                onClick={() => {
                  setCompareOpen(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {libraryCardLoginPromptOpen && (
        <div style={styles.modal} onClick={() => setLibraryCardLoginPromptOpen(false)}>
          <div style={styles.promptModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.promptIcon} aria-hidden="true">▤</div>
            <h2 style={styles.modalTitle}>Log in to save library cards</h2>
            <p style={styles.previewSubtitle}>
              Sign in to add your library card barcode and keep it synced with
              your Lumina account.
            </p>
            <div style={styles.previewActionRow}>
              <button
                type="button"
                style={styles.googleSignInButton}
                onClick={() => {
                  setLibraryCardLoginPromptOpen(false);
                  handleGoogleLogin();
                }}
                disabled={authLoading || !isFirebaseConfigured}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
              <button
                type="button"
                style={styles.appleSignInButton}
                onClick={() => {
                  setLibraryCardLoginPromptOpen(false);
                  handleAppleLogin();
                }}
                disabled={authLoading || !isFirebaseConfigured}
              >
                <AppleIcon />
                <span>Continue with Apple</span>
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setLibraryCardLoginPromptOpen(false);
                  setAuthMode("signin");
                  setCurrentPage("account");
                }}
              >
                Use email login
              </button>
              <button
                type="button"
                style={styles.authTextButton}
                onClick={() => setLibraryCardLoginPromptOpen(false)}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {scanLimitPromptOpen && (
        <div style={styles.modal} onClick={() => setScanLimitPromptOpen(false)}>
          <div style={styles.promptModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.promptIcon} aria-hidden="true">⌕</div>
            <h2 style={styles.modalTitle}>Scan limit reached</h2>
            <p style={styles.previewSubtitle}>
              {user
                ? "You have used your 10 free scans. Upgrade to Lumina Plus to unlock unlimited scanning!"
                : "You have used your 3 anonymous scans. Continue with Google to keep scanning."}
            </p>
            <div style={styles.previewActionRow}>
              {user ? (
                <button
                  type="button"
                  style={styles.googleSignInButton}
                  onClick={() => {
                    setScanLimitPromptOpen(false);
                    setCurrentPage("vibe"); // Redirect to upgrade page
                  }}
                >
                  <span>Upgrade to Lumina Plus</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    style={styles.googleSignInButton}
                    onClick={() => {
                      setScanLimitPromptOpen(false);
                      handleGoogleLogin();
                    }}
                    disabled={authLoading || !isFirebaseConfigured}
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </button>
                  <button
                    type="button"
                    style={styles.appleSignInButton}
                    onClick={() => {
                      setScanLimitPromptOpen(false);
                      handleAppleLogin();
                    }}
                    disabled={authLoading || !isFirebaseConfigured}
                  >
                    <AppleIcon />
                    <span>Continue with Apple</span>
                  </button>
                </>
              )}
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setScanLimitPromptOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {folderModal.isOpen && (
        <div style={styles.modal} onClick={closeFolderModal}>
          <form style={styles.promptModalContent} onSubmit={saveFolderFromModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.promptIcon} aria-hidden="true">▤</div>
            <h2 style={styles.modalTitle}>Add folder</h2>
            <p style={styles.previewSubtitle}>
              {folderModal.book
                ? `Create a folder for ${folderModal.book.title}.`
                : "Create a folder to organize saved books."}
            </p>
            <label style={styles.filterLabel}>
              <span>Folder name</span>
              <input
                style={styles.filterControl}
                value={folderModal.name}
                placeholder="Summer reads"
                autoFocus
                onChange={(event) =>
                  setFolderModal((currentModal) => ({
                    ...currentModal,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <div style={styles.previewActionRow}>
              <button
                type="submit"
                style={styles.authPrimaryButton}
                disabled={!folderModal.name.trim()}
              >
                Save folder
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={closeFolderModal}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {tagModal.isOpen && (
        <div style={styles.modal} onClick={closeTagModal}>
          <div style={styles.promptModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.promptIcon} aria-hidden="true">🏷️</div>
            <h2 style={styles.modalTitle}>Tag this book</h2>
            <p style={styles.previewSubtitle}>Select tags to organize your library.</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "16px 0", justifyContent: "center" }}>
              {AVAILABLE_TAGS.map(tag => {
                const isActive = (bookTags[tagModal.bookKey] || []).includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleBookTag(tagModal.bookKey, tag)}
                    style={{
                      background: isActive ? "var(--accent-bg)" : "var(--card-bg)",
                      border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: "16px",
                      padding: "8px 16px",
                      fontSize: "20px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div style={styles.previewActionRow}>
              <button
                type="button"
                style={styles.authPrimaryButton}
                onClick={closeTagModal}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {manualBookModalOpen && (
        <div style={styles.modal} onClick={closeManualBookModal}>
          <form style={{ ...styles.promptModalContent, maxWidth: "450px" }} onSubmit={saveManualBook} onClick={(e) => e.stopPropagation()}>
            {!disableEmojis && <div style={styles.promptIcon} aria-hidden="true">📖</div>}
            <h2 style={styles.modalTitle}>Add Book Manually</h2>
            <p style={styles.previewSubtitle}>Enter the details of the book you want to add.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", margin: "14px 0", textAlign: "left" }}>
              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Title *</span>
                <input
                  style={styles.filterControl}
                  value={manualBookForm.title}
                  placeholder="The Hobbit"
                  required
                  autoFocus
                  onChange={(e) => handleManualBookChange("title", e.target.value)}
                />
              </label>

              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Author</span>
                <input
                  style={styles.filterControl}
                  value={manualBookForm.author}
                  placeholder="J.R.R. Tolkien"
                  onChange={(e) => handleManualBookChange("author", e.target.value)}
                />
              </label>

              <div style={{ display: "flex", gap: "12px" }}>
                <label style={{ ...styles.filterLabel, flex: 1 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Genre</span>
                  <input
                    style={styles.filterControl}
                    value={manualBookForm.genre}
                    placeholder="Fantasy"
                    onChange={(e) => handleManualBookChange("genre", e.target.value)}
                  />
                </label>

                <label style={{ ...styles.filterLabel, flex: 1 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Rating (0-5)</span>
                  <input
                    style={styles.filterControl}
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={manualBookForm.rating}
                    onChange={(e) => handleManualBookChange("rating", e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <label style={{ ...styles.filterLabel, flex: 1 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Reading Level</span>
                  <select
                    style={styles.filterControl}
                    value={manualBookForm.readingLevel}
                    onChange={(e) => handleManualBookChange("readingLevel", e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </label>

                <label style={{ ...styles.filterLabel, flex: 1 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Shelf Pick</span>
                  <select
                    style={styles.filterControl}
                    value={manualBookForm.shelfPick}
                    onChange={(e) => handleManualBookChange("shelfPick", e.target.value)}
                  >
                    <option value="Popular">Popular</option>
                    <option value="Top Rated">Top Rated</option>
                    <option value="Hidden Gem">Hidden Gem</option>
                    <option value="Beginner Friendly">Beginner Friendly</option>
                    <option value="Educational">Educational</option>
                  </select>
                </label>
              </div>

              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Shelf Location</span>
                <input
                  style={styles.filterControl}
                  value={manualBookForm.shelfLocation}
                  placeholder="Middle row center"
                  onChange={(e) => handleManualBookChange("shelfLocation", e.target.value)}
                />
              </label>

              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Summary</span>
                <textarea
                  style={{ ...styles.filterControl, height: "60px", resize: "none", fontFamily: "inherit" }}
                  value={manualBookForm.summary}
                  placeholder="Enter book summary..."
                  onChange={(e) => handleManualBookChange("summary", e.target.value)}
                />
              </label>

              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Why Read</span>
                <input
                  style={styles.filterControl}
                  value={manualBookForm.whyRead}
                  placeholder="Why someone would like this book..."
                  onChange={(e) => handleManualBookChange("whyRead", e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px", paddingBottom: "40px" }}>
              <button
                type="submit"
                style={styles.authPrimaryButton}
                disabled={!manualBookForm.title.trim()}
              >
                Save Book
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={closeManualBookModal}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {avatarModalOpen && (
        <div style={styles.modal} onClick={() => setAvatarModalOpen(false)}>
          <div style={{ ...styles.promptModalContent, maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>🎨 Avatar Creator</h2>
            <p style={styles.previewSubtitle}>Create your own custom cartoon character!</p>

            {/* Live Preview */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              margin: "16px 0",
              background: "var(--code-bg)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid var(--border)"
            }}>
              <div
                style={{ width: "100px", height: "100px", borderRadius: "50%", overflow: "hidden", backgroundColor: "#f8fafc", border: "2px solid #e2e8f0" }}
                dangerouslySetInnerHTML={{
                  __html: getAvatarSvgContent({
                    bgColor: avatarBgColor,
                    accentColor: avatarAccentColor,
                    accessory: avatarAccessory,
                    eyeSize: avatarEyeSize,
                    mouth: avatarMouth,
                    bgImage: avatarBgImage
                  })
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", textAlign: "left", maxHeight: "55vh", overflowY: "auto", paddingRight: "4px" }}>
              {/* Accessory select */}
              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Accessory Style</span>
                <select
                  style={styles.filterControl}
                  value={avatarAccessory}
                  onChange={(e) => setAvatarAccessory(e.target.value)}
                >
                  <option value="none">None 🟡</option>
                  <option value="bunny">🐰 Bunny Ears</option>
                  <option value="round">🐻 Round Ears</option>
                  <option value="horn">🦄 Magical Horn</option>
                  <option value="blush">😊 Blushing Cheeks</option>
                </select>
              </label>

              {/* Mouth Style select */}
              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Mouth Style</span>
                <select
                  style={styles.filterControl}
                  value={avatarMouth}
                  onChange={(e) => setAvatarMouth(e.target.value)}
                >
                  <option value="smile">Smile 😊</option>
                  <option value="circle">O shape 😮</option>
                  <option value="open">Open Mouth 😃</option>
                </select>
              </label>

              {/* Eye size slider */}
              <label style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Eye Size ({avatarEyeSize})</span>
                <input
                  type="range"
                  min="2"
                  max="7"
                  step="0.5"
                  value={avatarEyeSize}
                  onChange={(e) => setAvatarEyeSize(parseFloat(e.target.value))}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              </label>

              {/* Background Color Swatches */}
              <div style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Background Color</span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["#fbcfe8", "#fed7aa", "#bbf7d0", "#fef08a", "#e2e8f0", "#c084fc", "#60a5fa", "#f472b6"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setAvatarBgColor(color);
                        setAvatarBgImage(null);
                      }}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: avatarBgColor === color && !avatarBgImage ? "2.5px solid #000000" : "1.5px solid #cbd5e1",
                        cursor: "pointer",
                        padding: 0
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Accent/Line Color Swatches */}
              <div style={styles.filterLabel}>
                <span style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Line & Detail Color</span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["#db2777", "#ea580c", "#16a34a", "#ca8a04", "#475569", "#7c3aed", "#be185d", "#2563eb"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarAccentColor(color)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: avatarAccentColor === color ? "2.5px solid #ffffff" : "1.5px solid #cbd5e1",
                        boxShadow: avatarAccentColor === color ? "0 0 4px rgba(0,0,0,0.5)" : "none",
                        cursor: "pointer",
                        padding: 0
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Upload Custom Background Image Option */}
              <div style={{ ...styles.filterLabel, borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Upload Custom Character Background</span>
                <label
                  style={{
                    ...styles.authSecondaryButton,
                    fontSize: "12px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "6px"
                  }}
                >
                  🖼️ Choose Background Image
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setAvatarBgImage(e.target.result);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {avatarBgImage && (
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#dc2626",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      textAlign: "left",
                      marginTop: "4px",
                      padding: 0
                    }}
                    onClick={() => setAvatarBgImage(null)}
                  >
                    ❌ Remove background image
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ ...styles.previewActionRow, marginTop: "20px" }}>
              <button
                type="button"
                style={styles.authPrimaryButton}
                onClick={async () => {
                  try {
                    setAuthLoading(true);
                    const finalSvg = getAvatarSvgContent({
                      bgColor: avatarBgColor,
                      accentColor: avatarAccentColor,
                      accessory: avatarAccessory,
                      eyeSize: avatarEyeSize,
                      mouth: avatarMouth,
                      bgImage: avatarBgImage
                    });
                    const cartoonUrl = "data:image/svg+xml;utf8," + encodeURIComponent(finalSvg);
                    localforage.setItem("profilePic_" + auth.currentUser.uid, cartoonUrl);
                    setUser((prev) => ({ ...prev, customPhotoURL: cartoonUrl }));

                    if (db) {
                      const userRef = doc(db, "users", auth.currentUser.uid);
                      await setDoc(userRef, { customPhotoURL: cartoonUrl }, { merge: true });
                    }
                    setAuthMessage("Custom cartoon character saved!");
                    setAvatarModalOpen(false);
                  } catch (err) {
                    console.error("Error saving custom avatar", err);
                  } finally {
                    setAuthLoading(false);
                  }
                }}
              >
                Save Character
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setAvatarModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLibraryCard && (
        <div style={styles.modal} onClick={() => setSelectedLibraryCard(null)}>
          <div style={styles.libraryCardModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedLibraryCard.name}</h2>
                <p style={styles.previewSubtitle}>Library card</p>
              </div>

              <button
                style={styles.closeIconButton}
                onClick={() => setSelectedLibraryCard(null)}
                aria-label="Close library card"
              >
                X
              </button>
            </div>

            {selectedLibraryCard.imageDataUrl ? (
              <img
                src={selectedLibraryCard.imageDataUrl}
                alt={`${selectedLibraryCard.name} full library card`}
                style={styles.libraryCardFullPhoto}
              />
            ) : (
              <p style={styles.countText}>No card photo saved.</p>
            )}

            {renderBarcodeSvg(selectedLibraryCard.cardNumber)}

            <div style={styles.previewActionRow}>
              <button
                style={{ ...styles.closeButton, marginTop: 0 }}
                onClick={() => setSelectedLibraryCard(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {betaUnlockPopupOpen && (
        <div style={styles.modal} onClick={() => setBetaUnlockPopupOpen(false)}>
          <div style={{...styles.previewModalContent, textAlign: "center", padding: "40px 24px"}} onClick={(e) => e.stopPropagation()}>
            <h2 style={{...styles.modalTitle, fontSize: "24px", marginBottom: "16px"}}>✨ Premium Unlocked</h2>
            <p style={{...styles.previewSubtitle, fontSize: "16px", lineHeight: "1.5", color: "var(--text)"}}>
              Thanks for trying Lumina! Since you're an early beta tester, we've unlocked all premium features for you for FREE. Enjoy unlimited scans and premium cards!
            </p>
            <button
              style={{...styles.closeButton, marginTop: "32px"}}
              onClick={() => setBetaUnlockPopupOpen(false)}
            >
              Awesome, thanks!
            </button>
          </div>
        </div>
      )}

      {scanLimitModalState && (
        <div style={styles.modal} onClick={() => setScanLimitModalState(null)}>
          <div style={{...styles.previewModalContent, textAlign: "center", padding: "40px 24px"}} onClick={(e) => e.stopPropagation()}>
            <h2 style={{...styles.modalTitle, fontSize: "24px", marginBottom: "16px"}}>
              {scanLimitModalState === "login_required" ? "Free Scans Used ✨" : "Scan Limit Reached 🥺"}
            </h2>
            <p style={{...styles.previewSubtitle, fontSize: "16px", lineHeight: "1.5", color: "var(--text)"}}>
              {scanLimitModalState === "login_required" 
                ? "Whoa, you've used your 3 free daily scans! Create an account to score 10 free scans every single day. No pressure, just vibes! 🌙"
                : "You've used all 10 of your free daily scans! Unlock Beta Plus for literally unlimited scanning. It's totally free for early beta testers! 🚀"}
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
              <button
                style={{...styles.closeButton, marginTop: 0, background: "transparent", color: "var(--text)", border: "1px solid var(--border)"}}
                onClick={() => setScanLimitModalState(null)}
              >
                Close
              </button>
              <button
                style={{...styles.closeButton, marginTop: 0}}
                onClick={() => {
                  setScanLimitModalState(null);
                  setCurrentPage(scanLimitModalState === "login_required" ? "account" : "vibe");
                }}
              >
                {scanLimitModalState === "login_required" ? "Log In" : "Unlock Beta Plus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentPage === "scan" && previewModal && (
        <div style={styles.modal} onClick={closePreview}>
          <div style={styles.previewModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {previewModal.book?.title || "Book preview"}
                </h2>
                <p style={styles.previewSubtitle}>
                  {previewModal.status === "ready"
                    ? "Google Books preview"
                    : previewModal.message}
                </p>
              </div>

              <button
                style={styles.closeIconButton}
                onClick={closePreview}
                aria-label="Close preview"
              >
                X
              </button>
            </div>

            {previewModal.status === "ready" ? (
              <>
                <iframe
                  title={`${previewModal.book?.title || "Book"} preview`}
                  src={previewModal.embedUrl}
                  style={styles.previewFrame}
                  onError={() =>
                    setPreviewModal((currentModal) => ({
                      ...currentModal,
                      status: "error",
                      message:
                        "Google Books could not display this preview inside the app.",
                    }))
                  }
                />
                <p style={styles.previewHelpText}>
                  If the pages do not appear, Google Books may not allow an
                  embedded preview for this title.
                </p>
              </>
            ) : (
              <div style={styles.previewMessage}>
                <p>{previewModal.message}</p>
              </div>
            )}

            {getScopedSaveStatus(saveStatus, previewModal.book, "preview") && (
              <p style={styles.saveStatus}>
                {getScopedSaveStatus(saveStatus, previewModal.book, "preview")}
              </p>
            )}

            <div style={styles.previewActionRow}>
              {previewModal.source === "saved" ? (
                <button
                  style={styles.secondaryButton}
                  onClick={showPreviewBookDetails}
                >
                  Details
                </button>
              ) : (
                <button
                  style={{
                    ...styles.secondaryButton,
                    ...(previewModal.book && hasSavedPreview(previewModal.book)
                      ? styles.savedButton
                      : {}),
                  }}
                  onClick={downloadPreviewDetails}
                  disabled={previewModal.book && hasSavedPreview(previewModal.book)}
                >
                  {previewModal.book && hasSavedPreview(previewModal.book)
                    ? "Saved Preview"
                    : "Save Preview Details"}
                </button>
              )}

              <button
                style={{ ...styles.closeButton, marginTop: 0 }}
                onClick={closePreview}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      <nav style={styles.bottomTabs} aria-label="App pages">
        <div style={styles.bottomTabsInner}>
	        {[
	          ["scan", "⌕", "Scan", "var(--accent)", "var(--accent-bg)"],
	          ["vibe", "✦", "Vibe", "var(--accent)", "var(--accent-bg)"],
	          ["discover", "✨", "Discover", "var(--accent)", "var(--accent-bg)"],
	          ["saved", "▤", "Stash", "var(--accent)", "var(--accent-bg)"],
	        ].map(([pageId, icon, label, accent, accentBg]) => {
          const isActive = currentPage === pageId;

          return (
            <button
              key={pageId}
              type="button"
              style={{
                ...styles.bottomTabButton,
                color: isActive ? accent : "#64748b",
                ...(isActive
                  ? {
                      ...styles.bottomTabButtonActive,
                      background: accentBg,
	                      border: "1px solid var(--accent-border)",
                    }
                  : {}),
              }}
              onClick={() => setCurrentPage(pageId)}
            >
              <span style={{ ...styles.bottomTabIcon, color: accent }}>{icon}</span>
              <span style={styles.bottomTabLabel}>{label}</span>
            </button>
          );
        })}
        </div>
      </nav>
      <ChatBox user={user} readingList={readingList} savedFiles={savedFiles} />
    </div>
  );
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",
    maxWidth: "1000px",
    margin: "auto",
    padding: "clamp(14px, 4vw, 24px) clamp(14px, 4vw, 24px) 112px",
    fontFamily:
      '"Google Sans Flex", "Google Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "var(--bg)",
    color: "var(--text)",
    paddingBottom: "calc(140px + env(safe-area-inset-bottom))",
  },
  offlineBanner: {
    position: "sticky",
    top: "10px",
    zIndex: 9999,
    width: "100%",
    padding: "12px 16px",
    borderRadius: "8px",
    background: "rgba(220, 38, 38, 0.95)",
    color: "#ffffff",
    fontWeight: "600",
    fontSize: "14px",
    textAlign: "center",
    boxShadow: "0 8px 30px rgba(220, 38, 38, 0.35)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  deleteFolderBadge: {
    position: "absolute",
    right: "6px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(220, 38, 38, 0.12)",
    color: "#dc2626",
    border: "none",
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
    lineHeight: 1,
    padding: 0,
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
  },
  historyItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    gap: "16px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)",
    textAlign: "left",
  },
  historyMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  historyItemTitle: {
    color: "var(--text-h)",
    fontSize: "15px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  historyDate: {
    color: "#718096",
    fontSize: "12px",
  },
  historyDeleteButton: {
    flex: "0 0 auto",
    padding: "6px 12px",
    background: "rgba(220, 38, 38, 0.08)",
    color: "#dc2626",
    border: "1px solid rgba(220, 38, 38, 0.18)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
  },
  historyClearAllButton: {
    padding: "8px 16px",
    background: "none",
    color: "#dc2626",
    border: "1px solid rgba(220, 38, 38, 0.24)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
  },
  progressStepsList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
    borderTop: "1px solid rgba(34, 49, 71, 0.08)",
    paddingTop: "16px",
    boxSizing: "border-box",
  },
  progressStepRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "opacity 300ms ease",
    textAlign: "left",
  },
  progressStepDot: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    color: "#ffffff",
    fontWeight: "bold",
    lineHeight: 1,
    flex: "0 0 auto",
    transition: "all 300ms ease",
  },
  progressStepText: {
    fontSize: "13px",
    transition: "all 300ms ease",
  },
  hero: {
    background: "var(--social-bg)",
    borderRadius: "8px",
    padding: "clamp(22px, 6vw, 32px) clamp(16px, 5vw, 24px)",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
    minWidth: 0,
    maxWidth: "100%",
    boxShadow: "0 28px 90px rgba(31, 45, 61, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.78)",
    color: "var(--text-h)",
    border: "1px solid var(--border)",
    backdropFilter: "blur(22px)",
  },
  heroText: {
    flex: "1 1 260px",
    minWidth: 0,
  },
  brandButton: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minWidth: 0,
    maxWidth: "100%",
    padding: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  brandMark: {
    position: "relative",
    width: "54px",
    height: "54px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--code-bg)",
    boxShadow: "0 0 0 1px var(--border), 0 12px 32px rgba(31, 45, 61, 0.12)",
    overflow: "hidden",
    flex: "0 0 auto",
  },
  brandMarkImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 6vw, 38px)",
    color: "var(--text-h)",
    lineHeight: 1.15,
    wordBreak: "break-word",
    fontWeight: "650",
    letterSpacing: 0,
  },
  subtitle: {
    color: "var(--text)",
    fontSize: "16px",
    lineHeight: 1.5,
    marginTop: "12px",
    marginBottom: 0,
  },
  homeSubtitleCollapse: {
    margin: "12px 0 0",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
  },
  homeSubtitleBody: {
    margin: 0,
    color: "var(--text)",
    fontSize: "14px",
    lineHeight: 1.45,
    textAlign: "left",
  },
  heroArt: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    width: "112px",
    height: "58px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    fontSize: "14px",
    fontWeight: "650",
    flex: "0 0 auto",
    maxWidth: "100%",
    minWidth: 0,
    boxShadow: "0 18px 44px rgba(31, 45, 61, 0.08)",
  },
  heroNavButton: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "1px solid rgba(34, 49, 71, 0.08)",
    background: "var(--code-bg)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    flex: "0 0 auto",
    boxShadow: "0 8px 18px rgba(31, 45, 61, 0.08)",
  },
  agentDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    background: "var(--accent)",
    boxShadow: "0 0 0 4px var(--accent-bg)",
  },
  homeGreetingPanel: {
    margin: "18px 0 0",
    padding: "16px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    textAlign: "left",
    boxShadow: "0 18px 48px rgba(31, 45, 61, 0.08)",
  },
  homeGreetingTitle: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "20px",
    lineHeight: 1.25,
    fontWeight: "750",
  },
  homeGreetingText: {
    margin: "6px 0 0",
    color: "var(--text)",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  uploadBox: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    margin: "24px 0",
    minWidth: 0,
  },
  pageNav: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    margin: "16px 0 6px",
    minWidth: 0,
    maxWidth: "100%",
  },
  bottomTabs: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    boxSizing: "border-box",
    minHeight: "78px",
    display: "flex",
    justifyContent: "center",
    padding: "10px 16px max(12px, env(safe-area-inset-bottom))",
    background: "var(--bg, rgba(255, 255, 255, 0.98))",
    boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.08)",
    backdropFilter: "blur(18px)",
    borderTop: "1px solid var(--border)",
    zIndex: 1200,
  },
  bottomTabsInner: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    width: "100%",
    maxWidth: "1126px",
  },
  bottomTabButton: {
    minWidth: 0,
    minHeight: "60px",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: "4px",
    padding: "7px 6px",
    borderRadius: "8px",
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--text, #718096)",
    cursor: "pointer",
    fontWeight: "780",
  },
  bottomTabButtonActive: {
    border: "1px solid var(--accent-border)",
    background: "var(--accent-bg)",
    color: "var(--accent)",
  },
  bottomTabIcon: {
    fontSize: "31px",
    lineHeight: 1,
    fontWeight: "850",
  },
  bottomTabLabel: {
    fontSize: "13px",
    lineHeight: 1.1,
    fontWeight: "800",
  },
  vibePage: {
    display: "grid",
    gap: "18px",
    margin: "22px 0",
  },
  vibeHero: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "16px",
    alignItems: "stretch",
    padding: "18px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 20px 46px rgba(31, 45, 61, 0.1)",
  },
  vibeKicker: {
    display: "inline-flex",
    marginBottom: "10px",
    color: "var(--accent)",
    fontSize: "12px",
    fontWeight: "850",
    textTransform: "uppercase",
  },
  vibeTitle: {
    margin: 0,
    color: "#172033",
    fontSize: "26px",
    lineHeight: 1.15,
    fontWeight: "800",
  },
  vibeText: {
    margin: "8px 0 0",
    color: "#4f5f73",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  vibeScoreCard: {
    display: "grid",
    alignContent: "center",
    gap: "4px",
    padding: "16px",
    borderRadius: "8px",
    background: "#172033",
    color: "#ffffff",
    textAlign: "left",
    border: "1px solid rgba(37, 99, 235, 0.28)",
    boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.08) inset",
  },
  vibeScoreLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    fontWeight: "750",
  },
  vibeScoreValue: {
    fontSize: "38px",
    lineHeight: 1,
  },
  vibeScoreHint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    lineHeight: 1.35,
  },
  vibeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: "16px",
  },
  vibeSection: {
    padding: "16px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 14px 34px rgba(31, 45, 61, 0.08)",
    textAlign: "left",
  },
  themeSelectorPanel: {
    padding: "16px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 14px 34px rgba(31, 45, 61, 0.08)",
    textAlign: "left",
  },
  themeSelectorCompact: {
    borderTop: "1px solid var(--border)",
    paddingTop: "12px",
  },
  themeSelectorHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  themeSelectorTitle: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "18px",
    lineHeight: 1.2,
    fontWeight: "780",
  },
  themeSelectorTitleSmall: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "14px",
    lineHeight: 1.2,
    fontWeight: "750",
  },
  themeSelectorMeta: {
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: "750",
  },
  themeSelectorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "8px",
  },
  themeChoiceButton: {
    minHeight: "42px",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "750",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textAlign: "center",
  },
  themeChoiceButtonActive: {
    border: "1px solid var(--accent)",
    background: "var(--accent-bg)",
    color: "var(--accent)",
    boxShadow: "0 8px 18px rgba(31, 45, 61, 0.08)",
  },
  themeChoiceIcon: {
    fontSize: "16px",
    lineHeight: 1,
  },
  vibeSectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  vibeSectionTitle: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "18px",
    lineHeight: 1.25,
    fontWeight: "780",
  },
  vibeMoodGrid: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    margin: "14px 0",
  },
  vibeMoodButton: {
    minHeight: "36px",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontWeight: "750",
    fontSize: "13px",
  },
  vibeMoodButtonActive: {
    border: "1px solid var(--accent)",
    background: "var(--accent-bg)",
    color: "var(--accent)",
  },
  vibeShareCard: {
    display: "grid",
    gap: "10px",
    padding: "18px",
    borderRadius: "8px",
    background: "#111827",
    color: "#ffffff",
    overflow: "hidden",
  },
  vibeCardEyebrow: {
    color: "#f9a8d4",
    fontSize: "12px",
    fontWeight: "850",
    textTransform: "uppercase",
  },
  vibeCardTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.1,
    fontWeight: "850",
  },
  vibeCardBody: {
    margin: 0,
    color: "rgba(255,255,255,0.84)",
    fontSize: "15px",
    lineHeight: 1.45,
  },
  vibeCardPrompt: {
    margin: 0,
    color: "#a7f3d0",
    fontSize: "13px",
    fontWeight: "750",
  },
  vibeBookStrip: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  vibeBookPill: {
    maxWidth: "100%",
    padding: "7px 9px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "750",
    overflowWrap: "anywhere",
  },
  vibeShareText: {
    width: "100%",
    minHeight: "140px",
    marginTop: "14px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    fontSize: "13px",
    lineHeight: 1.45,
    resize: "vertical",
    boxSizing: "border-box",
  },
  vibeChecklistItem: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    gap: "8px",
    alignItems: "start",
    marginTop: "12px",
    color: "var(--text)",
    fontSize: "14px",
    lineHeight: 1.45,
    fontWeight: "650",
  },
  vibeCheckDot: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent-bg)",
    color: "var(--accent)",
    fontWeight: "900",
  },
  vibeMonetizationRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: "14px",
  },
  vibePlanGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "14px",
    marginTop: "14px",
  },
  vibePlanCard: {
    display: "grid",
    gap: "12px",
    padding: "14px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
  },
  vibePlanCardActive: {
    border: "1px solid var(--accent)",
    boxShadow: "0 12px 30px rgba(31, 45, 61, 0.1)",
  },
  vibePlanTitle: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "17px",
    fontWeight: "800",
  },
  vibePlanPrice: {
    color: "var(--accent)",
    fontSize: "16px",
    whiteSpace: "nowrap",
  },
  vibePerkList: {
    margin: 0,
    paddingLeft: "18px",
    color: "var(--text)",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: "650",
  },
  vibeStatus: {
    margin: 0,
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--accent-border)",
    background: "var(--accent-bg)",
    color: "var(--text-h)",
    fontSize: "13px",
    fontWeight: "750",
  },
  folderToolbar: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    alignItems: "start",
    margin: "16px 0",
  },
  folderTabs: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    minWidth: 0,
  },
  navButton: {
    minWidth: 0,
    minHeight: "36px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(34, 49, 71, 0.12)",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#243044",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
    whiteSpace: "normal",
  },
  navButtonActive: {
    background: "var(--accent-bg)",
    border: "1px solid var(--accent-border)",
    color: "var(--accent)",
  },
  cameraButton: {
    flex: "1 1 min(100%, 150px)",
    minWidth: 0,
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "12px 20px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    border: "none",
    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
    transition: "all 150ms ease",
  },
  uploadPhotoButton: {
    flex: "1 1 min(100%, 150px)",
    minWidth: 0,
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "12px 20px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    border: "none",
    background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.35)",
    transition: "all 150ms ease",
  },
  manualBookButton: {
    flex: "1 1 min(100%, 150px)",
    minWidth: 0,
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "12px 20px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    border: "none",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
    transition: "all 150ms ease",
  },
  scanButtonNeedsAuth: {
    opacity: 0.78,
    border: "1px solid rgba(245, 158, 11, 0.36)",
    boxShadow: "none",
  },
  voiceStatus: {
    margin: "10px 0 14px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid rgba(34, 49, 71, 0.1)",
    color: "#243044",
    fontSize: "13px",
    fontWeight: "650",
    textAlign: "left",
  },
  filterPanel: {
    margin: "0 0 24px",
    padding: "14px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 14px 34px rgba(31, 45, 61, 0.09)",
    textAlign: "left",
  },
  filterHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  filterTitleButton: {
    minHeight: "36px",
    padding: "6px 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    background: "transparent",
    color: "var(--text-h)",
    cursor: "pointer",
    textAlign: "left",
  },
  filterTitle: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "18px",
    lineHeight: 1.2,
    fontWeight: "650",
  },
  filterCountBadge: {
    minWidth: "24px",
    height: "24px",
    padding: "0 7px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent-bg)",
    color: "var(--accent)",
    border: "1px solid var(--accent-border)",
    fontSize: "12px",
    fontWeight: "750",
  },
  filterChevron: {
    color: "var(--text)",
    fontSize: "11px",
    fontWeight: "750",
  },
  filterHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
  },
  filterSummary: {
    margin: "10px 0 0",
    color: "#718096",
    fontSize: "13px",
    lineHeight: 1.35,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: "10px",
  },
  filterLabel: {
    display: "grid",
    gap: "6px",
    color: "#4f5f73",
    fontSize: "12px",
    fontWeight: "750",
    textAlign: "center",
  },
  passwordHint: {
    color: "#718096",
    fontSize: "12px",
    fontWeight: "650",
    lineHeight: 1.4,
  },
  filterControl: {
    width: "100%",
    minWidth: 0,
    minHeight: "40px",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    outlineColor: "var(--accent)",
    fontSize: "14px",
    fontWeight: "600",
    boxSizing: "border-box",
  },
  clearFilterButton: {
    minHeight: "34px",
    padding: "7px 10px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
  },
  authPanel: {
    margin: "24px 0",
    padding: "18px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 18px 42px rgba(31, 45, 61, 0.1)",
    textAlign: "left",
  },
  authHeader: {
    marginBottom: "16px",
  },
  authTitle: {
    margin: "0 0 6px",
    color: "var(--text-h)",
    fontSize: "24px",
    lineHeight: 1.2,
    fontWeight: "700",
  },
  authSubtitle: {
    color: "var(--text)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  authNotice: {
    margin: "0 0 14px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(245, 158, 11, 0.34)",
    background: "rgba(245, 158, 11, 0.1)",
    color: "var(--text)",
    fontSize: "13px",
    fontWeight: "650",
  },
  authForm: {
    display: "grid",
    gap: "12px",
  },
  authPrimaryButton: {
    minHeight: "42px",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid var(--accent)",
    background: "var(--accent)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "750",
  },
  authSecondaryButton: {
    minHeight: "40px",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontWeight: "700",
  },
  appleSignInButton: {
    minHeight: "42px",
    padding: "9px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--social-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontWeight: "750",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    boxShadow: "0 8px 20px rgba(31, 45, 61, 0.08)",
  },
  googleSignInButton: {
    minHeight: "42px",
    padding: "9px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--social-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontWeight: "750",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    boxShadow: "0 8px 20px rgba(31, 45, 61, 0.08)",
  },
  googleSignInIcon: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent)",
    background: "var(--accent)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    fontSize: "18px",
    fontWeight: "900",
    lineHeight: 1,
  },
  authTextButton: {
    padding: "6px 0",
    border: "none",
    background: "transparent",
    color: "var(--accent)",
    cursor: "pointer",
    fontWeight: "700",
    textAlign: "left",
  },
  authActionRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "12px",
  },
  authFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "12px",
  },
  authMessage: {
    margin: "12px 0 0",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--accent-border)",
    background: "var(--accent-bg)",
    color: "var(--text-h)",
    fontSize: "13px",
    fontWeight: "650",
  },
  libraryCardBody: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: "16px",
    alignItems: "start",
    minWidth: 0,
  },
  libraryCardForm: {
    display: "grid",
    gap: "12px",
  },
  libraryCardActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    minWidth: 0,
  },
  libraryCardScanButton: {
    minHeight: "42px",
    boxSizing: "border-box",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  libraryCardList: {
    display: "grid",
    gap: "12px",
  },
  walletAddHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "8px",
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
  },
  walletAddIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--accent)",
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "700",
    flex: "0 0 auto",
  },
  walletAddTitle: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "16px",
    lineHeight: 1.2,
  },
  libraryCardTile: {
    display: "grid",
    gap: "10px",
  },
  libraryCardWalletButton: {
    position: "relative",
    minHeight: "154px",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "18px",
    borderRadius: "8px",
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 18px 38px rgba(31, 45, 61, 0.13)",
    color: "var(--text-h)",
    cursor: "pointer",
    overflow: "hidden",
    textAlign: "left",
  },
  walletAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "8px",
    background: "var(--accent)",
  },
  walletEyebrow: {
    margin: "0 0 18px",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: "750",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  walletMaskedNumber: {
    margin: "18px 0 0",
    color: "var(--text-h)",
    fontSize: "15px",
    fontWeight: "700",
    fontFamily: "ui-monospace, Consolas, monospace",
  },
  walletTapHint: {
    position: "absolute",
    right: "14px",
    bottom: "12px",
    color: "var(--accent)",
    fontSize: "13px",
    fontWeight: "750",
  },
  libraryCardTileActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  libraryCardName: {
    margin: 0,
    color: "var(--text-h)",
    fontSize: "22px",
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },
  libraryCardBarcode: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    height: "112px",
    borderRadius: "8px",
    border: "8px solid #ffffff",
    background: "#ffffff",
    boxSizing: "border-box",
  },
  libraryCardPhotoPreview: {
    padding: "10px",
    borderRadius: "8px",
    background: "rgba(34, 49, 71, 0.05)",
    border: "1px solid rgba(34, 49, 71, 0.1)",
  },
  libraryCardPhoto: {
    display: "block",
    width: "100%",
    maxHeight: "240px",
    objectFit: "contain",
    borderRadius: "8px",
    background: "#ffffff",
    border: "1px solid rgba(34, 49, 71, 0.14)",
    marginTop: "12px",
  },
  libraryCardModalContent: {
    width: "min(94vw, 560px)",
    maxWidth: "100%",
    boxSizing: "border-box",
    maxHeight: "90vh",
    overflow: "auto",
    background: "var(--social-bg)",
    borderRadius: "8px",
    padding: "18px",
    border: "1px solid var(--border)",
    boxShadow: "0 26px 70px rgba(0,0,0,0.45)",
    color: "var(--text-h)",
    textAlign: "left",
  },
  libraryCardFullPhoto: {
    display: "block",
    width: "100%",
    maxHeight: "52vh",
    objectFit: "contain",
    borderRadius: "8px",
    background: "#ffffff",
    border: "1px solid rgba(230, 234, 240, 0.16)",
    marginBottom: "14px",
  },
  pagePanel: {
    margin: "20px 0",
    padding: "14px",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 14px 32px rgba(31, 45, 61, 0.08)",
    textAlign: "left",
  },
  collapsibleSection: {
    margin: "14px 0",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    overflow: "hidden",
    textAlign: "left",
  },
  collapsibleHeader: {
    width: "100%",
    minHeight: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 14px",
    border: "none",
    background: "var(--code-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    textAlign: "left",
  },
  collapsibleHeaderWithAction: {
    display: "flex",
    alignItems: "stretch",
    background: "var(--code-bg)",
  },
  collapsibleHeaderToggle: {
    flex: "1 1 auto",
    minWidth: 0,
    background: "transparent",
  },
  collapsibleTitle: {
    minWidth: 0,
    color: "var(--text-h)",
    fontSize: "16px",
    fontWeight: "760",
    overflowWrap: "anywhere",
  },
  collapsibleMeta: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: "750",
    whiteSpace: "nowrap",
  },
  collapsibleChevron: {
    color: "var(--accent)",
    fontSize: "11px",
  },
  collapsibleCloseButton: {
    width: "36px",
    height: "36px",
    alignSelf: "center",
    marginRight: "10px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "var(--social-bg)",
    color: "var(--text-h)",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "800",
    lineHeight: 1,
    flex: "0 0 auto",
  },
  collapsibleBody: {
    padding: "14px",
  },
  developerLinkRow: {
    display: "flex",
    justifyContent: "flex-start",
    margin: "0 0 14px",
  },
  developerLinkButton: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "38px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--accent-border)",
    background: "var(--accent-bg)",
    color: "var(--text-h)",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: "750",
    fontSize: "13px",
  },
  developerStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  developerStatCard: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
  },
  developerStatLabel: {
    display: "block",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: "750",
    marginBottom: "6px",
  },
  developerStatValue: {
    display: "block",
    color: "var(--text-h)",
    fontSize: "28px",
    lineHeight: 1.1,
  },
  developerStatValueSmall: {
    display: "block",
    color: "var(--text-h)",
    fontSize: "14px",
    lineHeight: 1.3,
    overflowWrap: "anywhere",
  },
  developerIpList: {
    display: "grid",
    gap: "8px",
  },
  developerIpRow: {
    display: "grid",
    gap: "3px",
    color: "var(--text-h)",
    fontSize: "13px",
    lineHeight: 1.3,
    overflowWrap: "anywhere",
  },
  detailCollapse: {
    margin: "12px 0",
    background: "#f8fafc",
    border: "1px solid #dde5f0",
  },
  detailText: {
    margin: 0,
    color: "#38475f",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  detailNoteGrid: {
    display: "grid",
    gap: "12px",
  },
  preview: {
    width: "100%",
    maxHeight: "350px",
    objectFit: "cover",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid #d7e0ec",
    boxShadow: "0 16px 36px rgba(0,0,0,0.22)",
  },
  previewBlock: {
    display: "grid",
    gap: "10px",
    marginBottom: "20px",
  },
  clearPreviewButton: {
    minHeight: "38px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(34, 49, 71, 0.14)",
    background: "rgba(34, 49, 71, 0.06)",
    color: "#243044",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
    textAlign: "center",
  },
  loading: {
    fontWeight: "600",
    color: "var(--accent)",
  },
  processingOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "max(18px, calc(env(safe-area-inset-top) + 14px)) 22px 22px",
    background: "rgba(15, 23, 42, 0.34)",
    backdropFilter: "blur(8px)",
  },
  processingPanel: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "center",
    gap: "16px",
    width: "min(100%, 430px)",
    margin: 0,
    padding: "18px",
    borderRadius: "8px",
    border: "1px solid rgba(37, 99, 235, 0.22)",
    background:
      "linear-gradient(135deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98))",
    boxShadow: "0 18px 42px rgba(31, 45, 61, 0.12)",
    textAlign: "left",
  },
  processingCopy: {
    minWidth: 0,
  },
  processingTitle: {
    margin: 0,
    color: "#172033",
    fontSize: "20px",
    lineHeight: 1.2,
    fontWeight: "760",
  },
  processingText: {
    margin: "6px 0 0",
    color: "#4f5f73",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  error: {
    color: "#b91c1c",
    fontWeight: "600",
  },
  filterComposer: {
    width: "100%",
    minWidth: "min(100%, 280px)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px",
    borderRadius: "8px",
    border: "1px solid rgba(34, 49, 71, 0.12)",
    background: "#ffffff",
  },
  filterSearchInput: {
    flex: 1,
    minWidth: 0,
    padding: "8px 10px",
    border: "none",
    fontSize: "16px",
    background: "transparent",
    color: "#243044",
    outline: "none",
  },
  iconComposerButton: {
    width: "36px",
    height: "36px",
    flex: "0 0 36px",
    borderRadius: "8px",
    border: "1px solid rgba(245, 158, 11, 0.34)",
    background: "rgba(245, 158, 11, 0.12)",
    color: "#92400e",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "750",
  },
  iconComposerButtonActive: {
    background: "rgba(220, 38, 38, 0.2)",
    color: "#b91c1c",
    border: "1px solid rgba(220, 38, 38, 0.48)",
    boxShadow: "0 0 0 4px rgba(220, 38, 38, 0.14)",
  },
  clearComposerButton: {
    width: "36px",
    height: "36px",
    flex: "0 0 36px",
    borderRadius: "8px",
    border: "1px solid rgba(34, 49, 71, 0.12)",
    background: "rgba(34, 49, 71, 0.06)",
    color: "#243044",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "800",
    lineHeight: 1,
  },
  sendComposerButton: {
    width: "36px",
    height: "36px",
    flex: "0 0 36px",
    borderRadius: "8px",
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
    fontWeight: "800",
  },
  sectionTitle: {
    color: "#172033",
    marginTop: "32px",
    marginBottom: "14px",
    fontWeight: "650",
    clear: "both",
  },
  countText: {
    color: "#718096",
    fontWeight: "500",
  },
  savedFilesSection: {
    margin: "24px 0",
    padding: "16px",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
    borderRadius: "8px",
    background: "var(--social-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 12px 28px rgba(31, 45, 61, 0.08)",
    textAlign: "left",
  },
  savedFilesTop: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "10px",
  },
  savedFilesArt: {
    position: "relative",
    width: "64px",
    height: "56px",
    border: "1px solid rgba(37, 99, 235, 0.24)",
    borderRadius: "8px",
    background: "linear-gradient(145deg, rgba(26, 115, 232, 0.18), rgba(23, 23, 23, 0.88))",
    boxShadow: "0 14px 32px rgba(31, 45, 61, 0.12)",
    cursor: "pointer",
    overflow: "hidden",
    flex: "0 0 auto",
  },
  savedArtBookOne: {
    position: "absolute",
    left: "13px",
    bottom: "10px",
    width: "13px",
    height: "32px",
    borderRadius: "3px",
    background: "linear-gradient(180deg, #2563eb, #2563eb)",
  },
  savedArtBookTwo: {
    position: "absolute",
    left: "27px",
    bottom: "10px",
    width: "13px",
    height: "38px",
    borderRadius: "3px",
    background: "linear-gradient(180deg, #f59e0b, #92400e)",
  },
  savedArtBookThree: {
    position: "absolute",
    left: "41px",
    bottom: "10px",
    width: "13px",
    height: "28px",
    borderRadius: "3px",
    background: "linear-gradient(180deg, #18794e, #A7D7B8)",
  },
  savedArtSpark: {
    position: "absolute",
    right: "8px",
    top: "7px",
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#dc2626",
    boxShadow: "0 0 18px #dc2626",
  },
  fileCountBadge: {
    minWidth: "28px",
    height: "28px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(26, 115, 232, 0.16)",
    color: "#2563eb",
    fontWeight: "700",
    fontSize: "13px",
  },
  saveStatus: {
    padding: "10px 12px",
    margin: "8px 0 12px",
    borderRadius: "8px",
    background: "rgba(24, 121, 78, 0.12)",
    border: "1px solid rgba(24, 121, 78, 0.34)",
    color: "#18794e",
    fontWeight: "600",
  },
  savedFileList: {
    display: "grid",
    gap: "10px",
  },
  savedFileItem: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto)",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    padding: "12px",
    borderRadius: "8px",
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-h)",
  },
  savedFileInfo: {
    minWidth: 0,
  },
  savedFileNameButton: {
    display: "inline",
    maxWidth: "100%",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "var(--text-h)",
    cursor: "pointer",
    font: "inherit",
    fontWeight: "700",
    textAlign: "left",
    overflowWrap: "anywhere",
  },
  savedFileActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    alignItems: "center",
    justifyContent: "stretch",
    minWidth: 0,
  },
  noPreviewBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid rgba(245, 158, 11, 0.28)",
    background: "rgba(245, 158, 11, 0.1)",
    color: "#92400e",
    fontWeight: "600",
    fontSize: "13px",
    textAlign: "center",
  },
  deleteButton: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(220, 38, 38, 0.35)",
    background: "rgba(220, 38, 38, 0.14)",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },
  savedFileMeta: {
    marginTop: "4px",
    color: "#718096",
    fontSize: "13px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    columnGap: "20px",
    rowGap: "30px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 16px 36px rgba(31, 45, 61, 0.1)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    color: "var(--text)",
    minHeight: "100%",
    textAlign: "left",
    position: "relative",
    cursor: "pointer",
  },
  cardTitle: {
    fontSize: "22px",
    margin: "0 0 10px",
    overflowWrap: "anywhere",
    lineHeight: 1.2,
  },
  bookImage: {
    position: "relative",
    height: "90px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "42px",
    marginBottom: "12px",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
    background: "linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(24, 121, 78, 0.14), rgba(245, 158, 11, 0.12))",
  },
  cardBookOne: {
    position: "absolute",
    left: "calc(50% - 30px)",
    bottom: "20px",
    width: "18px",
    height: "38px",
    borderRadius: "4px",
    background: "linear-gradient(180deg, #2563eb, #2563eb)",
    transform: "rotate(-8deg)",
  },
  cardBookTwo: {
    position: "absolute",
    left: "calc(50% - 10px)",
    bottom: "18px",
    width: "18px",
    height: "44px",
    borderRadius: "4px",
    background: "linear-gradient(180deg, #f59e0b, #92400e)",
  },
  cardBookThree: {
    position: "absolute",
    left: "calc(50% + 10px)",
    bottom: "20px",
    width: "18px",
    height: "36px",
    borderRadius: "4px",
    background: "linear-gradient(180deg, #18794e, #A7D7B8)",
    transform: "rotate(7deg)",
  },
  cardLens: {
    position: "absolute",
    right: "calc(50% - 38px)",
    top: "18px",
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    border: "3px solid #dc2626",
    background: "rgba(17, 18, 20, 0.65)",
    boxShadow: "0 0 18px rgba(220, 38, 38, 0.36)",
  },
  rating: {
    color: "#92400e",
    fontWeight: "600",
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "4px",
    fontWeight: "600",
    fontSize: "12px",
    alignSelf: "flex-start",
    marginTop: "12px",
  },
  metaPillRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    justifyContent: "center",
    margin: "0 0 10px",
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(37, 99, 235, 0.14)",
    border: "1px solid rgba(37, 99, 235, 0.3)",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "750",
  },
  inlineSelect: {
    width: "140px",
    minHeight: "36px",
    padding: "7px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(34, 49, 71, 0.14)",
    background: "#f6f8fb",
    color: "#243044",
    fontWeight: "700",
    textAlign: "center",
    textAlignLast: "center",
  },
  buttonRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
    gap: "8px",
    alignItems: "stretch",
    marginTop: "auto",
    paddingTop: "16px",
  },
  smallButton: {
    width: "100%",
    minHeight: "38px",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d7e0ec",
    background: "#f8fafc",
    color: "#243044",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
    lineHeight: 1.2,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    transition: "background 0.2s",
  },
  iconButton: {
    fontSize: "18px",
    lineHeight: 1,
  },
  favoriteButtonFloating: {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(4px)",
    border: "1px solid rgba(0, 0, 0, 0.08)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "18px",
    zIndex: 5,
    padding: 0,
    lineHeight: 1,
    transition: "transform 0.2s ease, background-color 0.2s ease",
  },
  favoriteButton: {
    border: "1px solid rgba(220, 38, 38, 0.26)",
    background: "rgba(220, 38, 38, 0.06)",
    color: "#dc2626",
    fontSize: "19px",
    lineHeight: 1,
    boxShadow: "0 8px 20px rgba(220, 38, 38, 0.08)",
  },
  favoriteButtonSaved: {
    border: "1px solid rgba(220, 38, 38, 0.48)",
    background: "linear-gradient(135deg, #dc2626, #b91c1c)",
    color: "#ffffff",
    boxShadow: "0 12px 28px rgba(220, 38, 38, 0.24)",
  },
  savedButton: {
    border: "1px solid rgba(24, 121, 78, 0.44)",
    background: "rgba(24, 121, 78, 0.16)",
    color: "#18794e",
  },
  selectedButton: {
    border: "1px solid rgba(37, 99, 235, 0.46)",
    background: "rgba(26, 115, 232, 0.18)",
    color: "#1d4ed8",
  },
  shelfLocationNote: {
    margin: "14px 0 0",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(37, 99, 235, 0.22)",
    background: "rgba(239, 246, 255, 0.9)",
    color: "#243044",
    fontSize: "13px",
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  disabledButton: {
    border: "1px solid rgba(154, 160, 166, 0.22)",
    background: "rgba(154, 160, 166, 0.1)",
    color: "#718096",
    cursor: "not-allowed",
  },
  compareTray: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    margin: "28px 0",
    padding: "16px",
    borderRadius: "8px",
    background: "#ffffff",
    border: "1px solid #dde5f0",
    boxShadow: "0 12px 28px rgba(31, 45, 61, 0.08)",
    textAlign: "left",
  },
  compareTrayActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  compareTable: {
    display: "grid",
    gap: "8px",
    width: "100%",
    minWidth: "560px",
  },
  compareTableScroll: {
    flex: "1 1 auto",
    overflow: "auto",
    overflowX: "auto",
    maxHeight: "60vh",
    paddingBottom: "4px",
  },
  compareRow: {
    display: "grid",
    gridTemplateColumns: "minmax(72px, 100px) repeat(2, minmax(0, 1fr))",
    gap: "8px",
    alignItems: "stretch",
    minWidth: 0,
  },
  compareLabel: {
    padding: "10px",
    borderRadius: "8px",
    background: "#f8fafc",
    border: "1px solid #dde5f0",
    color: "#718096",
    fontWeight: "700",
  },
  compareValue: {
    padding: "10px",
    borderRadius: "8px",
    background: "#f8fafc",
    border: "1px solid #dde5f0",
    color: "#243044",
    overflowWrap: "anywhere",
  },
  compareValueStrong: {
    padding: "10px",
    borderRadius: "8px",
    background: "rgba(26, 115, 232, 0.14)",
    border: "1px solid rgba(37, 99, 235, 0.3)",
    color: "#243044",
    fontWeight: "800",
    overflowWrap: "anywhere",
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.72)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "20px",
    overflowY: "auto",
    overflowX: "hidden",
    zIndex: 2000,
  },
  modalContent: {
    background: "#ffffff",
    padding: "28px",
    borderRadius: "8px",
    maxWidth: "620px",
    width: "100%",
    boxSizing: "border-box",
    boxShadow: "0 28px 70px rgba(31, 45, 61, 0.18)",
    color: "#5f6f86",
    margin: "auto",
  },
  compareModalContent: {
    background: "#ffffff",
    padding: "18px",
    borderRadius: "8px",
    maxWidth: "760px",
    width: "min(100%, 760px)",
    boxSizing: "border-box",
    maxHeight: "none",
    boxShadow: "0 28px 70px rgba(31, 45, 61, 0.18)",
    color: "#5f6f86",
    border: "1px solid #dde5f0",
    display: "flex",
    flexDirection: "column",
    margin: "auto",
  },
  previewModalContent: {
    background: "#ffffff",
    padding: "20px",
    borderRadius: "8px",
    maxWidth: "900px",
    width: "100%",
    boxSizing: "border-box",
    maxHeight: "none",
    boxShadow: "0 28px 70px rgba(31, 45, 61, 0.18)",
    color: "#5f6f86",
    border: "1px solid #dde5f0",
    overflow: "visible",
    margin: "auto",
  },
  promptModalContent: {
    background: "var(--social-bg)",
    padding: "24px",
    borderRadius: "8px",
    maxWidth: "420px",
    width: "min(100%, 420px)",
    boxSizing: "border-box",
    boxShadow: "0 28px 70px rgba(31, 45, 61, 0.18)",
    color: "var(--text-h)",
    border: "1px solid var(--border)",
    textAlign: "left",
    maxHeight: "92vh",
    overflowY: "auto",
  },
  promptIcon: {
    width: "54px",
    height: "54px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "14px",
    color: "#18794e",
    background: "rgba(24, 121, 78, 0.12)",
    border: "1px solid rgba(24, 121, 78, 0.22)",
    fontSize: "30px",
    fontWeight: "850",
  },
  modalHeader: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    marginBottom: "16px",
  },
  modalIcon: {
    position: "relative",
    width: "72px",
    height: "72px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "36px",
    overflow: "hidden",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
  },
  detailOrbit: {
    position: "absolute",
    width: "58px",
    height: "34px",
    borderRadius: "999px",
    border: "2px solid rgba(37, 99, 235, 0.48)",
    transform: "rotate(-24deg)",
  },
  detailBookCore: {
    position: "absolute",
    left: "22px",
    top: "18px",
    width: "21px",
    height: "32px",
    borderRadius: "3px 7px 7px 3px",
    background: "linear-gradient(135deg, #2563eb, #18794e)",
    boxShadow:
      "inset 4px 0 0 rgba(255, 255, 255, 0.24), 0 10px 24px rgba(37, 99, 235, 0.28)",
  },
  detailLensCore: {
    position: "absolute",
    right: "16px",
    top: "15px",
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    border: "3px solid #f59e0b",
    background: "rgba(17, 18, 20, 0.74)",
  },
  detailSparkOne: {
    position: "absolute",
    left: "12px",
    top: "13px",
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "#dc2626",
    boxShadow: "0 0 18px #dc2626",
  },
  detailSparkTwo: {
    position: "absolute",
    right: "14px",
    bottom: "13px",
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#A7D7B8",
    boxShadow: "0 0 18px #A7D7B8",
  },
  modalTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "700",
  },
  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "14px",
    flex: "0 0 auto",
  },
  previewSubtitle: {
    marginTop: "6px",
    color: "#718096",
    fontSize: "14px",
  },
  closeIconButton: {
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    border: "1px solid rgba(248, 249, 250, 0.28)",
    background: "#ffffff",
    color: "#172033",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "18px",
    flex: "0 0 auto",
    boxShadow: "0 8px 20px rgba(31, 45, 61, 0.12)",
  },
  previewFrame: {
    width: "100%",
    height: "min(68vh, 680px)",
    minHeight: "min(420px, 58vh)",
    border: "1px solid #d7e0ec",
    borderRadius: "8px",
    background: "#f8fafc",
  },
  previewMessage: {
    minHeight: "240px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    borderRadius: "8px",
    background: "#f8fafc",
    border: "1px solid #dde5f0",
    color: "#243044",
    textAlign: "center",
  },
  previewHelpText: {
    marginTop: "10px",
    color: "#718096",
    fontSize: "13px",
  },
  previewActionRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    marginTop: "16px",
  },
  secondaryButton: {
    width: "100%",
    background: "#f8fafc",
    color: "#243044",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #d7e0ec",
    cursor: "pointer",
    fontWeight: "600",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "12px",
  },
  detailMiniCard: {
    background: "#f8fafc",
    borderRadius: "8px",
    padding: "12px",
    border: "1px solid #dde5f0",
  },
  closeButton: {
    width: "100%",
    background: "#1d4ed8",
    color: "#ffffff",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    marginTop: "16px",
  },
};
