import Link from "next/link";
import { LibraryView } from "@/components/LibraryView";

export const metadata = { title: "Library — TeachBack" };

export default function LibraryPage() {
  return (
    <>
      <div className="row" style={{ marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <p className="eyebrow">Library</p>
          <h1 style={{ fontSize: "2.4rem" }}>Everything you've explained back</h1>
        </div>
        <span className="spacer" />
        <Link className="btn primary" href="/new">
          New session
        </Link>
      </div>
      <LibraryView />
    </>
  );
}
