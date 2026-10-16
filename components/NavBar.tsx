"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGraderStatus } from "@/lib/status";

export function NavBar() {
  const pathname = usePathname();
  const status = useGraderStatus();
  const current = (href: string) =>
    (href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "page" : undefined;

  return (
    <header className="nav">
      <Link href="/" className="brand" aria-label="TeachBack home">
        <span className="brand-mark" aria-hidden>
          <span style={{ background: "var(--owned)" }} />
          <span style={{ background: "var(--shaky)" }} />
          <span style={{ background: "var(--gap)" }} />
        </span>
        TeachBack
      </Link>
      <nav className="nav-links" aria-label="Main">
        <Link href="/new" aria-current={current("/new")}>
          New session
        </Link>
        <Link href="/library" aria-current={current("/library")}>
          Library
        </Link>
        {status && (
          <span
            className={`mode-badge ${status.ai ? "ai" : "demo"}`}
            title={
              status.ai
                ? "Chunking and grading by Claude Opus 5.5"
                : "No ANTHROPIC_API_KEY set: using the offline keyword-matching demo grader"
            }
          >
            {status.ai ? "AI grader" : "Demo grader"}
          </span>
        )}
      </nav>
    </header>
  );
}
