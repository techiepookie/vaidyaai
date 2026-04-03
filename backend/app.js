'use strict';

/**
 * @file app.js
 * @description Express application factory for VaidyaAI Cloud Run backend.
 *
 * Exported as a factory function so the app can be instantiated in tests
 * without starting a server (supertest pattern).
 *
 * Security measures applied:
 *  - helmet: sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
 *  - cors: restricted to the Firebase Hosting origin
 *  - express-rate-limit: 60 req/min on all routes, 10 req/min on AI endpoint
 *  - All routes require a valid Firebase ID token (middleware/auth.js)
 *  - Input sanitised before Gemini prompt (sanitize-html)
 *  - No sensitive values logged
 */

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');

const symptomCheckRouter    = require('./routes/symptomCheck');
const bookAppointmentRouter = require('./routes/bookAppointment');
const slotsRouter           = require('./routes/slots');
const configRouter          = require('./routes/config');

/**
 * Creates and configures the Express application.
 * @returns {import('express').Application}
 */
function createApp() {
  const app = express();

  // ── Security headers ──────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameSrc:   ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  // ── CORS — allow Firebase Hosting + local dev origins ───────────
  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
  ];

  app.use(cors({
    origin: (origin, cb) => {
      // Allow server-to-server (no origin) and configured origins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ── Body parser ───────────────────────────────────────────────
  app.use(express.json({ limit: '16kb' }));

  // ── Global rate limit: 60 requests per minute ─────────────────
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  }));

  // ── Stricter rate limit on the AI endpoint ─────────────────────
  const aiRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI rate limit exceeded. Please wait before submitting again.' },
  });

  // ── Root — redirect to health check ─────────────────────────
  app.get('/', (_req, res) => {
    res.redirect('/health');
  });

  // ── Health check (no auth required) ───────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'vaidyaai-backend', ts: new Date().toISOString() });
  });

  // ── API routes ────────────────────────────────────────────────
  app.use('/symptom-check',    aiRateLimit, symptomCheckRouter);
  app.use('/book-appointment', bookAppointmentRouter);
  app.use('/slots',            slotsRouter);
  app.use('/config',           configRouter);

  // ── 404 handler ──────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
  });

  // ── Global error handler ──────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // Do not log full error objects in production (may contain PII)
    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : 'Internal server error.';
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
