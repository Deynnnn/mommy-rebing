import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readSettings(), { headers: { "Cache-Control": "no-store" } });
}
