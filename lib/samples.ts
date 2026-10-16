import type { Chunk } from "./types";

/**
 * Built-in "AI-written" samples. Chunks locate their lines by anchor text rather than
 * hard-coded numbers so editing a sample can't silently misalign its chunks.
 * `keywords` (one list of synonyms per concept) power the offline demo grader.
 */
interface SampleChunkDef {
  id: string;
  title: string;
  from: string;
  to: string;
  question: string;
  concepts: string[];
  keywords: string[][];
  hint: string;
}

interface SampleDef {
  id: string;
  title: string;
  language: string;
  intent: string;
  blurb: string;
  code: string;
  chunks: SampleChunkDef[];
}

export interface Sample {
  id: string;
  title: string;
  language: string;
  intent: string;
  blurb: string;
  code: string;
  chunks: Chunk[];
  keywords: Record<string, string[][]>;
}

const RATE_LIMITER = `import type { Request, Response, NextFunction } from "express";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export function createRateLimiter(capacity = 10, refillPerSecond = 1) {
  const buckets = new Map<string, Bucket>();

  function refill(bucket: Bucket, now: number) {
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.lastRefill = now;
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? "anonymous";
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      buckets.set(key, bucket);
    }

    refill(bucket, now);

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / refillPerSecond);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests" });
    }

    bucket.tokens -= 1;
    next();
  };
}`;

const RETRY = `import random
import time
from functools import wraps


class RetryError(Exception):
    pass


def retry(max_attempts=5, base_delay=0.5, max_delay=8.0, retry_on=(ConnectionError, TimeoutError)):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    last_error = error
                    if attempt == max_attempts:
                        break
                    delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
                    delay = random.uniform(0, delay)
                    time.sleep(delay)
            raise RetryError(f"Gave up after {max_attempts} attempts") from last_error
        return wrapper
    return decorator


@retry(max_attempts=4)
def fetch_profile(client, user_id):
    return client.get(f"/users/{user_id}", timeout=2)`;

const SEARCH_HOOK = `import { useEffect, useState } from "react";

export function useDebouncedSearch(query: string, delay = 300) {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(\`Search failed: \${res.status}\`);
        setResults(await res.json());
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, delay]);

  return { results, loading, error };
}`;

const DEFS: SampleDef[] = [
  {
    id: "rate-limiter",
    title: "Token-bucket rate limiter",
    language: "typescript",
    intent: "Express middleware that limits each IP to a burst of requests, refilling over time.",
    blurb: "Express middleware an agent wrote to stop API abuse.",
    code: RATE_LIMITER,
    chunks: [
      {
        id: "c1",
        title: "Per-client buckets",
        from: "interface Bucket",
        to: "const buckets = new Map",
        question:
          "What do `capacity` and `refillPerSecond` control, and why is there one bucket per key in a Map?",
        concepts: [
          "capacity is the maximum burst of requests",
          "refillPerSecond is the sustained rate",
          "the Map keeps separate state per client",
        ],
        keywords: [
          ["burst", "maximum", "max", "capacity", "most requests", "limit of tokens", "how many"],
          ["rate", "per second", "refill", "regenerat", "replenish", "speed"],
          ["per client", "per ip", "per user", "each client", "each ip", "each user", "separate", "key", "map"],
        ],
        hint: "Think about two different limits: how many requests at once vs. how fast you earn more.",
      },
      {
        id: "c2",
        title: "Refilling tokens",
        from: "function refill(",
        to: "bucket.lastRefill = now;",
        question:
          "Walk through `refill`. How does it compute new tokens, and why is `Math.min(capacity, …)` there?",
        concepts: [
          "tokens added proportional to time elapsed",
          "Math.min caps tokens at capacity",
          "lastRefill is updated so time isn't counted twice",
        ],
        keywords: [
          ["elapsed", "time passed", "since last", "time since", "seconds", "proportional", "how long"],
          ["cap", "never exceed", "not more than", "max", "capacity", "overflow", "ceiling", "min"],
          ["lastrefill", "last refill", "timestamp", "counted twice", "double", "reset the time", "update the time"],
        ],
        hint: "Imagine a client who has been idle for an hour. What would happen without Math.min?",
      },
      {
        id: "c3",
        title: "Finding the caller's bucket",
        from: "return function rateLimit",
        to: "refill(bucket, now);",
        question:
          "How does the middleware identify the caller, and what happens the first time a new client shows up?",
        concepts: [
          "req.ip identifies the client (falls back to 'anonymous')",
          "a new client gets a full bucket",
          "refill runs before checking tokens",
        ],
        keywords: [
          ["ip", "address", "anonymous", "identif"],
          ["new client", "first time", "first request", "full bucket", "starts full", "create", "initial"],
          ["refill", "top up", "before checking", "before the check", "update tokens"],
        ],
        hint: "Look at what `bucket` starts as for someone the Map has never seen.",
      },
      {
        id: "c4",
        title: "Rejecting or allowing",
        from: "if (bucket.tokens < 1)",
        to: "next();",
        question:
          "When is a request rejected, what does the client receive, and what happens to tokens when it's allowed?",
        concepts: [
          "rejected when fewer than one token remains",
          "429 status with a Retry-After header",
          "an allowed request spends one token and calls next()",
        ],
        keywords: [
          ["less than one", "< 1", "fewer than", "no tokens", "out of tokens", "empty", "run out", "zero"],
          ["429", "too many", "retry-after", "retry after", "wait"],
          ["spend", "consume", "subtract", "minus", "decrement", "-= 1", "uses a token", "take a token", "next"],
        ],
        hint: "There are two outcomes here. What does each one do to the bucket and to the response?",
      },
    ],
  },
  {
    id: "retry",
    title: "Retry with exponential backoff",
    language: "python",
    intent: "Decorator that retries flaky network calls with exponential backoff and jitter.",
    blurb: "A Python decorator an agent added around flaky network calls.",
    code: RETRY,
    chunks: [
      {
        id: "c1",
        title: "A decorator factory",
        from: "def retry(",
        to: "def wrapper(*args, **kwargs):",
        question:
          "Why are there three nested functions (`retry`, `decorator`, `wrapper`), and what does `@wraps` preserve?",
        concepts: [
          "retry takes configuration and returns the real decorator",
          "wrapper replaces the original function and accepts any arguments",
          "@wraps keeps the original function's name and docstring",
        ],
        keywords: [
          ["configur", "parameters", "arguments to the decorator", "factory", "returns a decorator", "options"],
          ["wrapper", "replaces", "wraps the function", "*args", "any arguments", "calls the original"],
          ["name", "docstring", "metadata", "__name__", "identity", "introspect"],
        ],
        hint: "`@retry(max_attempts=4)` is called *before* it decorates anything. What does that call return?",
      },
      {
        id: "c2",
        title: "Which errors are retried",
        from: "last_error = None",
        to: "break",
        question:
          "Which failures get retried and which escape immediately? What happens on the final attempt?",
        concepts: [
          "only exceptions in retry_on are caught",
          "other exceptions propagate immediately",
          "on the last attempt the loop stops instead of sleeping",
        ],
        keywords: [
          ["retry_on", "connectionerror", "timeouterror", "network", "listed", "specific exceptions", "only those"],
          ["other errors", "other exceptions", "not caught", "propagat", "escape", "immediately", "bubble"],
          ["last attempt", "final attempt", "max_attempts", "break", "stop", "no more", "gives up"],
        ],
        hint: "What happens if the function raises a ValueError instead of a ConnectionError?",
      },
      {
        id: "c3",
        title: "Backoff with jitter",
        from: "delay = min(max_delay",
        to: "time.sleep(delay)",
        question: "How does the delay grow between attempts, and why is it randomised with `random.uniform`?",
        concepts: [
          "delay doubles each attempt (exponential backoff)",
          "max_delay caps the wait",
          "random jitter spreads out retries from many clients",
        ],
        keywords: [
          ["double", "exponential", "2 **", "power of two", "grows", "increases each"],
          ["cap", "max_delay", "maximum", "never longer", "ceiling", "min("],
          ["jitter", "random", "thundering herd", "spread", "not all at once", "same time", "synchroni"],
        ],
        hint: "Picture 1,000 clients that all failed at the same second. What happens if they all wait exactly 1s?",
      },
      {
        id: "c4",
        title: "Giving up",
        from: "raise RetryError",
        to: "return client.get",
        question:
          "What does the caller see when every attempt fails, and why use `raise … from last_error`?",
        concepts: [
          "a RetryError is raised after all attempts fail",
          "`from last_error` chains the original exception for debugging",
          "fetch_profile is retried up to 4 times",
        ],
        keywords: [
          ["retryerror", "custom error", "gave up", "exception is raised", "raises an error"],
          ["chain", "original", "cause", "__cause__", "traceback", "underlying", "root"],
          ["4", "four", "fetch_profile", "max_attempts=4"],
        ],
        hint: "When you read the traceback later, what would you want to see besides 'Gave up'?",
      },
    ],
  },
  {
    id: "search-hook",
    title: "Debounced search hook",
    language: "typescript",
    intent: "React hook that searches as the user types without flooding the API.",
    blurb: "A React hook an agent generated for search-as-you-type.",
    code: SEARCH_HOOK,
    chunks: [
      {
        id: "c1",
        title: "State the hook exposes",
        from: "export function useDebouncedSearch",
        to: "const [error, setError]",
        question: "What three pieces of state does the hook keep, and who reads them?",
        concepts: [
          "results holds the search hits",
          "loading and error describe the request status",
          "the component using the hook reads all three",
        ],
        keywords: [
          ["results", "hits", "matches", "list"],
          ["loading", "error", "status", "spinner", "in progress", "failed"],
          ["component", "caller", "ui", "returned", "consumer", "render"],
        ],
        hint: "Look at the very last line of the hook.",
      },
      {
        id: "c2",
        title: "Skipping short queries",
        from: "useEffect(() => {",
        to: "return;\n    }",
        question: "Why does the effect bail out early, and what does the user see when it does?",
        concepts: [
          "queries under 2 characters are ignored",
          "results are cleared",
          "no request is made",
        ],
        keywords: [
          ["2", "two", "short", "too short", "length", "trim", "empty"],
          ["clear", "empty array", "reset", "no results", "setresults([])"],
          ["no request", "no fetch", "doesn't call", "skip", "avoid", "bail", "not search"],
        ],
        hint: "What does `query.trim().length < 2` protect the API from?",
      },
      {
        id: "c3",
        title: "Debounced fetch",
        from: "const controller = new AbortController();",
        to: "}, delay);",
        question:
          "Explain the `setTimeout` + `fetch` combination. When does the request actually fire, and how are errors handled?",
        concepts: [
          "the request waits `delay` ms after typing stops (debounce)",
          "the AbortController signal lets the request be cancelled",
          "AbortError is ignored; other errors are shown; loading resets in finally",
        ],
        keywords: [
          ["debounce", "wait", "delay", "300", "stops typing", "pause", "after typing", "timer"],
          ["abort", "cancel", "signal", "controller"],
          ["aborterror", "ignore", "error message", "seterror", "finally", "loading false", "res.ok"],
        ],
        hint: "Why would an *aborted* request not count as a real error to show the user?",
      },
      {
        id: "c4",
        title: "Cleanup on every keystroke",
        from: "return () => {",
        to: "}, [query, delay]);",
        question:
          "What does the cleanup function do, and when does React run it? What bug would happen without it?",
        concepts: [
          "cleanup runs before the next effect and on unmount",
          "clearTimeout cancels a pending search",
          "abort stops an in-flight request so stale results can't overwrite new ones",
        ],
        keywords: [
          ["before the next", "re-run", "rerun", "unmount", "query changes", "every keystroke", "dependency"],
          ["cleartimeout", "cancel the timer", "pending", "timer"],
          ["stale", "race", "out of order", "old results", "overwrite", "abort", "in-flight", "previous request"],
        ],
        hint: "Type 'rea' then 'react' quickly. Which response could arrive last?",
      },
    ],
  },
];

function findLine(lines: string[], needle: string, fromIndex: number): number {
  const firstLine = needle.split("\n")[0];
  for (let i = fromIndex; i < lines.length; i++) {
    if (lines[i].includes(firstLine)) {
      return i + needle.split("\n").length - 1;
    }
  }
  throw new Error(`Sample anchor not found: ${needle}`);
}

function resolve(def: SampleDef): Sample {
  const lines = def.code.split("\n");
  let cursor = 0;
  const chunks: Chunk[] = def.chunks.map((c) => {
    const start = findLine(lines, c.from, cursor) - (c.from.split("\n").length - 1);
    const end = findLine(lines, c.to, start);
    cursor = end + 1;
    return {
      id: c.id,
      title: c.title,
      startLine: start + 1,
      endLine: end + 1,
      question: c.question,
      concepts: c.concepts,
      hint: c.hint,
    };
  });
  return {
    id: def.id,
    title: def.title,
    language: def.language,
    intent: def.intent,
    blurb: def.blurb,
    code: def.code,
    chunks,
    keywords: Object.fromEntries(def.chunks.map((c) => [c.id, c.keywords])),
  };
}

export const SAMPLES: Sample[] = DEFS.map(resolve);

export function getSample(id: string | undefined): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}

/** Does this code exactly match a built-in sample? (Edited samples are treated as custom code.) */
export function sampleForCode(id: string | undefined, code: string): Sample | undefined {
  const s = getSample(id);
  return s && s.code.trim() === code.trim() ? s : undefined;
}
