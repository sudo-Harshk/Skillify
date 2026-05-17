require('dotenv').config();

// Fail fast on missing required environment variables
const missingEnvVars = [];
if (!process.env.GEMINI_API_KEY) missingEnvVars.push('GEMINI_API_KEY');
if (!process.env.ALLOWED_ORIGINS) missingEnvVars.push('ALLOWED_ORIGINS');
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
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

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

fastify.register(cors, {
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
});

fastify.register(rateLimit, {
  global: false, // we apply per-route below
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
        await fastify.listen({ port: 5000, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://localhost:5000`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
