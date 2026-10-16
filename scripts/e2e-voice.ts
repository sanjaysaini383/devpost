/**
 * Voice-answer check (`npm run e2e:voice`, server on BASE_URL). No microphone needed:
 * a fake SpeechRecognition is installed that "hears" an interim phrase, then a final one.
 * Also checks that browsers without speech support get a disabled mic button.
 */
import { chromium, type Browser } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
mkdirSync("docs/screenshots", { recursive: true });

const SPOKEN =
  "each client IP gets its own bucket in the map so one client can't use up another's allowance, capacity is the maximum burst and refill per second is the sustained rate";

// Plain-JS strings, not functions: tsx compiles class fields into helpers that don't exist
// inside the browser page, which silently broke a function-based init script.
const fakeSpeech = (spoken: string) => `
  (() => {
    const spoken = ${JSON.stringify(spoken)};
    function FakeRecognition() {
      this.lang = ""; this.continuous = false; this.interimResults = false;
      this.onresult = null; this.onerror = null; this.onend = null; this.timers = [];
    }
    FakeRecognition.prototype.start = function () {
      const emit = (text, isFinal) => this.onresult && this.onresult({
        resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })],
      });
      this.timers.push(setTimeout(() => emit(spoken.split(" ").slice(0, 6).join(" "), false), 300));
      this.timers.push(setTimeout(() => emit(spoken, true), 1500));
    };
    FakeRecognition.prototype.stop = function () {
      this.timers.forEach(clearTimeout);
      setTimeout(() => this.onend && this.onend(), 50);
    };
    FakeRecognition.prototype.abort = FakeRecognition.prototype.stop;
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  })();`;

const NO_SPEECH = `
  Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
  Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });`;

async function openSession(browser: Browser, script: string) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  await page.addInitScript({ content: script });
  await page.goto(base + "/new?sample=rate-limiter");
  await page.getByRole("button", { name: /Analyze & start/ }).click();
  await page.waitForURL(/\/session\/[^/]+$/);
  await page.getByText("Chunk 1 of").waitFor();
  return page;
}

async function main() {
  const browser = await chromium.launch();
  const errors: string[] = [];
  const check = (ok: boolean, label: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) errors.push(label);
  };

  // 1. Supported browser: speak → interim → final text in the box → stop → grade.
  const page = await openSession(browser, fakeSpeech(SPOKEN));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: /^Speak/ }).click();
  await page.locator(".interim").waitFor();
  check((await page.locator(".interim").innerText()).includes("each client IP"), "interim words shown while speaking");
  await page.screenshot({ path: "docs/screenshots/voice-listening.png" });
  const box = page.getByLabel("Your explanation");
  await page.waitForFunction(() => (document.querySelector("textarea.text") as HTMLTextAreaElement)?.value.includes("bucket"));
  check((await box.inputValue()).startsWith("Each client IP gets its own bucket"), "final phrase appended, capitalised");
  await page.getByRole("button", { name: /Listening… Stop/ }).click();
  await page.getByRole("button", { name: /^Speak/ }).waitFor();
  check((await page.locator(".interim").count()) === 0, "stop clears the listening state");
  await page.getByRole("button", { name: /Submit explanation/ }).click();
  await page.locator(".verdict").waitFor({ timeout: 60_000 });
  const score = Number(await page.locator(".verdict .score").innerText());
  check(score >= 60, `spoken answer graded (${score})`);

  // 2. Unsupported browser: button visible but disabled.
  const page2 = await openSession(browser, NO_SPEECH);
  const mic = page2.getByRole("button", { name: /aren't supported/ });
  check((await mic.count()) === 1 && (await mic.isDisabled()), "unsupported browser shows a disabled mic");

  await browser.close();
  if (errors.length) {
    console.error("FAIL\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("PASS  voice answers");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
