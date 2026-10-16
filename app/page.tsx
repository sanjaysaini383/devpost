import Link from "next/link";
import { HomeDemo } from "@/components/HomeDemo";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">For people who build with AI coding agents</p>
          <h1 style={{ marginTop: 12 }}>
            Your AI wrote it. <span className="highlight">Can you explain it?</span>
          </h1>
          <p className="lede">
            Paste the code your agent wrote, explain it back in your own words, and get a line-by-line map of what you
            actually understand — before it ships.
          </p>
          <div className="row">
            <Link className="btn primary" href="/new">
              Start a teach-back →
            </Link>
            <Link className="btn" href="/new?sample=rate-limiter">
              Try a 2-minute sample
            </Link>
          </div>
        </div>
        <HomeDemo />
      </section>

      <section className="steps" aria-label="How it works">
        <div className="card pad stack">
          <span className="step-num">1</span>
          <h3>Bring the code</h3>
          <p className="muted">
            Paste a function, component or script your agent wrote. TeachBack splits it into the few chunks that carry
            the real decisions.
          </p>
        </div>
        <div className="card pad stack">
          <span className="step-num">2</span>
          <h3>Explain it back</h3>
          <p className="muted">
            One review-style question per chunk. Answer in plain words. Claude grades the <em>understanding</em>, not
            your vocabulary, and tells you what you missed.
          </p>
        </div>
        <div className="card pad stack">
          <span className="step-num">3</span>
          <h3>See your Ownership Map</h3>
          <p className="muted">
            Every line painted owned, shaky or blind spot — plus a prompt that turns your gaps into a lesson from your
            own coding agent.
          </p>
        </div>
      </section>

      <section className="why">
        <div className="card pad stack">
          <p className="eyebrow">The problem</p>
          <h2>"It works" isn't the same as "I get it."</h2>
          <p className="muted">
            Agents hand back code that runs but that you couldn't defend in a code review, debug at 2 a.m., or safely
            change next week. Asking the AI to "explain this" gives you a wall of text you read passively and forget.
          </p>
        </div>
        <div className="card pad stack">
          <p className="eyebrow">The method</p>
          <h2>Teach-back, from medicine to code.</h2>
          <p className="muted">
            Nurses confirm a patient understood instructions by asking them to explain it back. Retrieval beats
            re-reading. TeachBack applies that to AI pair programming — and then flips it: your blind spots become a
            prompt that has your agent quiz <em>you</em>.
          </p>
          <div className="row">
            <Link className="btn primary" href="/new">
              Check your own code
            </Link>
            <Link className="btn ghost" href="/library">
              Your library
            </Link>
          </div>
        </div>
      </section>

      <p className="muted small" style={{ textAlign: "center", marginTop: 48 }}>
        Built for Devpost Learn's Build With AI: Basics with the Devpost Learn Skill Pack. Sessions stay in your
        browser.
      </p>
    </>
  );
}
