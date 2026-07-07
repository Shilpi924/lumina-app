import { describe, it, expect } from "vitest";
import {
  validatePassword,
  validateDisplayName,
  isValidEmail,
} from "../utils/validationUtils";

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
