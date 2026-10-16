/**
 * Offline "demo grader". Used when no ANTHROPIC_API_KEY is configured, or when the user
 * explicitly asks for it after an AI failure. Everything it returns is labelled mode "demo".
 * It is deliberately simple and transparent: concept keyword matching, not AI.
 */
import { getSample, sampleForCode } from "./samples";
import { applyHintCap, verdictFor } from "./scoring";
import type { AnalyzeRequest, AnalyzeResponse, Chunk, GradeRequest, GradeResponse } from "./types";

const STOPWORDS = new Set(
  "the a an and or of to in on for is are it this that with as by be at from if else return const let var function def class new true false null none self this await async import export".split(
    " ",
  ),
);

export function demoAnalyze(req: AnalyzeRequest): AnalyzeResponse {
  const sample = sampleForCode(req.sampleId, req.code);
  if (sample) return { mode: "demo", title: sample.title, chunks: sample.chunks };
  return { mode: "demo", title: guessTitle(req.code), chunks: heuristicChunks(req.code) };
}

export function guessTitle(code: string): string {
  const m = code.match(/(?:function|def|class|const|let)\s+([A-Za-z_$][\w$]*)/);
  return m ? `${m[1]}` : "Untitled snippet";
}

/**
 * Split code into 3–6 contiguous chunks at blank lines / top-level boundaries, then
 * merge tiny pieces. Good enough to demo the loop on arbitrary pasted code.
 */
export function heuristicChunks(code: string): Chunk[] {
  const lines = code.split("\n");
  const blocks: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const blank = lines[i].trim() === "";
    if (!blank && start === -1) start = i;
    if (blank && start !== -1) {
      blocks.push([start, i - 1]);
      start = -1;
    }
  }
  if (start !== -1) blocks.push([start, lines.length - 1]);
  if (blocks.length === 0) return [];

  const target = Math.min(6, Math.max(3, Math.round(lines.length / 10)));
  // Merge the smallest adjacent pair until we're at or below target.
  while (blocks.length > target) {
    let best = 0;
    let bestSize = Infinity;
    for (let i = 0; i < blocks.length - 1; i++) {
      const size = blocks[i + 1][1] - blocks[i][0];
      if (size < bestSize) {
        bestSize = size;
        best = i;
      }
    }
    blocks.splice(best, 2, [blocks[best][0], blocks[best + 1][1]]);
  }
  // Split the largest block if we have too few.
  while (blocks.length < Math.min(3, lines.filter((l) => l.trim()).length)) {
    let largest = 0;
    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i][1] - blocks[i][0] > blocks[largest][1] - blocks[largest][0]) largest = i;
    }
    const [s, e] = blocks[largest];
    if (e - s < 1) break;
    const mid = Math.floor((s + e) / 2);
    blocks.splice(largest, 1, [s, mid], [mid + 1, e]);
  }

  return blocks.map(([s, e], i) => {
    const body = lines.slice(s, e + 1);
    const idents = topIdentifiers(body.join("\n"), 4);
    const name = firstName(body) ?? idents[0] ?? `block ${i + 1}`;
    return {
      id: `c${i + 1}`,
      title: `Lines ${s + 1}–${e + 1}: ${name}`,
      startLine: s + 1,
      endLine: e + 1,
      question: `In your own words: what do lines ${s + 1}–${e + 1} do, and why does the code need them?`,
      concepts: idents.length ? idents.map((id) => `the role of \`${id}\``) : ["what this block does"],
      hint: idents.length
        ? `Start with what \`${idents[0]}\` is for, then say what changes after these lines run.`
        : "Describe the input, what happens to it, and the output.",
    };
  });
}

function firstName(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(/(?:function|def|class|interface|type)\s+([A-Za-z_$][\w$]*)/);
    if (m) return m[1];
  }
  return undefined;
}

export function topIdentifiers(text: string, n: number): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/[A-Za-z_$][\w$]{2,}/g)) {
    const w = m[0];
    if (STOPWORDS.has(w.toLowerCase())) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([w]) => w);
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[`'"]/g, "").replace(/\s+/g, " ");
}

function keywordsFor(req: GradeRequest): string[][] {
  const sample = getSample(req.sampleId);
  const fromSample = sample?.code.trim() === req.code.trim() ? sample?.keywords[req.chunk.id] : undefined;
  if (fromSample) return fromSample;
  // Custom code: a concept "the role of `x`" is matched by mentioning x (or its words).
  return req.chunk.concepts.map((c) => {
    const ident = c.match(/`([^`]+)`/)?.[1];
    if (!ident) return c.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const parts = ident.split(/(?=[A-Z])|_/).map((p) => p.toLowerCase()).filter((p) => p.length > 2);
    return [ident.toLowerCase(), ...parts];
  });
}

export function demoGrade(req: GradeRequest): GradeResponse {
  const answer = norm(req.answer);
  const words = answer.split(" ").filter(Boolean);
  const groups = keywordsFor(req);
  const matched: string[] = [];
  const missed: string[] = [];
  groups.forEach((kws, i) => {
    const hit = kws.some((k) => answer.includes(norm(k)));
    (hit ? matched : missed).push(req.chunk.concepts[i] ?? kws[0]);
  });

  const coverage = groups.length ? matched.length / groups.length : 0;
  let score = 10 + coverage * 85;
  if (words.length < 8) score -= 20; // one-liners rarely show understanding
  if (words.length >= 25 && coverage > 0) score += 5; // reward explaining, not keyword lists
  const final = applyHintCap(score, req.hintUsed);
  const verdict = verdictFor(final);

  const feedback =
    verdict === "owned"
      ? `Solid. You covered ${matched.length} of ${groups.length} key ideas${missed.length ? "; tighten up the one you skipped" : ""}.`
      : verdict === "shaky"
        ? `You're on the right track — you got ${matched.length} of ${groups.length} key ideas. The missing piece${missed.length > 1 ? "s" : ""} below ${missed.length > 1 ? "are" : "is"} where this code would surprise you.`
        : matched.length
          ? `There's a start here, but most of what makes these lines work is missing. Re-read them with the hint in mind.`
          : `This doesn't yet explain what these lines do. Try describing the input, what happens to it, and the result.`;

  return { mode: "demo", score: final, verdict, feedback, missed };
}
