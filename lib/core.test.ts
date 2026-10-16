import { test } from "node:test";
import assert from "node:assert/strict";
import { highlightLine } from "./highlight";
import { SAMPLES } from "./samples";
import { demoAnalyze, demoGrade, heuristicChunks } from "./demo";
import { applyHintCap, lineVerdicts, ownershipScore, verdictFor } from "./scoring";
import type { Chunk, Session } from "./types";

test("highlights keywords, strings, comments and calls in TS", () => {
  const line = `const x = foo("a", 2); // note`;
  const toks = highlightLine(line, "typescript");
  const kinds = toks.filter((t) => t.kind !== "plain").map((t) => `${t.kind}:${t.text}`);
  assert.deepEqual(kinds, ["kw:const", "fn:foo", 'str:"a"', "num:2", "com:// note"]);
  assert.equal(toks.map((t) => t.text).join(""), line);
});

test("python uses # comments and keeps // as an operator", () => {
  const toks = highlightLine("y = a // 2  # half", "python");
  assert.ok(toks.some((t) => t.kind === "com" && t.text === "# half"));
  assert.ok(!toks.some((t) => t.kind === "com" && t.text.startsWith("//")));
});

test("every sample resolves to ordered, non-overlapping, in-range chunks", () => {
  for (const s of SAMPLES) {
    const lineCount = s.code.split("\n").length;
    assert.ok(s.chunks.length >= 3, `${s.id} has ≥3 chunks`);
    let prevEnd = 0;
    for (const c of s.chunks) {
      assert.ok(c.startLine > prevEnd, `${s.id}/${c.id} starts after previous chunk`);
      assert.ok(c.endLine >= c.startLine && c.endLine <= lineCount, `${s.id}/${c.id} in range`);
      assert.equal(s.keywords[c.id].length, c.concepts.length, `${s.id}/${c.id} keywords per concept`);
      prevEnd = c.endLine;
    }
  }
});

test("verdict thresholds and hint cap", () => {
  assert.equal(verdictFor(75), "owned");
  assert.equal(verdictFor(74), "shaky");
  assert.equal(verdictFor(40), "shaky");
  assert.equal(verdictFor(39), "gap");
  assert.equal(applyHintCap(97, true), 85);
  assert.equal(applyHintCap(97, false), 97);
  assert.equal(applyHintCap(140, false), 100);
});

const chunks: Chunk[] = [
  { id: "a", title: "", startLine: 1, endLine: 3, question: "", concepts: [], hint: "" },
  { id: "b", title: "", startLine: 4, endLine: 4, question: "", concepts: [], hint: "" },
];
const ans = (score: number) => ({
  text: "",
  score,
  verdict: verdictFor(score),
  feedback: "",
  missed: [],
  hintUsed: false,
  skipped: false,
  mode: "demo" as const,
  at: "",
});

test("ownership score is weighted by chunk length and counts unanswered as 0", () => {
  assert.equal(ownershipScore({ chunks, answers: { a: ans(100), b: ans(0) } }), 75);
  assert.equal(ownershipScore({ chunks, answers: { b: ans(100) } }), 25);
});

test("line verdicts paint each chunk's lines", () => {
  const s = { chunks, answers: { a: ans(90) } } as Pick<Session, "chunks" | "answers">;
  assert.deepEqual(lineVerdicts(5, s), ["owned", "owned", "owned", "unasked", "none"]);
});

test("demo grader rewards a real explanation and penalises a vague one", () => {
  const s = SAMPLES.find((x) => x.id === "rate-limiter")!;
  const chunk = s.chunks.find((c) => c.id === "c2")!;
  const base = { code: s.code, language: s.language, intent: s.intent, sampleId: s.id, chunk, hintUsed: false };
  const good = demoGrade({
    ...base,
    answer:
      "It works out how much time has elapsed since the last refill and adds tokens proportional to that, " +
      "but Math.min caps the total at capacity so an idle client can't bank unlimited tokens. " +
      "Then it updates lastRefill so the same time isn't counted twice.",
  });
  const vague = demoGrade({ ...base, answer: "it refills the bucket stuff" });
  assert.equal(good.verdict, "owned");
  assert.equal(vague.verdict, "gap");
  assert.ok(vague.missed.length >= 2);
});

test("demo analyze returns authored chunks for an unedited sample, heuristic otherwise", () => {
  const s = SAMPLES[0];
  assert.equal(demoAnalyze({ code: s.code, language: s.language, intent: "", sampleId: s.id }).chunks, s.chunks);
  const edited = demoAnalyze({ code: s.code + "\n// edited", language: s.language, intent: "", sampleId: s.id });
  assert.notEqual(edited.chunks, s.chunks);
});

test("heuristic chunks cover pasted code in 3–6 ordered pieces", () => {
  const code = Array.from({ length: 40 }, (_, i) => (i % 7 === 6 ? "" : `const v${i} = compute(${i});`)).join("\n");
  const out = heuristicChunks(code);
  assert.ok(out.length >= 3 && out.length <= 6, `got ${out.length}`);
  for (let i = 1; i < out.length; i++) assert.ok(out[i].startLine > out[i - 1].endLine);
});

test("repairChunks clamps, orders and de-overlaps model ranges", async () => {
  const { repairChunks } = await import("./ai");
  const base = { title: "t", question: "q?", concepts: ["x"], hint: "h" };
  const out = repairChunks(
    [
      { ...base, startLine: 8, endLine: 12 },
      { ...base, startLine: 0, endLine: 5 },
      { ...base, startLine: 4, endLine: 9 }, // overlaps both neighbours
      { ...base, startLine: 30, endLine: 99 }, // beyond the file
    ],
    20,
  );
  assert.deepEqual(
    out.map((c) => [c.id, c.startLine, c.endLine]),
    [["c1", 1, 5], ["c2", 6, 9], ["c3", 10, 12], ["c4", 20, 20]],
  );
});

test("blind-spot prompt lists only weak chunks and asks the agent to teach", async () => {
  const { blindSpotPrompt } = await import("./prompt");
  const s = SAMPLES[0];
  const session: Session = {
    id: "x", title: s.title, language: s.language, intent: "", code: s.code, mode: "demo",
    chunks: s.chunks, hintsShown: [], createdAt: "",
    answers: { c1: ans(90), c2: { ...ans(50), missed: ["Math.min caps tokens at capacity"] }, c3: ans(10) },
  };
  const p = blindSpotPrompt(session);
  assert.match(p, /Teach me/);
  assert.match(p, /don't rewrite the code/);
  assert.match(p, /Refilling tokens \(Shaky\)/);
  assert.match(p, /Math\.min caps tokens at capacity/);
  assert.match(p, /\(Blind spot\)/);
  assert.match(p, /\(Not answered\)/); // c4
  assert.doesNotMatch(p, /Per-client buckets/); // owned chunk excluded
});

test("gemini provider: model JSON is validated against the schema", async () => {
  const { validate, GraderError } = await import("./llm");
  const { z } = await import("zod");
  const S = z.object({ score: z.number().int(), missed: z.array(z.string()) });
  assert.deepEqual(validate(S, '{"score": 80, "missed": []}'), { score: 80, missed: [] });
  assert.throws(() => validate(S, "not json"), GraderError);
  assert.throws(() => validate(S, '{"score": "high"}'), GraderError);
});
