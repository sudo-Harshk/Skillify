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

// Helper: try to list models from the SDK and normalize to an array of model ids
async function listAvailableModels() {
  if (!genAI) return [];
  try {
    // SDKs expose listing under different names depending on version
    if (typeof genAI.listModels === 'function') {
      const res = await genAI.listModels();
      // res.models or res?.data?.models depending on SDK
      const models = res?.models || res?.data?.models || res?.model || [];
      return (Array.isArray(models) ? models : []).map(m => (typeof m === 'string' ? m : m.name || m.id || m.model || m.modelId));
    }
    if (typeof genAI.list === 'function') {
      const res = await genAI.list();
      const models = res?.models || res?.data?.models || res || [];
      return (Array.isArray(models) ? models : []).map(m => (typeof m === 'string' ? m : m.name || m.id || m.model || m.modelId));
    }
    if (typeof genAI.listGenerativeModels === 'function') {
      const res = await genAI.listGenerativeModels();
      const models = res?.models || res?.data?.models || res?.model || [];
      return (Array.isArray(models) ? models : []).map(m => (typeof m === 'string' ? m : m.name || m.id || m.model || m.modelId));
    }
  } catch (err) {
    // ignore — return empty list for upstream handling
    return [];
  }
  return [];
}

// Stateless generation function
const generateUniqueQuestions = async (prompt) => {
  if (!genAI || !getModel) throw new Error('Gemini SDK not initialized');

  // Preferred model id (this may not be available on all API versions/accounts)
  // Can be overridden with the GEMINI_MODEL environment variable (recommended when your key has access to a different model)
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const model = await getModel({ model: preferredModel, generationConfig: { responseMimeType: 'application/json' } });

    // Call model and extract JSON
    let result;
    if (typeof model.generateContent === 'function') {
      result = await model.generateContent(prompt);
    } else if (typeof model.generate === 'function') {
      result = await model.generate({ prompt, responseMimeType: 'application/json' });
    } else if (typeof genAI.generate === 'function') {
      result = await genAI.generate({ model: preferredModel, input: prompt, responseMimeType: 'application/json' });
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
  } catch (err) {
    // If the SDK returned a 404 for the model, try to list available models and retry once with the first available
    if (err && (err.status === 404 || err.code === 404)) {
      const available = await listAvailableModels();
      if (Array.isArray(available) && available.length > 0) {
        const fallbackModel = available[0];
        try {
          const model = await getModel({ model: fallbackModel, generationConfig: { responseMimeType: 'application/json' } });
          let result;
          if (typeof model.generateContent === 'function') {
            result = await model.generateContent(prompt);
          } else if (typeof model.generate === 'function') {
            result = await model.generate({ prompt, responseMimeType: 'application/json' });
          } else if (typeof genAI.generate === 'function') {
            result = await genAI.generate({ model: fallbackModel, input: prompt, responseMimeType: 'application/json' });
          } else {
            throw new Error('Gemini SDK does not expose a supported generate method');
          }

          let jsonText = null;
          if (result?.response?.text) jsonText = typeof result.response.text === 'function' ? await result.response.text() : result.response.text;
          if (!jsonText && typeof result === 'string') jsonText = result;
          if (!jsonText && result?.output?.[0]?.content) jsonText = result.output[0].content;
          if (!jsonText) throw new Error('No JSON returned from model');

          const parsed = JSON.parse(jsonText);
          const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
          return questions;
        } catch (retryErr) {
          const e = new Error('Requested model not found and fallback failed');
          e.code = 'MODEL_NOT_FOUND';
          e.availableModels = available;
          throw e;
        }
      }

      const e = new Error('Requested model not found');
      e.code = 'MODEL_NOT_FOUND';
      e.availableModels = available;
      throw e;
    }
    // Re-throw other errors
    throw err;
  }
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
      if (err && err.code === 'MODEL_NOT_FOUND') {
        return reply.status(400).send({ message: 'Requested model not found for your API/version', availableModels: err.availableModels || [] });
      }
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
