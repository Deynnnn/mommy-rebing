import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
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
    })
    .returning({ id: posts.id });

  return NextResponse.json({ id: row.id });
}
