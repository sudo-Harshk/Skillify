const { evaluateAnswers } = require('../routes/questions');

describe('Evaluation helper', () => {
  test('evaluateAnswers marks correct and incorrect answers', () => {
    const originalQuestions = [
      { question: 'Q1', correctAnswers: ['a'], explanation: 'ex1' },
      { question: 'Q2', correctAnswers: ['b'], explanation: 'ex2' }
    ];
    const userAnswers = { '1': 'a', '2': 'c' };
    const result = evaluateAnswers(originalQuestions, userAnswers);
    expect(result.length).toBe(2);
    expect(result[0].isCorrect).toBe(true);
    expect(result[1].isCorrect).toBe(false);
  });
});
