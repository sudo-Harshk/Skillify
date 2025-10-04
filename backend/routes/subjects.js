const subjectsData = require('../data/subjects');

async function routes(fastify, options) {
    fastify.get('/subjects', async (request, reply) => {
        return Object.keys(subjectsData);
    });

    fastify.get('/subjects/:subject/chapters', async (request, reply) => {
        const { subject } = request.params;

        const normalizedSubject = subject.toLowerCase();
        const availableSubjects = Object.keys(subjectsData).map(s => s.toLowerCase());

        if (!availableSubjects.includes(normalizedSubject)) {
            return reply.status(404).send({ message: 'Subject not found' });
        }

        const originalSubject = Object.keys(subjectsData).find(s => s.toLowerCase() === normalizedSubject);
        const chapters = subjectsData[originalSubject];

        if (!chapters || chapters.length === 0) {
            return reply.status(404).send({ message: 'Chapters not found' });
        }

        return chapters;
    });
}

module.exports = routes;
