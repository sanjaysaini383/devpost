import { ownershipScore, VERDICT_LABEL } from "./scoring";
import type { Session } from "./types";

/**
 * Turns the learner's weak chunks into a prompt for their coding agent that asks it to
 * TEACH (flipped interaction: the agent quizzes them) rather than write more code.
 */
export function blindSpotPrompt(session: Session): string {
  const lines = session.code.split("\n");
  const weak = session.chunks.filter((c) => {
    const v = session.answers[c.id]?.verdict;
    return v === "shaky" || v === "gap" || !v;
  });

  if (weak.length === 0) {
    return [
      `I just explained every part of "${session.title}" back and owned it (${ownershipScore(session)}%).`,
      `Don't explain it to me. Ask me two hard "what if" questions about edge cases or changes to this code, one at a time, and tell me whether my answers hold up.`,
      "",
      "```" + session.language,
      session.code,
      "```",
    ].join("\n");
  }

  const sections = weak.map((c) => {
    const a = session.answers[c.id];
    const status = a ? VERDICT_LABEL[a.verdict] : "Not answered";
    const excerpt = lines.slice(c.startLine - 1, c.endLine).join("\n");
    const missed = (a?.missed.length ? a.missed : c.concepts).map((m) => `  - ${m}`).join("\n");
    return [
      `### Lines ${c.startLine}–${c.endLine}: ${c.title} (${status})`,
      "```" + session.language,
      excerpt,
      "```",
      `Ideas I'm missing:`,
      missed,
    ].join("\n");
  });

  return [
    `You wrote the code below for me ("${session.title}"). I tested myself with TeachBack and I can't fully explain ${weak.length} part${weak.length > 1 ? "s" : ""} of it yet.`,
    "",
    "Teach me — don't rewrite the code and don't dump a full explanation. For each part below:",
    "1. Ask me one question at a time to find out what I already understand.",
    "2. Explain only the piece I'm missing, with a tiny concrete example.",
    "3. Have me explain it back in one or two sentences before moving on.",
    "",
    ...sections.flatMap((s) => [s, ""]),
    "Start with the first part.",
  ].join("\n");
}
