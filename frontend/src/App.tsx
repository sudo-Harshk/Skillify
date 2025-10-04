import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import gifPath from './assets/done.webp';
import './loader.css';
import './App.css';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import DesignedBy from './components/DesignedBy';

// Question type definition
type Question = {
  question: string;
  options: { label: string; option: string }[];
  correctAnswers: string[];
  explanation: string;
  selectedAnswer?: string | null;
};

// ProgressBar component
type ProgressBarProps = {
  progress: number;
};

function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span>Quiz Progress</span>
        <span>{`${progress}%`}</span>
      </div>
      <div className="w-full bg-gray-300 h-2 rounded-full">
        <div
          className="bg-black h-full rounded-full"
          style={{ width: `${progress}%`, transition: 'width 0.5s ease-in-out' }}
        ></div>
      </div>
    </div>
  );
}

// QuestionDisplay component
type QuestionDisplayProps = {
  questions: Question[];
  setQuestions: (questions: Question[]) => void;
  setCorrectCount: (count: number) => void;
  setWrongCount: (count: number) => void;
  correctCount: number;
  wrongCount: number;
  setShowTimer: (show: boolean) => void;
  handleFinishQuiz: () => void;
};

function QuestionDisplay({
  questions,
  setQuestions,
  setCorrectCount,
  setWrongCount,
  correctCount,
  wrongCount,
  setShowTimer,
  handleFinishQuiz,
}: QuestionDisplayProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex] || { correctAnswers: [], options: [] };
  const totalQuestions = questions.length;

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleAnswerSelect = (label: string, index: number) => {
    if (!currentQuestion || !currentQuestion.correctAnswers) {
      console.error('currentQuestion or correctAnswers is undefined');
      return;
    }

    setSelectedAnswer(label);

    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].selectedAnswer = label;
    setQuestions(updatedQuestions);

    if (currentQuestion.correctAnswers.includes(label)) {
      setCorrectCount(correctCount + 1);
    } else {
      setWrongCount(wrongCount + 1);
      if (buttonRefs.current[index]) {
        buttonRefs.current[index]?.classList.add('shake');
        setTimeout(() => {
          buttonRefs.current[index]?.classList.remove('shake');
        }, 400);
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
    } else {
      setShowTimer(false);
      handleFinishQuiz();
    }
  };

  const progress = totalQuestions > 0 ? Math.round(((currentQuestionIndex + (selectedAnswer ? 1 : 0)) / totalQuestions) * 100) : 0;

  return (
    <div>
      <ProgressBar progress={progress} />
      {currentQuestionIndex < totalQuestions ? (
        <>
          <h2 className="text-lg font-semibold mb-2">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </h2>
          <p className="mb-4">
            <MathJax>{currentQuestion.question}</MathJax>
          </p>
          <div className="grid grid-cols-1 gap-2 mb-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option.label}
                ref={(el) => (buttonRefs.current[index] = el)}
                onClick={() => handleAnswerSelect(option.label, index)}
                className={`w-full px-4 py-3 rounded-md transition-colors text-left ${
                  selectedAnswer === option.label
                    ? currentQuestion.correctAnswers.includes(option.label)
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
                disabled={!!selectedAnswer}
              >
                {option.label.toUpperCase()}. {option.option}
              </button>
            ))}
          </div>
          <button
            onClick={handleNextQuestion}
            className={`bg-blue-500 text-white px-4 py-2 rounded-md transition-colors ${
              selectedAnswer ? 'hover:bg-blue-600' : 'opacity-50 cursor-not-allowed'
            }`}
            disabled={!selectedAnswer}
          >
            {currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'Finish Quiz'}
          </button>
        </>
      ) : (
        <div className="mt-4 text-center">
          <button
            onClick={handleFinishQuiz}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
          >
            Finish Quiz
          </button>
        </div>
      )}
    </div>
  );
}

// ChapterSelector component
function ChapterSelector({ subject, chapters, onSelect }: { subject: string, chapters: string[], onSelect: (chapter: string) => void }) {
  const getChapterColor = (subject: string) => {
    switch (subject) {
      case 'Math':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'Physics':
        return 'bg-pink-100 text-pink-800 hover:bg-pink-200';
      case 'Chemistry':
        return 'bg-[#FAD5A5] text-yellow-800 hover:bg-[#F8C471]';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  return (
    <div>
      {chapters.map((chapter) => (
        <button
          key={chapter}
          onClick={() => onSelect(chapter)}
          className={`px-4 py-2 rounded-md transition-colors ${getChapterColor(subject)} mb-2 w-full`}
        >
          {chapter}
        </button>
      ))}
    </div>
  );
}

// Main Component
export default function Component() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapters, setChapters] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  useEffect(() => {
    const fetchChapters = async () => {
      if (selectedSubject) {
        setLoading(true);
        try {
          const response = await axios.get(`https://skillify-backend.vercel.app/subjects/${selectedSubject}/chapters`);
          setChapters(response.data);
        } catch (error) {
          console.error('Error fetching chapters:', error);
          alert('There was an error fetching chapters. Please try again later.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchChapters();
  }, [selectedSubject]);

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    setChapters([]);
    setQuestions([]);
    setShowTimer(false);
    setCorrectCount(0);
    setWrongCount(0);
    setTimerStart(null);
    setQuizFinished(false);
  };

  const handleChapterSelect = (chapter: string) => {
    setSelectedChapter(chapter);
    setQuestions([]);
    setShowTimer(false);
    setCorrectCount(0);
    setWrongCount(0);
    setTimerStart(null);
    setQuizFinished(false);
  };

  const handleGenerateQuestions = async () => {
    if (selectedSubject && selectedChapter) {
      setQuestions([]);
      setLoading(true);
      try {
        const response = await axios.post('https://skillify-backend.vercel.app/questions/generate', {
          subject: selectedSubject,
          chapter: selectedChapter,
        });

        const questionsArray = response.data.questions;

        if (!questionsArray || questionsArray.length === 0) {
          alert('Unable to generate questions at this time. Please try again.');
          setShowTimer(false);
          return;
        }

        const formattedQuestions = questionsArray.map((question: any) => ({
          question: question.question.replace(/^\*?\d+[:.]?\s*/, '').replace(/Question:\s*/, '').replace(/\*\*/g, ''),
          options: question.options,
          correctAnswers: question.correctAnswers,
          explanation: question.explanation.replace(/\*\*/g, '').replace(/^Explanation:\s*/, ''),
        }));

        setQuestions(formattedQuestions);
        setShowTimer(true);
        if (!timerStart) {
          setTimerStart(Date.now());
          setTimerKey((prevKey) => prevKey + 1);
        }
      } catch (error) {
        alert('There was an error generating questions. Please try again later.');
        setShowTimer(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (selectedChapter) {
      setSelectedChapter(null);
    } else if (selectedSubject) {
      setSelectedSubject(null);
    }
    setShowTimer(false);
    setTimerStart(null);
    setQuizFinished(false);
  };

  const handleRetry = () => {
    setSelectedSubject(null);
    setSelectedChapter(null);
    setChapters([]);
    setQuestions([]);
    setShowTimer(false);
    setCorrectCount(0);
    setWrongCount(0);
    setTimerStart(null);
    setQuizFinished(false);
  };

  const handleFinishQuiz = () => {
    setQuizFinished(true);
    setShowTimer(false);
  };

  useEffect(() => {
    if (showTimer && timerStart) {
      const timerEnd = timerStart + 7 * 60 * 1000;
      const timeout = setTimeout(() => {
        handleFinishQuiz();
      }, timerEnd - Date.now());

      return () => clearTimeout(timeout);
    }
  }, [showTimer, timerStart]);

  return (
    <MathJaxContext>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-2 pb-4 bg-blue-600 text-white flex items-center justify-between relative">
            {selectedChapter === null && (selectedSubject || questions.length > 0) && (
              <button onClick={handleBack} className="absolute left-4" aria-label="Go back">
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <h1 className="mx-auto text-xl font-bold">Skillify</h1>
            {quizFinished && questions.length > 0 && (
              <button onClick={handleRetry} className="absolute right-4" aria-label="Retry">
                <RefreshCw className="h-6 w-6" />
              </button>
            )}
          </div>
          <div className="p-4">
            {showTimer && timerStart && questions.length > 0 && (
              <div className="mt-2 mb-4 flex justify-center items-center">
                <FlipClockCountdown
                  key={timerKey}
                  to={timerStart + 7 * 60 * 1000}
                  className="flip-timer"
                  renderMap={[false, false, true, true]}
                  duration={0.5}
                  style={{ margin: '0 auto', transform: 'scale(1.2)' }}
                />
              </div>
            )}
            {loading ? (
              <div className="flex justify-center items-center">
                <div className="loader">
                  <svg viewBox="0 0 80 80">
                    <circle id="test" cx="40" cy="40" r="32"></circle>
                  </svg>
                </div>
                <div className="loader triangle">
                  <svg viewBox="0 0 86 80">
                    <polygon points="43 8 79 72 7 72"></polygon>
                  </svg>
                </div>
                <div className="loader">
                  <svg viewBox="0 0 80 80">
                    <rect x="8" y="8" width="64" height="64"></rect>
                  </svg>
                </div>
              </div>
            ) : (
              <>
                {!selectedSubject && (
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Select a Subject</h2>
                    <div className="grid grid-cols-1 gap-2">
                      {['Math', 'Physics', 'Chemistry'].map((subject) => (
                        <button
                          key={subject}
                          onClick={() => handleSubjectSelect(subject)}
                          className="bg-blue-100 text-blue-800 px-4 py-2 rounded-md hover:bg-blue-200 transition-colors"
                        >
                          {subject}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSubject && !selectedChapter && chapters.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Select a Chapter</h2>
                    <ChapterSelector
                      subject={selectedSubject}
                      chapters={chapters}
                      onSelect={handleChapterSelect}
                    />
                  </div>
                )}
                {selectedSubject && selectedChapter && questions.length === 0 && correctCount + wrongCount === 0 && (
                  <div className="text-center">
                    <h2 className="text-lg font-semibold mb-2">Selected Chapter: {selectedChapter}</h2>
                    <div className="flex justify-center gap-4 mt-4">
                      <button
                        onClick={() => setSelectedChapter(null)}
                        className="bg-red-100 text-red-800 px-4 py-2 rounded-md hover:bg-red-200 transition-colors"
                      >
                        Reselect 
                      </button>
                      <button
                        onClick={handleGenerateQuestions}
                        className="bg-green-100 text-green-800 px-4 py-2 rounded-md hover:bg-green-200 transition-colors"
                      >
                        Proceed
                      </button>
                    </div>
                  </div>
                )}
                {questions.length > 0 && !quizFinished && (
                  <QuestionDisplay
                    questions={questions}
                    setQuestions={setQuestions}
                    setCorrectCount={setCorrectCount}
                    setWrongCount={setWrongCount}
                    correctCount={correctCount}
                    wrongCount={wrongCount}
                    setShowTimer={setShowTimer}
                    handleFinishQuiz={handleFinishQuiz}
                  />
                )}
                {quizFinished && (
                  <div className="text-center mt-8">
                    <div className="flex flex-col items-center">
                      <img
                        src={gifPath}
                        alt="Done And Done GIF"
                        className="w-full h-full mb-4 rounded-lg object-cover"
                      />
                      <div className="max-w-xl p-6 w-full mb-4">
                        <h2 className="text-xl font-semibold">
                          <span className="relative after:absolute after:bottom-0 after:left-0 after:bg-current after:w-full after:h-[2px] after:scale-x-0 after:origin-left after:animate-underlineExpand">
                            Final Report
                          </span>
                        </h2>
                        <div className="flex justify-around items-center mt-4">
                          <div className="flex items-center">
                            <CheckCircle className="text-green-500 w-5 h-5 mr-2" />
                            <p className="text-green-700 font-bold">Correct: {correctCount}</p>
                          </div>
                          <div className="flex items-center">
                            <XCircle className="text-red-500 w-5 h-5 mr-2" />
                            <p className="text-red-700 font-bold">Wrong: {wrongCount}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 w-full mt-2">
                        {questions.map((question, index) => {
                          const selectedOption = question.options.find(
                            (option) => option.label.toLowerCase() === question.selectedAnswer?.toLowerCase()
                          );

                          return (
                            <div
                              key={index}
                              className={`mb-4 p-6 rounded-lg shadow-md ${
                                question.selectedAnswer &&
                                question.correctAnswers.includes(question.selectedAnswer)
                                  ? 'bg-green-100'
                                  : 'bg-red-100'
                              }`}
                            >
                              <p className="font-bold mb-2 text-left">
                                <MathJax>
                                  {`${index + 1}) ${question.question}`}
                                </MathJax>
                              </p>
                              <p
                                className={`mt-2 text-left ${
                                  question.selectedAnswer &&
                                  question.correctAnswers.includes(question.selectedAnswer)
                                    ? 'text-green-700'
                                    : 'text-red-700'
                                }`}
                              >
                                <span className="font-bold">Your Answer:</span>{' '}
                                {selectedOption ? (
                                  <>
                                    <span className="font-bold italic">[ {selectedOption.label.toUpperCase()} ]</span>{' '}
                                    <span className="font-bold italic">{selectedOption.option}</span>
                                  </>
                                ) : (
                                  <span className="font-bold italic">- Not Answered</span>
                                )}
                              </p>

                              <p className="mt-2 font-semibold text-left">
                                Correct Answer:{' '}
                                {question.correctAnswers.map((answer, index) => {
                                  const correctOption = question.options.find(
                                    (option) => option.label.toLowerCase() === answer.toLowerCase()
                                  );

                                  return (
                                    <span key={index}>
                                      [ {correctOption ? correctOption.label.toUpperCase() : answer.toUpperCase()} ]{' '}
                                      <span className="font-bold italic">
                                        {correctOption ? correctOption.option : ''}
                                      </span>
                                      {index < question.correctAnswers.length - 1 && ', '}
                                    </span>
                                  );
                                })}
                              </p>

                              <div className="mt-2 text-gray-700 text-left">
                                <p className="font-bold mb-1">Explanation:</p>
                                <p>
                                  <MathJax>{question.explanation}</MathJax>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
           <DesignedBy />
          </div>
        </div>  
      </div>
    </MathJaxContext>
  );
}