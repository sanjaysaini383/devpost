export type Verdict = "owned" | "shaky" | "gap";
export type GraderMode = "ai" | "demo";

/** A contiguous slice of the code the learner must explain. Lines are 1-based, inclusive. */
export interface Chunk {
  id: string;
  title: string;
  startLine: number;
  endLine: number;
  question: string;
  concepts: string[];
  hint: string;
}

export interface Answer {
  text: string;
  score: number;
  verdict: Verdict;
  feedback: string;
  missed: string[];
  hintUsed: boolean;
  skipped: boolean;
  mode: GraderMode;
  at: string;
}

export interface Session {
  id: string;
  title: string;
  language: string;
  intent: string;
  code: string;
  sampleId?: string;
  mode: GraderMode;
  chunks: Chunk[];
  answers: Record<string, Answer>;
  hintsShown: string[];
  createdAt: string;
  completedAt?: string;
}

export interface AnalyzeRequest {
  code: string;
  language: string;
  intent: string;
  sampleId?: string;
}

export interface AnalyzeResponse {
  mode: GraderMode;
  title: string;
  chunks: Chunk[];
}

export interface GradeRequest {
  code: string;
  language: string;
  intent: string;
  sampleId?: string;
  chunk: Chunk;
  answer: string;
  hintUsed: boolean;
}

export interface GradeResponse {
  mode: GraderMode;
  score: number;
  verdict: Verdict;
  feedback: string;
  missed: string[];
}
