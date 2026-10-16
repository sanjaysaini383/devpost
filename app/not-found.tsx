import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card empty stack" style={{ alignItems: "center" }}>
      <p className="eyebrow">404</p>
      <h2>This page is a blind spot.</h2>
      <p className="muted">There's nothing here — but there's plenty of code to explain.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn primary" href="/">
          Home
        </Link>
        <Link className="btn" href="/library">
          Library
        </Link>
      </div>
    </div>
  );
}
