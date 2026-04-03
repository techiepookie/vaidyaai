'use strict';

/**
 * @file test/slots.test.js
 * @description Jest unit tests for GET /slots
 */

// ── Mocks ────────────────────────────────────────────────────────
const mockGet = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  apps: ['mockApp'],
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-user-uid' }),
  }),
  firestore: Object.assign(
    () => ({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        get: mockGet,
      })),
    }),
    { FieldValue: { serverTimestamp: jest.fn() } }
  ),
}));

const request = require('supertest');
const { createApp } = require('../app');
const { generateCandidateSlots } = require('../routes/slots');

let app;
beforeAll(() => { app = createApp(); });

const VALID_TOKEN = 'Bearer valid-test-token-slots';

describe('GET /slots', () => {

  test('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/slots?doctorId=doc-001');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when doctorId is missing', async () => {
    const res = await request(app)
      .get('/slots')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/doctorId/i);
  });

  test('returns available slots array for valid doctorId (no bookings)', async () => {
    // No booked slots
    mockGet.mockResolvedValueOnce({ docs: [] });

    const res = await request(app)
      .get('/slots?doctorId=doc-001')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slots');
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots.length).toBeGreaterThan(0);
    // All returned slots should be valid ISO strings in the future
    res.body.slots.forEach(slot => {
      expect(new Date(slot).getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  test('returns empty array for doctor with all slots booked', async () => {
    // Return all candidate slots as booked
    const allSlots = generateCandidateSlots();
    const mockedDocs = allSlots.map(s => ({ data: () => ({ slot: s }) }));
    mockGet.mockResolvedValueOnce({ docs: mockedDocs });

    const res = await request(app)
      .get('/slots?doctorId=doc-fully-booked')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([]);
  });

});

describe('generateCandidateSlots', () => {
  test('returns only future slots within next 7 days', () => {
    const slots = generateCandidateSlots();
    const now = Date.now();
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach(s => {
      const t = new Date(s).getTime();
      expect(t).toBeGreaterThan(now - 1000);
      expect(t).toBeLessThan(now + 8 * 24 * 60 * 60 * 1000);
    });
  });

  test('does not include Sunday slots', () => {
    const slots = generateCandidateSlots();
    slots.forEach(s => {
      expect(new Date(s).getDay()).not.toBe(0);
    });
  });
});
