/**
 * Records a silent demo walk-through of the real app (`npm run record`, server on BASE_URL).
 * Output: demo/teachback-demo.webm (convert to mp4 with ffmpeg; see README).
 *
 * Everything shown is the live app with live grading. The only simulated input is the
 * microphone for the voice segment (headless browsers have none), and the video says so
 * on screen while it happens.
 */
import { chromium, type Locator, type Page } from "playwright";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const W = 1280;
const H = 720;
const OUT = "demo";

const ANSWERS = {
  c1: "Each client IP gets its own bucket in the Map, so one noisy client can't use up anyone else's allowance. Capacity is the maximum burst of requests, and refillPerSecond is the sustained rate tokens come back at.",
  c2vague: "It refills the bucket so it works.",
  c2good:
    "It works out how much time has elapsed since lastRefill and adds tokens proportional to that. Math.min caps the total at capacity so an idle client can't bank unlimited tokens, and lastRefill is updated so the same time isn't counted twice.",
  c3voice:
    "it uses req.ip to identify the caller and falls back to anonymous. A brand new client gets a full bucket, and refill runs before the token check so the count is up to date",
};

// ---- in-page helpers (plain JS strings: tsx-compiled functions don't survive serialisation) ----

const CURSOR = `
  (() => {
    const install = () => {
      if (document.getElementById("__cursor")) return;
      const c = document.createElement("div");
      c.id = "__cursor";
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none",
        transform: "translate(-200px,-200px)", transition: "transform 0.02s linear", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))" });
      document.body.appendChild(c);
      const ring = document.createElement("div");
      ring.id = "__ring";
      Object.assign(ring.style, { position: "fixed", width: "34px", height: "34px", marginLeft: "-17px", marginTop: "-17px",
        borderRadius: "50%", border: "3px solid #1f6f5c", zIndex: 2147483646, pointerEvents: "none", opacity: "0", left: "0", top: "0" });
      document.body.appendChild(ring);
      document.addEventListener("mousemove", (e) => { c.style.transform = "translate(" + (e.clientX - 3) + "px," + (e.clientY - 2) + "px)"; }, true);
      document.addEventListener("mousedown", (e) => {
        ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
        ring.animate([{ opacity: 0.9, transform: "scale(0.4)" }, { opacity: 0, transform: "scale(1.4)" }], { duration: 450 });
      }, true);
    };
    if (document.body) install(); else document.addEventListener("DOMContentLoaded", install);
  })();`;

const FAKE_MIC = (spoken: string) => `
  (() => {
    const spoken = ${JSON.stringify(spoken)};
    function FakeRecognition() { this.onresult = null; this.onerror = null; this.onend = null; this.timers = []; }
    FakeRecognition.prototype.start = function () {
      const words = spoken.split(" ");
      const emit = (text, isFinal) => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
      // Reveal the phrase word by word like real dictation, then finalise it.
      words.forEach((_, i) => this.timers.push(setTimeout(() => emit(words.slice(0, i + 1).join(" "), false), 350 + i * 170)));
      this.timers.push(setTimeout(() => emit(spoken, true), 350 + words.length * 170 + 400));
    };
    FakeRecognition.prototype.stop = function () { this.timers.forEach(clearTimeout); setTimeout(() => this.onend && this.onend(), 50); };
    FakeRecognition.prototype.abort = FakeRecognition.prototype.stop;
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  })();`;

async function caption(page: Page, text: string | null) {
  await page.evaluate(
    `(() => {
      let el = document.getElementById("__caption");
      const text = ${JSON.stringify(text)};
      if (!text) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement("div");
        el.id = "__caption";
        Object.assign(el.style, { position: "fixed", left: "50%", bottom: "22px", transform: "translateX(-50%)", zIndex: 2147483645,
          background: "rgba(29,27,22,.88)", color: "#fff", padding: "8px 16px", borderRadius: "999px",
          font: "500 14px system-ui, sans-serif", pointerEvents: "none" });
        document.body.appendChild(el);
      }
      el.textContent = text;
    })()`,
  );
}

async function card(page: Page, title: string, subtitle: string, ms: number) {
  await page.setContent(
    `<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#f6f1e7;font-family:Georgia,serif;color:#1d1b16">
      <div style="text-align:center">
        <div style="display:inline-grid;grid-template-columns:repeat(3,14px);gap:7px;margin-bottom:22px">
          <span style="height:44px;border-radius:4px;background:#2f9e7a"></span>
          <span style="height:44px;border-radius:4px;background:#e0a526"></span>
          <span style="height:44px;border-radius:4px;background:#e0533d"></span>
        </div>
        <div style="font-size:64px;font-weight:700;letter-spacing:-1px">${title}</div>
        <div style="font:400 24px system-ui,sans-serif;color:#3a362d;margin-top:14px">${subtitle}</div>
      </div></body></html>`,
  );
  await page.waitForTimeout(ms);
}

// ---- human-ish interaction ----

let mouse = { x: W / 2, y: H / 2 };

async function moveTo(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("element not visible");
  const x = box.x + Math.min(box.width / 2, 60);
  const y = box.y + box.height / 2;
  const steps = Math.max(12, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 18));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
  await page.waitForTimeout(180);
}

async function click(page: Page, target: Locator, pause = 350) {
  await moveTo(page, target);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(pause);
}

async function type(page: Page, target: Locator, text: string) {
  await click(page, target, 200);
  await target.pressSequentially(text, { delay: 10 });
  await page.waitForTimeout(500);
}

async function smoothScroll(page: Page, y: number, ms = 900) {
  await page.evaluate(`window.scrollTo({ top: ${y}, behavior: "smooth" })`);
  await page.waitForTimeout(ms);
}

export let retries = 0;
// Wall-clock reference for the video timeline, and the grading waits to trim in post.
let t0 = 0;
const waits: Array<[number, number]> = [];
const now = () => (Date.now() - t0) / 1000;

/** Submit, wait for grading to finish, and retry (visibly, via the app's own button) on errors. */
async function grade(page: Page) {
  await click(page, page.getByRole("button", { name: /Submit explanation|Re-grade/ }), 100);
  const start = now();
  for (let attempt = 0; ; attempt++) {
    await page.getByText("Grading…").waitFor({ state: "hidden", timeout: 120_000 });
    const failed = await page.getByText("The grader couldn't respond").isVisible();
    if (!failed) break;
    if (attempt >= 4) throw new Error("grading kept failing");
    retries++;
    console.warn(`grading failed, retry ${attempt + 1}`);
    await page.waitForTimeout(8000);
    await click(page, page.getByRole("button", { name: "Try again" }), 100);
  }
  await page.locator(".verdict").waitFor({ timeout: 10_000 });
  waits.push([start, now()]);
  await page.waitForTimeout(2600); // let the verdict and line colours land
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
    colorScheme: "light",
  });
  await context.addInitScript({ content: CURSOR });
  await context.addInitScript({ content: FAKE_MIC(ANSWERS.c3voice) });
  const page = await context.newPage();
  t0 = Date.now();
  page.on("pageerror", (e) => console.error("pageerror:", e.message));

  // 1. Title
  await card(page, "TeachBack", "Your AI wrote it. Can you explain it?", 3200);

  // 2. Home
  await page.goto(base + "/");
  await page.waitForTimeout(4200); // preview paints itself
  await smoothScroll(page, 560, 2600);
  await smoothScroll(page, 0, 1200);

  // 3. Pick a sample
  await click(page, page.getByRole("link", { name: /Try a 2-minute sample/ }), 1600);
  await moveTo(page, page.getByRole("button", { name: /Debounced search hook/ }));
  await moveTo(page, page.getByRole("button", { name: /Token-bucket rate limiter/ }));
  await page.waitForTimeout(700);
  await click(page, page.getByRole("button", { name: /Analyze & start/ }), 300);
  await page.waitForURL(/\/session\/[^/]+$/);
  await page.getByText("Chunk 1 of").waitFor();
  await page.waitForTimeout(2200);

  const box = page.getByLabel("Your explanation");
  const next = () => page.getByRole("button", { name: /Next chunk|See your Ownership Map/ });

  // 4. Chunk 1 — a solid answer
  await type(page, box, ANSWERS.c1);
  await grade(page);
  await click(page, next(), 1200);

  // 5. Chunk 2 — vague answer turns red, then a real explanation turns it green
  await type(page, box, ANSWERS.c2vague);
  await grade(page);
  await page.waitForTimeout(1200);
  await click(page, box, 200);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await box.pressSequentially(ANSWERS.c2good, { delay: 10 });
  await page.waitForTimeout(400);
  await grade(page);
  await click(page, next(), 1200);

  // 6. Chunk 3 — hint, then answer out loud
  await click(page, page.getByRole("button", { name: /^Hint/ }), 2000);
  await caption(page, "Voice answer: microphone input simulated for this recording");
  await click(page, page.getByRole("button", { name: /^Speak/ }), 200);
  await page.waitForFunction(() => (document.querySelector("textarea.text") as HTMLTextAreaElement)?.value.length > 40, null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(900);
  await click(page, page.getByRole("button", { name: /Listening… Stop/ }), 500);
  await caption(page, null);
  await grade(page);
  await click(page, next(), 1200);

  // 7. Chunk 4 — be honest: skip it, so the map shows a real blind spot
  await click(page, page.getByRole("button", { name: /I don't know — skip/ }), 2400);
  await click(page, page.getByRole("button", { name: /See your Ownership Map/ }), 200);

  // 8. Report
  await page.waitForURL(/\/report$/);
  await page.getByText("Teach me my blind spots").waitFor();
  await page.waitForTimeout(3800);
  await click(page, page.getByRole("button", { name: /Copy prompt/ }), 1600);
  await smoothScroll(page, 420, 2600);
  await smoothScroll(page, 1100, 3000);
  await smoothScroll(page, 0, 1500);

  // 9. Library
  await click(page, page.getByRole("link", { name: "Library" }), 3200);

  // 10. End card
  await card(page, "TeachBack", "github.com/sanjaysaini383/devpost", 3000);

  const video = page.video();
  await context.close();
  await browser.close();
  const raw = await video!.path();
  renameSync(raw, `${OUT}/teachback-demo.webm`);
  writeFileSync(`${OUT}/waits.json`, JSON.stringify(waits));
  console.log(`saved ${OUT}/teachback-demo.webm (grading retries shown in video: ${retries})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
