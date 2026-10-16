import Link from "next/link";

export default function Home() {
  return (
    <div className="stack">
      <h1>Explain your AI-written code back.</h1>
      <Link className="btn primary" href="/new">Start a teach-back</Link>
    </div>
  );
}
