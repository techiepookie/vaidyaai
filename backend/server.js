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

// Load .env for local development (ignored in Cloud Run where env vars are injected)
try { require('dotenv').config(); } catch { /* dotenv not installed — ok in production */ }

// Log ALL uncaught errors — critical for Cloud Run crash diagnosis
process.on('uncaughtException', (err) => {
  console.error('[VaidyaAI] UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[VaidyaAI] UNHANDLED REJECTION:', reason);
  process.exit(1);
});

const { createApp } = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const app  = createApp();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[VaidyaAI] Backend listening on port ${PORT}`);
  console.log(`[VaidyaAI] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[VaidyaAI] Vertex AI project: ${process.env.VERTEX_AI_PROJECT_ID || '(not set)'}`);
});

server.on('error', (err) => {
  console.error('[VaidyaAI] Server failed to start:', err.message);
  process.exit(1);
});
