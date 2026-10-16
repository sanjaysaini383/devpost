import { z } from "zod";

export const MIN_LINES = 5;
export const MAX_LINES = 300;
export const MIN_ANSWER = 15;

export const ChunkSchema = z.object({
  id: z.string().min(1).max(20),
  title: z.string().max(200),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  question: z.string().max(1000),
  concepts: z.array(z.string().max(300)).max(8),
  hint: z.string().max(500),
});

export const AnalyzeBody = z.object({
  code: z
    .string()
    .max(40_000)
    .refine((c) => {
      const n = c.trim().split("\n").length;
      return n >= MIN_LINES && n <= MAX_LINES;
    }, `Code must be between ${MIN_LINES} and ${MAX_LINES} lines`),
  language: z.string().max(40).default("typescript"),
  intent: z.string().max(1000).default(""),
  sampleId: z.string().max(40).optional(),
});

export const GradeBody = z.object({
  code: z.string().max(40_000),
  language: z.string().max(40).default("typescript"),
  intent: z.string().max(1000).default(""),
  sampleId: z.string().max(40).optional(),
  chunk: ChunkSchema,
  answer: z.string().trim().min(MIN_ANSWER, "Explain in a sentence or two").max(4000),
  hintUsed: z.boolean().default(false),
});

export function lineCount(code: string): number {
  return code.trim() ? code.trim().split("\n").length : 0;
}
