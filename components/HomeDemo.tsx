"use client";

import { useEffect, useState } from "react";
import { CodeHeat } from "./CodeHeat";
import { ScoreDial } from "./ScoreDial";
import { SAMPLES } from "@/lib/samples";
import { ownershipScore, verdictFor } from "@/lib/scoring";
import type { Answer } from "@/lib/types";

const sample = SAMPLES[0];
// Illustrative scores for the looping preview (not a real grading).
const SCRIPT = [92, 58, 18, 86];

function fakeAnswer(score: number): Answer {
  return {
    text: "",
    score,
    verdict: verdictFor(score),
    feedback: "",
    missed: [],
    hintUsed: false,
    skipped: false,
    mode: "demo",
    at: "",
  };
}

/** Looping, decorative preview of a session painting itself. */
export function HomeDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(SCRIPT.length);
      return;
    }
    const t = setInterval(() => setStep((s) => (s >= SCRIPT.length + 2 ? 0 : s + 1)), 1300);
    return () => clearInterval(t);
  }, []);

  const shown = Math.min(step, SCRIPT.length);
  const answers = Object.fromEntries(
    sample.chunks.slice(0, shown).map((c, i) => [c.id, fakeAnswer(SCRIPT[i])]),
  );
  const active = step < SCRIPT.length ? sample.chunks[step]?.id : undefined;
  const score = ownershipScore({ chunks: sample.chunks, answers });

  return (
    <div className="card" style={{ padding: 14, position: "relative" }} aria-label="Animated example of an Ownership Map">
      <div className="row" style={{ padding: "4px 6px 12px" }}>
        <span className="eyebrow">Preview · {sample.title}</span>
        <span className="spacer" />
        <span className="small muted">{shown}/{sample.chunks.length} explained</span>
      </div>
      <CodeHeat
        code={sample.code}
        language={sample.language}
        chunks={sample.chunks}
        answers={answers}
        activeChunkId={active}
        paint={!active}
        maxHeight={400}
      />
      <div className="card home-dial">
        <ScoreDial score={score} size={86} />
      </div>
    </div>
  );
}
