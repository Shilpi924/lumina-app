# 📚 Lumina Pro — Release Notes (v1.0.23)

We have successfully compiled the Android App Bundle (`.aab` release package) after hardening the application with the following updates:

### 🚀 What's New

*   **📊 AI Routing Observability Dashboard**: Under the Account tab, you can now view a real-time performance metrics panel. It logs and displays model routing (Gemini vs. Claude), response latency (ms), token usage counters, and success/error status for the last 10 operations.
*   **📑 Reading Status Tracking**: Organize your stashed books into **To Read**, **Reading**, or **Finished** categories. Color-coded status badges are displayed on the top-left corner of the book cards.
*   **↕️ Advanced Stash Sorting**: Sort your library collection dynamically by **Title**, **Author**, **Date Saved**, or **Reading Status**.
*   **✨ Normalization & Rate Limit Guards**: Book titles and authors identified during shelf scans are automatically normalized. Google Books API queries are staggered to prevent rate-limiting/429 errors.
*   **📡 Storage Quota & Offline Resiliency**: 
    *   If browser/web storage limits are exceeded, a safe handler clears older AI metrics and limits history to prevent app crashes.
    *   An auto-sync listener detects when you transition from offline to online and pushes local/offline edits back to Cloud Firestore instantly.
*   **🧪 Strengthened Contributor Guide**: Added a complete setup guide in `CONTRIBUTING.md` documenting environment configurations, Firebase CLI instructions, and test references.

---

### 📦 Build Outputs
*   **Android App Bundle (`.aab`)**: `android/app/build/outputs/bundle/release/app-release.aab`
