"use client";

import { useEffect, useState } from "react";

export interface GraderStatus {
  ai: boolean;
  provider?: "gemini" | "anthropic" | null;
  model?: string | null;
}

let cached: GraderStatus | null = null;

export function useGraderStatus(): GraderStatus | null {
  const [status, setStatus] = useState<GraderStatus | null>(cached);
  useEffect(() => {
    if (cached) return;
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : { ai: false }))
      .catch(() => ({ ai: false }))
      .then((s: GraderStatus) => {
        cached = s;
        setStatus(s);
      });
  }, []);
  return status;
}
