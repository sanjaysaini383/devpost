import type { Chunk, Session, Verdict } from "./types";

export const HINT_CAP = 85;

export function verdictFor(score: number): Verdict {
  if (score >= 75) return "owned";
  if (score >= 40) return "shaky";
  return "gap";
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function applyHintCap(score: number, hintUsed: boolean): number {
  const s = clampScore(score);
  return hintUsed ? Math.min(s, HINT_CAP) : s;
}

export function chunkLength(chunk: Chunk): number {
  return chunk.endLine - chunk.startLine + 1;
}

/**
 * Overall ownership: chunk scores weighted by how many lines each chunk covers.
 * Unanswered chunks count as 0 so an unfinished session can't look better than it is.
 */
export function ownershipScore(session: Pick<Session, "chunks" | "answers">): number {
  const total = session.chunks.reduce((sum, c) => sum + chunkLength(c), 0);
  if (total === 0) return 0;
  const weighted = session.chunks.reduce(
    (sum, c) => sum + chunkLength(c) * (session.answers[c.id]?.score ?? 0),
    0,
  );
  return Math.round(weighted / total);
}

export type LineState = Verdict | "unasked" | "none";

/** One entry per code line (index 0 = line 1): the verdict of the chunk covering it. */
export function lineVerdicts(
  lineCount: number,
  session: Pick<Session, "chunks" | "answers">,
): LineState[] {
  const states: LineState[] = Array.from({ length: lineCount }, () => "none");
  for (const chunk of session.chunks) {
    const state: LineState = session.answers[chunk.id]?.verdict ?? "unasked";
    for (let line = chunk.startLine; line <= chunk.endLine && line <= lineCount; line++) {
      states[line - 1] = state;
    }
  }
  return states;
}

export function verdictCounts(session: Pick<Session, "chunks" | "answers">) {
  const counts = { owned: 0, shaky: 0, gap: 0, unasked: 0 };
  for (const c of session.chunks) {
    const v = session.answers[c.id]?.verdict;
    counts[v ?? "unasked"]++;
  }
  return counts;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  owned: "Owned",
  shaky: "Shaky",
  gap: "Blind spot",
};

export function scoreHeadline(score: number): string {
  if (score >= 80) return "You own this code.";
  if (score >= 60) return "Mostly yours, a few soft spots.";
  if (score >= 35) return "You can run it, but you couldn't defend it yet.";
  return "This code owns you — for now.";
}
