<div align="center">

# Skillify

**AI-powered MCQ quiz platform for JEE & EAMCET exam preparation**

[Try it live ->](https://sudo-Harshk.github.io/skillify-frontend/)

[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-brightgreen?style=for-the-badge&logo=render)](https://sudo-Harshk.github.io/skillify-frontend/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-blue?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/UI-React_18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/LLM-Google_Gemini-4285F4?style=for-the-badge&logo=google)](https://aistudio.google.com/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

## What is Skillify?

Skillify is a stateless, full-stack quiz application that uses Google Gemini to generate fresh multiple-choice questions on demand. Pick a subject and chapter, and Gemini produces 10 unique MCQs every time. Answer them against a 7-minute countdown, then review your results with per-question explanations and correct answer breakdowns.

It covers the three core subjects for Indian competitive exams:

- **Mathematics** - 17 chapters (Sets, Calculus, Vectors, Probability, ...)
- **Physics** - 26 chapters (Kinematics, Optics, Electrostatics, Nuclei, ...)
- **Chemistry** - 28 chapters (Bonding, Thermodynamics, Organic, Coordination, ...)

---

## How it Works

### Architecture

```
User Browser
    |
    | (1) Select subject + chapter
    v
React Frontend  ----POST /questions/generate---->  Fastify Backend
(TypeScript)                                        (Node.js)
    |                                                   |
    | (5) Render questions + start 7-min timer          | (2) Validate subject/chapter
    |                                                   |     against canonical server list
    |                                                   | (3) Send prompt to Gemini API
    |                                                   |
    |                                                   v
    |                                           Google Gemini 2.5 Flash
    |                                                   |
    |                                                   | (4) JSON response: 10 MCQs
    |                                                   |     + options + explanations
    |
    | (6) User selects answers -> local state
    |
    | (7) Finish quiz (manual or timer expiry)
    |
    v
React Frontend  ----POST /questions/evaluate---->  Fastify Backend
    |                                                   |
    | (9) Display Final Report                          | (8) Compare user answers
    |     - score, per-question breakdown               |     to correct answers
    |     - correct answer + explanation                |     return evaluation array
    |     - MathJax-rendered math
    v
Done
```

### Key Design Choices

| Decision | Choice | Reason |
|---|---|---|
| Stateless backend | No database | Each request generates fresh questions; no session to manage |
| Canonical input validation | Server-side subject/chapter lookup | Prevents prompt injection via crafted chapter names |
| Dual Gemini SDK support | `@google/genai` + `@google/generative-ai` | Handles Google's SDK rename without breaking deployments |
| Model fallback | Auto-retry with first available model on 404 | Survives API key restrictions on specific model versions |
| Rate limiting | `@fastify/rate-limit` at 20 req/IP/min | Protects Gemini API quota from abuse |
| MathJax rendering | `better-react-mathjax` | Cleanly renders LaTeX in questions and explanations |

---

## Live Demo

**[https://sudo-Harshk.github.io/skillify-frontend/](https://sudo-Harshk.github.io/skillify-frontend/)**

> The frontend is deployed on GitHub Pages. The backend must be running separately for question generation to work.

---

## Setup

### Prerequisites

- Node.js 18+
- A Google Gemini API key - get one free at [Google AI Studio](https://aistudio.google.com/)

### 1. Clone the repository

```bash
git clone https://github.com/sudo-Harshk/skillify-frontend.git
cd skillify-frontend
```

### 2. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend (separate terminal)
cd frontend && npm install
```

### 3. Configure environment

**Backend** - create `backend/.env` (copy from `backend/.env.example`):

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
ALLOWED_ORIGINS=http://localhost:3000

# Optional
GEMINI_MODEL=gemini-2.5-flash
RATE_LIMIT_RPM=20
```

**Frontend** - create `frontend/.env` (copy from `frontend/.env.example`):

```env
HOST=localhost
DANGEROUSLY_DISABLE_HOST_CHECK=true
REACT_APP_API_BASE_URL=http://localhost:5000
```

### 4. Run

```bash
# Terminal 1 - Backend (http://localhost:5000)
cd backend && npm start

# Terminal 2 - Frontend (http://localhost:3000)
cd frontend && npm start
```

---

## Usage

1. **Select a subject** - Math, Physics, or Chemistry
2. **Select a chapter** from the list
3. **Click Proceed** - Gemini generates 10 MCQs
4. **Answer questions** within the 7-minute timer
   - Correct answers turn green, wrong answers turn red with a shake animation
   - Click Next Question to advance
5. **View Final Report** - score summary, correct answers, and explanations for every question

To start over, click the refresh icon in the top-right corner of the header.

---

## API Reference

**Base URL:** `http://localhost:5000`

### GET `/subjects`

Returns the list of available subjects.

```json
["Math", "Physics", "Chemistry"]
```

### GET `/subjects/:subject/chapters`

Returns the chapter list for a subject (case-insensitive).

```json
["Sets, Relations, and Functions", "Complex Numbers", "Quadratic Equations", ...]
```

### POST `/questions/generate`

Generates 10 MCQs for the given subject and chapter.

```json
// Request
{ "subject": "Physics", "chapter": "Kinematics" }

// Response 201
{
  "questions": [
    {
      "question": "A body is thrown vertically upward with velocity u. What is the maximum height reached?",
      "options": [
        { "label": "a", "option": "u/2g" },
        { "label": "b", "option": "u²/2g" },
        { "label": "c", "option": "2u/g" },
        { "label": "d", "option": "u²/g" }
      ],
      "correctAnswers": ["b"],
      "explanation": "Using v² = u² - 2gh, at max height v=0, so h = u²/2g."
    }
  ]
}
```

### POST `/questions/evaluate`

Evaluates user answers against the original questions.

```json
// Request
{
  "originalQuestions": [...],
  "userAnswers": { "1": "b", "2": "a", "3": "c" }
}

// Response 200
{
  "evaluation": [
    {
      "question": "...",
      "correctAnswers": ["b"],
      "userAnswer": "b",
      "isCorrect": true,
      "explanation": "..."
    }
  ]
}
```

> `userAnswers` keys are 1-based string integers ("1" to "10"). Values are single lowercase letters "a"-"d".

---

## Project Structure

```
skillify/
|
|- backend/
|   |- api/
|   |   +- index.js              # Fastify server entry, CORS, rate limiting, startup validation
|   |- routes/
|   |   |- questions.js          # POST /questions/generate + /evaluate, Gemini integration
|   |   +- subjects.js           # GET /subjects + /subjects/:subject/chapters
|   |- data/
|   |   +- subjects.js           # Static subject -> chapter mapping (72 chapters total)
|   |- db/
|   |   +- sqlite.js             # Stub (project is stateless - retained for reference)
|   |- scripts/
|   |   +- list_models.js        # CLI utility to list available Gemini models for your key
|   |- __tests__/
|   |   |- questions.test.js     # Unit + route tests (82% line coverage)
|   |   +- questions-generate.test.js
|   |- .env.example              # Required env var reference
|   +- package.json
|
|- frontend/
|   |- src/
|   |   |- App.tsx               # Main component: useReducer state, quiz flow, results
|   |   |- ErrorBoundary.tsx     # Class component catching render errors
|   |   |- index.tsx             # React root, wraps App in ErrorBoundary
|   |   |- components/
|   |   |   +- DesignedBy.tsx   # Animated footer with scrambling text + avatar rotation
|   |   |- assets/              # done.webp, avatar images
|   |   +- *.css                # loader.css, DesignedBy.css, index.css
|   |- .env.example              # Required env var reference
|   +- package.json
|
|- PRD.md                        # Product Requirements Document
|- README.md
+- LICENSE
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend framework | React 18 + TypeScript | UI and quiz state management |
| State management | `useReducer` (built-in) | Single reducer for all quiz state transitions |
| HTTP client | Axios | API calls from frontend to backend |
| Styling | Tailwind CSS | Utility-first responsive styling |
| Math rendering | better-react-mathjax | LaTeX rendering in questions and explanations |
| Timer | @leenguyen/react-flip-clock-countdown | Animated 7-minute flip clock |
| Icons | Lucide React | Back, check, X, refresh icons |
| Backend framework | Fastify 5 | High-performance Node.js HTTP server |
| Security headers | @fastify/helmet | Sets CSP, X-Frame-Options, etc. |
| CORS | @fastify/cors | Configurable origin allowlist |
| Rate limiting | @fastify/rate-limit | Per-IP request throttling |
| LLM | Google Gemini 2.5 Flash | Question generation via `@google/genai` |
| Testing (backend) | Jest | Unit + route tests, 82% line coverage |
| Testing (frontend) | React Testing Library + Jest | Component + interaction tests, 86% App.tsx coverage |
| Deployment (frontend) | GitHub Pages | Static build via `gh-pages` |

---

## Design Decisions

**Why stateless over a database?**

Storing generated questions would introduce schema design, migration management, and infrastructure cost for no user-facing benefit. Since Gemini generates unique questions each time, there is nothing worth caching per-session. The frontend holds question state locally and sends it back for evaluation - simpler, cheaper, and scales horizontally without coordination.

**Why Fastify over Express?**

Fastify has a schema-based validation pipeline, native async/await support without wrappers, and benchmarks consistently faster than Express for JSON-heavy workloads. The official plugin ecosystem (`@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`) provides everything needed without extra configuration.

**Why validate chapter names server-side instead of trusting the frontend?**

The chapter name goes directly into an LLM prompt. A crafted value like `"ignore all previous instructions and..."` would be injected verbatim. Matching the incoming value against the canonical server-side list and using only the canonical string in the prompt eliminates this attack surface entirely.

**Why `useReducer` over multiple `useState` hooks?**

The quiz has 12 interdependent state variables. Updating them with individual `useState` setters leads to stale closure bugs and scattered logic (e.g., resetting 8 variables on subject change). A single reducer makes every state transition explicit and atomic - SELECT_SUBJECT resets everything in one dispatch, no variable missed.

**Why dual Gemini SDK support?**

Google renamed `@google/generative-ai` to `@google/genai` during the transition to the 2.x API. Different API keys may be provisioned against different SDK versions depending on when they were created. Supporting both with a try/catch at import time means deployments don't break on SDK version mismatches.

---

## Acknowledgements

Inspired by the lack of good, free, on-demand MCQ tools for JEE and EAMCET preparation. Most platforms either have static question banks that get memorised quickly, or require paid subscriptions. Skillify generates fresh questions on every run so the same chapter never feels the same twice.

---

## License

MIT License - see [LICENSE](LICENSE) for full text.

Copyright (c) 2026 [sudo-Harshk](https://github.com/sudo-Harshk)

---

<div align="center">

Built by [sudo-Harshk](https://github.com/sudo-Harshk) · [Live Demo](https://sudo-Harshk.github.io/skillify-frontend/) · [MIT License](LICENSE)

</div>
