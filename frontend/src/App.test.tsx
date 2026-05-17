import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// ---------------------------------------------------------------------------
// Axios mock
// jest.mock() is hoisted before variable declarations, so we cannot close over
// const/let variables.  The workaround is to store jest.fn() instances on the
// mock's exported object and retrieve them with jest.requireMock() after the
// fact — that reference is stable and always points to the same fn objects.
// ---------------------------------------------------------------------------
jest.mock('axios', () => {
  const get = jest.fn();
  const post = jest.fn();
  const instance = { get, post };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      // expose fns for test access
      _instance: instance,
    },
  };
});

// Grab the stable mock references once (after jest.mock registers them)
const axiosMock = require('axios').default as { _instance: { get: jest.Mock; post: jest.Mock } };
const mockGet = axiosMock._instance.get;
const mockPost = axiosMock._instance.post;

// ---------------------------------------------------------------------------
// UI dependency mocks
// ---------------------------------------------------------------------------
jest.mock('better-react-mathjax', () => ({
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@leenguyen/react-flip-clock-countdown', () => () => null);

jest.mock('./assets/done.webp', () => 'done.webp');

// Mock DesignedBy to avoid timer leaks
jest.mock('./components/DesignedBy', () => () => null);

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
const mockChapters = [
  'Sets, Relations, and Functions',
  'Complex Numbers',
  'Quadratic Equations',
];

const mockQuestions = [
  {
    question: 'What is 2 + 2?',
    options: [
      { label: 'a', option: '3' },
      { label: 'b', option: '4' },
      { label: 'c', option: '5' },
      { label: 'd', option: '6' },
    ],
    correctAnswers: ['b'],
    explanation: 'Basic arithmetic.',
  },
  {
    question: 'What is 3 + 3?',
    options: [
      { label: 'a', option: '5' },
      { label: 'b', option: '6' },
      { label: 'c', option: '7' },
      { label: 'd', option: '8' },
    ],
    correctAnswers: ['b'],
    explanation: '3 + 3 = 6.',
  },
];

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helper: navigate through subject → chapter → quiz start
// ---------------------------------------------------------------------------
async function renderAndStartQuiz() {
  mockGet.mockResolvedValue({ data: mockChapters });
  mockPost.mockResolvedValue({ data: { questions: mockQuestions } });

  render(<App />);

  fireEvent.click(screen.getByText('Math'));
  await waitFor(() => screen.getByText('Sets, Relations, and Functions'));

  fireEvent.click(screen.getByText('Sets, Relations, and Functions'));
  await waitFor(() => screen.getByText('Proceed'));

  fireEvent.click(screen.getByText('Proceed'));
  await waitFor(() => screen.getByText(/Question 1 of/i));
}

// ---------------------------------------------------------------------------
// Group 1: Initial render
// ---------------------------------------------------------------------------
describe('Group 1: Initial render', () => {
  test('renders "Skillify" header', () => {
    render(<App />);
    expect(screen.getByText('Skillify')).toBeInTheDocument();
  });

  test('shows subject selection screen with Math, Physics, Chemistry buttons', () => {
    render(<App />);
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
  });

  test('does not show chapter list initially', () => {
    render(<App />);
    expect(screen.queryByText('Select a Chapter')).not.toBeInTheDocument();
    expect(screen.queryByText('Sets, Relations, and Functions')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 2: Subject selection → chapter loading
// ---------------------------------------------------------------------------
describe('Group 2: Subject selection → chapter loading', () => {
  test('clicking a subject calls GET /subjects/{subject}/chapters', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/subjects/Math/chapters');
    });
  });

  test('after successful response, chapter buttons are displayed', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));

    await waitFor(() => {
      expect(screen.getByText('Sets, Relations, and Functions')).toBeInTheDocument();
      expect(screen.getByText('Complex Numbers')).toBeInTheDocument();
      expect(screen.getByText('Quadratic Equations')).toBeInTheDocument();
    });
  });

  test('shows error banner (not an alert) when chapter fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<App />);

    fireEvent.click(screen.getByText('Physics'));

    await waitFor(() => {
      expect(screen.getByText(/could not load chapters/i)).toBeInTheDocument();
    });

    // The error is rendered inline — not via alert()
    const errorEl = screen.getByText(/could not load chapters/i);
    expect(errorEl).toBeVisible();
  });

  test('error banner can be dismissed', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<App />);

    fireEvent.click(screen.getByText('Physics'));

    await waitFor(() => {
      expect(screen.getByText(/could not load chapters/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss error'));

    await waitFor(() => {
      expect(screen.queryByText(/could not load chapters/i)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Group 3: Chapter selection → quiz start
// ---------------------------------------------------------------------------
describe('Group 3: Chapter selection → quiz start', () => {
  test('clicking a chapter shows the chapter name and Proceed/Reselect buttons', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));
    await waitFor(() => screen.getByText('Sets, Relations, and Functions'));

    fireEvent.click(screen.getByText('Sets, Relations, and Functions'));

    await waitFor(() => {
      expect(screen.getByText(/Selected Chapter:/i)).toBeInTheDocument();
      expect(screen.getByText('Proceed')).toBeInTheDocument();
      expect(screen.getByText('Reselect')).toBeInTheDocument();
    });
  });

  test('chapter name is shown in the confirmation screen', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));
    await waitFor(() => screen.getByText('Sets, Relations, and Functions'));

    fireEvent.click(screen.getByText('Sets, Relations, and Functions'));

    await waitFor(() => {
      // The heading contains the chapter name
      expect(
        screen.getByText((content) =>
          content.includes('Sets, Relations, and Functions')
        )
      ).toBeInTheDocument();
    });
  });

  test('clicking Proceed calls POST /questions/generate with correct subject and chapter', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    mockPost.mockResolvedValue({ data: { questions: mockQuestions } });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));
    await waitFor(() => screen.getByText('Sets, Relations, and Functions'));

    fireEvent.click(screen.getByText('Sets, Relations, and Functions'));
    await waitFor(() => screen.getByText('Proceed'));

    fireEvent.click(screen.getByText('Proceed'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/questions/generate', {
        subject: 'Math',
        chapter: 'Sets, Relations, and Functions',
      });
    });
  });

  test('after successful generate response, shows the first question', async () => {
    await renderAndStartQuiz();

    expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 4: Answering questions
// ---------------------------------------------------------------------------
describe('Group 4: Answering questions', () => {
  test('clicking the correct answer option applies bg-green-500 class', async () => {
    await renderAndStartQuiz();

    // Option B (label "b") is the correct answer for question 1
    const correctButton = screen.getByRole('button', { name: /B\. 4/i });
    fireEvent.click(correctButton);

    await waitFor(() => {
      expect(correctButton).toHaveClass('bg-green-500');
    });
  });

  test('clicking the wrong answer option applies bg-red-500 class', async () => {
    await renderAndStartQuiz();

    // Option A (label "a") is incorrect for question 1
    const wrongButton = screen.getByRole('button', { name: /A\. 3/i });
    fireEvent.click(wrongButton);

    await waitFor(() => {
      expect(wrongButton).toHaveClass('bg-red-500');
    });
  });

  test('Next Question button is disabled before answering', async () => {
    await renderAndStartQuiz();

    expect(screen.getByRole('button', { name: /Next Question/i })).toBeDisabled();
  });

  test('after answering, the "Next Question" button becomes enabled', async () => {
    await renderAndStartQuiz();

    fireEvent.click(screen.getByRole('button', { name: /B\. 4/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Next Question/i })).not.toBeDisabled();
    });
  });

  test('clicking "Next Question" advances to question 2', async () => {
    await renderAndStartQuiz();

    fireEvent.click(screen.getByRole('button', { name: /B\. 4/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Next Question/i })).not.toBeDisabled()
    );

    fireEvent.click(screen.getByRole('button', { name: /Next Question/i }));

    await waitFor(() => {
      expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
      expect(screen.getByText('What is 3 + 3?')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Group 5: Finishing the quiz
// ---------------------------------------------------------------------------
describe('Group 5: Finishing the quiz', () => {
  async function finishQuiz() {
    await renderAndStartQuiz();

    // Answer question 1 correctly (label b = "4")
    fireEvent.click(screen.getByRole('button', { name: /B\. 4/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Next Question/i })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole('button', { name: /Next Question/i }));

    // Answer question 2 incorrectly (label a = "5", correct is b = "6")
    await waitFor(() => screen.getByText(/Question 2 of 2/i));
    fireEvent.click(screen.getByRole('button', { name: /A\. 5/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Finish Quiz/i })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole('button', { name: /Finish Quiz/i }));

    await waitFor(() => screen.getByText('Final Report'));
  }

  test('results screen appears after finishing the quiz', async () => {
    await finishQuiz();
    expect(screen.getByText('Final Report')).toBeInTheDocument();
  });

  test('results screen shows "Final Report" text', async () => {
    await finishQuiz();
    expect(screen.getByText('Final Report')).toBeInTheDocument();
  });

  test('results screen shows correct and wrong counts', async () => {
    await finishQuiz();
    // Q1 answered correctly (b), Q2 answered incorrectly (a instead of b)
    expect(screen.getByText(/Correct: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Wrong: 1/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group 6: Navigation
// ---------------------------------------------------------------------------
describe('Group 6: Navigation', () => {
  test('back button (ChevronLeft) appears when a subject is selected', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));
    await waitFor(() => screen.getByText('Sets, Relations, and Functions'));

    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
  });

  test('clicking back returns to subject selection', async () => {
    mockGet.mockResolvedValue({ data: mockChapters });
    render(<App />);

    fireEvent.click(screen.getByText('Math'));
    await waitFor(() => screen.getByText('Sets, Relations, and Functions'));

    fireEvent.click(screen.getByLabelText('Go back'));

    await waitFor(() => {
      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
      expect(screen.queryByText('Sets, Relations, and Functions')).not.toBeInTheDocument();
    });
  });
});
