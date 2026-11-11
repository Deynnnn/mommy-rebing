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

type StreamKind = { folder: string; types: Record<string, string>; max: number; noun: string; typeHint: string };

const VIDEO_KIND: StreamKind = {
  folder: "videos",
  types: VIDEO_TYPES,
  max: MAX_VIDEO_BYTES,
  noun: "Video",
  typeHint: "Please upload an MP4, MOV or WebM video.",
};

export const MAX_AUDIO_BYTES = 60 * 1024 * 1024;
export const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

const AUDIO_KIND: StreamKind = {
  folder: "music",
  types: AUDIO_TYPES,
  max: MAX_AUDIO_BYTES,
  noun: "Song",
  typeHint: "Please upload an MP3, M4A, AAC, OGG, WAV or FLAC file.",
};

/**
 * Streams a raw request body (a file) to the bucket without holding it in memory.
 * Aborts if the body grows past the size limit or the client disconnects.
 */
async function storeStream(
  body: ReadableStream<Uint8Array> | null,
  contentType: string,
  length: number,
  kind: StreamKind,
) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const ext = kind.types[type];
  const mb = Math.round(kind.max / 1024 / 1024);
  if (!ext) throw new UploadError(kind.typeHint, 415);
  if (!body) throw new UploadError(`No ${kind.noun.toLowerCase()} received.`, 400);
  if (length > kind.max) throw new UploadError(`${kind.noun} is too large (max ${mb} MB).`, 413);

  let seen = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > kind.max) cb(new UploadError(`${kind.noun} is too large (max ${mb} MB).`, 413));
      else cb(null, chunk);
    },
  });
  // pipeline() tears down both streams if either side fails (e.g. the connection drops).
  const stream = pipeline(Readable.fromWeb(body as NodeWebStream<Uint8Array>), limiter, () => {});

  const key = datedKey(kind.folder, ext);
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
    throw new UploadError(`No ${kind.noun.toLowerCase()} received.`, 400);
  }
  return key;
}

export async function storeVideoStream(body: ReadableStream<Uint8Array> | null, contentType: string, length: number) {
  try {
    return await storeStream(body, contentType, length, VIDEO_KIND);
  } catch (e) {
    if (e instanceof UploadError && e.status === 413) {
      throw new UploadError("Video is too large (max 300 MB). Try a shorter clip.", 413);
    }
    throw e;
  }
}

export function storeAudioStream(body: ReadableStream<Uint8Array> | null, contentType: string, length: number) {
  return storeStream(body, contentType, length, AUDIO_KIND);
}
