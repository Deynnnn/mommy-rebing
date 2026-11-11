import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getDb()
    .select({ id: posts.id, name: posts.name, message: posts.message, createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.hidden, false))
    .orderBy(desc(posts.createdAt))
    .limit(1000);
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
