import imageCompression from "browser-image-compression";

/** Shrinks a photo in the browser before upload. Falls back to the original if it can't be decoded. */
export async function compressImage(file: File, maxSide = 1920): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const out = await imageCompression(file, {
      maxWidthOrHeight: maxSide,
      maxSizeMB: 2,
      initialQuality: 0.82,
      fileType: "image/jpeg",
      useWebWorker: true,
    });
    return new File([out], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
