import type { Session } from "@/lib/types";
import { ownershipScore } from "@/lib/scoring";

/** Inline-SVG line chart of completed-session scores, oldest → newest. */
export function TrendChart({ sessions }: { sessions: Session[] }) {
  const done = sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
    .slice(-12);
  if (done.length < 2) return null;

  const w = 1000;
  const h = 190;
  const pad = { l: 34, r: 14, t: 14, b: 24 };
  const xs = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (done.length - 1);
  const ys = (v: number) => pad.t + ((100 - v) * (h - pad.t - pad.b)) / 100;
  const scores = done.map(ownershipScore);
  const path = scores.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
  const area = `${path} L${xs(done.length - 1)},${ys(0)} L${xs(0)},${ys(0)} Z`;
  const first = scores[0];
  const last = scores[scores.length - 1];

  return (
    <section className="card pad stack">
      <div className="row">
        <h2 style={{ fontSize: "1.2rem" }}>Your ownership over time</h2>
        <span className="spacer" />
        <span className="small" style={{ fontWeight: 700, color: last >= first ? "var(--owned)" : "var(--gap)" }}>
          {last >= first ? "+" : ""}
          {last - first} pts across {done.length} sessions
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Scores: ${scores.join(", ")}`}>
        {[0, 40, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={w - pad.r} y1={ys(g)} y2={ys(g)} stroke="var(--line)" strokeDasharray={g ? "3 4" : undefined} />
            <text x={pad.l - 8} y={ys(g) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {g}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--accent)" opacity="0.08" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {scores.map((v, i) => (
          <circle key={i} cx={xs(i)} cy={ys(v)} r="4.5" fill="var(--card)" stroke={`var(--${v >= 75 ? "owned" : v >= 40 ? "shaky" : "gap"})`} strokeWidth="2.5">
            <title>
              {done[i].title}: {v}%
            </title>
          </circle>
        ))}
      </svg>
    </section>
  );
}
