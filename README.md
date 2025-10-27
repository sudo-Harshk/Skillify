# Skillify

Skillify is a lightweight quiz generation and evaluation platform powered by a Large Language Model (LLM).  
It provides a Fastify-based backend for generating and evaluating multiple-choice questions and a React-based frontend for user interaction.

## Quick Start (Windows PowerShell)

### 1. Run the Backend

```powershell
cd backend
npm install
npm start
````

The backend runs on **[http://localhost:5000](http://localhost:5000)** by default (see `backend/api/index.js`).

If you encounter native build issues (for example, with `better-sqlite3`), refer to the [Troubleshooting](#troubleshooting) section.

---

### 2. Run the Frontend (Development Mode)

```powershell
cd frontend
npm install
npm start
```

Alternatively, you can serve the prebuilt static app from the `frontend/build` directory.

---

## Environment Configuration

Create a `.env` file in the `backend/` directory (do not commit this file):

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

The application uses Gemini for question generation.
Obtain your API key from [Google AI Studio](https://aistudio.google.com/).

---

## API Endpoints

**Base URL:** `http://localhost:5000`

### 1. Generate Questions

**POST** `/questions/generate`

**Request Body**

```json
{
  "subject": "Physics",
  "chapter": "Kinematics"
}
```

**Response (201)**

```json
{
  "questions": [
    {
      "question": "What is the SI unit of acceleration?",
      "options": [
        { "label": "a", "option": "m/s" },
        { "label": "b", "option": "m/s²" },
        { "label": "c", "option": "m/s³" },
        { "label": "d", "option": "N" }
      ],
      "correctAnswers": ["b"],
      "explanation": "Acceleration is measured in meters per second squared (m/s²)."
    }
  ]
}
```

---

### 2. Evaluate Answers

**POST** `/questions/evaluate`

**Request Body**

```json
{
  "originalQuestions": "questions returned from /generate",
  "userAnswers": { "1": "b", "2": "a" }
}
```

**Response (200)**

```json
{
  "evaluation": [
    {
      "question": "What is the SI unit of acceleration?",
      "correctAnswers": ["b"],
      "userAnswer": "b",
      "isCorrect": true,
      "explanation": "Acceleration is measured in meters per second squared."
    }
  ]
}
```

---

## Running Tests

Backend unit tests are written with Jest.

```powershell
cd backend
npm test
```

---

## Design Notes

* **Stateless Architecture:**
  The backend does not persist data. The frontend is responsible for storing the generated questions and sending them back for evaluation. This ensures unique questions per request and simplifies the backend.

* **Tamper-Proof Option:**
  To prevent data tampering, consider signing the generated question payload using an HMAC token. The frontend can return this token along with answers, allowing the backend to verify integrity.

* **Gemini SDK Compatibility:**
  The backend supports both `@google/genai` and `@google/generative-ai`. If your SDK version differs, update `backend/routes/questions.js` accordingly.
