/**
 * Minimal typings + feature detection for the browser Web Speech API.
 * (Not every TypeScript DOM lib ships these, and Chrome/Safari still use the webkit prefix.)
 * https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
 */
export interface SpeechAlternative {
  transcript: string;
}
export interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}
export interface SpeechResultEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechResult };
}
export interface SpeechErrorEvent {
  readonly error: string;
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Split a result event into newly finalised text and the current interim text. */
export function readResults(e: SpeechResultEvent): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    const text = r[0]?.transcript ?? "";
    if (r.isFinal) final += text;
    else interim += text;
  }
  return { final: final.trim(), interim: interim.trim() };
}

/** Append spoken text to an existing draft with sensible spacing and capitalisation. */
export function appendSpoken(draft: string, spoken: string): string {
  const s = spoken.trim();
  if (!s) return draft;
  const capital = s.charAt(0).toUpperCase() + s.slice(1);
  const base = draft.replace(/\s+$/, "");
  if (!base) return capital;
  if (/[,;:]$/.test(base)) return `${base} ${s}`; // mid-sentence: keep the speaker's case
  const needsStop = !/[.!?]$/.test(base);
  return `${base}${needsStop ? "." : ""} ${capital}`;
}

export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it from the icon in the address bar, or just type.";
    case "audio-capture":
      return "No microphone was found. Plug one in, or type your answer.";
    case "network":
      return "The browser's speech service couldn't be reached. Check your connection, or type.";
    case "no-speech":
    case "aborted":
      return null; // silence or a deliberate stop: not worth an error
    default:
      return "Voice input stopped unexpectedly. Try again, or type.";
  }
}
