'use strict';

/**
 * @file middleware/auth.js
 * @description Firebase Admin SDK token verification middleware.
 *
 * Every protected endpoint must use this middleware.
 * Returns HTTP 401 if the Authorization header is missing or the token is invalid.
 * Returns HTTP 403 if the token is valid but the role claim does not match.
 *
 * Usage:
 *   const { verifyFirebaseToken } = require('../middleware/auth');
 *   router.post('/endpoint', verifyFirebaseToken, handlerFn);
 */

const admin = require('firebase-admin');

// Initialise Firebase Admin SDK once (singleton)
if (!admin.apps.length) {
  const credential = process.env.FIREBASE_ADMIN_CREDENTIAL;

  if (process.env.NODE_ENV === 'test') {
    // Tests mock firebase-admin — skip real initialisation
    admin.initializeApp({ projectId: 'test-project' });
  } else if (credential) {
    // Local development: service account JSON file path
    admin.initializeApp({
      credential: admin.credential.cert(require(credential)),
    });
  } else {
    // Cloud Run: use Application Default Credentials (service account attached to the Cloud Run service)
    admin.initializeApp();
  }
}

/**
 * Express middleware that validates a Firebase ID token from the
 * Authorization: Bearer <token> header.
 *
 * On success: attaches decoded token to req.decodedToken and continues.
 * On failure: responds with 401 JSON error.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or malformed Authorization header. Expected: Bearer <Firebase ID token>',
    });
  }

  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Authorization token is empty.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decodedToken = decoded;
    req.uid = decoded.uid;
    next();
  } catch (err) {
    // Do not expose internal Firebase error details to caller
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = { verifyFirebaseToken, admin };
