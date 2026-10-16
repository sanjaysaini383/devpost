"use client";

import { useEffect, useRef, useState } from "react";
import { getRecognitionCtor, readResults, speechErrorMessage, type Recognition } from "@/lib/speech";

interface Props {
  disabled?: boolean;
  /** A finished phrase to append to the answer. */
  onFinal: (text: string) => void;
  /** Words still being recognised ("" when none). */
  onInterim: (text: string) => void;
  onError: (message: string | null) => void;
}

/** Mic toggle backed by the browser's Web Speech API. Stops when unmounted. */
export function VoiceButton({ disabled, onFinal, onInterim, onError }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  // Keep the latest callbacks without restarting recognition when they change.
  const cb = useRef({ onFinal, onInterim, onError });
  cb.current = { onFinal, onInterim, onError };

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (disabled && listening) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const { final, interim } = readResults(e);
      if (final) cb.current.onFinal(final);
      cb.current.onInterim(interim);
    };
    rec.onerror = (e) => cb.current.onError(speechErrorMessage(e.error));
    rec.onend = () => {
      setListening(false);
      cb.current.onInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    cb.current.onError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      cb.current.onError("Voice input couldn't start. Try again, or type.");
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  if (supported === null) return null; // avoid a flash before detection on the client

  if (!supported) {
    return (
      <button
        type="button"
        className="btn ghost mic"
        disabled
        title="Voice answers need Chrome, Edge or Safari. You can type instead."
        aria-label="Voice answers aren't supported in this browser"
      >
        <MicIcon /> Speak
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn mic${listening ? " listening" : ""}`}
      onClick={listening ? stop : start}
      disabled={disabled && !listening}
      aria-pressed={listening}
      title={
        listening
          ? "Stop listening"
          : "Explain it out loud. Your browser's speech service turns audio into text (Chrome uses Google's servers)."
      }
    >
      {listening ? (
        <>
          <span className="rec-dot" aria-hidden /> Listening… Stop
        </>
      ) : (
        <>
          <MicIcon /> Speak
        </>
      )}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}
