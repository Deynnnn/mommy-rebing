import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAdmin(req.headers.get("x-admin-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, hidden } = (await req.json()) as { id?: string; hidden?: boolean };
  if (!id || typeof hidden !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await getDb().update(posts).set({ hidden }).where(eq(posts.id, id));
  return NextResponse.json({ ok: true });
}
