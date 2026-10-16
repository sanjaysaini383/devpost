---
doc: scope
status: approved
---
<!-- Decision note: the learner delegated idea selection and scoping to the agent
     ("make a project by own"). Every choice below was made by the agent under that
     delegation on 2026-10-16. Approval = the learner's instruction to proceed. -->

# TeachBack

Prove you understand the AI-written code you're about to ship — by explaining it back.

## The Unique Kernel
**The Ownership Map.** You paste code an AI wrote for you; TeachBack splits it into meaningful chunks and asks you to explain each one in your own words. An AI grader judges each explanation, and every line of the code gets painted by how well *you* understood it — owned, shaky, or blind spot. Your gaps then become a ready-to-paste prompt you hand back to your coding agent so it teaches you, instead of writing more code.

It's "teach-back" — the technique nurses use to confirm a patient really understood instructions — applied to AI pair programming. Code tools explain code *to* you; TeachBack makes you explain it and measures the result.

## Who It's For
A beginner-to-intermediate developer building with Claude Code, Cursor, or Codex — like the 3,800 people in this hackathon — who has a working feature the agent wrote and a nagging feeling they couldn't explain it in a code review. Today they either ship it anyway, or ask the AI "explain this" and passively read a wall of text that doesn't stick.

## The Core Loop
Paste a snippet → answer one question per chunk in plain words → see the verdict and the line heat update instantly → finish and get the Ownership Map plus a "teach me my blind spots" prompt → come back after learning and re-run to watch the map turn green.

## Inspiration & Identity
- The teach-back method in healthcare (https://www.ahrq.gov/health-literacy/improve/precautions/tool5.html).
- The Build With AI: Basics premise: AI "hands back code that works but you can't explain" (https://learn-ai-basics.devpost.com/).
- Feel: a calm, editorial lab notebook — warm paper, ink, a heatmap that feels like a code-coverage report for your brain. Encouraging, never scolding.

## Why This Matters to the Learner
They want a submission that stands out to Devpost Learn judges. TeachBack is built directly around the problem this hackathon names, and it has a visual "oh, that's cool" moment that reads well in a short video.

## What "Working" Looks Like
Open TeachBack → pick a sample (or paste code) → answer 3–5 chunk questions → each answer gets an instant verdict with feedback and the gutter heat for those lines changes colour → finish → the report shows the whole file painted green/amber/red, an ownership score, and a copyable blind-spot prompt → the library lists the session and the score trend.

The "oh, that's cool" beat: the moment a vague answer turns a block of lines red, and a sharp answer flips it green.

## The POC Boundary
- Paste code or choose one of three built-in AI-written samples.
- AI chunking + one question per chunk (Claude), with a clearly labeled offline demo grader when no API key is set.
- Per-chunk grading: verdict, score, feedback, missed concepts; one hint per chunk; skip.
- Live line heatmap during the session; full Ownership Map report; blind-spot prompt with copy.
- Local history (library) with score trend and "retake".
- Five screens: Home, New Session, Teach-back Session, Report, Library.

## Later
- Re-ask only the red chunks ("focus retake").
- Import directly from a GitHub file URL or a git diff.
- Team mode: reviewers send a TeachBack link before approving a PR.
- Spaced repetition of blind spots across sessions.

## Explicitly Cut
- **Accounts / cloud sync** — localStorage is enough to prove the loop; auth adds no proof of the kernel.
- **Whole-repository analysis** — a snippet makes the demo legible in a minute; repo scale is a different product.
- **Voice answers** — nice, but typing proves the same thing with far less risk.
- **IDE extension** — distribution question, not a proof-of-concept question.
