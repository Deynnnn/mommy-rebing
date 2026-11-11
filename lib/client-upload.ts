"use client";

import { compressImage } from "@/lib/compress";

// Browser-side upload helpers shared by the guest share page and the admin bulk upload.

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_VIDEO_MB = 300;

const VIDEO_EXT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  "3gp": "video/3gpp",
};

/** Phones sometimes leave file.type empty for videos; fall back to the extension. */
export function videoType(file: File) {
  if (file.type.startsWith("video/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXT_TYPES[ext] ?? "";
}

export function kindOf(file: File): "image" | "video" | null {
  if (videoType(file)) return "video";
  if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) return "image";
  return null;
}

/** Uploads a video as a raw body so the server can stream it; reports progress 0–1. */
export function uploadVideo(file: File, name: string, message: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const qs = new URLSearchParams();
    if (name.trim()) qs.set("name", name.trim());
    if (message.trim()) qs.set("message", message.trim());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload-video?${qs}`);
    xhr.setRequestHeader("Content-Type", videoType(file));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Upload failed. Please try again.";
      try {
        msg = JSON.parse(xhr.responseText).error || msg;
      } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Connection lost. Please try again."));
    xhr.send(file);
  });
}

export async function uploadImage(file: File, name: string, message: string) {
  const prepared = await compressImage(file);
  if (!IMAGE_TYPES.includes(prepared.type)) throw new Error("Format not supported. Try a JPG.");
  const fd = new FormData();
  fd.append("file", prepared);
  fd.append("name", name);
  fd.append("message", message);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Upload failed. Please try again.");
  }
}
