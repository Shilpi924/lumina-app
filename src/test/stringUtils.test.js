import { describe, it, expect } from "vitest";
import {
  getTimeGreeting,
  sanitizeDisplayName,
  getUserDisplayName,
  getFirstName,
} from "../utils/stringUtils";

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

describe("User Name Utils", () => {
  it("should extract first name from full display name", () => {
    expect(getFirstName({ displayName: "Shilpi Sharma" })).toBe("Shilpi");
  });

  it("should return email prefix if no displayName", () => {
    expect(getFirstName({ email: "shilpispin@gmail.com" })).toBe("Shilpispin");
  });

  it("should default to Reader if user is null or empty", () => {
    expect(getFirstName(null)).toBe("Reader");
    expect(getFirstName({})).toBe("Reader");
  });

  it("should return displayName from getUserDisplayName", () => {
    expect(getUserDisplayName({ displayName: "Shilpi Sharma" })).toBe("Shilpi Sharma");
  });

  it("should fall back to email prefix (before @) from getUserDisplayName", () => {
    expect(getUserDisplayName({ email: "test@example.com" })).toBe("Test");
  });

  it("should return Reader (not Guest) from getUserDisplayName for null", () => {
    expect(getUserDisplayName(null)).toBe("Reader");
    expect(getUserDisplayName({})).toBe("Reader");
  });
});

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
