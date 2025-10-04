const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_KEY);
let model;

const questionHistory = {};

// Function to generate unique questions
const generateUniqueQuestions = async (subject, chapter, prompt, retries = 5) => {
  if (!questionHistory[subject]) {
    questionHistory[subject] = {};
  }
  if (!questionHistory[subject][chapter]) {
    questionHistory[subject][chapter] = [];
  }

  const previousQuestions = questionHistory[subject][chapter]; 

  let uniqueQuestions = [];
  let attempts = 0;

  while (uniqueQuestions.length < 10 && attempts < retries) {
    const remainingQuestions = 10 - uniqueQuestions.length;
    const currentPrompt = `${prompt} Generate ${remainingQuestions} additional questions.`;

    try {
      const result = await model.generateContent(currentPrompt);
      const candidates = result?.response?.candidates;

      if (Array.isArray(candidates) && candidates.length > 0) {
        const questionsText = candidates[0]?.content?.parts?.[0]?.text;

        if (typeof questionsText === 'string' && questionsText.trim().length > 0) {
          const questionsArray = questionsText.split('\n\n').filter(q => q.trim().length > 0);
          const formattedQuestions = questionsArray.map((questionText) => {
            const lines = questionText.split('\n').filter(line => line.trim().length > 0);
            if (lines.length < 6) {
              console.warn('Incomplete MCQ format detected');
              return null;
            }
            const question = lines[0].replace(/\*\*|Question:|\d+\.\s*/g, '').trim();
            const options = lines.slice(1, 5).map((line, idx) => ({
              label: String.fromCharCode(97 + idx), 
              option: line.replace(`(${String.fromCharCode(97 + idx)})`, '').trim()
            }));
            const correctAnswerLine = lines[5]?.replace(/\*\*|Correct Answer:/g, '').trim();
            const correctAnswers = correctAnswerLine?.match(/\((.)\)/g)?.map(match => match[1]);
            const explanation = lines.length > 6 ? lines[6].replace(/\*\*|Explanation:/g, '').trim() : "No explanation provided.";
            return { question, options, correctAnswers, explanation };
          }).filter(q => q !== null);

          const nonDuplicateQuestions = formattedQuestions.filter(
            (q) => !previousQuestions.some((pq) => pq.question === q.question)
          );

          uniqueQuestions.push(...nonDuplicateQuestions);
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed:`, error);
    }

    attempts += 1;
  }

  if (uniqueQuestions.length < 10) {
    console.warn('Unable to generate 10 unique questions, returning partial result.');
  }

  questionHistory[subject][chapter].push(...uniqueQuestions);
  return uniqueQuestions;
};

// Helper function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function routes(fastify, options) {
  try {
    model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log('Gemini model initialized successfully');
  } catch (error) {
    console.error("Error initializing Gemini model:", error);
    throw error;
  }

  // Route for generating questions
  fastify.post('/questions/generate', async (request, reply) => {
    const { subject, chapter } = request.body;

    const prompt = `Generate 10 multiple-choice questions for the chapter "${chapter}" in ${subject}. Each question should have four options labeled (a), (b), (c), and (d), with one or more correct answers clearly indicated. Each question should also include a detailed explanation (2-3 lines) explaining the correct answer and the reasoning behind it. Format each question like the following example:
    
        Example:
        A ball is thrown vertically upwards with an initial velocity of 20 m/s. What will be the maximum height reached by the ball? Assume no air resistance and that the acceleration due to gravity is 9.8 m/s².
        (a) 10.2 m  
        (b) 20.4 m  
        (c) 30.6 m  
        (d) 40.8 m  
        Answer: (b)  
        Explanation: Using the formula for vertical motion, v² = u² - 2gh, where v is the final velocity (0 at max height), u is the initial velocity, and g is the acceleration due to gravity, the maximum height reached by the ball is calculated as h = u² / (2g).   
        Ensure that each question follows this format and is aligned with the expectations of a comprehensive assessment. The questions should also emphasize concepts and problem-solving skills relevant to the subject.`;

    try {
      console.log("Prompt:", prompt);

      if (!model) {
        throw new Error("Model not initialized correctly.");
      }

      // Start generating questions
      const questions = await generateUniqueQuestions(subject, chapter, prompt);
      console.log("Generated Questions:", questions);

      return reply.code(201).send({ questions });
    } catch (error) {
      console.error('Error generating questions:', error);
      return reply.status(500).send({ message: 'Error generating questions', error: error.message });
    }
  });

  // Route for evaluating user answers
  fastify.post('/questions/evaluate', async (request, reply) => {
    const { userAnswers, subject, chapter } = request.body; 

    try {
      if (!model) {
        throw new Error("Model not initialized correctly.");
      }

      const generatedQuestions = questionHistory[subject]?.[chapter] || [];
      if (generatedQuestions.length === 0) {
        throw new Error("No questions available for evaluation.");
      }

      const evaluation = generatedQuestions.map((question, index) => {
        const userAnswer = userAnswers[(index + 1).toString()];
        const isCorrect = question.correctAnswers.includes(userAnswer);
        return {
          question: question.question,
          correctAnswers: question.correctAnswers,
          userAnswer: userAnswer,
          isCorrect: isCorrect,
          explanation: question.explanation
        };
      });

      return reply.code(200).send({ evaluation });
    } catch (error) {
      console.error('Error evaluating answers:', error);
      return reply.status(500).send({ message: 'Error evaluating answers', error: error.message });
    }
  });
}

module.exports = routes;
