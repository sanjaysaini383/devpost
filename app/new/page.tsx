import { Suspense } from "react";
import { NewSessionForm } from "@/components/NewSessionForm";

export const metadata = { title: "New session — TeachBack" };

export default function NewPage() {
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <p className="eyebrow">New teach-back</p>
        <h1 style={{ fontSize: "2.4rem" }}>What did your agent write?</h1>
      </div>
      <Suspense>
        <NewSessionForm />
      </Suspense>
    </>
  );
}
