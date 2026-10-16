---
doc: spec
status: approved
---
<!-- Decision note: stack and architecture were chosen by the agent under the learner's
     explicit delegation (2026-10-16). Recorded with reasons so the learner can revise. -->

# TeachBack — Technical Spec

## How This Works, In Plain Language
TeachBack is one Next.js web app with two halves:

- **The pages** (Home, New, Session, Report, Library) run in your browser. They show the code, collect your explanations, and paint the heatmap. Your sessions are saved in the browser's **localStorage** — a small notebook the browser keeps for this one site — so nothing needs a database or an account.
- **Two small server routes** (`/api/analyze` and `/api/grade`) run on the Next.js server. They are the only place the AI API key lives. The browser sends code or an explanation; the server asks the AI model (Google Gemini, free tier) for a structured JSON answer (chunks + questions, or a verdict + feedback) and sends it back.

If there's no API key, the same routes answer with a **demo grader**: pre-written chunks for the three samples, simple line-based chunking for pasted code, and a concept-matching scorer. Every demo result is labelled `mode: "demo"` and the UI shows a "Demo grader" badge.

Why this shape: one project, one `npm run dev`, no database, and the key never reaches the browser.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. User opens `/new`, pastes code or picks a sample → `components/NewSessionForm.tsx` validates line count.
2. Analyze → `POST /api/analyze {code, language, intent, sampleId?}` → `lib/ai.ts#analyzeCode` (Gemini via `lib/llm.ts`) or `lib/demo.ts#demoAnalyze` → returns `{mode, title, chunks[]}`.
3. Browser builds a `Session` (`lib/session.ts#createSession`), saves it via `lib/storage.ts`, routes to `/session/[id]`.
4. User submits an explanation → `POST /api/grade {code, chunk, answer, hintUsed, intent}` → `lib/ai.ts#gradeAnswer` or `lib/demo.ts#demoGrade` → `{mode, score, verdict, feedback, missed[]}`; `lib/scoring.ts#applyHintCap` and `verdictFor` normalise it.
5. Session state updates → `components/CodeHeat.tsx` repaints the chunk's lines; storage saves.
6. Last chunk answered → `/session/[id]/report` computes `lib/scoring.ts#ownershipScore` and `lib/prompt.ts#blindSpotPrompt` from the stored session.
7. `/library` reads all sessions from storage, renders list + `components/TrendChart.tsx`.

## Stack
- **Next.js 16 (App Router) + React 19 + TypeScript 5** — https://nextjs.org/docs. One framework covers pages and server routes; easy optional deploy to Vercel.
- **@google/genai 2.30** — https://ai.google.dev/gemini-api/docs. `models.generateContent` with `responseMimeType: "application/json"` + `responseJsonSchema` (from zod via `z.toJSONSchema`), re-validated with zod. **Learner choice:** a free provider, because the learner has no Anthropic account.
- **@anthropic-ai/sdk 0.135** (optional) — used only if `ANTHROPIC_API_KEY` is set and `GEMINI_API_KEY` is not.
- **Model:** `gemini-flash-latest` by default (override with `GEMINI_MODEL`); `claude-opus-5-5` when using Claude.
- **zod 4** — https://zod.dev. Schemas for AI output and request bodies.
- **Plain CSS** with design tokens in `app/globals.css` (no Tailwind) — full control over the editorial look.
- **Fonts via `next/font/google`**: Fraunces, IBM Plex Sans, IBM Plex Mono.
- **tsx + node:test** for unit tests of pure logic (`lib/*.test.ts`).
- Syntax highlighting: a tiny hand-written tokenizer (`lib/highlight.ts`) for keywords/strings/comments/numbers — avoids a dependency and keeps per-line rendering simple for the heat gutter.

## Where It Runs and How Someone Tries It
- Node.js 20+. `npm install`, then `npm run dev`, open http://localhost:3000.
- Optional live AI: copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` (free from https://aistudio.google.com/apikey). Without it the app runs in demo mode.
- Demo recording: Home → New → pick "Rate limiter" sample → Analyze → answer chunks (one good, one vague, one skip) → Report → Copy prompt → Library.
- Deployment optional (Vercel: import repo, add `GEMINI_API_KEY` env var).

## Look and Feel
From `prd.md > Look and Feel`.
- Tokens on `:root`: `--paper #f6f1e7`, `--ink #1d1b16`, `--muted #6b6458`, `--line #e2d9c6`, `--card #fffaf0`, `--accent #1f6f5c`; heat `--owned #2f9e7a`, `--shaky #e0a526`, `--gap #e0533d`, `--unasked #cfc6b3`. Dark mode under `prefers-color-scheme: dark` swaps to ink background `#15140f`, paper text.
- Fraunces for h1/h2 and the score dial number; Plex Sans body 16px; Plex Mono 13.5px code.
- Cards with 1px warm borders and soft shadow, 14px radius. Max content width 1200px; session screen is a two-column grid that stacks under 900px.
- Verdict always shown as colour + icon + word.

## Components

### Pages (`app/`)
- `app/page.tsx` — Home. PRD ref: `prd.md > Screens and Layout`.
- `app/new/page.tsx` → `components/NewSessionForm.tsx`. PRD ref: `prd.md > Bringing code`.
- `app/session/[id]/page.tsx` → `components/SessionView.tsx`. PRD ref: `prd.md > Explaining back (the kernel)`.
- `app/session/[id]/report/page.tsx` → `components/ReportView.tsx`. PRD ref: `prd.md > Ownership Map report`.
- `app/library/page.tsx` → `components/LibraryView.tsx`. PRD ref: `prd.md > Library and progress`.
- `app/layout.tsx` — fonts, `components/NavBar.tsx` (with mode badge from `GET /api/status`).

### API routes (`app/api/`)
- `analyze/route.ts` — validates body with zod, calls AI or demo. PRD ref: `prd.md > Chunking and questions`.
- `grade/route.ts` — validates, calls AI or demo; `?demo=1` forces demo. PRD ref: `prd.md > Explaining back (the kernel)`.
- `status/route.ts` — `{ ai: boolean }`.

### Shared UI
- `CodeHeat.tsx` — renders code lines with number, heat gutter, highlight, active-chunk outline. Used by Session, Report, Home sample.
- `VerdictCard.tsx`, `ProgressRail.tsx`, `ScoreDial.tsx`, `TrendChart.tsx` (inline SVG), `HeatStrip.tsx` (mini bar for library rows).

### Logic (`lib/`)
- `types.ts` — `Chunk`, `Answer`, `Session`, `Verdict`.
- `ai.ts` — Anthropic client, `analyzeCode`, `gradeAnswer`, zod schemas, `hasApiKey`.
- `demo.ts` — `demoAnalyze`, `demoGrade`, `heuristicChunks`.
- `samples.ts` — three AI-written samples with authored chunks, questions, concepts, hints.
- `scoring.ts` — `verdictFor`, `applyHintCap`, `ownershipScore`, `lineVerdicts`.
- `prompt.ts` — `blindSpotPrompt`.
- `session.ts` — `createSession`, `recordAnswer`, `nextUnanswered`, `isComplete`.
- `storage.ts` — localStorage wrapper with try/catch and a `useSessions`/`useSession` hook.
- `highlight.ts` — minimal tokenizer.

## Data Model
```ts
type Verdict = "owned" | "shaky" | "gap";
interface Chunk { id: string; title: string; startLine: number; endLine: number; // 1-based inclusive
  question: string; concepts: string[]; hint: string; }
interface Answer { text: string; score: number; verdict: Verdict; feedback: string;
  missed: string[]; hintUsed: boolean; skipped: boolean; mode: "ai" | "demo"; at: string; }
interface Session { id: string; title: string; language: string; intent: string; code: string;
  sampleId?: string; mode: "ai" | "demo"; chunks: Chunk[]; answers: Record<string, Answer>;
  hintsShown: string[]; createdAt: string; completedAt?: string; }
```
- Lives in localStorage key `teachback.sessions.v1` as an array. Written on every answer; read on every page load. Survives reloads; cleared with browser data.
- Concepts and hints are sent to the browser (needed for hint + demo); acceptable for a self-check tool.

## File Structure
```
teachback/
├── app/
│   ├── layout.tsx              # fonts, nav, theme
│   ├── globals.css             # tokens + all styles
│   ├── page.tsx                # / Home
│   ├── new/page.tsx            # /new
│   ├── session/[id]/page.tsx   # /session/:id  teach-back loop
│   ├── session/[id]/report/page.tsx  # /session/:id/report
│   ├── library/page.tsx        # /library
│   └── api/{analyze,grade,status}/route.ts
├── components/                 # UI pieces listed under Components
├── lib/                        # logic listed under Components > Logic (+ *.test.ts)
├── devpost/                    # planning docs (learner-profile.md is git-ignored)
├── .env.example                # GEMINI_API_KEY= (ANTHROPIC_API_KEY optional)
├── package.json, tsconfig.json, next.config.ts
└── README.md
```

## External Services and Dependencies
**Google Gemini API (default, free tier)**: https://ai.google.dev/gemini-api/docs
- Call: `ai.models.generateContent({ model, contents: user, config: { systemInstruction, responseMimeType: "application/json", responseJsonSchema, temperature: 0.2 } })`, then `JSON.parse(response.text)` and validate with zod.
- Key: `GEMINI_API_KEY` from Google AI Studio, server-side only. Free tier, no card. Rate limits are roughly 10 requests/min on Flash models (per third-party guides; check in AI Studio). Free-tier prompts may be used by Google to improve products.
- Errors: 429 → "rate limit, wait a minute"; 400/401/403 with a key message → "key rejected"; 404 → "check GEMINI_MODEL".

**Anthropic Messages API (optional)**: https://platform.claude.com/docs. Used only when `ANTHROPIC_API_KEY` is set and no Gemini key is: `client.beta.messages.parse` with `betaZodOutputFormat`, `fallbacks: "default"`.

Both providers return the same shapes. Analyze returns `{ title, chunks: [{ title, startLine, endLine, question, concepts[], hint }] }`. Grade returns `{ score 0-100, feedback, missed[] }`, and the verdict is derived locally.

## Important Failure Modes
- **AI call fails / refuses / times out** → route returns 502 with message; Session shows "Try again" + "Use demo grader".
- **AI returns bad line ranges** → `lib/ai.ts` clamps ranges to the file, sorts, removes overlaps; if fewer than 2 chunks survive, falls back to `heuristicChunks`.
- **localStorage unavailable** (private mode) → in-memory fallback; banner says sessions won't be saved.

## What Was Simplified and Why
- **localStorage** instead of a database — single-user proof; a backend would add infra without proving the kernel.
- **Demo grader** instead of requiring a key — reviewers can see the full loop; clearly labelled, AI path is the real product.
- **Hand-written highlighter** instead of Shiki/Prism — per-line control for the heat gutter, zero config.
- **Whole-snippet retake** instead of focus-retake — deferred per PRD.

## Decisions and Open Issues
- All stack choices above are agent decisions under delegation; rationale given inline.
- Genuine uncertainty (agent-side, since the learner didn't raise one): does the model return reliable 1-based line ranges? Investigation: the clamp/repair step plus a unit test on `repairChunks`, and a live check if a key is present.
- Open: none blocking.
