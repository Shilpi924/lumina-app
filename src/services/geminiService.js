import { httpsCallable } from "firebase/functions";
import { cloudFunctions } from "../firebase";

export function getPromptTokenCount(result) {
  return Number(result?.usageMetadata?.promptTokenCount || 0);
}

export function getTotalTokenCount(result) {
  return Number(
    result?.usageMetadata?.totalTokenCount ||
      result?.usageMetadata?.promptTokenCount ||
      0
  );
}

export function getGeminiText(result) {
  return (
    result?.text ||
    result?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""
  );
}

export async function generateGeminiContent(contents, generationConfig = {}, callType = "Gemini call") {
  if (!cloudFunctions) {
    throw new Error("Firebase Functions is not configured.");
  }

  const callable = httpsCallable(cloudFunctions, "generateGeminiContent");
  const response = await callable({ contents, generationConfig, callType });

  return response.data;
}

export function getFriendlyScanError(error) {
  const code = String(error?.code || "").toLowerCase();
  const details = String(error?.details?.message || error?.details || "");
  const message = String(error?.message || details || "");
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("high demand") ||
    lowerMessage.includes("try again later") ||
    lowerMessage.includes("temporarily unavailable") ||
    code.includes("unavailable")
  ) {
    return "The scan AI is temporarily busy. Try again in a minute.";
  }
  if (lowerMessage.includes("failed to fetch")) {
    return "Lumina could not reach the scan service. Check your connection and try again.";
  }
  if (lowerMessage.includes("api key") || lowerMessage.includes("key not valid")) {
    return "Gemini is not configured on the server. Check the Firebase Function secret.";
  }
  if (
    code.includes("admin-restricted-operation") ||
    lowerMessage.includes("admin-restricted-operation") ||
    lowerMessage.includes("operation is restricted")
  ) {
    return "Guest scanning needs Anonymous sign-in enabled in Firebase Authentication. Open Firebase Console > Authentication > Sign-in method, then enable Anonymous.";
  }
  if (lowerMessage.includes("quota") || lowerMessage.includes("rate limit") || code.includes("resource-exhausted")) {
    return "Gemini quota or rate limit was reached. Lumina will try Claude fallback when Gemini reports quota exhaustion.";
  }
  if (lowerMessage.includes("too large")) {
    return "That photo is too large. Try a smaller or cropped bookshelf photo.";
  }
  if (lowerMessage.includes("permission") || lowerMessage.includes("forbidden") || code.includes("failed-precondition")) {
    return message || "Gemini rejected this request. Check that the API key allows the Gemini API.";
  }
  if (code.includes("internal") && lowerMessage === "internal") {
    return "The scan service hit an internal error. Try again once; if it repeats, check Firebase Function logs.";
  }

  return message || "Could not scan the bookshelf. Try a clearer photo of book spines.";
}
