import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { portraits } from "@/db/schema";
import { Readable } from "node:stream";
import { getObjectStream, presignGet } from "@/lib/s3";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Redirects to a signed bucket URL. With `?raw=1` the bytes are streamed from this site instead,
 * so the browser can draw the photo onto a canvas (used for the story image on /qr).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const [row] = await getDb()
    .select({ key: portraits.imageKey })
    .from(portraits)
    .where(eq(portraits.id, id))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (new URL(req.url).searchParams.get("raw") === "1") {
    const body = await getObjectStream(row.key);
    const ext = row.key.split(".").pop()?.toLowerCase();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new Response(Readable.toWeb(body) as ReadableStream, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
    });
  }
  return NextResponse.redirect(await presignGet(row.key, 3600), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=3000" },
  });
}
