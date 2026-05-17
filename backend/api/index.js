require('dotenv').config();

// Fail fast if the Gemini API key is missing
if (!process.env.GEMINI_API_KEY) {
  console.error('Missing required environment variable: GEMINI_API_KEY');
  console.error('See backend/.env.example for setup instructions.');
  process.exit(1);
}

const fastify = require('fastify')({ logger: true });
const helmet = require('@fastify/helmet');
const cors = require('@fastify/cors');
const rateLimit = require('@fastify/rate-limit');
const subjectsRoutes = require('../routes/subjects');
const questionsRoutes = require('../routes/questions');

fastify.register(helmet);

fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

fastify.register(rateLimit, {
  global: false,
  max: parseInt(process.env.RATE_LIMIT_RPM || '20', 10),
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'You have exceeded the request limit. Please wait before trying again.'
  })
});

fastify.register(subjectsRoutes);
fastify.register(questionsRoutes);

fastify.get('/', async (request, reply) => {
    reply.send({
        message: 'Welcome to the Skillify API!',
        endpoints: [
            { endpoint: '/subjects', description: 'Retrieve a list of all subjects' },
            { endpoint: '/subjects/{subject}/chapters', description: 'Retrieve chapter information for a specific subject (replace {subject} with a subject name)' },
            { endpoint: '/questions', description: 'Retrieve questions and answers for practice' }
        ],
        note: 'Use the above endpoints to interact with the API.'
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: parseInt(process.env.PORT || '5000', 10), host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
