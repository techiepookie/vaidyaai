'use strict';

/**
 * @file routes/config.js
 * @description GET /config
 *
 * Returns public runtime configuration to authenticated clients.
 * The Maps API key is stored server-side (never in frontend source)
 * and only returned to valid Firebase token holders.
 *
 * Response 200:
 *   { mapsApiKey: string }
 *
 * Errors:
 *   401 — missing / invalid auth token
 */

const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /config
 * Returns runtime config values that must NOT be hardcoded in frontend source.
 */
function handleGetConfig(_req, res) {
  // Only expose the Maps key — never Vertex AI keys or service account details
  const mapsApiKey = process.env.MAPS_API_KEY || '';

  return res.status(200).json({
    mapsApiKey,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
  });
}

router.get('/', verifyFirebaseToken, handleGetConfig);

module.exports = router;
module.exports.handleGetConfig = handleGetConfig;
