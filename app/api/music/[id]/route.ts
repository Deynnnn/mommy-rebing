import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { tracks } from "@/db/schema";
import { presignGet } from "@/lib/s3";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/** Redirects to a signed bucket URL for the song. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const [row] = await getDb().select({ key: tracks.audioKey }).from(tracks).where(eq(tracks.id, id)).limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(await presignGet(row.key, 6 * 3600), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=3000" },
  });
}
