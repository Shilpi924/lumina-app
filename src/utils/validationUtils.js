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

export function getScanConfidence(book) {
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

export function getScanConfidenceDisplayLabel(book) {
  const label = String(book?.scanConfidence || getScanConfidence(book).label || "");

  if (/please check title/i.test(label)) return "Confidence: low";
  if (/best guess/i.test(label)) return "Confidence: medium";
  if (/looks correct/i.test(label)) return "Confidence: high";
  if (/needs review/i.test(label)) return "Confidence: low";
  if (/high confidence/i.test(label)) return "Confidence: high";

  return label;
}

export function getTheme(book) {
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
