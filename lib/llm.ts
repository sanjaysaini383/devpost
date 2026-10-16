/**
 * Provider layer: one function, `generateJSON`, that returns schema-validated JSON from
 * whichever model is configured. Priority: Gemini (free tier) → Claude → none (demo grader).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

export type Provider = "gemini" | "anthropic";
export type Effort = "low" | "medium";

// Lite answered reliably on the free tier when the larger Flash models were overloaded (Oct 2026).
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const CLAUDE_MODEL = "claude-opus-5-5";

export class GraderError extends Error {}

export function activeProvider(): Provider | null {
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return null;
}

export function activeModel(): string | null {
  const p = activeProvider();
  if (p === "gemini") return process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
  if (p === "anthropic") return CLAUDE_MODEL;
  return null;
}

export async function generateJSON<T>(schema: z.ZodType<T>, system: string, user: string, effort: Effort): Promise<T> {
  const provider = activeProvider();
  if (provider === "gemini") return gemini(schema, system, user);
  if (provider === "anthropic") return claude(schema, system, user, effort);
  throw new GraderError("No AI provider is configured.");
}

// ---------- Gemini (Google AI Studio free tier) ----------

let googleClient: GoogleGenAI | null = null;

/** Gemini accepts a JSON Schema subset; drop keys it doesn't use. */
function geminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "$schema" || k === "additionalProperties") continue;
        // zod adds ±MAX_SAFE_INTEGER bounds to .int(); they carry no meaning here.
        if ((k === "minimum" || k === "maximum") && typeof v === "number" && Math.abs(v) > 1e12) continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(json);
}

/**
 * Free-tier models get "high demand" 503s and per-model 429 quotas, so we try the
 * configured model first, then fall back through other Flash models.
 */
export const GEMINI_FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash"];

// Remember the model that last answered so we don't pay for known-overloaded ones on every
// request; re-try the preferred order after a while in case demand has dropped.
const STICKY_MS = 10 * 60_000;
let sticky: { model: string; until: number } | null = null;

export function geminiModelChain(): string[] {
  const chain = [...new Set([activeModel() ?? GEMINI_DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS])];
  if (sticky && Date.now() < sticky.until && chain.includes(sticky.model)) {
    return [sticky.model, ...chain.filter((m) => m !== sticky!.model)];
  }
  return chain;
}

/** Errors worth retrying on a different model: overloaded, rate-limited, gone, or server-side. */
function isRetryable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 429 || err.status === 404 || err.status >= 500);
}

async function gemini<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  googleClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
  const chain = geminiModelChain();
  let lastErr: unknown;
  for (const model of chain) {
    try {
      const result = await geminiOnce(googleClient, model, schema, system, user);
      sticky = model === chain[0] && !sticky ? null : { model, until: Date.now() + STICKY_MS };
      return result;
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) break;
      console.warn(`[teachback] Gemini ${model} unavailable (${(err as ApiError).status}); trying next model`);
    }
  }
  const err = lastErr;
  if (err instanceof GraderError) throw err;
  if (err instanceof ApiError) {
    if (err.status === 429) throw new GraderError("Free-tier rate limit hit — wait a minute and retry.");
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message))
      throw new GraderError("The Gemini API key was rejected.");
    if (err.status === 503) throw new GraderError("Gemini is overloaded right now — retry in a moment.");
    if (err.status === 404) throw new GraderError(`Gemini model "${chain[0]}" wasn't found — check GEMINI_MODEL.`);
    throw new GraderError(`Gemini API error ${err.status}`);
  }
  throw new GraderError("Couldn't reach the Gemini API.");
}

async function geminiOnce<T>(
  client: GoogleGenAI,
  model: string,
  schema: z.ZodType<T>,
  system: string,
  user: string,
): Promise<T> {
  const response = await client.models.generateContent({
    model,
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: geminiSchema(schema),
      temperature: 0.2,
      // One attempt per model: on overload we move to the next model instead of backing off.
      httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } },
    },
  });
  const text = response.text;
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason;
    throw new GraderError(reason ? `The model returned no answer (${reason}).` : "The model returned no answer.");
  }
  return validate(schema, text);
}

// ---------- Claude (optional, paid) ----------

let anthropicClient: Anthropic | null = null;

async function claude<T>(schema: z.ZodType<T>, system: string, user: string, effort: Effort): Promise<T> {
  anthropicClient ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  try {
    const response = await anthropicClient.beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") throw new GraderError("The model declined to grade this request.");
    if (response.stop_reason === "max_tokens") throw new GraderError("The model's answer was cut off.");
    if (!response.parsed_output) throw new GraderError("The model returned an unreadable answer.");
    return response.parsed_output as T;
  } catch (err) {
    if (err instanceof GraderError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new GraderError("The API key was rejected.");
    if (err instanceof Anthropic.RateLimitError) throw new GraderError("Rate limited — wait a moment and retry.");
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new GraderError("The model took too long.");
    if (err instanceof Anthropic.APIConnectionError) throw new GraderError("Couldn't reach the Anthropic API.");
    if (err instanceof Anthropic.APIError) throw new GraderError(`Anthropic API error ${err.status ?? ""}`.trim());
    throw new GraderError("Unexpected grader failure.");
  }
}

// ---------- shared ----------

export function validate<T>(schema: z.ZodType<T>, text: string): T {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GraderError("The model returned malformed JSON.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new GraderError("The model's answer didn't match the expected shape.");
  return parsed.data;
}
