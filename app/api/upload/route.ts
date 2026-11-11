import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { cleanUploadId, findByUploadId } from "@/lib/dedupe";
import { deleteObject } from "@/lib/s3";
import { storeImage, UploadError } from "@/lib/upload";

export const runtime = "nodejs";

function clean(v: FormDataEntryValue | null, max: number) {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const uploadId = cleanUploadId(form.get("uploadId"));
  // already saved (double tap or retry): answer with the existing post instead of saving it again
  const existing = await findByUploadId(uploadId);
  if (existing) return NextResponse.json({ id: existing.id, duplicate: true });

  let key: string;
  try {
    key = await storeImage(form.get("file"), "photos");
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [row] = await getDb()
    .insert(posts)
    .values({
      imageKey: key,
      name: clean(form.get("name"), 80),
      message: clean(form.get("message"), 500),
      uploadId,
    })
    .onConflictDoNothing({ target: posts.uploadId })
    .returning({ id: posts.id });

  if (!row) {
    // the same upload finished at the same moment in another request
    await deleteObject(key).catch(() => {});
    const dup = await findByUploadId(uploadId);
    return NextResponse.json({ id: dup?.id, duplicate: true });
  }
  return NextResponse.json({ id: row.id });
}
