/**
 * Browser walk-through of the full core journey (`npm run e2e`, server on BASE_URL).
 * New → sample → analyze → answer (strong / vague / hint / skip) → report → library.
 * Saves screenshots to docs/screenshots and fails on any page error.
 */
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = "docs/screenshots";
const scheme = (process.env.SCHEME as "light" | "dark") ?? "light";
mkdirSync(out, { recursive: true });

const STRONG = [
  "Each client IP gets its own bucket stored in the Map, so one noisy client can't use up anyone else's allowance. Capacity is the maximum burst of requests and refillPerSecond is the sustained rate tokens come back at.",
  "",
  "",
  "If the bucket has fewer than one token the request is rejected with a 429 Too Many Requests and a Retry-After header saying how long to wait. Otherwise it spends one token and calls next() to let the request through.",
];
const VAGUE = "It refills the bucket with some more tokens so it works.";

async function shot(page: Page, name: string) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${scheme}-${name}.png`, fullPage: false });
  console.log(`shot  ${name}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, colorScheme: scheme });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(base + "/");
  await shot(page, "1-home");

  await page.goto(base + "/library");
  await page.getByText("No teach-backs yet").waitFor();
  await shot(page, "2-library-empty");

  await page.goto(base + "/new");
  await page.getByRole("button", { name: /Token-bucket rate limiter/ }).click();
  await shot(page, "3-new-sample");
  await page.getByRole("button", { name: /Analyze & start/ }).click();
  await page.waitForURL(/\/session\/[^/]+$/);
  await page.getByText("Chunk 1 of").waitFor();
  await shot(page, "4-session-start");

  const box = page.getByLabel("Your explanation");
  const submit = page.getByRole("button", { name: /Submit explanation|Re-grade/ });
  const next = page.getByRole("button", { name: /Next chunk|See your Ownership Map/ });

  // 1: strong answer
  await box.fill(STRONG[0]);
  await submit.click();
  await page.locator(".verdict").waitFor();
  await shot(page, "5-verdict-owned");
  await next.click();

  // 2: vague answer
  await box.fill(VAGUE);
  await submit.click();
  await page.locator(".verdict").waitFor();
  await shot(page, "6-verdict-gap");
  await next.click();

  // 3: hint then skip
  await page.getByRole("button", { name: /^Hint/ }).click();
  await page.locator(".hint-box").waitFor();
  await page.getByRole("button", { name: /skip/ }).click();
  await next.click();

  // 4: strong answer, then go to the report
  await box.fill(STRONG[3]);
  await submit.click();
  await page.locator(".verdict").waitFor();
  await shot(page, "7-session-painted");
  await page.getByRole("button", { name: /See your Ownership Map/ }).click();
  await page.waitForURL(/\/report$/);
  await page.getByText("Teach me my blind spots").waitFor();
  await page.waitForTimeout(1100); // let the dial count up
  await shot(page, "8-report");
  const prompt = await page.locator(".prompt-box").innerText();
  if (!/Teach me/.test(prompt) || !/Refilling tokens/.test(prompt)) throw new Error("blind-spot prompt missing content");

  // Retake to get a trend line, answer everything strongly-ish
  await page.getByRole("button", { name: "Retake this code" }).click();
  await page.waitForURL(/\/session\/[^/]+$/);
  for (let i = 0; i < 4; i++) {
    await box.fill(
      STRONG[i] ||
        "It works out how much time has elapsed since lastRefill, adds tokens proportional to that, caps them at capacity with Math.min so idle clients can't bank more, and updates lastRefill so time isn't counted twice. For a new client it creates a full bucket keyed by req.ip and refills before checking.",
    );
    await submit.click();
    await page.locator(".verdict").waitFor();
    await next.click();
  }
  await page.waitForURL(/\/report$/);
  await page.getByText(/since your last attempt/).waitFor();
  await page.waitForTimeout(1100);
  await shot(page, "9-report-retake");

  await page.goto(base + "/library");
  await page.getByText("Your ownership over time").waitFor();
  await shot(page, "10-library");

  // Mobile layout check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/");
  await shot(page, "11-home-mobile");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push("horizontal overflow on mobile home");

  await browser.close();
  if (errors.length) {
    console.error("FAIL\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("PASS  full journey");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
