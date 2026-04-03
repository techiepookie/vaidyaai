/**
 * @file config.js
 * @description Firebase Web SDK configuration and runtime constants.
 *
 * ── HOW TO GET YOUR FIREBASE CONFIG ──────────────────────────────
 * 1. Go to https://console.firebase.google.com
 * 2. Select your project → ⚙️ Project Settings → General
 * 3. Scroll to "Your apps" → click your Web app (or "Add app" → Web)
 * 4. Copy the firebaseConfig object values below
 *
 * ── HOW TO GET YOUR CLOUD RUN URL ────────────────────────────────
 * 1. GCP Console → Cloud Run → select your service
 * 2. Copy the URL from the top of the service detail page
 *
 * ── HOW TO GET YOUR MAPS API KEY ─────────────────────────────────
 * 1. GCP Console → APIs & Services → Credentials → Create Credentials → API key
 * 2. IMPORTANT: Click "Edit key" → set Application restrictions → HTTP referrers
 *    Add your Firebase Hosting domain: https://YOUR-PROJECT.web.app/*
 *
 * ── SECURITY NOTE ────────────────────────────────────────────────
 * These values are safe to expose in frontend code.
 * Security is enforced by Firestore Security Rules + Auth token validation.
 * NEVER put your serviceAccount.json or Vertex AI keys in frontend code.
 */

/** @type {import('firebase/app').FirebaseOptions} */
export const firebaseConfig = {
  apiKey:            "AIzaSyBIycJXGV5vFnLhIyMlJAVz1MjQL_W-NEc",
  authDomain:        "vaidhya-ai.firebaseapp.com",
  projectId:         "vaidhya-ai",
  storageBucket:     "vaidhya-ai.firebasestorage.app",
  messagingSenderId: "321531393873",
  appId:             "1:321531393873:web:b1b64ab0c768ee36798570",
  measurementId:     "G-FPWD8CDE6W",
};

/**
 * Cloud Run service base URL.
 * Example: "https://vaidyaai-backend-xxxx-uc.a.run.app"
 * Leave as empty string to use mock data (DEMO_MODE auto-enables).
 * @type {string}
 */
export const CLOUD_RUN_BASE_URL = "https://vaidyaai-565232619347.europe-west1.run.app";

/**
 * Google Maps JavaScript API key.
 * SECURITY: This is intentionally empty. The Maps API key is fetched
 * from the backend /config endpoint after authentication, so it is
 * never exposed in static frontend source files.
 * Set MAPS_API_KEY env var on Cloud Run before deploying.
 * @type {string}
 */
export const MAPS_API_KEY = "";

/**
 * Demo mode — automatically true when credentials are not configured.
 * In demo mode the app uses realistic mock data and localStorage for auth state.
 * Set to false after configuring all credentials above.
 * @type {boolean}
 */
export const DEMO_MODE = (
  firebaseConfig.apiKey === "REPLACE_WITH_YOUR_API_KEY" ||
  !firebaseConfig.apiKey
);

/** Firebase SDK CDN version (pin for reproducibility) */
export const FB_SDK_VERSION = "10.11.0";
