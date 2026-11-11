import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

let s3: S3Client | undefined;

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function bucket() {
  return env("S3_BUCKET");
}

export function getS3() {
  if (!s3) {
    s3 = new S3Client({
      endpoint: env("S3_ENDPOINT"),
      region: process.env.S3_REGION || "auto",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: env("S3_ACCESS_KEY_ID"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
      },
    });
  }
  return s3;
}

export async function putImage(key: string, body: Buffer, contentType: string) {
  await getS3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function presignGet(key: string, expiresIn = 3600) {
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

export async function getObjectStream(key: string) {
  const res = await getS3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body as Readable;
}

export async function deleteObject(key: string) {
  await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
