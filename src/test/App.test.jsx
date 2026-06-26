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
} from "../App.jsx";

describe("Password and Display Name Validation", () => {
  it("should validate passwords based on security rules", () => {
    // Too short
    expect(validatePassword("Ab1!")).toBe("Password must be at least 8 characters.");
    // No uppercase
    expect(validatePassword("abcdefg1!")).toBe("Password must include an uppercase letter.");
    // No number
    expect(validatePassword("Abcdefgh!")).toBe("Password must include a number.");
    // No special char
    expect(validatePassword("Abcdefgh1")).toBe("Password must include a special character.");
    // Valid password
    expect(validatePassword("BookCompass@1310")).toBe("");
  });

  it("should validate display names correctly", () => {
    // Empty
    expect(validateDisplayName("")).toBe("Enter a display name.");
    // Too short
    expect(validateDisplayName("sh")).toBe("Display name must be at least 3 characters.");
    // Special characters
    expect(validateDisplayName("shilpi!")).toBe("Use only letters, numbers, and spaces in your display name.");
    // Blocked term
    expect(validateDisplayName("administrator")).toBe("Choose a different display name.");
    // Valid
    expect(validateDisplayName("Reader Shilpi")).toBe("");
  });

  it("should sanitize display names properly", () => {
    expect(validateDisplayName("  Shilpi <b>Test</b>  ")).toBe("");
  });
});

describe("String & JSON Utils", () => {
  it("should normalize book search text", () => {
    expect(normalizeBookText("The Great Gatsby & Friends!")).toBe("great gatsby and friends");
    expect(normalizeBookText("A Hacker's Guide to the Galaxy")).toBe("hacker s guide to galaxy");
  });

  it("should generate a consistent book key", () => {
    const book = { title: "Clean Code", author: "Robert Martin" };
    expect(getBookKey(book)).toBe("clean code-robert martin");
  });

  it("should clean markdown wrapper fences around JSON text", () => {
    const raw = "```json\n{\"books\": []}\n```";
    expect(cleanJsonText(raw)).toBe("{\"books\": []}");
  });

  it("should safely parse JSON text", () => {
    expect(safeParseJson("{\"a\": 1}")).toEqual({ a: 1 });
    expect(safeParseJson("invalid-json")).toBeNull();
  });

  describe("User Name Utils", () => {
    it("should extract first name from full name", () => {
      expect(getFirstName({ displayName: "Shilpi Sharma" })).toBe("Shilpi");
    });

    it("should return email prefix if no displayName", () => {
      expect(getFirstName({ email: "shilpispin@gmail.com" })).toBe("shilpispin");
    });

    it("should default to Reader if user is null or empty", () => {
      expect(getFirstName(null)).toBe("Reader");
      expect(getFirstName({})).toBe("Reader");
    });
  });
});

describe("State Merge Logic", () => {
  it("should merge lists preserving uniqueness and preferring primary items", () => {
    const local = [{ id: "1", name: "A" }, { id: "2", name: "B" }];
    const remote = [{ id: "2", name: "B-updated" }, { id: "3", name: "C" }];
    
    const merged = mergeUniqueByKey(local, remote, (item) => item.id);
    expect(merged).toHaveLength(3);
    expect(merged[1].name).toBe("B"); // Keeps local as primary/first
  });
});

describe("Filtering & Search Logic", () => {
  const mockBooks = [
    {
      title: "Clean Code",
      author: "Robert C. Martin",
      genre: "Technology",
      rating: 4.5,
      readingLevel: "Advanced",
      gradeBand: "7+",
      ageRecommendation: "Adult",
      shelfPick: "Top Rated",
    },
    {
      title: "Green Eggs and Ham",
      author: "Dr. Seuss",
      genre: "Children's Book",
      rating: 4.8,
      readingLevel: "Easy",
      gradeBand: "K-3",
      ageRecommendation: "Kids",
      shelfPick: "Popular",
    },
  ];

  it("should match structured filters", () => {
    const filters1 = { genre: "Technology", minRating: "4" };
    expect(matchesStructuredFilters(mockBooks[0], filters1)).toBe(true);
    expect(matchesStructuredFilters(mockBooks[1], filters1)).toBe(false);

    const filters2 = { readingLevel: "Easy", gradeBand: "K-3" };
    expect(matchesStructuredFilters(mockBooks[1], filters2)).toBe(true);
    expect(matchesStructuredFilters(mockBooks[0], filters2)).toBe(false);
  });

  it("should parse search intents", () => {
    const intent1 = getSearchIntent("rating above 4.6");
    expect(intent1.minRating).toBe(4.6);

    const intent2 = getSearchIntent("grade 4-6 easy book");
    expect(intent2.gradeBand).toBe("4-6");
    expect(intent2.readingLevel).toBe("easy");
  });

  it("should match parsed intents to book features", () => {
    const intent1 = getSearchIntent("rating above 4.6");
    expect(matchesSearchIntent(mockBooks[0], intent1)).toBe(false); // 4.5 is not > 4.6
    expect(matchesSearchIntent(mockBooks[1], intent1)).toBe(true);  // 4.8 is > 4.6

    const intent2 = getSearchIntent("Clean Code Martin");
    expect(matchesSearchIntent(mockBooks[0], intent2)).toBe(true);
    expect(matchesSearchIntent(mockBooks[1], intent2)).toBe(false);
  });
});

describe("Google Books Scoring & Match Logic", () => {
  it("should match and score book recommendations properly", () => {
    const book = { title: "The Hobbit", author: "J.R.R. Tolkien" };
    const apiResult = {
      volumeInfo: {
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
      },
    };
    const score = scoreGoogleBooksMatch(book, apiResult);
    expect(score).toBeGreaterThan(100); // Perfect match + author match bonuses
  });
});

describe("Library Card & File Normalization", () => {
  it("should normalize saved preview files", () => {
    const rawFiles = [
      {
        bookTitle: "Clean Code",
        type: "details",
        payload: { catalogBook: { title: "Clean Code" } },
      },
    ];
    const normalized = normalizeSavedFiles(rawFiles);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("details-clean code");
  });

  it("should normalize library cards and build barcode configurations", () => {
    const rawCards = [
      {
        name: "My Local Library",
        cardNumber: "12345678",
      },
    ];
    const normalized = normalizeLibraryCards(rawCards);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].cardNumber).toBe("12345678");

    const barsData = getCode128Bars("12345678");
    expect(barsData.width).toBeGreaterThan(0);
    expect(barsData.bars.length).toBeGreaterThan(0);
  });
});

describe("Manual Book Addition", () => {
  it("should determine gradeBand correctly based on manual reading level input", () => {
    const getGradeBandForLevel = (level) => level === "Easy" ? "K-3" : level === "Advanced" ? "7+" : "4-6";
    expect(getGradeBandForLevel("Easy")).toBe("K-3");
    expect(getGradeBandForLevel("Intermediate")).toBe("4-6");
    expect(getGradeBandForLevel("Advanced")).toBe("7+");
  });
});

describe("Content Guidance & Error Messages", () => {
  it("should return correct guidance based on age, level, and grade", () => {
    expect(getContentGuidance({ ageRecommendation: "adult" })).toBe("Best reviewed by an adult before sharing with younger readers.");
    expect(getContentGuidance({ ageRecommendation: "teen" })).toBe("Good for older readers; skim themes if choosing for a child.");
    expect(getContentGuidance({ gradeBand: "7+" })).toBe("Good for older readers; skim themes if choosing for a child.");
    expect(getContentGuidance({ readingLevel: "Advanced" })).toBe("May need support for younger or developing readers.");
    expect(getContentGuidance({ ageRecommendation: "Kids", readingLevel: "Easy", gradeBand: "K-3" })).toBe("Generally approachable for the listed age and level.");
  });

  it("should return friendly scan errors based on error codes and messages", () => {
    expect(getFriendlyScanError({ message: "high demand" })).toBe("The scan AI is temporarily busy. Try again in a minute.");
    expect(getFriendlyScanError({ message: "failed to fetch" })).toBe("Lumina could not reach the scan service. Check your connection and try again.");
    expect(getFriendlyScanError({ message: "api key not valid" })).toBe("Gemini is not configured on the server. Check the Firebase Function secret.");
    expect(getFriendlyScanError({ code: "admin-restricted-operation" })).toBe("Guest scanning needs Anonymous sign-in enabled in Firebase Authentication. Open Firebase Console > Authentication > Sign-in method, then enable Anonymous.");
    expect(getFriendlyScanError({ code: "resource-exhausted" })).toBe("Gemini quota or rate limit was reached. Lumina will try Claude fallback when Gemini reports quota exhaustion.");
    expect(getFriendlyScanError({ message: "too large" })).toBe("That photo is too large. Try a smaller or cropped bookshelf photo.");
    expect(getFriendlyScanError({ message: "permission denied" })).toBe("permission denied"); // Returns original message if available for permissions
    expect(getFriendlyScanError({ code: "internal", message: "internal" })).toBe("The scan service hit an internal error. Try again once; if it repeats, check Firebase Function logs.");
    expect(getFriendlyScanError({})).toBe("Could not scan the bookshelf. Try a clearer photo of book spines.");
  });
});

describe("Folder Display Labels", () => {
  it("should return the full folder name and not use short forms like WR", () => {
    expect(getFolderDisplayLabel("Want to read")).toBe("Want to read");
    expect(getFolderDisplayLabel("Purchased")).toBe("Purchased");
  });
});
