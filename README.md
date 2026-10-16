# TeachBack

**Your AI wrote it. Can you explain it?**

TeachBack checks whether you actually understand code an AI coding agent wrote for you. Paste the code, explain each important chunk back in your own words, and get an **Ownership Map**: every line painted *owned*, *shaky* or *blind spot*. Your gaps then become a ready-to-paste prompt that asks your coding agent to **teach you**, instead of writing more code.

It's the *teach-back* method nurses use to confirm a patient understood their instructions, applied to AI pair programming.

![Ownership Map report](docs/report.png)

## The journey

| Route | What happens |
|---|---|
| `/` | Landing page with a live preview of a session painting itself. |
| `/new` | Paste 5–300 lines of code (or pick one of three AI-written samples), optionally say what it should do, then **Analyze**. |
| `/session/[id]` | The teach-back loop. The code sits on the left with a heat gutter; one review-style question per chunk sits on the right. Submit an explanation, take a hint (score capped at 85), or skip. Each verdict repaints its lines straight away. |
| `/session/[id]/report` | The Ownership Map: a weighted score dial, the code painted by understanding, per-chunk feedback with missed concepts, a copyable **"Teach me my blind spots"** prompt, and **Retake**. |
| `/library` | Every session, with mini heat strips, scores, a trend chart of your ownership over time, and delete. |

| Teach-back session | Library and progress |
|---|---|
| ![Session](docs/session.png) | ![Library](docs/library.png) |

## How it works

- **Next.js 16 (App Router), React 19, TypeScript.** Pages run in the browser, and sessions are saved in `localStorage`, so there's no account and no database.
- **`/api/analyze`** asks **Claude Opus 5.5** to split the code into 3–6 meaningful chunks. Each chunk gets a *why/how* question, rubric concepts and a hint. The output is a schema-validated JSON response (`client.beta.messages.parse` with a zod schema), and the line ranges are repaired server-side so the UI can trust them.
- **`/api/grade`** asks Claude to grade one explanation against that chunk's rubric. It judges meaning, not vocabulary, and returns a 0–100 score, coaching feedback and missed concepts. The learner's text is fenced off and treated only as an answer, never as instructions.
- **Demo grader:** without an API key, the same routes answer with an offline keyword-matching grader and curated sample chunks. The nav badge and every verdict say **"Demo grader"**, so nothing pretends to be AI.
- The API key stays server-side. Requests use server-side refusal fallback, and errors map to friendly messages with *Try again* and *Use demo grader*.

```
browser ──/new──▶ POST /api/analyze ──▶ Claude (chunks + questions) ──▶ session saved in localStorage
        ──answer─▶ POST /api/grade   ──▶ Claude (score + feedback)  ──▶ heat gutter repaints
        ──report─▶ ownershipScore() + blindSpotPrompt()  (pure functions in lib/)
```

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:3000
```

For live AI grading, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`, then restart. Without it, the app runs end to end in labelled demo mode.

### Checks

```bash
npm test             # unit tests: scoring, demo grader, chunk repair, prompt, highlighter
npm run typecheck
npm run build && npm start
npm run smoke        # API + route smoke test against a running server (BASE_URL, default :3000)
npm run e2e          # Playwright walk-through of the whole journey; screenshots to docs/screenshots
                     # (first time: npx playwright install chromium)
```

## Built with the Devpost Learn Skill Pack

This project was planned and built with the [Devpost Learn skill pack](https://github.com/challengepost/learn-ai-basics) for [Build With AI: Basics](https://learn-ai-basics.devpost.com/). The planning documents it produced are in [`devpost/`](devpost/):

- [`scope.md`](devpost/scope.md): the kernel, the user, and the proof-of-concept boundary
- [`prd.md`](devpost/prd.md): the journey, behaviours, acceptance criteria and states
- [`spec.md`](devpost/spec.md): stack, components, data model and failure modes
- [`checklist.md`](devpost/checklist.md): the slice-by-slice build plan, with revisions

## Project layout

```
app/            routes: / · /new · /session/[id] · /session/[id]/report · /library · /api/{analyze,grade,status}
components/     CodeHeat (heat-painted code), SessionView, ReportView, LibraryView, ScoreDial, TrendChart, …
lib/            ai.ts (Claude), demo.ts (offline grader), samples.ts, scoring.ts, prompt.ts, session.ts, storage.ts
scripts/        smoke.ts, e2e.ts
devpost/        planning docs from the skill pack
```
