---
doc: prd
status: approved
---
<!-- Decision note: product decisions below were made by the agent under the learner's
     explicit delegation (2026-10-16). The learner may revise any of them. -->

# TeachBack — Product Requirements

TeachBack is a web app for developers who build with AI coding agents: it checks whether you can explain the code the AI wrote, maps your understanding line by line, and turns gaps into a learning prompt.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
1. **Arrive.** The Home page explains the idea in one sentence, shows a sample Ownership Map, and offers "Start a teach-back".
2. **Bring code.** On New Session the user pastes code (or picks one of three AI-written samples), optionally says what the code is supposed to do, and presses "Analyze".
3. **Get chunks.** TeachBack splits the code into 3–6 meaningful chunks, each with a title and one open question, and opens the Session screen.
4. **Explain back.** For the highlighted chunk, the user types an explanation in their own words and submits. They can ask for one hint or skip.
5. **See the verdict.** Within a few seconds they see Owned / Shaky / Blind spot, a 0–100 score, one-paragraph feedback, and the concepts they missed. The gutter beside those lines changes colour.
6. **Repeat** for each chunk; a progress rail shows where they are.
7. **Finish.** The Report shows the whole file painted by understanding, the overall ownership score, a per-chunk breakdown, and a "Teach me my blind spots" prompt they copy into their coding agent.
8. **Return.** The Library lists past sessions with scores and a trend; "Retake" starts a fresh attempt on the same code.

Success = the user finishes a session and can see, at a glance, which lines they own.
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

## Screens and Layout
| Route | Screen | Purpose |
|---|---|---|
| `/` | Home | Pitch, how-it-works in 3 steps, live-looking sample map, CTA. |
| `/new` | New Session | Code textarea with line numbers, language picker, "what it should do" field, sample picker cards, Analyze button. |
| `/session/[id]` | Teach-back | Left: code with heat gutter, active chunk outlined. Right: chunk question, answer box, Hint / Skip / Submit, verdict card. Top: progress rail of chunks. |
| `/session/[id]/report` | Ownership Map | Score dial, heat-painted code, per-chunk cards, blind-spot prompt with Copy, Retake + New buttons. |
| `/library` | Library | Session list (title, language, date, score, mini heat strip), score trend chart, empty state. |

A top navigation bar (logo, New, Library, AI-mode badge) is present on every screen.

## Look and Feel
- Editorial "lab notebook": warm paper background, ink-dark text, generous whitespace; dark mode is deep ink with the same accents.
- Serif display headings (Fraunces), clean sans body (IBM Plex Sans), monospace code (IBM Plex Mono).
- Heat palette: Owned = teal-green, Shaky = amber, Blind spot = coral red, Not yet asked = neutral grey. Always paired with a text label so colour isn't the only signal.
- Tone: encouraging coach. "Blind spot" not "wrong". Never shames.
- Avoid: generic purple-gradient AI-app look, chat bubbles.

## Features and Behavior

### Bringing code
- As a developer, I want to paste the code my agent wrote so that I can check myself on exactly that code.
  - [ ] Pasting 5–300 lines enables Analyze; under 5 or over 300 lines shows an inline message and Analyze stays disabled.
  - [ ] Picking a sample fills the textarea, title, language and intent.
  - [ ] Analyze shows a progress state ("Reading your code…") and then lands on the Session screen.

### Chunking and questions
- [ ] Code is split into 3–6 contiguous chunks covering the meaningful lines; each chunk has a short title, a line range, and one open question that asks *why/how*, not trivia.
- [ ] Each chunk stores hidden "key concepts" the grader looks for.

### Explaining back (the kernel)
- [ ] The active chunk's lines are outlined in the code panel; other chunks are dimmed slightly.
- [ ] Submitting an explanation of at least 15 characters returns a verdict: **Owned** (score ≥ 75), **Shaky** (40–74), or **Blind spot** (< 40), plus feedback and missed concepts.
- [ ] The gutter colour for that chunk's lines updates immediately to the verdict colour.
- [ ] **Hint** reveals one nudge (not the answer) and marks the chunk "hint used"; the score is capped at 85 when a hint was used.
- [ ] **Skip** marks the chunk Blind spot with score 0 and moves on.
- [ ] After a verdict, "Next chunk" advances; the progress rail shows each chunk's verdict colour; any chunk in the rail can be revisited and re-answered.

### Ownership Map report
- [ ] Overall score = average of chunk scores weighted by chunk line count, shown as a dial with a label (e.g. "You own 68% of this code").
- [ ] Full code rendered with every line painted by its chunk's verdict.
- [ ] Per-chunk cards: title, lines, verdict, the user's answer, feedback, missed concepts.
- [ ] "Teach me my blind spots" prompt lists the Shaky/Blind-spot chunks with their line ranges and missed concepts, framed as a request for the agent to *teach* (ask questions, not dump code). Copy button confirms "Copied".
- [ ] Retake creates a new session on the same code.

### Library and progress
- [ ] Lists every session newest-first with title, language, date, score (or "In progress"), and a mini heat strip.
- [ ] A trend chart of completed-session scores over time appears once there are ≥ 2 completed sessions.
- [ ] Each row links to the report (completed) or session (in progress); a row can be deleted with confirmation.

## States and Boundaries
- **First use / empty library** — Library shows a friendly empty state with "Try a sample" CTA.
- **No API key (demo mode)** — App works end-to-end with a deterministic offline grader; a "Demo grader" badge is visible in the nav and on verdict cards so nothing is passed off as AI.
- **AI call fails or is slow** — a loading state while grading; on failure, an inline error with "Try again" and "Use demo grader for this answer".
- **Unknown session id** — "Session not found" with link to Library.
- **Persistence** — sessions live in the browser's localStorage and survive reloads; clearing browser data clears them.
- **Answer too short** — Submit stays disabled under 15 characters with a hint "Explain in a sentence or two".

## Product Decisions
- Snippet-sized input (≤ 300 lines) — agent decision: keeps the demo legible and the AI call fast.
- Three-level verdict instead of pass/fail — agent decision: "shaky" is the most common and most useful real state.
- Gaps become a prompt for the coding agent — agent decision: ties the product back to the hackathon's flipped-interaction lesson and gives the user a next action.
- Demo grader shipped and labeled — agent decision: reviewers and users without a key can still see the full journey; never disguised as AI.

## What We're Building
All five screens above; paste or sample input; AI (or labeled demo) chunking and grading; hint/skip; live heatmap; report with weighted score and blind-spot prompt; local library with trend and retake.

## Deferred From the POC
- Focus retake of only red chunks — Retake of the whole snippet proves the loop.
- GitHub URL / diff import — paste covers the demo.
- Sharing a report link — needs a backend.

## Possible Later Enhancements
Team review mode before PR approval; spaced repetition of blind spots; VS Code extension that launches a teach-back on a selection.

## Non-Goals
- Not a code explainer — TeachBack never shows a full explanation before you try.
- Not a code reviewer — it judges your understanding, not code quality.
- No accounts.

## Open Questions
- None blocking. Whether the learner will use live AI or demo mode for the video can be decided at `6-ship`.
