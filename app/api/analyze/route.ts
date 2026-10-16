import { NextResponse } from "next/server";
import { analyzeCode, GraderError, hasApiKey } from "@/lib/ai";
import { demoAnalyze } from "@/lib/demo";
import { sampleForCode } from "@/lib/samples";
import { AnalyzeBody } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = AnalyzeBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  const forceDemo = new URL(request.url).searchParams.get("demo") === "1";
  if (forceDemo || !hasApiKey()) return NextResponse.json(demoAnalyze(body));

  // Unedited samples keep their curated chunks; Claude still grades the answers.
  const sample = sampleForCode(body.sampleId, body.code);
  if (sample) return NextResponse.json({ mode: "ai", title: sample.title, chunks: sample.chunks });

  try {
    return NextResponse.json(await analyzeCode(body));
  } catch (err) {
    const message = err instanceof GraderError ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
