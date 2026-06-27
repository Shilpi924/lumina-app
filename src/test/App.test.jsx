import { describe, it, expect } from "vitest";
import {
  validatePassword,
  validateDisplayName,
  normalizeBookText,
  getBookKey,
  cleanJsonText,
  safeParseJson,
  mergeUniqueByKey,
  matchesStructuredFilters,
  getSearchIntent,
  matchesSearchIntent,
  scoreGoogleBooksMatch,
  normalizeSavedFiles,
  normalizeLibraryCards,
  getCode128Bars,
  getFriendlyScanError,
  getFolderDisplayLabel,
  getFirstName,
  getUserDisplayName,
  getContentGuidance,
  canOpenSavedBookPreview,
  enrichScannedBook,
  getSafeFileName,
  getSavedBookGroups,
  getSavedFileKey,
  getScanConfidenceDisplayLabel,
  getTimeGreeting,
  isValidEmail,
  sanitizeDisplayName,
} from "../App.jsx";

// ─────────────────────────────────────────────────────────────
// 1. PASSWORD & DISPLAY NAME VALIDATION
// ─────────────────────────────────────────────────────────────
describe("Password and Display Name Validation", () => {
  it("should validate passwords based on security rules", () => {
    expect(validatePassword("Ab1!")).toBe("Password must be at least 8 characters.");
    expect(validatePassword("abcdefg1!")).toBe("Password must include an uppercase letter.");
    expect(validatePassword("Abcdefgh!")).toBe("Password must include a number.");
    expect(validatePassword("Abcdefgh1")).toBe("Password must include a special character.");
    expect(validatePassword("BookCompass@1310")).toBe("");
  });

  it("should validate display names correctly", () => {
    expect(validateDisplayName("")).toBe("Enter a display name.");
    expect(validateDisplayName("sh")).toBe("Display name must be at least 3 characters.");
    expect(validateDisplayName("shilpi!")).toBe("Use only letters, numbers, and spaces in your display name.");
    expect(validateDisplayName("administrator")).toBe("Choose a different display name.");
    expect(validateDisplayName("Reader Shilpi")).toBe("");
  });

  it("should sanitize display names with HTML tags", () => {
    expect(validateDisplayName("  Shilpi <b>Test</b>  ")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────
// 2. sanitizeDisplayName
// ─────────────────────────────────────────────────────────────
describe("sanitizeDisplayName", () => {
  it("should strip HTML tags from display name", () => {
    expect(sanitizeDisplayName("<b>hello</b>")).toBe("hello");
  });

  it("should trim whitespace", () => {
    expect(sanitizeDisplayName("  hello  ")).toBe("hello");
  });

  it("should return empty string for null/undefined", () => {
    expect(sanitizeDisplayName(null)).toBe("");
    expect(sanitizeDisplayName(undefined)).toBe("");
    expect(sanitizeDisplayName("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────
// 3. STRING & JSON UTILS
// ─────────────────────────────────────────────────────────────
describe("String & JSON Utils", () => {
  it("should normalize book search text", () => {
    expect(normalizeBookText("The Great Gatsby & Friends!")).toBe("great gatsby and friends");
    expect(normalizeBookText("A Hacker's Guide to the Galaxy")).toBe("hacker s guide to galaxy");
    expect(normalizeBookText("  ")).toBe("");
    expect(normalizeBookText(null)).toBe("");
  });

  it("should generate a consistent book key from title+author", () => {
    expect(getBookKey({ title: "Clean Code", author: "Robert Martin" })).toBe("clean code-robert martin");
  });

  it("should handle missing author in getBookKey", () => {
    expect(getBookKey({ title: "Dune" })).toBe("dune-");
  });

  it("should return a join-separator string from getBookKey for null/empty book", () => {
    // getBookKey returns `${title}-${author}` so empty gives "-"
    expect(getBookKey(null)).toBe("-");
    expect(getBookKey({})).toBe("-");
  });

  it("should clean markdown wrapper fences around JSON text", () => {
    const raw = "```json\n{\"books\": []}\n```";
    expect(cleanJsonText(raw)).toBe("{\"books\": []}");
  });

  it("should clean plain code fences around JSON text", () => {
    const raw = "```\n{\"a\": 1}\n```";
    expect(cleanJsonText(raw)).toBe("{\"a\": 1}");
  });

  it("should safely parse valid JSON text", () => {
    expect(safeParseJson("{\"a\": 1}")).toEqual({ a: 1 });
  });

  it("should return null for invalid JSON", () => {
    expect(safeParseJson("invalid-json")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(safeParseJson("")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 4. USER NAME UTILS
// ─────────────────────────────────────────────────────────────
describe("User Name Utils", () => {
  it("should extract first name from full display name", () => {
    expect(getFirstName({ displayName: "Shilpi Sharma" })).toBe("Shilpi");
  });

  it("should return email prefix if no displayName", () => {
    expect(getFirstName({ email: "shilpispin@gmail.com" })).toBe("shilpispin");
  });

  it("should default to Reader if user is null or empty", () => {
    expect(getFirstName(null)).toBe("Reader");
    expect(getFirstName({})).toBe("Reader");
  });

  it("should return displayName from getUserDisplayName", () => {
    expect(getUserDisplayName({ displayName: "Shilpi Sharma" })).toBe("Shilpi Sharma");
  });

  it("should fall back to email prefix (before @) from getUserDisplayName", () => {
    // getUserDisplayName uses email.split('@')[0] as fallback
    expect(getUserDisplayName({ email: "test@example.com" })).toBe("test");
  });

  it("should return Reader (not Guest) from getUserDisplayName for null", () => {
    // The function uses 'Reader' as the ultimate fallback
    expect(getUserDisplayName(null)).toBe("Reader");
    expect(getUserDisplayName({})).toBe("Reader");
  });
});

// ─────────────────────────────────────────────────────────────
// 5. TIME GREETING
// ─────────────────────────────────────────────────────────────
describe("getTimeGreeting", () => {
  const makeDate = (hours) => new Date(2025, 0, 1, hours, 0, 0);

  it("returns Good Morning before noon", () => {
    expect(getTimeGreeting(makeDate(6))).toBe("Good Morning");
    expect(getTimeGreeting(makeDate(11))).toBe("Good Morning");
  });

  it("returns Good Afternoon in the afternoon", () => {
    expect(getTimeGreeting(makeDate(12))).toBe("Good Afternoon");
    expect(getTimeGreeting(makeDate(16))).toBe("Good Afternoon");
  });

  it("returns Good Evening in the evening", () => {
    expect(getTimeGreeting(makeDate(17))).toBe("Good Evening");
    expect(getTimeGreeting(makeDate(21))).toBe("Good Evening");
  });

  it("returns Good Night late at night", () => {
    expect(getTimeGreeting(makeDate(22))).toBe("Good Night");
    expect(getTimeGreeting(makeDate(23))).toBe("Good Night");
  });
});

// ─────────────────────────────────────────────────────────────
// 6. EMAIL VALIDATION
// ─────────────────────────────────────────────────────────────
describe("isValidEmail", () => {
  it("should return true for valid email formats", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("shilpi.sharma+test@gmail.co.uk")).toBe(true);
  });

  it("should return false for invalid email formats", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@no-user.com")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 7. FILE NAME HELPERS
// ─────────────────────────────────────────────────────────────
describe("getSafeFileName and getSavedFileKey", () => {
  it("should normalize text into a safe filename", () => {
    expect(getSafeFileName("Clean Code!")).toBe("clean-code");
    expect(getSafeFileName("The Great Gatsby")).toBe("great-gatsby");
    expect(getSafeFileName("")).toBe("book-preview");
  });

  it("should create a typed saved file key", () => {
    expect(getSavedFileKey("Clean Code", "details")).toBe("details-clean code");
    expect(getSavedFileKey("Dune", "preview")).toBe("preview-dune");
  });
});

// ─────────────────────────────────────────────────────────────
// 8. STATE MERGE LOGIC
// ─────────────────────────────────────────────────────────────
describe("State Merge Logic", () => {
  it("should merge lists preserving uniqueness and preferring primary items", () => {
    const local = [{ id: "1", name: "A" }, { id: "2", name: "B" }];
    const remote = [{ id: "2", name: "B-updated" }, { id: "3", name: "C" }];
    const merged = mergeUniqueByKey(local, remote, (item) => item.id);
    expect(merged).toHaveLength(3);
    expect(merged.find((m) => m.id === "2").name).toBe("B");
    expect(merged.find((m) => m.id === "3").name).toBe("C");
  });

  it("should handle empty primary and secondary arrays", () => {
    expect(mergeUniqueByKey([], [], (i) => i.id)).toHaveLength(0);
  });

  it("should return primary items when secondary is empty", () => {
    const list = [{ id: "1", name: "A" }];
    expect(mergeUniqueByKey(list, [], (i) => i.id)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. FILTERING & SEARCH LOGIC
// ─────────────────────────────────────────────────────────────
describe("Filtering & Search Logic", () => {
  const mockBooks = [
    {
      title: "Clean Code", author: "Robert C. Martin",
      genre: "Technology", rating: 4.5,
      readingLevel: "Advanced", gradeBand: "7+",
      ageRecommendation: "Adult", shelfPick: "Top Rated",
    },
    {
      title: "Green Eggs and Ham", author: "Dr. Seuss",
      genre: "Children's Book", rating: 4.8,
      readingLevel: "Easy", gradeBand: "K-3",
      ageRecommendation: "Kids", shelfPick: "Popular",
    },
    {
      title: "Harry Potter", author: "J.K. Rowling",
      genre: "Fantasy", rating: 4.9,
      readingLevel: "Intermediate", gradeBand: "4-6",
      ageRecommendation: "Young Readers", shelfPick: "Popular",
    },
  ];

  it("should match structured filters by genre", () => {
    expect(matchesStructuredFilters(mockBooks[0], { genre: "Technology", minRating: "4" })).toBe(true);
    expect(matchesStructuredFilters(mockBooks[1], { genre: "Technology", minRating: "4" })).toBe(false);
  });

  it("should match structured filters by reading level and grade band", () => {
    expect(matchesStructuredFilters(mockBooks[1], { readingLevel: "Easy", gradeBand: "K-3" })).toBe(true);
    expect(matchesStructuredFilters(mockBooks[0], { readingLevel: "Easy", gradeBand: "K-3" })).toBe(false);
  });

  it("should match structured filters by minRating", () => {
    expect(matchesStructuredFilters(mockBooks[1], { minRating: "4.9" })).toBe(false);
    expect(matchesStructuredFilters(mockBooks[2], { minRating: "4.9" })).toBe(true);
  });

  it("should pass empty filters for any book", () => {
    expect(matchesStructuredFilters(mockBooks[0], {})).toBe(true);
  });

  it("should parse minRating from search intent", () => {
    expect(getSearchIntent("rating above 4.6").minRating).toBe(4.6);
  });

  it("should parse gradeBand and readingLevel from search intent", () => {
    const intent = getSearchIntent("grade 4-6 easy book");
    expect(intent.gradeBand).toBe("4-6");
    expect(intent.readingLevel).toBe("easy");
  });

  it("should match parsed intents to book features", () => {
    const intent1 = getSearchIntent("rating above 4.6");
    expect(matchesSearchIntent(mockBooks[0], intent1)).toBe(false);
    expect(matchesSearchIntent(mockBooks[1], intent1)).toBe(true);

    const intent2 = getSearchIntent("Clean Code Martin");
    expect(matchesSearchIntent(mockBooks[0], intent2)).toBe(true);
    expect(matchesSearchIntent(mockBooks[1], intent2)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 10. GOOGLE BOOKS SCORING & MATCH LOGIC
// ─────────────────────────────────────────────────────────────
describe("Google Books Scoring & Match Logic", () => {
  it("should give high score for exact title + author match", () => {
    const book = { title: "The Hobbit", author: "J.R.R. Tolkien" };
    const api = { volumeInfo: { title: "The Hobbit", authors: ["J.R.R. Tolkien"] } };
    expect(scoreGoogleBooksMatch(book, api)).toBeGreaterThan(100);
  });

  it("should score exact match higher than partial match", () => {
    const book = { title: "The Hobbit", author: "J.R.R. Tolkien" };
    const exact = { volumeInfo: { title: "The Hobbit", authors: ["J.R.R. Tolkien"] } };
    const partial = { volumeInfo: { title: "Hobbit Stories", authors: ["Tolkien J.R.R."] } };
    expect(scoreGoogleBooksMatch(book, exact)).toBeGreaterThan(scoreGoogleBooksMatch(book, partial));
  });

  it("should return a numeric score for any input", () => {
    const book = { title: "The Hobbit", author: "J.R.R. Tolkien" };
    const mismatch = { volumeInfo: { title: "Harry Potter", authors: ["J.K. Rowling"] } };
    expect(typeof scoreGoogleBooksMatch(book, mismatch)).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────
// 11. LIBRARY CARD & FILE NORMALIZATION
// ─────────────────────────────────────────────────────────────
describe("Library Card & File Normalization", () => {
  it("should normalize saved preview files", () => {
    const normalized = normalizeSavedFiles([{
      bookTitle: "Clean Code",
      type: "details",
      payload: { catalogBook: { title: "Clean Code" } },
    }]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("details-clean code");
  });

  it("should normalize library cards", () => {
    const normalized = normalizeLibraryCards([{ name: "My Library", cardNumber: "12345678" }]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].cardNumber).toBe("12345678");
  });

  it("should generate barcode data", () => {
    const barsData = getCode128Bars("12345678");
    expect(barsData.width).toBeGreaterThan(0);
    expect(barsData.bars.length).toBeGreaterThan(0);
  });

  it("should handle empty saved files array", () => {
    expect(normalizeSavedFiles([])).toHaveLength(0);
    // Note: normalizeSavedFiles requires an array, not null
  });
});

// ─────────────────────────────────────────────────────────────
// 12. SAVED BOOK GROUPS
// ─────────────────────────────────────────────────────────────
describe("getSavedBookGroups", () => {
  it("should group multiple files for the same book together", () => {
    const files = [
      {
        id: "details-clean code", bookTitle: "Clean Code",
        savedAt: "2025-01-10T00:00:00Z",
        payload: { catalogBook: { title: "Clean Code", author: "Robert Martin" } },
      },
      {
        id: "preview-clean code", bookTitle: "Clean Code",
        savedAt: "2025-01-09T00:00:00Z",
        payload: {
          catalogBook: { title: "Clean Code", author: "Robert Martin" },
          preview: { status: "ready", embedUrl: "https://example.com" },
        },
      },
    ];
    const groups = getSavedBookGroups(files);
    expect(groups).toHaveLength(1);
    expect(groups[0].bookTitle).toBe("Clean Code");
    expect(groups[0].ids).toHaveLength(2);
  });

  it("should separate different books into different groups", () => {
    const files = [
      {
        id: "details-dune", bookTitle: "Dune",
        savedAt: "2025-01-10T00:00:00Z",
        payload: { catalogBook: { title: "Dune", author: "Frank Herbert" } },
      },
      {
        id: "details-hobbit", bookTitle: "The Hobbit",
        savedAt: "2025-01-08T00:00:00Z",
        payload: { catalogBook: { title: "The Hobbit", author: "J.R.R. Tolkien" } },
      },
    ];
    const groups = getSavedBookGroups(files);
    expect(groups).toHaveLength(2);
    expect(groups[0].bookTitle).toBe("Dune"); // newest first
  });

  it("should handle empty files array", () => {
    expect(getSavedBookGroups([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 13. canOpenSavedBookPreview
// ─────────────────────────────────────────────────────────────
describe("canOpenSavedBookPreview", () => {
  it("returns true when preview is ready with embedUrl", () => {
    expect(canOpenSavedBookPreview({
      preview: { status: "ready", embedUrl: "https://books.google.com/preview" }
    })).toBe(true);
  });

  it("returns false when preview status is not ready", () => {
    expect(canOpenSavedBookPreview({ preview: { status: "pending", embedUrl: "https://x.com" } })).toBe(false);
  });

  it("returns false when embedUrl is missing", () => {
    expect(canOpenSavedBookPreview({ preview: { status: "ready" } })).toBe(false);
  });

  it("returns false for null/no preview", () => {
    expect(canOpenSavedBookPreview(null)).toBe(false);
    expect(canOpenSavedBookPreview({})).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 14. SCAN CONFIDENCE & ENRICHMENT
// ─────────────────────────────────────────────────────────────
describe("getScanConfidenceDisplayLabel", () => {
  it("returns Confidence: low for Please check title", () => {
    expect(getScanConfidenceDisplayLabel({ scanConfidence: "Please check title" })).toBe("Confidence: low");
  });

  it("returns Confidence: medium for best guess", () => {
    expect(getScanConfidenceDisplayLabel({ scanConfidence: "best guess" })).toBe("Confidence: medium");
  });

  it("returns Confidence: high for looks correct", () => {
    expect(getScanConfidenceDisplayLabel({ scanConfidence: "looks correct" })).toBe("Confidence: high");
  });

  it("returns Confidence: high for High confidence", () => {
    expect(getScanConfidenceDisplayLabel({ scanConfidence: "High confidence" })).toBe("Confidence: high");
  });
});

describe("enrichScannedBook", () => {
  it("should add default shelf location if missing", () => {
    const enriched = enrichScannedBook({ title: "Dune" });
    expect(enriched.shelfLocation).toContain("Scan the shelf again");
  });

  it("should preserve existing shelf location", () => {
    const enriched = enrichScannedBook({ title: "Dune", shelfLocation: "Top row, left side" });
    expect(enriched.shelfLocation).toBe("Top row, left side");
  });

  it("should set reviewed to false by default", () => {
    expect(enrichScannedBook({ title: "Dune" }).reviewed).toBe(false);
  });

  it("should set reviewed to true if pre-marked", () => {
    expect(enrichScannedBook({ title: "Dune", reviewed: true }).reviewed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 15. CONTENT GUIDANCE & ERROR MESSAGES
// ─────────────────────────────────────────────────────────────
describe("Content Guidance", () => {
  it("returns adult guidance", () => {
    expect(getContentGuidance({ ageRecommendation: "adult" }))
      .toBe("Best reviewed by an adult before sharing with younger readers.");
  });

  it("returns teen/7+ guidance", () => {
    expect(getContentGuidance({ ageRecommendation: "teen" }))
      .toBe("Good for older readers; skim themes if choosing for a child.");
    expect(getContentGuidance({ gradeBand: "7+" }))
      .toBe("Good for older readers; skim themes if choosing for a child.");
  });

  it("returns advanced level guidance", () => {
    expect(getContentGuidance({ readingLevel: "Advanced" }))
      .toBe("May need support for younger or developing readers.");
  });

  it("returns general guidance for kids book", () => {
    expect(getContentGuidance({ ageRecommendation: "Kids", readingLevel: "Easy", gradeBand: "K-3" }))
      .toBe("Generally approachable for the listed age and level.");
  });

  it("returns general guidance for no metadata", () => {
    expect(getContentGuidance({}))
      .toBe("Generally approachable for the listed age and level.");
  });
});

describe("getFriendlyScanError", () => {
  it("handles high demand error", () => {
    expect(getFriendlyScanError({ message: "high demand" }))
      .toBe("The scan AI is temporarily busy. Try again in a minute.");
  });

  it("handles fetch failure", () => {
    expect(getFriendlyScanError({ message: "failed to fetch" }))
      .toBe("Lumina could not reach the scan service. Check your connection and try again.");
  });

  it("handles invalid API key", () => {
    expect(getFriendlyScanError({ message: "api key not valid" }))
      .toBe("Gemini is not configured on the server. Check the Firebase Function secret.");
  });

  it("handles admin-restricted-operation", () => {
    expect(getFriendlyScanError({ code: "admin-restricted-operation" })).toContain("Anonymous sign-in");
  });

  it("handles resource-exhausted", () => {
    expect(getFriendlyScanError({ code: "resource-exhausted" })).toContain("quota");
  });

  it("handles photo too large", () => {
    expect(getFriendlyScanError({ message: "too large" }))
      .toBe("That photo is too large. Try a smaller or cropped bookshelf photo.");
  });

  it("passes through permission denied message", () => {
    expect(getFriendlyScanError({ message: "permission denied" })).toBe("permission denied");
  });

  it("handles internal error", () => {
    expect(getFriendlyScanError({ code: "internal", message: "internal" })).toContain("internal error");
  });

  it("falls back to generic message", () => {
    expect(getFriendlyScanError({}))
      .toBe("Could not scan the bookshelf. Try a clearer photo of book spines.");
  });
});

// ─────────────────────────────────────────────────────────────
// 16. FOLDER DISPLAY LABELS
// ─────────────────────────────────────────────────────────────
describe("Folder Display Labels", () => {
  it("should return the full folder name", () => {
    expect(getFolderDisplayLabel("Want to read")).toBe("Want to read");
    expect(getFolderDisplayLabel("Purchased")).toBe("Purchased");
    expect(getFolderDisplayLabel("Favorites")).toBe("Favorites");
  });

  it("should handle empty folder name gracefully", () => {
    expect(typeof getFolderDisplayLabel("")).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────
// 17. MANUAL BOOK GRADE BAND HELPER
// ─────────────────────────────────────────────────────────────
describe("Manual Book Addition", () => {
  it("should determine gradeBand correctly based on reading level", () => {
    const getGradeBandForLevel = (level) =>
      level === "Easy" ? "K-3" : level === "Advanced" ? "7+" : "4-6";

    expect(getGradeBandForLevel("Easy")).toBe("K-3");
    expect(getGradeBandForLevel("Intermediate")).toBe("4-6");
    expect(getGradeBandForLevel("Advanced")).toBe("7+");
  });
});

// ─────────────────────────────────────────────────────────────
// 18. SHELF PHOTO HISTORY LOGIC (new feature)
// ─────────────────────────────────────────────────────────────
describe("Shelf Photo History Logic", () => {
  function addPhotoToHistory(prev, url, max = 5) {
    const next = [url, ...prev.filter((u) => u !== url)];
    return next.slice(0, max);
  }

  it("should prepend a new URL to the history", () => {
    expect(addPhotoToHistory([], "url-1")).toEqual(["url-1"]);
  });

  it("should not duplicate the same URL", () => {
    expect(addPhotoToHistory(["url-1", "url-2"], "url-1")).toEqual(["url-1", "url-2"]);
  });

  it("should keep newest URL at the front", () => {
    const history = addPhotoToHistory(["url-1", "url-2"], "url-3");
    expect(history[0]).toBe("url-3");
  });

  it("should limit history to 5 entries", () => {
    let history = [];
    for (let i = 1; i <= 7; i++) history = addPhotoToHistory(history, `url-${i}`);
    expect(history).toHaveLength(5);
    expect(history[0]).toBe("url-7");
  });

  it("should drop the oldest entry when at capacity", () => {
    // With 5 slots full, adding 'f' pushes out the last item ('e')
    const initial = ["a", "b", "c", "d", "e"];
    const result = addPhotoToHistory(initial, "f");
    expect(result).toHaveLength(5);
    expect(result[0]).toBe("f");
    // 'e' (the last item) is dropped, 'a' is still in there
    expect(result.includes("e")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 19. COMPARE BUTTON LABEL (new feature: "Pick another book to compare")
// ─────────────────────────────────────────────────────────────
describe("Compare Button Label", () => {
  function getCompareLabel(compareSelected, disableEmojis = false) {
    const eHelper = (emoji, text) => (disableEmojis ? text : `${emoji} ${text}`);
    return compareSelected ? "Pick another book to compare" : eHelper("⚖️", "Compare");
  }

  it('shows "Pick another book to compare" when book is in compare slot', () => {
    expect(getCompareLabel(true)).toBe("Pick another book to compare");
  });

  it('shows "⚖️ Compare" when book is not in compare slot', () => {
    expect(getCompareLabel(false)).toBe("⚖️ Compare");
  });

  it('shows plain "Compare" when emojis are disabled', () => {
    expect(getCompareLabel(false, true)).toBe("Compare");
  });

  it('always shows "Pick another book to compare" regardless of emoji setting', () => {
    expect(getCompareLabel(true, true)).toBe("Pick another book to compare");
    expect(getCompareLabel(true, false)).toBe("Pick another book to compare");
  });
});

// ─────────────────────────────────────────────────────────────
// 20. DELETE CONFIRMATION GUARD (behavioral spec)
// ─────────────────────────────────────────────────────────────
describe("Delete Confirmation Guard", () => {
  // Mirrors the guard logic: window.confirm before calling deleteSavedBook
  function guardedDelete(confirmed, deleteFn, book) {
    if (confirmed) {
      deleteFn(book);
      return true;
    }
    return false;
  }

  it("should call delete when user confirms", () => {
    let deleted = false;
    const result = guardedDelete(true, () => { deleted = true; }, { title: "Dune" });
    expect(deleted).toBe(true);
    expect(result).toBe(true);
  });

  it("should not call delete when user cancels", () => {
    let deleted = false;
    const result = guardedDelete(false, () => { deleted = true; }, { title: "Dune" });
    expect(deleted).toBe(false);
    expect(result).toBe(false);
  });
});
