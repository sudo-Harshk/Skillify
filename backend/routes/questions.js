const dotenv = require('dotenv');
dotenv.config();

// Initialize Gemini SDK (try @google/genai then @google/generative-ai)
let genAI = null;
let getModel = null;
try {
  const { GoogleGenerativeAI } = require('@google/genai');
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  getModel = (opts) => genAI.getGenerativeModel ? genAI.getGenerativeModel(opts) : genAI.model(opts);
} catch (e) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    getModel = (opts) => genAI.getGenerativeModel(opts);
  } catch (err) {
    console.warn('Gemini SDK not available. /questions/generate will not work.');
  }
}

// Stateless generation function
const generateUniqueQuestions = async (prompt) => {
  if (!genAI || !getModel) throw new Error('Gemini SDK not initialized');

  const model = await getModel({ model: 'gemini-1.5-flash-latest', generationConfig: { responseMimeType: 'application/json' } });

  // Call model and extract JSON
  let result;
  if (typeof model.generateContent === 'function') {
    result = await model.generateContent(prompt);
  } else if (typeof model.generate === 'function') {
    result = await model.generate({ prompt, responseMimeType: 'application/json' });
  } else if (typeof genAI.generate === 'function') {
    result = await genAI.generate({ model: 'gemini-1.5-flash-latest', input: prompt, responseMimeType: 'application/json' });
  } else {
    throw new Error('Gemini SDK does not expose a supported generate method');
  }

  // Try to get the JSON text
  let jsonText = null;
  if (result?.response?.text) jsonText = typeof result.response.text === 'function' ? await result.response.text() : result.response.text;
  if (!jsonText && typeof result === 'string') jsonText = result;
  if (!jsonText && result?.output?.[0]?.content) jsonText = result.output[0].content;
  if (!jsonText) throw new Error('No JSON returned from model');

  const parsed = JSON.parse(jsonText);
  const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
  return questions;
};

function evaluateAnswers(originalQuestions, userAnswers) {
  if (!Array.isArray(originalQuestions)) throw new Error('originalQuestions must be an array');
  return originalQuestions.map((question, index) => {
    const userAnswer = userAnswers?.[(index + 1).toString()];
    const isCorrect = question.correctAnswers && question.correctAnswers.includes(userAnswer);
    return {
      question: question.question,
      correctAnswers: question.correctAnswers,
      userAnswer: userAnswer || 'Not answered',
      isCorrect: Boolean(isCorrect),
      explanation: question.explanation
    };
  });
}

async function routes(fastify, options) {
  fastify.post('/questions/generate', async (request, reply) => {
    const { subject, chapter } = request.body || {};
    const prompt = `Generate multiple-choice questions for the chapter \"${chapter}\" in ${subject}.\\n\\nYour response MUST be a single, valid JSON object. Do not include any other text or markdown.\\n\\nThe JSON object should have a single key \"questions\", which is an array of 10 question objects. Each question object must have these keys: \\\"question\\\" (string), \\\"options\\\" (array of objects with \\\"label\\\" and \\\"option\\\"), \\\"correctAnswers\\\" (array of strings), and \\\"explanation\\\" (string).`;

    try {
      const questions = await generateUniqueQuestions(prompt);
      return reply.code(201).send({ questions });
    } catch (err) {
      console.error('Error in /questions/generate:', err);
      return reply.status(500).send({ message: 'Error generating questions', error: err.message });
    }
  });

  fastify.post('/questions/evaluate', async (request, reply) => {
    const { userAnswers, originalQuestions } = request.body || {};
    if (!userAnswers || !originalQuestions || !Array.isArray(originalQuestions)) {
      return reply.status(400).send({ message: 'Missing userAnswers or originalQuestions in request.' });
    }

    try {
      const evaluation = evaluateAnswers(originalQuestions, userAnswers);
      return reply.code(200).send({ evaluation });
    } catch (err) {
      console.error('Error in /questions/evaluate:', err);
      return reply.status(500).send({ message: 'Error evaluating answers', error: err.message });
    }
  });
}

module.exports = routes;
module.exports.evaluateAnswers = evaluateAnswers;
module.exports.generateUniqueQuestions = generateUniqueQuestions;
