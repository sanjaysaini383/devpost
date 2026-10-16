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
- **Two small server routes** (`/api/analyze` and `/api/grade`) run on the Next.js server. They are the only place the Anthropic API key lives. The browser sends code or an explanation; the server asks Claude for a structured JSON answer (chunks + questions, or a verdict + feedback) and sends it back.

If there's no API key, the same routes answer with a **demo grader**: pre-written chunks for the three samples, simple line-based chunking for pasted code, and a concept-matching scorer. Every demo result is labelled `mode: "demo"` and the UI shows a "Demo grader" badge.

Why this shape: one project, one `npm run dev`, no database, and the key never reaches the browser.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. User opens `/new`, pastes code or picks a sample → `components/NewSessionForm.tsx` validates line count.
2. Analyze → `POST /api/analyze {code, language, intent, sampleId?}` → `lib/ai.ts#analyzeCode` (Claude) or `lib/demo.ts#demoAnalyze` → returns `{mode, title, chunks[]}`.
3. Browser builds a `Session` (`lib/session.ts#createSession`), saves it via `lib/storage.ts`, routes to `/session/[id]`.
4. User submits an explanation → `POST /api/grade {code, chunk, answer, hintUsed, intent}` → `lib/ai.ts#gradeAnswer` or `lib/demo.ts#demoGrade` → `{mode, score, verdict, feedback, missed[]}`; `lib/scoring.ts#applyHintCap` and `verdictFor` normalise it.
5. Session state updates → `components/CodeHeat.tsx` repaints the chunk's lines; storage saves.
6. Last chunk answered → `/session/[id]/report` computes `lib/scoring.ts#ownershipScore` and `lib/prompt.ts#blindSpotPrompt` from the stored session.
7. `/library` reads all sessions from storage, renders list + `components/TrendChart.tsx`.

## Stack
- **Next.js 16 (App Router) + React 19 + TypeScript 5** — https://nextjs.org/docs. One framework covers pages and server routes; easy optional deploy to Vercel.
- **@anthropic-ai/sdk 0.135** — https://github.com/anthropics/anthropic-sdk-typescript. `client.beta.messages.parse` with `betaZodOutputFormat` for schema-validated JSON, `fallbacks: "default"` for refusal fallback.
- **Model: `claude-opus-5-5`**, adaptive thinking (default), `output_config.effort` = `medium` for analysis, `low` for grading (fast feedback).
- **zod 4** — https://zod.dev. Schemas for AI output and request bodies.
- **Plain CSS** with design tokens in `app/globals.css` (no Tailwind) — full control over the editorial look.
- **Fonts via `next/font/google`**: Fraunces, IBM Plex Sans, IBM Plex Mono.
- **tsx + node:test** for unit tests of pure logic (`lib/*.test.ts`).
- Syntax highlighting: a tiny hand-written tokenizer (`lib/highlight.ts`) for keywords/strings/comments/numbers — avoids a dependency and keeps per-line rendering simple for the heat gutter.

## Where It Runs and How Someone Tries It
- Node.js 20+. `npm install`, then `npm run dev`, open http://localhost:3000.
- Optional live AI: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. Without it the app runs in demo mode.
- Demo recording: Home → New → pick "Rate limiter" sample → Analyze → answer chunks (one good, one vague, one skip) → Report → Copy prompt → Library.
- Deployment optional (Vercel: import repo, add `ANTHROPIC_API_KEY` env var).

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
├── .env.example                # ANTHROPIC_API_KEY=
├── package.json, tsconfig.json, next.config.ts
└── README.md
```

## External Services and Dependencies
**Anthropic Messages API** — https://platform.claude.com/docs
- Call: `client.beta.messages.parse({ model: "claude-opus-5-5", max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort, format: betaZodOutputFormat(Schema) }, system, messages })`.
- Analyze output: `{ title, chunks: [{ title, startLine, endLine, question, concepts[3-5], hint }] }` (3–6 chunks).
- Grade output: `{ score 0-100, feedback, missed[] }`; verdict derived locally.
- Key: `ANTHROPIC_API_KEY` server-side only. Cost: Opus 5.5 $4/$20 per MTok — a session is a handful of short calls.
- Check `stop_reason === "refusal"` and null `parsed_output` → treat as failure (UI offers demo grader).

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
- Genuine uncertainty (agent-side, since the learner didn't raise one): does Opus 5.5 return reliable 1-based line ranges? Investigation: the clamp/repair step plus a unit test on `repairChunks`, and a live check if a key is present.
- Open: none blocking.
