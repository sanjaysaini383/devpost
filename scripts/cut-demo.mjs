// Trims the long grading waits recorded by record-demo.ts and encodes an MP4.
// Usage: FFMPEG=path/to/ffmpeg node scripts/cut-demo.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const KEEP_HEAD = 1.0; // seconds of "Grading…" spinner left in
const KEEP_TAIL = 0.4; // seconds before the verdict appears
const waits = JSON.parse(readFileSync("demo/waits.json", "utf8"));
const cuts = waits
  .map(([a, b]) => [a + KEEP_HEAD, b - KEEP_TAIL])
  .filter(([a, b]) => b - a > 0.5);
const removed = cuts.reduce((s, [a, b]) => s + (b - a), 0);
const expr = cuts.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join("+") || "0";
const vf = `fps=30,select='not(${expr})',setpts=N/30/TB`;
console.log(`cutting ${cuts.length} waits, ${removed.toFixed(1)}s removed`);
execFileSync(ffmpeg, ["-y", "-i", "demo/teachback-demo.webm", "-vf", vf, "-an", "-c:v", "libx264", "-preset", "slow",
  "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "demo/teachback-demo.mp4"], { stdio: "inherit" });
