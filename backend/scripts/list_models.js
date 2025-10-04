const dotenv = require('dotenv');
dotenv.config();

// Try both package names similar to how routes does it
let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/genai');
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (e) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (err) {
    console.error('No Gemini SDK installed (tried @google/genai and @google/generative-ai)');
    process.exit(1);
  }
}

async function listModels() {
  try {
    if (!genAI) throw new Error('SDK not initialized');
    // try a few method names
    if (typeof genAI.listModels === 'function') {
      const res = await genAI.listModels();
      const models = res?.models || res?.data?.models || res?.model || res || [];
      console.log('Models:', (Array.isArray(models) ? models : [models]).map(m => (typeof m === 'string' ? m : m.name || m.id || m.model || m.modelId)));
      return;
    }
    if (typeof genAI.listGenerativeModels === 'function') {
      const res = await genAI.listGenerativeModels();
      const models = res?.models || res?.data?.models || res?.model || res || [];
      console.log('Models:', (Array.isArray(models) ? models : [models]).map(m => (typeof m === 'string' ? m : m.name || m.id || m.model || m.modelId)));
      return;
    }
    if (typeof genAI.list === 'function') {
      const res = await genAI.list();
      const models = res?.models || res?.data?.models || res || [];
      console.log('Models:', (Array.isArray(models) ? models : [models]).map(m => (typeof m === 'string' ? m : m.name || m.id || m.model || m.modelId)));
      return;
    }

    console.error('SDK does not expose a list models method on this version of the package');
  } catch (err) {
    console.error('Error listing models:', err);
  }
}

listModels();
