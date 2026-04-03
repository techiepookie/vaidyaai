'use strict';

/**
 * @file test/book-appointment.test.js
 * @description Jest unit tests for POST /book-appointment
 */

// ── Mocks ────────────────────────────────────────────────────────
const mockGet    = jest.fn();
const mockSet    = jest.fn().mockResolvedValue({});
const mockDoc    = jest.fn(() => ({ set: mockSet, id: 'new-appt-id' }));

jest.mock('firebase-admin', () => {
  return {
    initializeApp: jest.fn(),
    apps: ['mockApp'],
    auth: () => ({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-patient-uid' }),
    }),
    firestore: Object.assign(
      () => ({
        collection: jest.fn((collName) => ({
          doc: mockDoc,
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: mockGet,
        })),
      }),
      { FieldValue: { serverTimestamp: jest.fn() } }
    ),
  };
});

const request = require('supertest');
const { createApp } = require('../app');

let app;
beforeAll(() => { app = createApp(); });

const VALID_TOKEN = 'Bearer valid-test-token-456';
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
const PAST_DATE   = new Date(Date.now() - 60 * 60 * 1000).toISOString();           // 1 hour ago

describe('POST /book-appointment', () => {

  test('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/book-appointment').send({
      doctorId: 'doc-001', slot: FUTURE_DATE,
    });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when doctorId is missing', async () => {
    const res = await request(app)
      .post('/book-appointment')
      .set('Authorization', VALID_TOKEN)
      .send({ slot: FUTURE_DATE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/doctorId/i);
  });

  test('returns 400 when slot is in the past', async () => {
    const res = await request(app)
      .post('/book-appointment')
      .set('Authorization', VALID_TOKEN)
      .send({ doctorId: 'doc-001', slot: PAST_DATE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/past/i);
  });

  test('returns 409 when the slot is already booked', async () => {
    // conflict check returns a non-empty snapshot
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: 'existing-appt' }] });

    const res = await request(app)
      .post('/book-appointment')
      .set('Authorization', VALID_TOKEN)
      .send({ doctorId: 'doc-001', slot: FUTURE_DATE });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already booked/i);
  });

  test('returns appointmentId and confirmed status on success', async () => {
    // No conflict
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    // Doctor exists
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'doctor' }) });

    const res = await request(app)
      .post('/book-appointment')
      .set('Authorization', VALID_TOKEN)
      .send({ doctorId: 'doc-001', slot: FUTURE_DATE });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      appointmentId: expect.any(String),
      status: 'confirmed',
    });
  });

});
