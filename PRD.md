# Product Requirements Document — Skillify

**Author:** Product Head  
**Date:** 2026-05-17  
**Status:** Active  
**Audience:** Engineering Team

---

## 1. Executive Summary

Skillify is an AI-powered quiz platform that helps students prepare for competitive exams (JEE, EAMCET) by generating on-demand multiple-choice questions via Google Gemini and evaluating their answers instantly. The product works end-to-end in its current form, but a code audit has surfaced a critical security breach, significant reliability gaps, poor test coverage, and missing product-level features that block us from calling this production-ready.

This document defines the problems clearly, sets out the expected outcomes for the engineering team, and draws a boundary around what is in scope for the next engineering sprint.

---

## 2. Background & Context

The current implementation is a React + TypeScript frontend talking to a Fastify (Node.js) backend. There is no database — every request is stateless and answered live by the Gemini LLM. The core user journey is:

1. Pick a subject (Math / Physics / Chemistry)
2. Pick a chapter
3. Generate 10 MCQs
4. Answer within a 7-minute timer
5. See results with explanations

This is a solid foundation. The problems below are not architectural rewrites — they are correctness, security, and reliability issues in an otherwise well-structured codebase.

---

## 3. Problem Areas

### 3.1 CRITICAL — Gemini API Key Exposed in Git

**Issue:** The file `backend/.env` was committed to the repository. It contains the live `GEMINI_API_KEY`. Any person with access to the git history can extract and abuse this key, incurring costs or exhausting the quota.

**Desired Outcome:**
- Rotate the API key immediately (outside engineering scope — owner action required).
- Remove the `.env` file from git history using `git filter-repo` or BFG Repo Cleaner.
- Add `.env` to `.gitignore` if not already present (it is, but verify it was not bypassed).
- Create a `.env.example` file listing every required environment variable with placeholder values and a comment explaining each one. This becomes the canonical reference for any new developer setting up the project.
- Add a startup check in `api/index.js` that exits with a clear error if `GEMINI_API_KEY` is not set, rather than silently continuing.

---

### 3.2 HIGH — CORS Defaults to Allow-All in Production

**Issue:** If `ALLOWED_ORIGINS` is not set as an environment variable, the backend falls back to allowing every origin. This means a deployed production instance with a missing env var accepts cross-origin requests from any website.

**Desired Outcome:**
- Change the fallback behavior so that if `ALLOWED_ORIGINS` is empty or not set, the server refuses to start and logs a clear error: `ALLOWED_ORIGINS must be set. Example: https://yourdomain.com`.
- Document the expected value format in `.env.example`.
- Update the local development setup docs to instruct developers to set `ALLOWED_ORIGINS=http://localhost:3000` for local runs.

---

### 3.3 HIGH — No Rate Limiting on Question Generation

**Issue:** `POST /questions/generate` makes a live call to the Gemini API on every request. There is no rate limiting or request throttling. A malicious or runaway client can exhaust the API quota within minutes.

**Desired Outcome:**
- Add IP-based rate limiting on the `/questions/generate` and `/questions/evaluate` endpoints.
- Recommended limit: 20 requests per IP per minute (adjustable via env var `RATE_LIMIT_RPM`).
- Return HTTP 429 with a `Retry-After` header when the limit is hit.
- Use `@fastify/rate-limit` (official Fastify plugin) to implement this — do not roll a custom solution.

---

### 3.4 HIGH — No Input Sanitization (Prompt Injection Risk)

**Issue:** The `chapter` and `subject` fields from the request body are interpolated directly into the LLM prompt string without sanitization. A crafted chapter name (e.g., `"Ignore all previous instructions and..."`) is passed verbatim to Gemini.

**Desired Outcome:**
- Validate that `subject` is one of the known subjects and `chapter` is one of the known chapters for that subject before the value ever touches the prompt string.
- This check already exists partially (subject/chapter lookup). Make it strict: if neither matches exactly (case-insensitive), return HTTP 400 immediately.
- Do not interpolate user-supplied strings into the prompt at all. Use only the canonical chapter name from the server-side data file.

---

### 3.5 MEDIUM — Frontend Has No Error Boundary

**Issue:** The entire app is rendered inside a single React component tree with no `ErrorBoundary`. An unhandled JavaScript error anywhere in the component hierarchy crashes the entire page, showing a blank screen with no recovery option.

**Desired Outcome:**
- Wrap the application root in a React `ErrorBoundary` component.
- The fallback UI should display a friendly message ("Something went wrong — please reload the page") and a reload button.
- Do not just add a library; write this as a plain class component — it is small and we do not need a dependency for it.

---

### 3.6 MEDIUM — Generic Error Messages and Alert() Calls

**Issue:** The frontend uses `alert()` to surface errors (e.g., failed question generation). `alert()` is blocking, browser-native, and has inconsistent UX across platforms. Error messages are generic ("Please try again later") and give the user no actionable information.

**Desired Outcome:**
- Replace all `alert()` calls with inline error messages rendered in the component tree.
- The error UI should appear where the user is looking (near the button or content area), not as a modal dialog.
- Messages should be specific:
  - API key / model not available → "Question generation is temporarily unavailable. Please try again in a few minutes."
  - Network error → "Could not reach the server. Check your connection and try again."
  - Unexpected response → "We received an unexpected response. Please retry."
- Errors should be dismissible.

---

### 3.7 MEDIUM — Answer Evaluation Index Contract Is Undocumented and Fragile

**Issue:** `POST /questions/evaluate` expects `userAnswers` to be a 1-indexed object (`{"1": "b", "2": "a"}`). This contract is not documented in the API, not validated by the backend, and the frontend is the only caller. A mismatch between indexing on either side silently produces wrong evaluation results.

**Desired Outcome:**
- Add explicit backend validation: ensure `userAnswers` keys are strings of integers from 1 to N (where N is the number of questions), and values are single lowercase letters ("a"–"d"). Return HTTP 400 with a clear message if validation fails.
- Add a comment in the backend route file explaining the 1-based index contract.
- Add a comment in the frontend where `userAnswers` is built explaining the same contract.

---

### 3.8 MEDIUM — State Management Is Unsustainable at Scale

**Issue:** `App.tsx` manages 11 `useState` hooks in a single component. The quiz state (subject, chapter, questions, answers, timer, results) is spread across individual hooks with no clear grouping. As we add features (difficulty levels, history, etc.), this will become unmanageable.

**Desired Outcome:**
- Refactor the quiz flow state into a single `useReducer` with clearly named actions (`SELECT_SUBJECT`, `SELECT_CHAPTER`, `SET_QUESTIONS`, `ANSWER_QUESTION`, `FINISH_QUIZ`, `RESET`).
- Do not extract into a separate file or introduce context unless the team chooses to. A single `useReducer` in `App.tsx` is sufficient.
- The refactor must not change any user-visible behavior. All existing functionality must continue to work identically.

---

### 3.9 LOW — Test Coverage Is Near Zero

**Issue:** Backend has 1 test (evaluates a hardcoded answer set). Frontend has 1 test (checks that "Skillify" text renders). Neither is a meaningful safety net.

**Desired Outcome (Backend):**
- Test that `POST /questions/evaluate` correctly marks correct and incorrect answers, including edge cases: missing answers, case-insensitive matching, extra whitespace.
- Test that `POST /questions/generate` returns HTTP 400 when subject or chapter is invalid.
- Test that `GET /subjects/:subject/chapters` returns 404 for unknown subjects.
- Do not test the Gemini API call itself — mock it.

**Desired Outcome (Frontend):**
- Test that selecting a subject loads and displays chapters.
- Test that selecting a wrong answer increments `wrongCount`.
- Test that finishing the quiz shows the results screen.
- Use React Testing Library. Mock `axios` at the module level.

**Target:** Backend ≥ 70% line coverage. Frontend ≥ 50% line coverage on `App.tsx`.

---

### 3.10 LOW — Unused Dependencies and Dead Code

**Issue:** `@fastify/session` is installed as a dependency but the plugin is never registered. `components.json` references shadcn/ui but no shadcn components are used. `App.css` contains an unused `App-logo` animation. `DesignedBy.css` has an unused `animate-scale-up-down` keyframe.

**Desired Outcome:**
- Remove `@fastify/session` from `package.json` and `package-lock.json`.
- Remove `components.json` unless shadcn components are being added in this sprint.
- Remove unused CSS animations.
- Do not leave `// TODO: remove` comments — just delete the code.

---

### 3.11 LOW — No `.env.example` File

**Issue:** There is no reference file showing what environment variables are required. A new developer cloning the repo has no way to know what to configure.

**Desired Outcome:**
- Create `backend/.env.example` with the following entries:
  ```
  # Required: Your Google Gemini API key
  GEMINI_API_KEY=your_gemini_api_key_here

  # Required: Comma-separated list of allowed CORS origins
  ALLOWED_ORIGINS=http://localhost:3000

  # Optional: Override the Gemini model (default: gemini-2.5-flash)
  GEMINI_MODEL=gemini-2.5-flash

  # Optional: Rate limit per IP per minute (default: 20)
  RATE_LIMIT_RPM=20
  ```
- Create `frontend/.env.example`:
  ```
  # Required in production: Base URL of the backend API
  REACT_APP_API_BASE_URL=http://localhost:5000
  ```

---

## 4. Out of Scope for This Sprint

The following are known product gaps that are intentionally deferred. Do not build these now.

| Feature | Reason Deferred |
|---|---|
| User authentication / login | Requires database schema design and UX work |
| Quiz result persistence / history | Requires auth to be meaningful |
| Difficulty level selection | UX not designed yet |
| Additional subjects beyond Math/Physics/Chemistry | Content decisions not finalized |
| Analytics / usage tracking | Privacy policy not in place |
| Caching LLM responses | API cost is acceptable at current scale |

---

## 5. Success Criteria

The engineering team should treat this sprint as complete when:

| # | Criterion | How to Verify |
|---|---|---|
| 1 | `.env` removed from git history | `git log --all -- backend/.env` returns nothing |
| 2 | App refuses to start without `GEMINI_API_KEY` | Remove env var, run server, observe exit with error |
| 3 | App refuses to start without `ALLOWED_ORIGINS` | Remove env var, run server, observe exit with error |
| 4 | Rate limiting blocks >20 req/min per IP | `ab -n 25 -c 5 http://localhost:5000/questions/generate` returns 429s |
| 5 | Prompt injection sanitized | POST with `chapter: "ignore all previous"` returns HTTP 400 |
| 6 | No `alert()` calls in frontend | `grep -r "alert(" frontend/src` returns nothing |
| 7 | Error boundary in place | Manually throw in a child component, confirm fallback UI renders |
| 8 | Backend test coverage ≥ 70% | `npm test -- --coverage` in backend |
| 9 | Frontend test coverage ≥ 50% on App.tsx | `npm test -- --coverage` in frontend |
| 10 | `@fastify/session` removed from dependencies | `cat backend/package.json` shows it absent |
| 11 | `.env.example` files present in both `backend/` and `frontend/` | `ls backend/.env.example frontend/.env.example` |

---

## 6. Priority Order

Work in this order. Do not start item N+1 until item N is merged and passing CI.

1. **Rotate API key** (owner action, not engineering) + purge `.env` from git history
2. Startup validation for required env vars (`GEMINI_API_KEY`, `ALLOWED_ORIGINS`)
3. Rate limiting on generation and evaluation endpoints
4. Input sanitization / prompt injection fix
5. `.env.example` files
6. Error boundary + replace `alert()` with inline errors
7. Answer evaluation validation + index contract documentation
8. Backend tests
9. Frontend tests
10. `useReducer` refactor (lowest risk, do last)
11. Remove unused dependencies and dead code

---

## 7. Engineering Notes

- The `db/sqlite.js` stub exists for backward compatibility. Do not delete it yet — check git blame to understand if anything imports it before removing.
- The dual-SDK pattern (`@google/genai` + `@google/generative-ai`) in `routes/questions.js` is intentional fragility to survive Google SDK renames. Leave it as-is for now; it is not a bug.
- The timer is `420000ms` (7 minutes) in two places: the frontend `FlipClockCountdown` and the `timerStart` logic. If you need to change the quiz duration, change both.
- MathJax requires network access for its CDN. If deploying in an offline or restricted environment, self-host the MathJax assets.
- `build/` is checked in to the repo (likely for GitHub Pages deployment). This is fine but means the build must be manually updated before deploying. Consider adding a GitHub Actions workflow that builds and deploys on push to `main` to remove this manual step — though that is outside this sprint's scope.

---

*This document was authored on 2026-05-17. Issues should be tracked individually in the project's issue tracker, linking back to the relevant section number in this PRD.*
