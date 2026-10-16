"use client";

import Link from "next/link";
import { TrendChart } from "./TrendChart";
import { chunkLength, ownershipScore } from "@/lib/scoring";
import { isComplete } from "@/lib/session";
import { deleteSession, isPersistent, useSessions } from "@/lib/storage";
import type { Session } from "@/lib/types";

function HeatStrip({ session }: { session: Session }) {
  return (
    <div className="heat-strip" aria-hidden>
      {session.chunks.map((c) => {
        const v = session.answers[c.id]?.verdict;
        return <span key={c.id} style={{ flex: chunkLength(c), background: `var(--${v ?? "unasked"})` }} />;
      })}
    </div>
  );
}

const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function LibraryView() {
  const { sessions, ready } = useSessions();

  if (!ready) return <p className="muted">Loading…</p>;

  if (sessions.length === 0) {
    return (
      <div className="card empty stack" style={{ alignItems: "center" }}>
        <div className="heat-strip" style={{ width: 220 }} aria-hidden>
          <span style={{ flex: 3, background: "var(--owned)" }} />
          <span style={{ flex: 2, background: "var(--shaky)" }} />
          <span style={{ flex: 1, background: "var(--gap)" }} />
          <span style={{ flex: 2, background: "var(--unasked)" }} />
        </div>
        <h2>No teach-backs yet</h2>
        <p className="muted" style={{ maxWidth: "44ch" }}>
          Pick some code an AI wrote for you and find out how much of it you really own. A sample takes about two
          minutes.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn primary" href="/new?sample=rate-limiter">
            Try a sample
          </Link>
          <Link className="btn" href="/new">
            Paste your own code
          </Link>
        </div>
      </div>
    );
  }

  const completed = sessions.filter(isComplete);
  const avg = completed.length ? Math.round(completed.reduce((s, x) => s + ownershipScore(x), 0) / completed.length) : null;

  return (
    <div className="stack" style={{ gap: 22 }}>
      {!isPersistent() && (
        <p className="notice warn">This browser is blocking storage — sessions will disappear when you close the tab.</p>
      )}
      <div className="row">
        <p className="muted">
          {sessions.length} session{sessions.length === 1 ? "" : "s"} · {completed.length} completed
          {avg !== null && ` · average ownership ${avg}%`}
        </p>
      </div>

      <TrendChart sessions={sessions} />

      <section className="card" aria-label="Sessions">
        {sessions.map((s) => {
          const done = isComplete(s);
          const href = done ? `/session/${s.id}/report` : `/session/${s.id}`;
          const answered = s.chunks.filter((c) => s.answers[c.id]).length;
          return (
            <div key={s.id} className="lib-row">
              <Link href={href} style={{ textDecoration: "none", minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </strong>
                <span className="muted small">
                  {s.language} · {fmt.format(new Date(s.createdAt))} · {s.mode === "ai" ? "AI grader" : "Demo grader"}
                </span>
              </Link>
              <HeatStrip session={s} />
              <Link href={href} className="lib-score" style={{ textDecoration: "none" }}>
                {done ? (
                  `${ownershipScore(s)}%`
                ) : (
                  <span className="small muted" style={{ fontFamily: "var(--font-body)", fontWeight: 600 }}>
                    {answered}/{s.chunks.length} done
                  </span>
                )}
              </Link>
              <div className="row lib-actions" style={{ justifyContent: "flex-end" }}>
                <Link className="btn ghost small" href={href}>
                  {done ? "Report" : "Continue"}
                </Link>
                <button
                  className="btn ghost danger small"
                  onClick={() => {
                    if (window.confirm(`Delete "${s.title}"? This can't be undone.`)) deleteSession(s.id);
                  }}
                  aria-label={`Delete ${s.title}`}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
