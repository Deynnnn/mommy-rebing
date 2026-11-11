import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { writeSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await writeSettings(body));
}
