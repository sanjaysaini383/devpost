import { Fragment } from "react";
import { VERDICT_LABEL } from "@/lib/scoring";
import type { Verdict } from "@/lib/types";

/** Renders `backtick` spans as inline code; everything else as text (no HTML injection). */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i}>{p.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function VerdictPill({ verdict }: { verdict?: Verdict }) {
  return (
    <span className={`pill ${verdict ?? ""}`}>
      <span className="dot" aria-hidden />
      {verdict ? VERDICT_LABEL[verdict] : "Not yet"}
    </span>
  );
}

export function Legend() {
  return (
    <div className="legend" aria-label="Legend">
      <span>
        <i style={{ background: "var(--owned)" }} /> Owned
      </span>
      <span>
        <i style={{ background: "var(--shaky)" }} /> Shaky
      </span>
      <span>
        <i style={{ background: "var(--gap)" }} /> Blind spot
      </span>
      <span>
        <i style={{ background: "var(--unasked)" }} /> Not asked yet
      </span>
    </div>
  );
}
