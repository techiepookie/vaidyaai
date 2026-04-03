'use strict';

/**
 * @file routes/slots.js
 * @description GET /slots?doctorId=<uid>
 *
 * Returns an array of available ISO 8601 time slot strings for a given doctor
 * over the next 7 days. Slots that already have a confirmed/pending appointment
 * are excluded.
 *
 * Query params:
 *   doctorId (required) — Firebase UID of the doctor
 *
 * Response 200:
 *   { slots: string[] }  — array of available ISO 8601 datetimes
 *
 * Errors:
 *   401 — missing / invalid auth token
 *   400 — missing doctorId
 */

const express = require('express');
const admin   = require('firebase-admin');
const { verifyFirebaseToken } = require('../middleware/auth');

const router = express.Router();

// Clinic working hours
const START_HOUR = 9;   // 09:00
const END_HOUR   = 17;  // 17:00 (last slot 16:30)
const SLOT_MINS  = 30;  // 30-minute slots
const DAYS_AHEAD = 7;   // generate slots for next 7 days

/**
 * Generate all candidate slots for the next DAYS_AHEAD days.
 * @returns {string[]} ISO 8601 UTC strings
 */
function generateCandidateSlots() {
  const slots = [];
  const now   = new Date();

  for (let d = 1; d <= DAYS_AHEAD; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);

    // Skip Sundays (0)
    if (date.getDay() === 0) continue;

    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MINS) {
        const slot = new Date(date);
        slot.setUTCHours(h, m, 0, 0);
        slots.push(slot.toISOString());
      }
    }
  }
  return slots;
}

/**
 * GET /slots
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function handleGetSlots(req, res) {
  const { doctorId } = req.query;

  if (!doctorId || typeof doctorId !== 'string' || !doctorId.trim()) {
    return res.status(400).json({ error: 'doctorId query parameter is required.' });
  }

  const db = admin.firestore();

  // ── Fetch booked slots for this doctor ───────────────────────
  const bookedSnap = await db.collection('appointments')
    .where('doctorId', '==', doctorId)
    .where('status', 'in', ['pending', 'confirmed'])
    .get();

  const bookedSet = new Set(bookedSnap.docs.map(d => d.data().slot));

  // ── Filter out booked slots ────────────────────────────────
  const available = generateCandidateSlots().filter(s => !bookedSet.has(s));

  return res.status(200).json({ slots: available });
}

router.get('/', verifyFirebaseToken, handleGetSlots);

module.exports = router;
module.exports.handleGetSlots       = handleGetSlots;
module.exports.generateCandidateSlots = generateCandidateSlots;
