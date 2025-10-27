# Skillify

Lightweight quiz backend + frontend for generating and evaluating multiple-choice questions using an LLM.

This repository contains two main folders:
- `backend/` - Fastify-based API that generates questions via Gemini (stateless) and evaluates answers.
- `frontend/` - Static React app (build included under `frontend/build`).

## Quick start (Windows PowerShell)

1. Backend

```powershell
cd backend
npm install
npm start
```

- The backend listens on port `5000` by default (see `backend/api/index.js`).
- If you run into native build issues for optional native modules (e.g. `better-sqlite3`), see Troubleshooting below.

2. Frontend (development)

```powershell
cd frontend
npm install
npm start
```

Or serve the included `frontend/build` folder with your static host.

## Environment

Create a `.env` file in `backend/` (do not commit it). Required keys:

```env
# Gemini API key (recommended)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

## API Endpoints (backend)

Base URL: http://localhost:5000

1) POST /questions/generate

Request body:
```json
{ "subject": "Physics", "chapter": "Kinematics" }
```

Response (201):
```json
{ "questions": [ { "question": "...", "options": [{"label":"a","option":"..."},...], "correctAnswers": ["b"], "explanation":"..." }, ... ] }
```

2) POST /questions/evaluate

Request body (frontend must supply the original questions):
```json
{
  "originalQuestions": [ /* questions from /generate */ ],
  "userAnswers": { "1": "b", "2": "a" }
}
```

Response (200):
```json
{ "evaluation": [ { "question": "...", "correctAnswers": ["b"], "userAnswer": "b", "isCorrect": true, "explanation": "..." }, ... ] }
```

## Tests

Backend unit tests are written with Jest.

```powershell
cd backend
npm test
```

## Design notes & recommendations

- Stateless flow: The server does not persist generated questions by default. The frontend must keep the original questions (including answers) and send them back during evaluation. This guarantees unique questions per request and simplifies the backend.

- If you need tamper-proof evaluation without a DB, consider issuing a signed token (HMAC) with the questions payload when generating. The frontend sends the token back with answers; server verifies token signature before evaluating.

- The code tries to use the Gemini SDK (`@google/genai` or `@google/generative-ai`) if present. If the SDK shape does not match your installed version, adapt `backend/routes/questions.js` or tell me which SDK version you prefer and I can lock it down.

## Troubleshooting

- better-sqlite3 install errors (native build):
  - On Windows you may need the Visual Studio C++ Build Tools. Alternatively, keep `better-sqlite3` as optional (the project provides an in-memory fallback or has been refactored to stateless) or use Docker where binaries are available.

- Model returned invalid JSON:
  - The prompt asks for a strict JSON object. If the model returns stray text, the backend will throw. Improve the prompt or add retries.

- Forgot to set `GEMINI_API_KEY`:
  - The `/questions/generate` route will fail. Add your key to `backend/.env` or set it in your environment.
