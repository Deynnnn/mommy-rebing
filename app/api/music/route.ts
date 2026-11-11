import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { tracks } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The slideshow playlist, in the admin's order. */
export async function GET() {
  const rows = await getDb()
    .select({ id: tracks.id, title: tracks.title })
    .from(tracks)
    .orderBy(asc(tracks.sortOrder), asc(tracks.createdAt));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
