import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { posts } from "@/db/schema";

const ID = /^[A-Za-z0-9-]{8,64}$/;

/** The browser's one-time upload id (header or form field), if it looks valid. */
export function cleanUploadId(v: unknown) {
  return typeof v === "string" && ID.test(v) ? v : null;
}

/** The post already saved for this upload id, if any. */
export async function findByUploadId(uploadId: string | null) {
  if (!uploadId) return null;
  const [row] = await getDb().select({ id: posts.id }).from(posts).where(eq(posts.uploadId, uploadId)).limit(1);
  return row ?? null;
}
