/**
 * End-to-end smoke test against a running server: `npm run smoke` (defaults to :3000).
 * Exercises every route and the analyze → grade API loop on a built-in sample.
 */
import { SAMPLES } from "../lib/samples";

const base = process.env.BASE_URL ?? "http://localhost:3000";

async function post(path: string, body: unknown) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  let failures = 0;
  const check = (ok: boolean, label: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) failures++;
  };

  for (const p of ["/", "/new", "/library", "/session/missing", "/session/missing/report"]) {
    const r = await fetch(base + p);
    check(r.status === 200, `GET ${p} -> ${r.status}`);
  }
  const status = await (await fetch(base + "/api/status")).json();
  console.log(`      grader mode: ${status.ai ? "AI" : "demo"}`);

  const s = SAMPLES[0];
  const a = await post("/api/analyze", { code: s.code, language: s.language, intent: s.intent, sampleId: s.id });
  check(a.status === 200 && a.json.chunks?.length >= 2, `analyze -> ${a.status}, ${a.json.chunks?.length} chunks (${a.json.mode})`);

  const chunk = a.json.chunks.at(-1);
  const good = await post("/api/grade", {
    code: s.code, language: s.language, intent: s.intent, sampleId: s.id, chunk, hintUsed: false,
    answer:
      "If fewer than one token is left the request is rejected with a 429 and a Retry-After header saying how long to wait; otherwise it spends one token and calls next().",
  });
  check(good.status === 200 && good.json.score >= 60, `grade strong answer -> ${good.json.score} ${good.json.verdict} (${good.json.mode})`);

  const vague = await post("/api/grade", {
    code: s.code, language: s.language, intent: s.intent, sampleId: s.id, chunk, hintUsed: false,
    answer: "it checks the thing and returns stuff",
  });
  check(vague.status === 200 && vague.json.score < good.json.score, `grade vague answer -> ${vague.json.score} ${vague.json.verdict}`);

  const short = await post("/api/grade", { code: s.code, chunk, answer: "short" });
  check(short.status === 400, `grade too-short answer -> ${short.status}`);

  const tiny = await post("/api/analyze", { code: "a\nb", language: "typescript" });
  check(tiny.status === 400, `analyze 2-line code -> ${tiny.status}`);

  if (failures) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
}

main();
