"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import { createSession } from "@/lib/session";
import { saveSession } from "@/lib/storage";
import type { AnalyzeResponse } from "@/lib/types";
import { lineCount, MAX_LINES, MIN_LINES } from "@/lib/validate";

const LANGUAGES = ["typescript", "javascript", "python", "go", "rust", "java", "ruby", "other"];

const STAGES = ["Reading your code…", "Finding the parts that matter…", "Writing your questions…"];

export function NewSessionForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [intent, setIntent] = useState("");
  const [title, setTitle] = useState("");
  const [sampleId, setSampleId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const pickSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setSampleId(s.id);
    setCode(s.code);
    setLanguage(s.language);
    setIntent(s.intent);
    setTitle(s.title);
    setError(null);
  };

  // `/new?sample=retry` preselects a sample (used by the home page).
  useEffect(() => {
    const s = params.get("sample");
    if (s) pickSample(s);
  }, [params]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1400);
    return () => clearInterval(t);
  }, [busy]);

  const n = lineCount(code);
  const tooShort = n > 0 && n < MIN_LINES;
  const tooLong = n > MAX_LINES;
  const canAnalyze = n >= MIN_LINES && !tooLong && !busy;

  async function analyze(forceDemo = false) {
    setBusy(true);
    setStage(0);
    setError(null);
    try {
      const res = await fetch(`/api/analyze${forceDemo ? "?demo=1" : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, language, intent, sampleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      const session = createSession({ code, language, intent, sampleId }, data as AnalyzeResponse, title);
      saveSession(session);
      router.push(`/session/${session.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="new-grid">
      <section className="card pad stack">
        <div className="row">
          <h2>Bring the code</h2>
          <span className="spacer" />
          <span className={`small ${tooShort || tooLong ? "" : "muted"}`} style={tooLong ? { color: "var(--gap)" } : undefined}>
            {n} / {MAX_LINES} lines
          </span>
        </div>
        <p className="muted small">
          Paste something an AI wrote for you — a function, a component, a script. 5–300 lines works best.
        </p>
        <div className="code-input-wrap">
          <div className="code-input-gutter" ref={gutterRef} aria-hidden>
            {Array.from({ length: Math.max(n, 1) }, (_, i) => i + 1).join("\n")}
          </div>
          <textarea
            className="code-input"
            aria-label="Code to explain back"
            spellCheck={false}
            value={code}
            placeholder={"// paste the code your agent wrote…"}
            onChange={(e) => {
              setCode(e.target.value);
              if (sampleId) setSampleId(SAMPLES.find((s) => s.id === sampleId)?.code === e.target.value ? sampleId : undefined);
            }}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const t = e.currentTarget;
                const { selectionStart: s, selectionEnd: end } = t;
                const next = code.slice(0, s) + "  " + code.slice(end);
                setCode(next);
                requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
              }
            }}
          />
        </div>
        {tooShort && <p className="notice warn">Add a few more lines — TeachBack needs at least {MIN_LINES} to find chunks worth explaining.</p>}
        {tooLong && <p className="notice warn">That's over {MAX_LINES} lines. Pick the part you're least sure about.</p>}

        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "1 1 220px" }}>
            Title <span className="muted small" style={{ fontWeight: 400 }}>(optional)</span>
            <input className="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout webhook handler" />
          </label>
          <label className="field" style={{ flex: "0 1 180px" }}>
            Language
            <select className="text" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          What is it supposed to do? <span className="muted small" style={{ fontWeight: 400 }}>(optional, helps the questions)</span>
          <input className="text" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="One sentence, in your words" />
        </label>

        {error && (
          <div className="notice error stack" role="alert" style={{ gap: 8 }}>
            <span>{error}</span>
            <div className="row">
              <button className="btn" onClick={() => analyze()}>
                Try again
              </button>
              <button className="btn ghost" onClick={() => analyze(true)}>
                Continue with demo grader
              </button>
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn primary" onClick={() => analyze()} disabled={!canAnalyze}>
            {busy ? (
              <span className="analyzing">
                <span className="spinner" aria-hidden /> {STAGES[stage]}
              </span>
            ) : (
              "Analyze & start →"
            )}
          </button>
          <span className="muted small">Sessions are saved only in this browser.</span>
        </div>
      </section>

      <aside className="stack">
        <p className="eyebrow">Or try an AI-written sample</p>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            className="card sample-card"
            aria-pressed={sampleId === s.id}
            onClick={() => pickSample(s.id)}
          >
            <span className="lang">
              {s.language} · {s.code.split("\n").length} lines
            </span>
            <strong>{s.title}</strong>
            <span className="muted small">{s.blurb}</span>
          </button>
        ))}
        <div className="notice small">
          <strong>How it works:</strong> TeachBack splits the code into a few chunks and asks you one question about
          each. Answer like you're explaining it in a code review. Your answers paint the code green, amber or red.
        </div>
      </aside>
    </div>
  );
}
