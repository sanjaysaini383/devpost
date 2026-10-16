"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CodeHeat } from "./CodeHeat";
import { Legend, RichText, VerdictPill } from "./Bits";
import { isComplete, markHint, nextUnanswered, recordAnswer, skipResult } from "@/lib/session";
import { useSession } from "@/lib/storage";
import { VERDICT_LABEL } from "@/lib/scoring";
import type { GradeResponse } from "@/lib/types";
import { MIN_ANSWER } from "@/lib/validate";

export function SessionView({ id }: { id: string }) {
  const router = useRouter();
  const { session, ready, update } = useSession(id);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseId, setPulseId] = useState<string | undefined>();

  // Pick the first unanswered chunk once the session loads.
  useEffect(() => {
    if (session && !activeId) setActiveId((nextUnanswered(session) ?? session.chunks[0])?.id);
  }, [session, activeId]);

  const chunk = useMemo(() => session?.chunks.find((c) => c.id === activeId), [session, activeId]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!session) {
    return (
      <div className="card empty stack" style={{ alignItems: "center" }}>
        <h2>Session not found</h2>
        <p className="muted">It may have been deleted, or it was created in another browser.</p>
        <Link className="btn primary" href="/library">
          Go to your library
        </Link>
      </div>
    );
  }
  if (!chunk) return null;

  const index = session.chunks.findIndex((c) => c.id === chunk.id);
  const answer = session.answers[chunk.id];
  const hintShown = session.hintsShown.includes(chunk.id);
  const draft = drafts[chunk.id] ?? answer?.text ?? "";
  const done = isComplete(session);
  const answeredCount = session.chunks.filter((c) => session.answers[c.id]).length;

  function select(chunkId: string) {
    setActiveId(chunkId);
    setError(null);
  }

  async function submit(forceDemo = false) {
    if (!session || !chunk) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/grade${forceDemo ? "?demo=1" : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: session.code,
          language: session.language,
          intent: session.intent,
          sampleId: session.sampleId,
          chunk,
          answer: draft,
          hintUsed: hintShown,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Grading failed");
      update(recordAnswer(session, chunk, draft, data as GradeResponse));
      setDrafts((d) => {
        const { [chunk.id]: _, ...rest } = d;
        return rest;
      });
      setPulseId(chunk.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (!session || !chunk) return;
    update(recordAnswer(session, chunk, draft, skipResult(chunk), { skipped: true }));
    setPulseId(chunk.id);
  }

  function goNext() {
    if (!session || !chunk) return;
    const next = nextUnanswered(session, chunk.id);
    if (next) select(next.id);
    else router.push(`/session/${session.id}/report`);
  }

  return (
    <>
      <div className="session-head">
        <div>
          <p className="eyebrow">
            Teach-back · {session.language} · {answeredCount}/{session.chunks.length} explained
          </p>
          <h1 style={{ fontSize: "2rem" }}>{session.title}</h1>
        </div>
        <span className="spacer" />
        <Legend />
      </div>

      <nav className="rail" aria-label="Chunks">
        {session.chunks.map((c, i) => {
          const v = session.answers[c.id]?.verdict;
          return (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              aria-current={c.id === chunk.id ? "step" : undefined}
              aria-label={`Chunk ${i + 1}: ${c.title}${v ? ` — ${VERDICT_LABEL[v]}` : ""}`}
            >
              <span className={`num ${v ?? ""}`}>{i + 1}</span>
              {c.title}
            </button>
          );
        })}
        {done && (
          <Link className="btn primary" href={`/session/${session.id}/report`} style={{ marginLeft: "auto" }}>
            Ownership Map →
          </Link>
        )}
      </nav>

      <div className="session-grid">
        <div className="code-col">
          <CodeHeat
            code={session.code}
            language={session.language}
            chunks={session.chunks}
            answers={session.answers}
            activeChunkId={chunk.id}
            pulseChunkId={pulseId}
            onSelectChunk={select}
          />
        </div>

        <section className="card pad stack" aria-live="polite">
          <div className="row">
            <span className="eyebrow">
              Chunk {index + 1} of {session.chunks.length} · lines {chunk.startLine}–{chunk.endLine}
            </span>
            <span className="spacer" />
            {answer && <VerdictPill verdict={answer.verdict} />}
          </div>
          <h2 style={{ fontSize: "1.1rem", fontFamily: "var(--font-body)" }}>{chunk.title}</h2>
          <p className="question">
            <RichText text={chunk.question} />
          </p>

          {hintShown && (
            <p className="hint-box">
              <strong>Hint:</strong> <RichText text={chunk.hint} />
            </p>
          )}

          <label className="field">
            Your explanation
            <textarea
              className="text"
              rows={6}
              value={draft}
              onChange={(e) => setDrafts((d) => ({ ...d, [chunk.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim().length >= MIN_ANSWER) submit();
              }}
              placeholder="Explain it like you're defending this code in a review. Why is it written this way?"
              disabled={busy}
            />
          </label>

          {error && (
            <div className="notice error stack" role="alert" style={{ gap: 8 }}>
              <span>The grader couldn't respond: {error}</span>
              <div className="row">
                <button className="btn" onClick={() => submit()}>
                  Try again
                </button>
                <button className="btn ghost" onClick={() => submit(true)}>
                  Use demo grader for this answer
                </button>
              </div>
            </div>
          )}

          <div className="row">
            <button
              className="btn primary"
              onClick={() => submit()}
              disabled={busy || draft.trim().length < MIN_ANSWER}
              title={draft.trim().length < MIN_ANSWER ? "Explain in a sentence or two" : "Ctrl/⌘ + Enter"}
            >
              {busy ? (
                <span className="analyzing">
                  <span className="spinner" aria-hidden /> Grading…
                </span>
              ) : answer ? (
                "Re-grade"
              ) : (
                "Submit explanation"
              )}
            </button>
            {!hintShown && (
              <button className="btn ghost" onClick={() => update(markHint(session, chunk.id))} disabled={busy}>
                Hint <span className="muted small">(caps at 85)</span>
              </button>
            )}
            {!answer && (
              <button className="btn ghost" onClick={skip} disabled={busy}>
                I don't know — skip
              </button>
            )}
          </div>
          {draft.trim().length > 0 && draft.trim().length < MIN_ANSWER && (
            <p className="muted small">Explain in a sentence or two.</p>
          )}

          {answer && (
            <div className={`verdict ${answer.verdict}`}>
              <div className="row">
                <span className="score">{answer.score}</span>
                <VerdictPill verdict={answer.verdict} />
                <span className="spacer" />
                <span className={`mode-badge ${answer.mode}`}>{answer.mode === "ai" ? "AI grader" : "Demo grader"}</span>
              </div>
              <p className="feedback">
                <RichText text={answer.feedback} />
              </p>
              {answer.missed.length > 0 && (
                <div>
                  <p className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                    What you missed
                  </p>
                  <ul className="missed">
                    {answer.missed.map((m, i) => (
                      <li key={i}>
                        <RichText text={m} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="row">
                <button className="btn primary" onClick={goNext}>
                  {nextUnanswered(session, chunk.id) ? "Next chunk →" : "See your Ownership Map →"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
