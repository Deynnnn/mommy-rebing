import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Visible posts in the order the family arranged them in /admin. */
export async function GET() {
  const rows = await getDb()
    .select({
      id: posts.id,
      name: posts.name,
      message: posts.message,
      createdAt: posts.createdAt,
      mediaType: posts.mediaType,
    })
    .from(posts)
    .where(eq(posts.hidden, false))
    .orderBy(asc(posts.sortOrder), asc(posts.createdAt))
    .limit(2000);
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
