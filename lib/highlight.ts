/**
 * A deliberately tiny per-line highlighter. It handles the common cases (keywords,
 * strings, comments, numbers) well enough for reading, and keeps each line independent
 * so the heat gutter can sit beside it. Multi-line strings/comments are not tracked.
 */
export type TokenKind = "kw" | "str" | "com" | "num" | "fn" | "plain";
export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set(
  (
    "import from export default function return const let var if else for while do break continue " +
    "new class extends interface type async await try catch finally throw raise def lambda with as " +
    "in of is not and or None True False null undefined true false this self yield pass elif except " +
    "public private protected static readonly enum implements package struct func go defer fn pub use " +
    "mut impl match switch case typeof instanceof void delete"
  ).split(" "),
);

// Groups: 1 comment | 2 string | 3 number | 4 called identifier | 5 identifier
const REST =
  /|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/
    .source;
const SLASH_RE = new RegExp(/(\/\/.*$)/.source + REST, "g");
const HASH_RE = new RegExp(/(#.*$)/.source + REST, "g");

export function highlightLine(line: string, language: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const re = /python|ruby|shell|bash|yaml|toml/.test(language) ? HASH_RE : SLASH_RE;
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ kind: "plain", text: line.slice(last, idx) });
    const [text, com, str, num, fnName, word] = m;
    if (com) tokens.push({ kind: "com", text });
    else if (str) tokens.push({ kind: "str", text });
    else if (num) tokens.push({ kind: "num", text });
    else if (fnName) tokens.push({ kind: KEYWORDS.has(fnName) ? "kw" : "fn", text });
    else if (word) tokens.push({ kind: KEYWORDS.has(word) ? "kw" : "plain", text });
    else tokens.push({ kind: "plain", text });
    last = idx + text.length;
  }
  if (last < line.length) tokens.push({ kind: "plain", text: line.slice(last) });
  return tokens;
}
