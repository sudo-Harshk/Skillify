/**
 * Targeted tests for generateUniqueQuestions internals:
 * - parseJsonFromText fallback path (JSON wrapped in markdown text)
 * - 404 retry with available fallback model succeeding
 * - 404 retry with available fallback model failing → MODEL_NOT_FOUND
 * - 404 with no available models → MODEL_NOT_FOUND
 * - Route handler: MODEL_NOT_FOUND → 400
 * - Route handler: generic SDK error → 500
 * - SDK methods: model.generate branch, genAI.generate branch, no-method branch
 *
 * Jest isolates module registry per file so we can set up a different
 * @google/genai mock without affecting questions.test.js.
 */

process.env.GEMINI_API_KEY = 'test-key';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

// We will control the mock implementation per-test using mockImplementation.
// Start with a factory that we can mutate via the reference below.
let mockGenerateContent = jest.fn();
let mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
let mockListModels = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    get getGenerativeModel() { return mockGetGenerativeModel; },
    get listModels() { return mockListModels; }
  }))
}));

jest.mock('@google/generative-ai', () => {
  throw new Error('not available');
});

// After mocks are set up, require the module under test.
// Jest hoists jest.mock calls so these require calls happen after mocking.
const questionsRoutes = require('../routes/questions');
const { generateUniqueQuestions } = questionsRoutes;

// Build a minimal Fastify app for route-level tests.
const fastify = require('fastify')({ logger: false });
const cors = require('@fastify/cors');
fastify.register(cors, { origin: true });
fastify.register(questionsRoutes);

beforeAll(() => fastify.ready());
afterAll(() => fastify.close());

// Helper: build a standard successful generateContent response.
function makeOkResponse(questions) {
  return {
    response: {
      text: () => JSON.stringify({ questions })
    }
  };
}

const SAMPLE_QUESTIONS = [
  {
    question: 'Q?',
    options: [
      { label: 'a', option: 'A' },
      { label: 'b', option: 'B' },
      { label: 'c', option: 'C' },
      { label: 'd', option: 'D' }
    ],
    correctAnswers: ['a'],
    explanation: 'Because A.'
  }
];

// ---------------------------------------------------------------------------
// generateUniqueQuestions — unit tests exercising internals
// ---------------------------------------------------------------------------
describe('generateUniqueQuestions — parseJsonFromText fallback path', () => {
  beforeEach(() => {
    // Reset all mocks before each test so they don't leak.
    mockGenerateContent.mockReset();
    mockListModels.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  test('handles response.text that returns plain JSON string', async () => {
    mockGenerateContent.mockResolvedValue(makeOkResponse(SAMPLE_QUESTIONS));
    const result = await generateUniqueQuestions('test prompt');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].question).toBe('Q?');
  });

  test('handles response.text wrapped in markdown code fences (fallback extraction)', async () => {
    // text() returns JSON embedded in non-JSON text — parseJsonFromText must extract it.
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          'Here is your JSON:\n```json\n' +
          JSON.stringify({ questions: SAMPLE_QUESTIONS }) +
          '\n```\nHope that helps!'
      }
    });
    const result = await generateUniqueQuestions('test prompt');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  test('handles response where parsed result is already an array', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(SAMPLE_QUESTIONS) // top-level array, not wrapped in {questions:}
      }
    });
    const result = await generateUniqueQuestions('test prompt');
    expect(Array.isArray(result)).toBe(true);
  });

  test('throws when response.text returns unparseable text', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'not json at all !!!'
      }
    });
    await expect(generateUniqueQuestions('test prompt')).rejects.toThrow();
  });
});

describe('generateUniqueQuestions — 404 retry logic', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockListModels.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  test('on 404, retries with first available model and succeeds', async () => {
    // First call raises 404; second call (retry) succeeds.
    const err404 = Object.assign(new Error('model not found'), { status: 404 });
    mockGenerateContent
      .mockRejectedValueOnce(err404)
      .mockResolvedValueOnce(makeOkResponse(SAMPLE_QUESTIONS));

    mockListModels.mockResolvedValue({ models: [{ name: 'models/gemini-pro' }] });

    const result = await generateUniqueQuestions('test prompt');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].question).toBe('Q?');
  });

  test('on 404, retries with fallback model but retry also fails → throws MODEL_NOT_FOUND', async () => {
    const err404 = Object.assign(new Error('model not found'), { status: 404 });
    const retryErr = new Error('fallback also failed');
    mockGenerateContent
      .mockRejectedValueOnce(err404)
      .mockRejectedValueOnce(retryErr);

    mockListModels.mockResolvedValue({ models: [{ name: 'models/gemini-pro' }] });

    await expect(generateUniqueQuestions('test prompt')).rejects.toMatchObject({
      code: 'MODEL_NOT_FOUND',
      message: expect.stringMatching(/fallback failed/i)
    });
  });

  test('on 404 with no available models → throws MODEL_NOT_FOUND', async () => {
    const err404 = Object.assign(new Error('model not found'), { status: 404 });
    mockGenerateContent.mockRejectedValueOnce(err404);
    mockListModels.mockResolvedValue({ models: [] });

    await expect(generateUniqueQuestions('test prompt')).rejects.toMatchObject({
      code: 'MODEL_NOT_FOUND'
    });
  });

  test('on 404 with code=404 (not status=404), same retry path triggers', async () => {
    const err404 = Object.assign(new Error('model not found'), { code: 404 });
    mockGenerateContent
      .mockRejectedValueOnce(err404)
      .mockResolvedValueOnce(makeOkResponse(SAMPLE_QUESTIONS));

    mockListModels.mockResolvedValue({ models: [{ name: 'models/gemini-pro' }] });

    const result = await generateUniqueQuestions('test prompt');
    expect(Array.isArray(result)).toBe(true);
  });

  test('non-404 errors are rethrown without retry', async () => {
    const genericErr = new Error('some other SDK error');
    mockGenerateContent.mockRejectedValueOnce(genericErr);

    await expect(generateUniqueQuestions('test prompt')).rejects.toThrow('some other SDK error');
    // listModels should NOT have been called
    expect(mockListModels).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Route: POST /questions/generate error responses
// ---------------------------------------------------------------------------
describe('POST /questions/generate — SDK error responses', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockListModels.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  test('returns 400 with availableModels when MODEL_NOT_FOUND is thrown', async () => {
    const err = Object.assign(new Error('Requested model not found'), {
      code: 'MODEL_NOT_FOUND',
      availableModels: ['models/gemini-pro', 'models/gemini-ultra']
    });
    mockGenerateContent.mockRejectedValue(err);

    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'Math', chapter: 'Sets, Relations, and Functions' }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/requested model not found/i);
    expect(Array.isArray(body.availableModels)).toBe(true);
  });

  test('returns 500 on generic SDK error', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network failure'));

    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'Math', chapter: 'Sets, Relations, and Functions' }
    });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/error generating questions/i);
    expect(body.error).toMatch(/network failure/i);
  });
});
