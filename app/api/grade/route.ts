import { NextResponse } from "next/server";
import { gradeAnswer, GraderError, hasApiKey } from "@/lib/ai";
import { demoGrade } from "@/lib/demo";
import { GradeBody } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = GradeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const forceDemo = new URL(request.url).searchParams.get("demo") === "1";
  if (forceDemo || !hasApiKey()) return NextResponse.json(demoGrade(parsed.data));

  try {
    return NextResponse.json(await gradeAnswer(parsed.data));
  } catch (err) {
    const message = err instanceof GraderError ? err.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
