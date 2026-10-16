import { NextResponse } from "next/server";
import { hasApiKey, MODEL } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const ai = hasApiKey();
  return NextResponse.json({ ai, model: ai ? MODEL : null });
}
