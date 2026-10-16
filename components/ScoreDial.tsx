import { verdictFor } from "@/lib/scoring";

export function ScoreDial({ score, size = 180 }: { score: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = `var(--${verdictFor(score)})`;
  return (
    <div className="dial" style={{ width: size, height: size }} role="img" aria-label={`Ownership score ${score} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
        />
      </svg>
      <div className="dial-num">
        <div>
          <strong style={{ fontSize: Math.round(size * 0.26) }}>{score}%</strong>
          <span className="muted small">owned</span>
        </div>
      </div>
    </div>
  );
}
