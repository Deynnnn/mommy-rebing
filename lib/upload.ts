import { randomUUID } from "node:crypto";
import { putImage } from "./s3";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class UploadError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Validates an uploaded image and stores it in the bucket under `<folder>/<date>/<uuid>.<ext>`. */
export async function storeImage(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File)) throw new UploadError("No photo received.", 400);
  const ext = TYPES[file.type];
  if (!ext) throw new UploadError("Please upload a JPG, PNG or WebP photo.", 415);
  if (file.size > MAX_BYTES) throw new UploadError("Photo is too large (max 10 MB).", 413);
  const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  await putImage(key, Buffer.from(await file.arrayBuffer()), file.type);
  return key;
}
