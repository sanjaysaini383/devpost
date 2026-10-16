"use client";

import { useEffect, useMemo, useRef } from "react";
import { highlightLine } from "@/lib/highlight";
import { lineVerdicts } from "@/lib/scoring";
import type { Chunk, Session } from "@/lib/types";

interface Props {
  code: string;
  language: string;
  chunks: Chunk[];
  answers: Session["answers"];
  activeChunkId?: string;
  /** Tint whole lines with verdict colour (report view) instead of only the gutter. */
  paint?: boolean;
  /** Chunk id whose gutter should pulse (just graded). */
  pulseChunkId?: string;
  onSelectChunk?: (chunkId: string) => void;
  maxHeight?: number;
}

export function CodeHeat({
  code,
  language,
  chunks,
  answers,
  activeChunkId,
  paint,
  pulseChunkId,
  onSelectChunk,
  maxHeight,
}: Props) {
  const lines = useMemo(() => code.split("\n"), [code]);
  const tokens = useMemo(() => lines.map((l) => highlightLine(l, language)), [lines, language]);
  const states = lineVerdicts(lines.length, { chunks, answers });
  const chunkOfLine = useMemo(() => {
    const map: (Chunk | undefined)[] = Array(lines.length).fill(undefined);
    for (const c of chunks) for (let l = c.startLine; l <= c.endLine && l <= lines.length; l++) map[l - 1] = c;
    return map;
  }, [chunks, lines.length]);

  const active = chunks.find((c) => c.id === activeChunkId);
  const pulse = chunks.find((c) => c.id === pulseChunkId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the active chunk in view.
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-line="${active.startLine}"]`);
    if (!el) return;
    const box = containerRef.current;
    const top = el.offsetTop - 48;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 96) {
      box.scrollTo({ top, behavior: "smooth" });
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className={`code-heat${paint ? " paint" : ""}${active ? " focusing" : ""}`}
      style={maxHeight ? { maxHeight } : undefined}
      role="region"
      aria-label="Code with understanding heatmap"
    >
      {lines.map((line, i) => {
        const n = i + 1;
        const chunk = chunkOfLine[i];
        const isActive = !!active && n >= active.startLine && n <= active.endLine;
        const isPulse = !!pulse && n >= pulse.startLine && n <= pulse.endLine;
        const cls = [
          "code-line",
          isActive && "active",
          isActive && n === active!.startLine && "first",
          isActive && n === active!.endLine && "last",
          isPulse && "just-graded",
          chunk && onSelectChunk && "clickable",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={`${pulseChunkId ?? ""}-${n}`}
            className={cls}
            data-state={states[i]}
            data-line={n}
            onClick={chunk && onSelectChunk ? () => onSelectChunk(chunk.id) : undefined}
            title={chunk ? chunk.title : undefined}
          >
            <span className="heat" aria-hidden />
            <span className="ln">{n}</span>
            <span className="src">
              {tokens[i].map((t, j) =>
                t.kind === "plain" ? (
                  <span key={j}>{t.text}</span>
                ) : (
                  <span key={j} className={`tok-${t.kind}`}>
                    {t.text}
                  </span>
                ),
              )}
              {line === "" ? " " : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
