export function getUserDisplayName(user) {
  const rawName = sanitizeDisplayName(user?.displayName || user?.email?.split("@")[0]) || "Reader";
  return rawName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function getFirstName(user) {
  const name = getUserDisplayName(user);
  return name.split(' ')[0] || "Reader";
}

export function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 22) return "Good Evening";
  return "Good Night";
}

export function sanitizeDisplayName(name, maxLength = 40) {
  return String(name || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function getDisplayTime(isoDate) {
  if (!isoDate) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(isoDate));
}

export function getTimestamp() {
  return new Date().getTime();
}

export function cleanJsonText(text) {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

export function safeParseJson(text) {
  try {
    return JSON.parse(cleanJsonText(text));
  } catch (err) {
    console.error("Invalid JSON:", text);
    console.error(err);
    return null;
  }
}

export function normalizeBookText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAuthErrorMessage(err) {
  const code = err?.code || "";
  const message = String(err?.message || "");

  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Invalid email or password.";
  }
  if (code.includes("email-already-in-use")) {
    return "This email is already registered. Please log in.";
  }
  if (code.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (code.includes("weak-password")) {
    return "Password is too weak. Please use at least 6 characters.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many failed attempts. Please try again later or reset your password.";
  }
  if (code.includes("auth/unauthorized-domain")) {
    return "This app URL is not authorized in Firebase. Add 127.0.0.1 and localhost under Authentication > Settings > Authorized domains.";
  }
  if (code.includes("network-request-failed")) {
    return "Firebase could not connect. Check your internet connection and try again.";
  }
  if (
    message.toLowerCase().includes("no credentials available") ||
    code.includes("credential-unavailable")
  ) {
    return "No Google account is available on this device, or Android Google sign-in is not fully configured yet. Sign into Google on the device, verify the Firebase Android app setup for com.shilpi.lumina, then try again.";
  }

  return err?.message || "Authentication failed. Please try again.";
}

export function getBookKey(book) {
  return `${book?.title || ""}-${book?.author || ""}`.toLowerCase();
}

export function getSavedFileKey(bookTitle, type) {
  return `${type}-${normalizeBookText(bookTitle)}`;
}

export const e = (emoji, text = "") => {
  return text ? `${emoji} ${text}` : emoji;
};
