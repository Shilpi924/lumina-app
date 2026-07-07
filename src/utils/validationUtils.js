import { sanitizeDisplayName, normalizeBookText } from "./stringUtils";

export const BLOCKED_NAME_TERMS = [
  "admin",
  "administrator",
  "firebase",
  "google",
  "http",
  "https",
  "moderator",
  "support",
  "www",
];

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";

  return "";
}

export function validateDisplayName(name) {
  const sanitizedName = sanitizeDisplayName(name);
  const normalizedName = normalizeBookText(sanitizedName);

  if (!sanitizedName) return "Enter a display name.";
  if (sanitizedName.length < 3) return "Display name must be at least 3 characters.";
  if (!/^[a-zA-Z0-9 ]+$/.test(sanitizedName)) {
    return "Use only letters, numbers, and spaces in your display name.";
  }
  if (BLOCKED_NAME_TERMS.some((term) => normalizedName.includes(term))) {
    return "Choose a different display name.";
  }

  return "";
}
