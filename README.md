# VaidyaAI — वैद्य AI

> **AI-Powered Doctor & Patient Management Platform**  
> Gemini 2.5 Pro · Firebase · Cloud Run · Google Maps

---

## Quick Start (Demo Mode)

The app runs fully in **demo mode** with no configuration required.

```bash
# Just open index.html in a browser — no server needed
# Demo credentials:
#   patient@demo.com / any password (6+ chars)
#   doctor@demo.com  / any password (6+ chars)
```

---

## Firebase Setup (Production)

### 1. Firebase Console

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project (or select existing)
3. Enable **Authentication** → Sign-in method → Email/Password
4. Enable **Firestore Database** (start in production mode)
5. Enable **Hosting**

### 2. Get your Web Config

Project Settings → General → Your apps → Web app → copy `firebaseConfig`

Paste into `js/config.js`:
```js
export const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:...",
};
```

### 3. Deploy Firestore Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 4. Deploy Frontend

```bash
firebase deploy --only hosting
```

---

## Cloud Run Backend Setup

### 1. Enable GCP APIs

```bash
gcloud services enable run.googleapis.com aiplatform.googleapis.com
```

### 2. Get Service Account

Firebase Console → Project Settings → Service accounts → **Generate new private key**  
Save as `backend/serviceAccount.json` (never commit — already in `.gitignore`)

### 3. Environment Variables for Cloud Run

| Variable | Description |
|---|---|
| `VERTEX_AI_PROJECT_ID` | Your GCP project ID |
| `VERTEX_AI_LOCATION` | `us-central1` (default) |
| `GEMINI_MODEL` | `gemini-2.5-pro` (verify in GCP Console → Vertex AI → Model Garden) |
| `FIREBASE_ADMIN_CREDENTIAL` | Leave empty in Cloud Run (uses ADC) |
| `ALLOWED_ORIGINS` | Your Firebase Hosting URL, e.g. `https://your-project.web.app` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` (default for Cloud Run) |

### 4. Deploy to Cloud Run

```bash
cd backend
npm install
gcloud run deploy vaidyaai-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated=false \
  --set-env-vars VERTEX_AI_PROJECT_ID=your-project,GEMINI_MODEL=gemini-2.5-pro,ALLOWED_ORIGINS=https://your-project.web.app
```

### 5. Update Frontend Config

```js
// js/config.js
export const CLOUD_RUN_BASE_URL = "https://vaidyaai-backend-xxxx-uc.a.run.app";
```

---

## Google Maps Setup

1. GCP Console → APIs & Services → Enable **Maps JavaScript API**
2. Create an API key → **Restrict to HTTP referrers**: `https://your-project.web.app/*`
3. Add to `js/config.js`:
```js
export const MAPS_API_KEY = "AIza...";
```

---

## Run Backend Tests

```bash
cd backend
npm install
npm test
```

Expected output:
```
PASS test/symptom-check.test.js (8 tests)
PASS test/book-appointment.test.js (5 tests)
PASS test/slots.test.js (5 tests)

Test Suites: 3 passed
Tests:       18 passed
```

---

## Manual End-to-End Test Checklist

| # | Flow | Expected Result |
|---|------|-----------------|
| 1 | Open app → Log in as `patient@demo.com` | Redirected to patient dashboard |
| 2 | Open app → Log in as `doctor@demo.com` | Redirected to doctor dashboard |
| 3 | Patient: type symptoms → Submit | Triage card renders with urgency badge |
| 4 | Patient: select doctor → pick slot → Confirm | Toast "Appointment confirmed", list updates |
| 5 | Doctor: expand queue card | AI urgency badge + Gemini triage visible |
| 6 | Doctor: Add Notes & Complete | Appointment marked completed, notes saved |
| 7 | Patient: Clinic Finder tab | Clinic list renders, map shows (if API key set) |
| 8 | Doctor: log out → try to access doctor.html directly | Redirected to login |

---

## Architecture

```
Firebase Hosting (index.html · patient.html · doctor.html)
        │
        │  Firebase JS SDK (Auth · Firestore · real-time)
        │
        │  REST (Bearer ID token)
        ▼
Cloud Run (Node.js 20 · Express)
  POST /symptom-check    ──► Vertex AI Gemini 2.5 Pro
  POST /book-appointment ──► Firestore write
  GET  /slots            ──► Firestore read
        │
        ▼
Cloud Firestore
  users · appointments · triage_results
```

---

## Security Checklist

- [x] Firebase Admin SDK validates ID token on every Cloud Run request
- [x] Vertex AI / service account credentials in Cloud Run env vars — never in frontend
- [x] Google Maps API key HTTP-referrer restricted to Firebase Hosting domain
- [x] Firestore rules: cross-user data access blocked; triage writes server-side only
- [x] Helmet middleware: CSP, HSTS, X-Frame-Options on all Cloud Run responses
- [x] Firebase Hosting headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- [x] Rate limiting: 60 req/min global, 10 req/min on AI endpoint
- [x] CORS restricted to configured `ALLOWED_ORIGINS`
- [x] User input sanitised with `sanitize-html` before Gemini prompt insertion
- [x] `serviceAccount.json` in `.gitignore` — never committed
- [x] Role stored in Firestore, immutable after signup (Firestore rule enforced)

---

## Accessibility Checklist

- [x] `<html lang="en">` on all pages
- [x] Skip-to-content link as first `<body>` child on all pages
- [x] All inputs have explicit `<label>` (not just placeholder)
- [x] Urgency: colour + text + icon (never colour alone)
- [x] `aria-live="polite"` on loading states and result regions
- [x] Doctor notes modal: focus trapped, Escape closes, focus returns to trigger
- [x] Tab navigation: `role="tablist"`, `aria-selected`, Arrow key navigation
- [x] All buttons ≥ 44×44px touch target
- [x] WCAG AA contrast: all urgency colours verified on white/off-white backgrounds
- [x] `role="alert"` on error messages for immediate screen reader announcement
- [x] `aria-modal="true"` on notes modal

---

## Google Cloud Services Used

| Service | Purpose |
|---|---|
| Firebase Authentication | Email/password login, role-based access |
| Cloud Firestore | Real-time database — users, appointments, triage |
| Firebase Hosting | Static frontend with HTTPS + security headers |
| Cloud Run (Node.js 20) | Serverless backend — Gemini proxy + booking logic |
| Vertex AI (Gemini 2.5 Pro) | AI symptom triage — urgency, conditions, advice |
| Google Maps JavaScript API | Clinic finder with interactive map pins |

---

*VaidyaAI v1.0 · वैद्य AI · Built for Google Cloud Hackathon*
