import { NextResponse } from "next/server";
import { demoAnalyze } from "@/lib/demo";
import { AnalyzeBody } from "@/lib/validate";

export async function POST(request: Request) {
  const parsed = AnalyzeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  return NextResponse.json(demoAnalyze(parsed.data));
}
