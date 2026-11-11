import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { tracks } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin";
import { deleteObject } from "@/lib/s3";
import { storeAudioStream, UploadError } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 600;

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** Raw upload: the body is the audio file, `?title=` is the song name. */
export async function POST(req: Request) {
  if (!isAdminRequest(req)) return unauthorized();
  const title = (new URL(req.url).searchParams.get("title") ?? "").trim().slice(0, 200) || "Untitled song";
  let key: string;
  try {
    key = await storeAudioStream(
      req.body,
      req.headers.get("content-type") || "",
      Number(req.headers.get("content-length") || 0),
    );
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("music upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  const [row] = await getDb().insert(tracks).values({ title, audioKey: key }).returning({ id: tracks.id });
  return NextResponse.json({ id: row.id });
}

/** Rename: { id, title }. */
export async function PATCH(req: Request) {
  if (!isAdminRequest(req)) return unauthorized();
  const { id, title } = (await req.json().catch(() => ({}))) as { id?: string; title?: string };
  const t = (title ?? "").trim().slice(0, 200);
  if (!id || !t) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await getDb().update(tracks).set({ title: t }).where(eq(tracks.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isAdminRequest(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const [row] = await getDb().delete(tracks).where(eq(tracks.id, id)).returning();
  if (row) await deleteObject(row.audioKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
