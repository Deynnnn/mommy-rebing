import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "node:crypto";
import { pipeline, Readable, Transform } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { bucket, deleteObject, getS3, putImage } from "./s3";

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

function datedKey(folder: string, ext: string) {
  return `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
}

/** Validates an uploaded image and stores it in the bucket under `<folder>/<date>/<uuid>.<ext>`. */
export async function storeImage(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File)) throw new UploadError("No photo received.", 400);
  const ext = TYPES[file.type];
  if (!ext) throw new UploadError("Please upload a JPG, PNG or WebP photo.", 415);
  if (file.size > MAX_BYTES) throw new UploadError("Photo is too large (max 10 MB).", 413);
  const key = datedKey(folder, ext);
  await putImage(key, Buffer.from(await file.arrayBuffer()), file.type);
  return key;
}

export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
};

/**
 * Streams a raw request body (a video file) to the bucket without holding it in memory.
 * Aborts if the body grows past MAX_VIDEO_BYTES or the client disconnects.
 */
export async function storeVideoStream(
  body: ReadableStream<Uint8Array> | null,
  contentType: string,
  length: number,
) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const ext = VIDEO_TYPES[type];
  if (!ext) throw new UploadError("Please upload an MP4, MOV or WebM video.", 415);
  if (!body) throw new UploadError("No video received.", 400);
  if (length > MAX_VIDEO_BYTES) throw new UploadError("Video is too large (max 300 MB). Try a shorter clip.", 413);

  let seen = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > MAX_VIDEO_BYTES) cb(new UploadError("Video is too large (max 300 MB).", 413));
      else cb(null, chunk);
    },
  });
  // pipeline() tears down both streams if either side fails (e.g. the guest's connection drops).
  const stream = pipeline(Readable.fromWeb(body as NodeWebStream<Uint8Array>), limiter, () => {});

  const key = datedKey("videos", ext);
  const upload = new Upload({
    client: getS3(),
    params: { Bucket: bucket(), Key: key, Body: stream, ContentType: type },
    queueSize: 3,
    partSize: 8 * 1024 * 1024,
  });
  try {
    await upload.done();
  } catch (e) {
    await upload.abort().catch(() => {});
    throw e;
  }
  if (seen === 0) {
    await deleteObject(key).catch(() => {});
    throw new UploadError("No video received.", 400);
  }
  return key;
}
