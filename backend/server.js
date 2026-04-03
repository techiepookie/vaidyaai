'use strict';

/**
 * @file server.js
 * @description Cloud Run entrypoint for VaidyaAI backend.
 * Starts the Express server on the PORT env var (default 8080).
 *
 * Environment variables (set in Cloud Run service config or .env):
 *   PORT                   - server port (default 8080)
 *   VERTEX_AI_PROJECT_ID   - GCP project ID for Vertex AI
 *   VERTEX_AI_LOCATION     - Vertex AI region (default us-central1)
 *   GEMINI_MODEL           - Gemini model string (e.g. gemini-2.5-pro)
 *   FIREBASE_ADMIN_CREDENTIAL - path to serviceAccount.json (local dev only)
 *   ALLOWED_ORIGINS        - comma-separated list of allowed CORS origins
 *   NODE_ENV               - 'production' | 'development' | 'test'
 */

require('dotenv').config(); // local dev only; no-op in Cloud Run (env vars injected)

const { createApp } = require('./app');

const PORT = process.env.PORT || 8080;
const app  = createApp();

app.listen(PORT, () => {
  // Avoid logging sensitive env vars
  console.log(`[VaidyaAI] Backend listening on port ${PORT}`);
  console.log(`[VaidyaAI] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});
