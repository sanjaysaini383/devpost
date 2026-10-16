import { NextResponse } from "next/server";
import { activeModel, activeProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = activeProvider();
  return NextResponse.json({ ai: provider !== null, provider, model: activeModel() });
}
