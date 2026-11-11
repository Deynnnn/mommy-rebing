import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { cleanUploadId, findByUploadId } from "@/lib/dedupe";
import { deleteObject } from "@/lib/s3";
import { storeVideoStream, UploadError } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 900;

function clean(v: string | null, max: number) {
  const t = (v ?? "").trim().slice(0, max);
  return t.length ? t : null;
}

/**
 * Raw video upload: the request body is the file itself (not multipart) so it can be streamed.
 * Guest name and message come as query parameters.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const uploadId = cleanUploadId(req.headers.get("x-upload-id"));
  // already saved (a retry after the response was lost): don't store the video again
  const existing = await findByUploadId(uploadId);
  if (existing) {
    req.body?.cancel().catch(() => {});
    return NextResponse.json({ id: existing.id, duplicate: true });
  }

  let key: string;
  try {
    key = await storeVideoStream(
      req.body,
      req.headers.get("content-type") || "",
      Number(req.headers.get("content-length") || 0),
    );
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("video upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const [row] = await getDb()
    .insert(posts)
    .values({
      imageKey: key,
      mediaType: "video",
      name: clean(url.searchParams.get("name"), 80),
      message: clean(url.searchParams.get("message"), 500),
      uploadId,
    })
    .onConflictDoNothing({ target: posts.uploadId })
    .returning({ id: posts.id });

  if (!row) {
    await deleteObject(key).catch(() => {});
    const dup = await findByUploadId(uploadId);
    return NextResponse.json({ id: dup?.id, duplicate: true });
  }
  return NextResponse.json({ id: row.id });
}
