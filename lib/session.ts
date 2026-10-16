import type { Answer, AnalyzeResponse, Chunk, GradeResponse, Session } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function createSession(
  input: { code: string; language: string; intent: string; sampleId?: string },
  analysis: AnalyzeResponse,
  title?: string,
): Session {
  return {
    id: newId(),
    title: title?.trim() || analysis.title,
    language: input.language,
    intent: input.intent,
    code: input.code,
    sampleId: input.sampleId,
    mode: analysis.mode,
    chunks: analysis.chunks,
    answers: {},
    hintsShown: [],
    createdAt: new Date().toISOString(),
  };
}

export function retakeSession(old: Session): Session {
  return {
    ...old,
    id: newId(),
    answers: {},
    hintsShown: [],
    createdAt: new Date().toISOString(),
    completedAt: undefined,
  };
}

export function recordAnswer(
  session: Session,
  chunk: Chunk,
  text: string,
  result: GradeResponse,
  opts: { skipped?: boolean } = {},
): Session {
  const answer: Answer = {
    text,
    score: result.score,
    verdict: result.verdict,
    feedback: result.feedback,
    missed: result.missed,
    hintUsed: session.hintsShown.includes(chunk.id),
    skipped: !!opts.skipped,
    mode: result.mode,
    at: new Date().toISOString(),
  };
  const answers = { ...session.answers, [chunk.id]: answer };
  const done = session.chunks.every((c) => answers[c.id]);
  return {
    ...session,
    answers,
    completedAt: done ? (session.completedAt ?? new Date().toISOString()) : session.completedAt,
  };
}

export function skipResult(chunk: Chunk): GradeResponse {
  return {
    mode: "demo",
    score: 0,
    verdict: "gap",
    feedback: "Skipped. That's honest — this is now on your blind-spot list.",
    missed: chunk.concepts,
  };
}

export function markHint(session: Session, chunkId: string): Session {
  if (session.hintsShown.includes(chunkId)) return session;
  return { ...session, hintsShown: [...session.hintsShown, chunkId] };
}

export function nextUnanswered(session: Session, afterId?: string): Chunk | undefined {
  const idx = afterId ? session.chunks.findIndex((c) => c.id === afterId) : -1;
  const ordered = [...session.chunks.slice(idx + 1), ...session.chunks.slice(0, idx + 1)];
  return ordered.find((c) => !session.answers[c.id]);
}

export function isComplete(session: Session): boolean {
  return session.chunks.length > 0 && session.chunks.every((c) => session.answers[c.id]);
}
