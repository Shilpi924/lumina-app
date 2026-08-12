# Contributor Guide: Project Setup and Guidelines

Welcome! This guide helps you set up your local development environment, configure environment variables, deploy to Firebase, and run our test suite.

---

## 🛠️ Local Project Setup

### 1. Prerequisites
- Node.js (v18+)
- npm (v10+)
- Firebase CLI (for deployment)

### 2. Installation
Clone the repository and run:
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory. It should contain the following configuration variables:

```ini
# OpenAI & Gemini API configuration
OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GOOGLE_AI_API_KEY=your_google_ai_api_key

# Vector Database (Milvus/Zilliz)
MILVUS_URI=your_milvus_uri
MILVUS_API_KEY=your_milvus_api_key

# Google Books API Key
GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# Anthropic (Claude) API configuration
ANTHROPIC_API_KEY=your_anthropic_api_key

# Langchain Tracing
LANGCHAIN_PROJECT=your_langchain_project_name
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=your_langchain_api_key

# Firebase SDK Client Config
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Android specific configurations
VITE_ANDROID_GOOGLE_SSO_READY=true
```

---

## 🚀 Firebase Deployments

We utilize Firebase for Hosting, Firestore database storage, and Cloud Functions (like Claude analysis calls).

### Deploying the Complete Stack
To deploy both client hosting assets and functions:
```bash
firebase deploy
```

### Deploying Individual Slices
If you only changed client assets (e.g., in `src/`):
```bash
firebase deploy --only hosting
```

If you only changed Cloud Functions:
```bash
firebase deploy --only functions
```

---

## 🧪 Testing reference guide

### Running Unit Tests (Vitest)
Unit tests cover state updates, hooks, utilities, and modular components.
```bash
npm run test:unit
```

### Running End-to-End Tests (Playwright)
E2E tests simulate user interaction in real Chromium browsers, mocking API interfaces and Capacitor bridges:
```bash
npm run test:e2e
```

### Running All Tests
To run Vitest unit tests followed by Playwright E2E tests:
```bash
npm run test:all
```
