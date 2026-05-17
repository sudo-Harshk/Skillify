// Set env vars before any requires so dotenv and route modules pick them up
process.env.GEMINI_API_KEY = 'test-key';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

// Mock the Gemini SDK so no real API calls are made and the SDK initialises cleanly
jest.mock('@google/genai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              questions: [
                {
                  question: 'Test question?',
                  options: [
                    { label: 'a', option: 'Option A' },
                    { label: 'b', option: 'Option B' },
                    { label: 'c', option: 'Option C' },
                    { label: 'd', option: 'Option D' }
                  ],
                  correctAnswers: ['a'],
                  explanation: 'Test explanation'
                }
              ]
            })
        }
      })
    })
  }))
}));

// Stub the legacy SDK so the fallback branch does not throw during module load
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ questions: [] })
        }
      })
    })
  }))
}));

const fastify = require('fastify')({ logger: false });
const cors = require('@fastify/cors');
const questionsRoutes = require('../routes/questions');
const subjectsRoutes = require('../routes/subjects');

const { evaluateAnswers } = questionsRoutes;

// Register routes with minimal setup — no rate limit plugin, no helmet in tests
fastify.register(cors, { origin: true });
fastify.register(questionsRoutes);
fastify.register(subjectsRoutes);

beforeAll(() => fastify.ready());
afterAll(() => fastify.close());

// ---------------------------------------------------------------------------
// 1. evaluateAnswers — unit tests
// ---------------------------------------------------------------------------
describe('evaluateAnswers', () => {
  const makeQuestions = (n) =>
    Array.from({ length: n }, (_, i) => ({
      question: `Q${i + 1}`,
      correctAnswers: ['a'],
      explanation: `Explanation ${i + 1}`
    }));

  test('marks answer correct when user answer matches (exact lowercase)', () => {
    const questions = [{ question: 'Q1', correctAnswers: ['b'], explanation: 'ex1' }];
    const result = evaluateAnswers(questions, { '1': 'b' });
    expect(result[0].isCorrect).toBe(true);
    expect(result[0].userAnswer).toBe('b');
  });

  test('marks answer correct when user sends uppercase letter (case-insensitive)', () => {
    const questions = [{ question: 'Q1', correctAnswers: ['a'], explanation: 'ex1' }];
    const result = evaluateAnswers(questions, { '1': 'A' });
    expect(result[0].isCorrect).toBe(true);
  });

  test('marks answer incorrect when user answer does not match', () => {
    const questions = [{ question: 'Q1', correctAnswers: ['a'], explanation: 'ex1' }];
    const result = evaluateAnswers(questions, { '1': 'c' });
    expect(result[0].isCorrect).toBe(false);
  });

  test('handles missing answer — produces userAnswer "Not answered" and isCorrect false', () => {
    const questions = [{ question: 'Q1', correctAnswers: ['a'], explanation: 'ex1' }];
    const result = evaluateAnswers(questions, {});
    expect(result[0].userAnswer).toBe('Not answered');
    expect(result[0].isCorrect).toBe(false);
  });

  test('handles multiple correct answers in correctAnswers array', () => {
    const questions = [
      { question: 'Q1', correctAnswers: ['a', 'b'], explanation: 'ex1' }
    ];
    const resultA = evaluateAnswers(questions, { '1': 'a' });
    const resultB = evaluateAnswers(questions, { '1': 'b' });
    const resultC = evaluateAnswers(questions, { '1': 'c' });
    expect(resultA[0].isCorrect).toBe(true);
    expect(resultB[0].isCorrect).toBe(true);
    expect(resultC[0].isCorrect).toBe(false);
  });

  test('throws when originalQuestions is not an array', () => {
    expect(() => evaluateAnswers(null, {})).toThrow('originalQuestions must be an array');
    expect(() => evaluateAnswers('string', {})).toThrow('originalQuestions must be an array');
    expect(() => evaluateAnswers(42, {})).toThrow('originalQuestions must be an array');
  });

  test('works correctly with all 10 questions', () => {
    const questions = makeQuestions(10);
    // Answer all correctly
    const userAnswers = {};
    for (let i = 1; i <= 10; i++) userAnswers[String(i)] = 'a';
    const result = evaluateAnswers(questions, userAnswers);
    expect(result).toHaveLength(10);
    result.forEach((r) => expect(r.isCorrect).toBe(true));
  });

  test('returns correct shape for each result item', () => {
    const questions = [{ question: 'Q1', correctAnswers: ['a'], explanation: 'some text' }];
    const result = evaluateAnswers(questions, { '1': 'a' });
    expect(result[0]).toMatchObject({
      question: 'Q1',
      correctAnswers: ['a'],
      userAnswer: 'a',
      isCorrect: true,
      explanation: 'some text'
    });
  });
});

// ---------------------------------------------------------------------------
// 2. POST /questions/generate — route tests
// ---------------------------------------------------------------------------
describe('POST /questions/generate', () => {
  test('returns 400 when subject is missing', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { chapter: 'Sets, Relations, and Functions' }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/missing subject or chapter/i);
  });

  test('returns 400 when chapter is missing', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'Math' }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/missing subject or chapter/i);
  });

  test('returns 400 when subject is unknown', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'Biology', chapter: 'Genetics' }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/unknown subject/i);
  });

  test('returns 400 when chapter is unknown for a valid subject', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'Math', chapter: 'Quantum Mechanics' }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/unknown chapter/i);
  });

  test('returns 201 with questions array on valid subject and chapter', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'Math', chapter: 'Sets, Relations, and Functions' }
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('questions');
    expect(Array.isArray(body.questions)).toBe(true);
  });

  test('subject/chapter lookup is case-insensitive', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/generate',
      payload: { subject: 'math', chapter: 'sets, relations, and functions' }
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('questions');
  });
});

// ---------------------------------------------------------------------------
// 3. POST /questions/evaluate — route tests
// ---------------------------------------------------------------------------
describe('POST /questions/evaluate', () => {
  const sampleQuestions = [
    { question: 'Q1', options: [], correctAnswers: ['a'], explanation: 'ex1' },
    { question: 'Q2', options: [], correctAnswers: ['b'], explanation: 'ex2' },
    { question: 'Q3', options: [], correctAnswers: ['c'], explanation: 'ex3' }
  ];

  test('returns 400 when userAnswers is missing', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { originalQuestions: sampleQuestions }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/missing/i);
  });

  test('returns 400 when originalQuestions is missing', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { userAnswers: { '1': 'a' } }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/missing/i);
  });

  test('returns 400 when originalQuestions is not an array', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { userAnswers: { '1': 'a' }, originalQuestions: 'not-an-array' }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/missing/i);
  });

  test('returns 400 when userAnswers has key "0" (out-of-range)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { userAnswers: { '0': 'a' }, originalQuestions: sampleQuestions }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/invalid answer key/i);
  });

  test('returns 400 when userAnswers has key beyond question count', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { userAnswers: { '11': 'a' }, originalQuestions: sampleQuestions }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/invalid answer key/i);
  });

  test('returns 400 when userAnswers value is invalid letter "x"', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { userAnswers: { '1': 'x' }, originalQuestions: sampleQuestions }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/invalid answer value/i);
  });

  test('returns 400 when userAnswers value is multi-character "ab"', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: { userAnswers: { '1': 'ab' }, originalQuestions: sampleQuestions }
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/invalid answer value/i);
  });

  test('returns 200 with evaluation array on valid input', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: {
        userAnswers: { '1': 'a', '2': 'b', '3': 'c' },
        originalQuestions: sampleQuestions
      }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('evaluation');
    expect(Array.isArray(body.evaluation)).toBe(true);
    expect(body.evaluation).toHaveLength(3);
    expect(body.evaluation[0].isCorrect).toBe(true);
    expect(body.evaluation[1].isCorrect).toBe(true);
    expect(body.evaluation[2].isCorrect).toBe(true);
  });

  test('returns 200 and marks unanswered questions correctly', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/questions/evaluate',
      payload: {
        userAnswers: {},
        originalQuestions: sampleQuestions
      }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    body.evaluation.forEach((item) => {
      expect(item.userAnswer).toBe('Not answered');
      expect(item.isCorrect).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. GET /subjects/:subject/chapters — route tests
// ---------------------------------------------------------------------------
describe('GET /subjects/:subject/chapters', () => {
  test('returns 200 with array for valid subject "Math"', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/subjects/Math/chapters'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain('Sets, Relations, and Functions');
  });

  test('returns 404 for unknown subject "Biology"', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/subjects/Biology/chapters'
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/subject not found/i);
  });

  test('is case-insensitive — "math" returns same chapters as "Math"', async () => {
    const resLower = await fastify.inject({ method: 'GET', url: '/subjects/math/chapters' });
    const resUpper = await fastify.inject({ method: 'GET', url: '/subjects/Math/chapters' });
    expect(resLower.statusCode).toBe(200);
    expect(resUpper.statusCode).toBe(200);
    expect(JSON.parse(resLower.body)).toEqual(JSON.parse(resUpper.body));
  });

  test('is case-insensitive — "MATH" returns 200', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/subjects/MATH/chapters' });
    expect(res.statusCode).toBe(200);
  });

  test('returns chapters for Physics', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/subjects/Physics/chapters' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toContain('Thermodynamics');
  });

  test('returns chapters for Chemistry', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/subjects/Chemistry/chapters' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toContain('States of Matter');
  });
});

// ---------------------------------------------------------------------------
// 5. GET /subjects — route tests
// ---------------------------------------------------------------------------
describe('GET /subjects', () => {
  test('returns 200 with an array', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/subjects' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
  });

  test('response contains "Math", "Physics", and "Chemistry"', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/subjects' });
    const body = JSON.parse(res.body);
    expect(body).toContain('Math');
    expect(body).toContain('Physics');
    expect(body).toContain('Chemistry');
  });

  test('returns exactly 3 subjects', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/subjects' });
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(3);
  });
});
