const fastify = require('fastify')({ logger: true });
const helmet = require('@fastify/helmet');
const cors = require('@fastify/cors');
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

        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
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
