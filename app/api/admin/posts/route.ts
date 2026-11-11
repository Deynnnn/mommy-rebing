import { asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin";
import { parseIds } from "@/lib/ids";
import { deleteObject } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb().select().from(posts).orderBy(asc(posts.sortOrder), asc(posts.createdAt));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}

/** Permanently deletes uploads and their files. Body: { ids: [...] }. */
export async function DELETE(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { ids: raw } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = parseIds(raw);
  if (!ids || !ids.length) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const rows = await getDb().delete(posts).where(inArray(posts.id, ids)).returning({ key: posts.imageKey });
  // remove the files after the rows, a few at a time; a leftover file is harmless
  for (let i = 0; i < rows.length; i += 10) {
    await Promise.all(rows.slice(i, i + 10).map((r) => deleteObject(r.key).catch(() => {})));
  }
  return NextResponse.json({ deleted: rows.length });
}
