---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner asked the agent to build autonomously and commit as it goes)

## Slices

- [x] **1. You can explain a sample back and watch its lines change colour**
  Becomes usable: `/new` → pick a sample → Analyze → `/session/[id]` shows the code with a heat gutter, one question per chunk; submitting an answer returns a demo verdict and repaints those lines. Sessions persist in localStorage.
  Why now: This is the kernel (`scope.md > The Unique Kernel`). Proving the explain → verdict → heat loop first means every later slice decorates something that already works. Includes the scaffold.
  PRD ref: `prd.md > Bringing code`, `prd.md > Explaining back (the kernel)`, `prd.md > The Core Journey` (steps 2–6)
  Spec ref: `spec.md > Components`, `spec.md > Data Model`, `spec.md > File Structure`
  Build: Next.js config, layout, globals.css tokens, NavBar; lib types/samples/demo/scoring/session/storage/highlight; `/api/analyze` + `/api/grade` (demo path); NewSessionForm; SessionView with CodeHeat, ProgressRail, VerdictCard, hint/skip.
  Verify (mechanical): `npm run typecheck`, `npm test` (scoring, demo grade, chunk repair), `npm run build`; run the server and `curl` `/api/analyze` and `/api/grade` with sample payloads.
  Learner check: Open http://localhost:3000/new, pick "Rate limiter", Analyze, answer the first chunk well and the second vaguely, and see one turn green and one amber/red.
  Commit: `Add teach-back loop with heat-painted code (demo grader)`

- [x] **2. Claude does the chunking and grading for real**
  Becomes usable: With `ANTHROPIC_API_KEY` set, any pasted code is chunked and graded by Claude Opus 5.5; the nav shows "AI grader" vs "Demo grader"; failures show Try again / Use demo grader.
  Why now: The live AI is the riskiest dependency; wire it right after the loop exists so its shape is verified before more UI depends on it.
  PRD ref: `prd.md > Chunking and questions`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`, `spec.md > Components > API routes`
  Build: `lib/ai.ts` with zod schemas, `beta.messages.parse`, fallbacks, refusal checks, range repair; `/api/status`; mode badge; error UI.
  Verify (mechanical): typecheck + tests; `curl /api/status`; without a key, analyze/grade return `mode: "demo"`; with a key (if available) analyze returns ≥2 valid chunks.
  Learner check: Paste your own code into `/new` and confirm it gets sensible chunks and questions.
  Commit: `Wire Claude Opus 5.5 analysis and grading with demo fallback`

- [x] **3. You get your Ownership Map and a blind-spot prompt**
  Becomes usable: `/session/[id]/report` with score dial, fully painted code, per-chunk cards, copyable "Teach me my blind spots" prompt, Retake.
  Why now: Completes the core journey end to end — the moment the demo video builds toward.
  PRD ref: `prd.md > Ownership Map report`
  Spec ref: `spec.md > Components > Pages`, `spec.md > Components > Logic` (`scoring.ts`, `prompt.ts`)
  Build: ReportView, ScoreDial, blindSpotPrompt, retake.
  Verify (mechanical): tests for `ownershipScore` + `blindSpotPrompt`; build; load the report route.
  Learner check: Finish a session and copy the prompt into your coding agent.
  Commit: `Add Ownership Map report and blind-spot prompt`

- [x] **4. Your sessions live in a library with a progress trend**
  Becomes usable: `/library` lists sessions with mini heat strips and scores, trend chart, delete, empty state.
  Why now: Gives the "come back and improve" half of the loop.
  PRD ref: `prd.md > Library and progress`
  Spec ref: `spec.md > Components > Shared UI` (`TrendChart`, `HeatStrip`)
  Build: LibraryView, TrendChart, HeatStrip, delete confirm.
  Verify (mechanical): build; load `/library` in empty and populated states.
  Learner check: Do two sessions and see both in the library with a trend line.
  Commit: `Add session library with score trend`

- [x] **5. The front door explains it in five seconds**
  Becomes usable: Home page with pitch, 3-step how-it-works and an animated sample map; not-found states; responsive and dark mode polish.
  Why now: Presentation matters for judging, but only once everything it advertises works.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Look and Feel`
  Build: Home page, not-found handling, README with run instructions.
  Verify (mechanical): `npm run build` passes; every route returns 200 from the production server.
  Learner check: Open the home page on desktop and phone width.
  Commit: `Add landing page, empty states and README`

- [x] **6. You can say your explanation out loud**
  Becomes usable: A mic button on the Session screen turns speech into answer text live; unsupported browsers and blocked mics degrade to typing with a clear message.
  Why now: Added after the core build at the learner's request; it rides on the finished answer box and changes nothing else in the loop.
  PRD ref: `prd.md > Speaking an answer (voice)`
  Spec ref: `spec.md > Components > Voice input`, `spec.md > Important Failure Modes`
  Build: `lib/speech.ts` (feature detection + minimal types), `components/VoiceButton.tsx`, wire into `SessionView.tsx`, styles.
  Verify (mechanical): typecheck + build; e2e with a fake SpeechRecognition confirms the interim text shows, the final text lands in the answer box, and the answer grades; e2e without speech support confirms the button is disabled.
  Learner check: In Chrome, open a session, press the mic, explain the chunk out loud, and see your words appear; then submit.
  Commit: `Add voice answers with the Web Speech API`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1 (learner to try the sample loop)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Not yet done with the learner (autonomous build). Agent-side verification: 11 unit tests, `scripts/smoke.ts` (11 checks), `scripts/e2e.ts` full browser journey in light + dark, mobile overflow check.
Route and stops: Reference route only, documented in app-map.html: `components/SessionView.tsx#submit` → `app/api/grade/route.ts` → `lib/ai.ts#gradeAnswer` / `lib/demo.ts#demoGrade` → `lib/session.ts#recordAnswer` → `components/CodeHeat.tsx` + `lib/scoring.ts#lineVerdicts`.
Edit outcome: not offered yet
Reflection: not offered yet
Activity mode: pending learner

## Revisions

- Live AI grading verified only up to authentication (fake key → clean "API key was rejected" error and demo fallback); no real ANTHROPIC_API_KEY was available during the build, so a real Opus 5.5 response shape is still to be checked by the learner before recording.
- Analyze also got a "Continue with demo grader" fallback (PRD only specified it for grading) — an analyze failure would otherwise dead-end the journey.
- Switched the default AI provider from Claude to Google Gemini's free tier (`lib/llm.ts`). The learner has no Anthropic account and asked for a free alternative. Claude stays available as an optional provider. Verified up to authentication with a fake key ("The Gemini API key was rejected."). A real Gemini response still needs checking once the learner adds a key.
- Live Gemini check passed (2026-10-16): with the learner's key, analyze produced sensible why/how chunks for pasted code, strong vs vague answers scored 100/owned vs 30/gap, and `npm run e2e` passed end to end with AI grading. The free-tier Flash models were often overloaded (503/429), so the default became `gemini-3.5-flash-lite` (reliable at about 6s), with a fallback chain, a sticky last-good model, and SDK auto-retries turned off (they had pushed grading to about 17s).
