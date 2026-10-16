"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CodeHeat } from "./CodeHeat";
import { Legend, RichText, VerdictPill } from "./Bits";
import { ScoreDial } from "./ScoreDial";
import { blindSpotPrompt } from "@/lib/prompt";
import { ownershipScore, scoreHeadline, verdictCounts } from "@/lib/scoring";
import { isComplete, retakeSession } from "@/lib/session";
import { saveSession, useSession, useSessions } from "@/lib/storage";

export function ReportView({ id }: { id: string }) {
  const router = useRouter();
  const { session, ready } = useSession(id);
  const { sessions } = useSessions();
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(0);

  const score = session ? ownershipScore(session) : 0;

  // Count the dial up on first view — the reveal moment of the demo.
  useEffect(() => {
    if (!session) return;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session, score]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!session) {
    return (
      <div className="card empty stack" style={{ alignItems: "center" }}>
        <h2>Report not found</h2>
        <p className="muted">This session isn't in this browser's library.</p>
        <Link className="btn primary" href="/library">
          Go to your library
        </Link>
      </div>
    );
  }

  const counts = verdictCounts(session);
  const complete = isComplete(session);
  const prompt = blindSpotPrompt(session);

  // Previous completed attempt on the same code, for a "+12 since last time" line.
  const previous = sessions
    .filter((s) => s.id !== session.id && s.code === session.code && s.completedAt && s.createdAt < session.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const delta = previous ? score - ownershipScore(previous) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function retake() {
    if (!session) return;
    const next = retakeSession(session);
    saveSession(next);
    router.push(`/session/${next.id}`);
  }

  return (
    <>
      <div className="report-top">
        <ScoreDial score={shown} />
        <div className="stack">
          <p className="eyebrow">Ownership Map · {session.title}</p>
          <h1 style={{ fontSize: "2.4rem" }}>{scoreHeadline(score)}</h1>
          <p className="muted">
            {counts.owned} owned · {counts.shaky} shaky · {counts.gap} blind spot{counts.gap === 1 ? "" : "s"}
            {counts.unasked ? ` · ${counts.unasked} not answered` : ""}
            {delta !== null && (
              <strong style={{ color: delta >= 0 ? "var(--owned)" : "var(--gap)", marginLeft: 8 }}>
                {delta >= 0 ? "+" : ""}
                {delta} since your last attempt
              </strong>
            )}
          </p>
          <div className="row">
            {!complete && (
              <Link className="btn primary" href={`/session/${session.id}`}>
                Finish the session
              </Link>
            )}
            <button className="btn" onClick={retake}>
              Retake this code
            </button>
            <Link className="btn ghost" href="/new">
              New session
            </Link>
          </div>
        </div>
      </div>

      <div className="report-grid">
        <div className="stack">
          <div className="row">
            <h2 style={{ fontSize: "1.25rem" }}>Your code, painted by understanding</h2>
            <span className="spacer" />
            <Legend />
          </div>
          <CodeHeat
            code={session.code}
            language={session.language}
            chunks={session.chunks}
            answers={session.answers}
            paint
            maxHeight={640}
          />
        </div>

        <div className="stack">
          <section className="card pad stack">
            <div className="row">
              <h2 style={{ fontSize: "1.25rem" }}>Teach me my blind spots</h2>
              <span className="spacer" />
              <button className="btn primary" onClick={copy}>
                {copied ? "Copied ✓" : "Copy prompt"}
              </button>
            </div>
            <p className="muted small">
              Paste this into Claude Code, Cursor or Codex. It asks your agent to quiz and teach you — not to write more
              code for you.
            </p>
            <pre className="prompt-box">{prompt}</pre>
          </section>

          {session.chunks.map((c, i) => {
            const a = session.answers[c.id];
            return (
              <article key={c.id} className={`card chunk-card ${a?.verdict ?? ""}`}>
                <div className="row">
                  <strong>
                    {i + 1}. {c.title}
                  </strong>
                  <span className="muted small">
                    lines {c.startLine}–{c.endLine}
                  </span>
                  <span className="spacer" />
                  {a && <span className="small" style={{ fontWeight: 700 }}>{a.score}</span>}
                  <VerdictPill verdict={a?.verdict} />
                </div>
                <p className="small">
                  <RichText text={c.question} />
                </p>
                {a && (
                  <>
                    <blockquote>{a.skipped ? <em>Skipped</em> : a.text}</blockquote>
                    <p className="small">
                      <RichText text={a.feedback} />
                    </p>
                    {a.missed.length > 0 && (
                      <ul className="missed small">
                        {a.missed.map((m, j) => (
                          <li key={j}>
                            <RichText text={m} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="muted small">
                      {a.mode === "ai" ? "Graded by AI" : "Demo grader"}
                      {a.hintUsed ? " · hint used" : ""}
                    </p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
