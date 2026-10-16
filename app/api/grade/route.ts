import { NextResponse } from "next/server";
import { demoGrade } from "@/lib/demo";
import { GradeBody } from "@/lib/validate";

export async function POST(request: Request) {
  const parsed = GradeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  return NextResponse.json(demoGrade(parsed.data));
}
