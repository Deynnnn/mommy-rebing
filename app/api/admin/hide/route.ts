import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin";
import { parseIds } from "@/lib/ids";

export const runtime = "nodejs";

/** Hide or show uploads. Body: { id, hidden } or { ids: [...], hidden }. */
export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; ids?: unknown; hidden?: unknown };
  const ids = parseIds(body.ids ?? (body.id ? [body.id] : null));
  if (!ids || !ids.length || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await getDb().update(posts).set({ hidden: body.hidden }).where(inArray(posts.id, ids));
  return NextResponse.json({ ok: true });
}
