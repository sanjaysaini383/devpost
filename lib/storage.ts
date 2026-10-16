"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "./types";

const KEY = "teachback.sessions.v1";
const EVENT = "teachback:sessions";

// Fallback when localStorage is unavailable (private mode, blocked storage).
let memory: Session[] = [];
let persistent: boolean | null = null;

function canPersist(): boolean {
  if (persistent !== null) return persistent;
  try {
    const probe = "__teachback_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    persistent = true;
  } catch {
    persistent = false;
  }
  return persistent;
}

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  if (!canPersist()) return memory;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Session[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: Session[]) {
  if (canPersist()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(sessions));
    } catch {
      memory = sessions;
    }
  } else {
    memory = sessions;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function saveSession(session: Session) {
  const all = loadSessions().filter((s) => s.id !== session.id);
  writeAll([session, ...all]);
}

export function deleteSession(id: string) {
  writeAll(loadSessions().filter((s) => s.id !== id));
}

export function isPersistent(): boolean {
  return typeof window !== "undefined" && canPersist();
}

/** All sessions, newest first. `ready` is false until the first client-side read. */
export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => setSessions(sortNewest(loadSessions()));
    read();
    setReady(true);
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return { sessions, ready };
}

export function useSession(id: string) {
  const { sessions, ready } = useSessions();
  const session = sessions.find((s) => s.id === id);
  const update = useCallback((next: Session) => saveSession(next), []);
  return { session, ready, update };
}

function sortNewest(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
