'use strict';

/**
 * @file test/symptom-check.test.js
 * @description Jest unit tests for POST /symptom-check
 *
 * Firebase Admin and Vertex AI are mocked so no real GCP calls are made.
 * Run: cd backend && npm test
 */

// ── Mocks ────────────────────────────────────────────────────────
jest.mock('firebase-admin', () => {
  const mockSet   = jest.fn().mockResolvedValue({});
  const mockDoc   = jest.fn(() => ({ set: mockSet, id: 'mock-triage-id' }));
  const mockColl  = jest.fn(() => ({ doc: mockDoc }));
  return {
    initializeApp: jest.fn(),
    apps: ['mockApp'],
    auth: () => ({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-user-uid' }),
    }),
    firestore: () => ({ collection: mockColl }),
    firestore: Object.assign(() => ({ collection: mockColl }), {
      FieldValue: { serverTimestamp: jest.fn() },
    }),
  };
});

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  urgency: 'moderate',
                  conditions: ['Tension headache', 'Dehydration'],
                  advice: 'Rest and stay hydrated.',
                  seeDoctor: true,
                }),
              }],
            },
          }],
        },
      }),
    }),
  })),
}));

const request = require('supertest');
const { createApp } = require('../app');

let app;
beforeAll(() => { app = createApp(); });

const VALID_TOKEN = 'Bearer valid-test-token-123';

// ─── Tests ───────────────────────────────────────────────────────

describe('POST /symptom-check', () => {

  test('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/symptom-check').send({ symptoms: 'I have a headache' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 401 when token is malformed (no Bearer prefix)', async () => {
    const res = await request(app)
      .post('/symptom-check')
      .set('Authorization', 'invalid-token')
      .send({ symptoms: 'I have a headache' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when symptoms field is missing', async () => {
    const res = await request(app)
      .post('/symptom-check')
      .set('Authorization', VALID_TOKEN)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/symptoms/i);
  });

  test('returns 400 when symptoms is an empty string', async () => {
    const res = await request(app)
      .post('/symptom-check')
      .set('Authorization', VALID_TOKEN)
      .send({ symptoms: '   ' });
    expect(res.status).toBe(400);
  });

  test('returns structured triage JSON for valid English symptoms', async () => {
    const res = await request(app)
      .post('/symptom-check')
      .set('Authorization', VALID_TOKEN)
      .send({ symptoms: 'I have been experiencing a severe headache for 2 hours.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      urgency:    expect.stringMatching(/^(low|moderate|high)$/),
      conditions: expect.any(Array),
      advice:     expect.any(String),
      seeDoctor:  expect.any(Boolean),
      disclaimer: expect.any(String),
    });
    expect(res.body.conditions.length).toBeGreaterThan(0);
    expect(res.body.conditions.length).toBeLessThanOrEqual(4);
  });

  test('returns structured triage JSON for Hindi symptoms (Hinglish)', async () => {
    const res = await request(app)
      .post('/symptom-check')
      .set('Authorization', VALID_TOKEN)
      .send({ symptoms: 'Mujhe bahut sar dard ho raha hai aur aankhon mein jalan hai.' });
    expect(res.status).toBe(200);
    expect(['low','moderate','high']).toContain(res.body.urgency);
  });

  test('handles Gemini API timeout gracefully — returns 503', async () => {
    const { VertexAI } = require('@google-cloud/vertexai');
    VertexAI.mockImplementationOnce(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockRejectedValue(new Error('DEADLINE_EXCEEDED')),
      }),
    }));

    const res = await request(app)
      .post('/symptom-check')
      .set('Authorization', VALID_TOKEN)
      .send({ symptoms: 'My chest hurts and I cannot breathe properly.' });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

});

// ─── Unit test for sanitiseInput ────────────────────────────────
describe('sanitiseInput', () => {
  const { sanitiseInput } = require('../routes/symptomCheck');

  test('strips HTML tags from input', () => {
    const result = sanitiseInput('<script>alert("xss")</script>headache');
    expect(result).not.toContain('<script>');
    expect(result).toContain('headache');
  });

  test('trims whitespace', () => {
    expect(sanitiseInput('  headache  ')).toBe('headache');
  });
});
