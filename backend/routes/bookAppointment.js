'use strict';

/**
 * @file routes/bookAppointment.js
 * @description POST /book-appointment
 *
 * Validates auth token, checks slot availability in Firestore,
 * and creates a confirmed appointment document.
 *
 * Request body:
 *   { doctorId: string, slot: string (ISO 8601), triageId?: string }
 *
 * Response 200:
 *   { appointmentId: string, status: "confirmed" }
 *
 * Errors:
 *   401 — missing / invalid auth token
 *   400 — missing fields or slot in the past
 *   409 — slot already booked
 */

const express = require('express');
const admin   = require('firebase-admin');
const { verifyFirebaseToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /book-appointment
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function handleBookAppointment(req, res) {
  const { doctorId, slot, triageId = null } = req.body || {};

  // ── Validate required fields ─────────────────────────────────
  if (!doctorId || typeof doctorId !== 'string' || !doctorId.trim()) {
    return res.status(400).json({ error: 'doctorId is required.' });
  }
  if (!slot || typeof slot !== 'string') {
    return res.status(400).json({ error: 'slot is required and must be an ISO 8601 date string.' });
  }

  const slotDate = new Date(slot);
  if (isNaN(slotDate.getTime())) {
    return res.status(400).json({ error: 'slot is not a valid ISO 8601 date string.' });
  }

  // ── Reject past slots ────────────────────────────────────────
  if (slotDate.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Cannot book an appointment in the past.' });
  }

  const db = admin.firestore();

  // ── Check for conflicting booking (same doctor + same slot) ──
  const conflictSnap = await db.collection('appointments')
    .where('doctorId', '==', doctorId)
    .where('slot', '==', slotDate.toISOString())
    .where('status', 'in', ['pending', 'confirmed'])
    .limit(1)
    .get();

  if (!conflictSnap.empty) {
    return res.status(409).json({ error: 'This time slot is already booked. Please choose another.' });
  }

  // ── Verify doctor exists ─────────────────────────────────────
  const doctorSnap = await db.collection('users').doc(doctorId).get();
  if (!doctorSnap.exists || doctorSnap.data().role !== 'doctor') {
    return res.status(400).json({ error: 'Specified doctor does not exist.' });
  }

  // ── Create the appointment ───────────────────────────────────
  const apptRef = db.collection('appointments').doc();
  await apptRef.set({
    patientId:   req.uid,
    doctorId:    doctorId.trim(),
    slot:        slotDate.toISOString(),
    status:      'confirmed',
    triageId:    triageId || null,
    notes:       null,
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    appointmentId: apptRef.id,
    status:        'confirmed',
  });
}

router.post('/', verifyFirebaseToken, handleBookAppointment);

module.exports = router;
module.exports.handleBookAppointment = handleBookAppointment;
