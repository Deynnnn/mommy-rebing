"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Candle } from "@/components/Candle";
import { kindOf, MAX_VIDEO_MB, newUploadId, uploadImage, uploadVideo } from "@/lib/client-upload";
import { tribute } from "@/lib/tribute";

type Item = {
  file: File;
  kind: "image" | "video";
  preview: string;
  /** stays the same on "Try again", so a file that did arrive isn't saved twice */
  uploadId: string;
  status: "waiting" | "uploading" | "done" | "error";
  progress?: number;
  error?: string;
};

const MAX_ITEMS = 20;

export default function SharePage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const n = localStorage.getItem("guestName");
      if (n) setName(n);
    } catch {}
  }, []);

  function pick(files: FileList | null) {
    if (!files) return;
    setNotice("");
    const next: Item[] = [];
    for (const file of Array.from(files)) {
      const kind = kindOf(file);
      if (!kind) continue;
      if (kind === "video" && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setNotice(`A video was skipped because it's over ${MAX_VIDEO_MB} MB. Try a shorter clip.`);
        continue;
      }
      next.push({ file, kind, preview: URL.createObjectURL(file), status: "waiting", uploadId: newUploadId() });
    }
    setItems((cur) => [...cur, ...next].slice(0, MAX_ITEMS));
  }

  function remove(i: number) {
    setItems((cur) => {
      URL.revokeObjectURL(cur[i].preview);
      return cur.filter((_, j) => j !== i);
    });
  }

  function patch(i: number, p: Partial<Item>) {
    setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...p } : it)));
  }

  // a ref, not just state: two quick taps can both run before `busy` re-renders
  const sendingRef = useRef(false);

  async function submit() {
    if (!items.length || busy || sendingRef.current) return;
    sendingRef.current = true;
    setBusy(true);
    try {
      localStorage.setItem("guestName", name.trim());
    } catch {}

    let failures = 0;
    let messageSent = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status === "done") continue;
      patch(i, { status: "uploading", error: undefined, progress: 0 });
      // attach the message to the first successful upload only
      const msg = messageSent ? "" : message;
      try {
        if (it.kind === "video") {
          await uploadVideo(it.file, name, msg, (p) => patch(i, { progress: p }), it.uploadId);
        } else {
          await uploadImage(it.file, name, msg, it.uploadId);
        }
        messageSent = true;
        patch(i, { status: "done" });
      } catch (e) {
        failures++;
        patch(i, { status: "error", error: e instanceof Error ? e.message : "Upload failed." });
      }
    }
    if (messageSent) setMessage("");
    sendingRef.current = false;
    setBusy(false);
    if (failures === 0) setDone(true);
  }

  function again() {
    items.forEach((it) => URL.revokeObjectURL(it.preview));
    setItems([]);
    setMessage("");
    setNotice("");
    setDone(false);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <Candle className="h-16 w-10" />
        <h1 className="mt-4 font-serif text-4xl">Salamat po.</h1>
        <p className="mt-3 font-serif text-lg text-ink/80">
          Thank you for sharing your memory of {tribute.nickname}. It will appear on the screen shortly.
        </p>
        <button onClick={again} className="mt-8 w-full rounded-full bg-ink px-6 py-4 font-medium text-cream">
          Share another
        </button>
        <Link href="/" className="mt-4 text-sm text-muted underline underline-offset-4">
          See all shared memories
        </Link>
      </main>
    );
  }

  const uploaded = items.filter((i) => i.status === "done").length;
  const hasErrors = items.some((i) => i.status === "error");
  const videos = items.filter((i) => i.kind === "video").length;
  const photos = items.length - videos;
  const label = [photos && `${photos} photo${photos > 1 ? "s" : ""}`, videos && `${videos} video${videos > 1 ? "s" : ""}`]
    .filter(Boolean)
    .join(" & ");

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    pick(e.target.files);
    e.target.value = "";
  };

  const tile =
    "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gold/50 bg-paper px-3 py-5 text-center disabled:opacity-50";

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-12 pt-8">
      <Link href="/" className="text-sm text-muted">
        ← Back
      </Link>
      <h1 className="mt-4 font-serif text-3xl leading-tight">Share a memory of {tribute.nickname}</h1>
      <p className="mt-1 text-sm text-muted">Magbahagi ng larawan, video at alaala</p>

      {/* Phones skip the camera when `multiple` is set, so camera inputs are separate. */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPick} />

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => photoRef.current?.click()} disabled={busy} className={tile}>
          <span className="text-3xl">📷</span>
          <span className="mt-2 font-medium">Take a photo</span>
          <span className="mt-0.5 text-xs text-muted">Kumuha ng larawan</span>
        </button>
        <button type="button" onClick={() => videoRef.current?.click()} disabled={busy} className={tile}>
          <span className="text-3xl">🎥</span>
          <span className="mt-2 font-medium">Record a video</span>
          <span className="mt-0.5 text-xs text-muted">Mag-video</span>
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
          className={`${tile} col-span-2 flex-row gap-3 py-4`}
        >
          <span className="text-2xl">🖼️</span>
          <span className="text-left">
            <span className="block font-medium">Choose from gallery</span>
            <span className="block text-xs text-muted">Photos or videos, several at once</span>
          </span>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Short videos (under 1 minute) upload fastest.</p>
      {notice && <p className="mt-2 text-center text-sm text-red-700">{notice}</p>}

      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {items.map((it, i) => (
            <div key={it.preview} className="relative aspect-square overflow-hidden rounded-lg bg-line">
              {it.kind === "video" ? (
                <video src={`${it.preview}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.preview} alt="" className="h-full w-full object-cover" />
              )}
              {it.kind === "video" && it.status === "waiting" && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">▶ video</span>
              )}
              {it.status === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-xs text-white">
                  {it.kind === "video" ? `${Math.round((it.progress ?? 0) * 100)}%` : "Uploading…"}
                  {it.kind === "video" && (
                    <span className="h-1 w-3/4 overflow-hidden rounded bg-white/30">
                      <span className="block h-full bg-white" style={{ width: `${(it.progress ?? 0) * 100}%` }} />
                    </span>
                  )}
                </div>
              )}
              {it.status === "done" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-2xl text-white">✓</div>
              )}
              {it.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 p-1 text-center text-[10px] text-white">
                  {it.error}
                </div>
              )}
              {!busy && it.status !== "done" && (
                <button
                  onClick={() => remove(i)}
                  className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-sm leading-6 text-white"
                  aria-label="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <label className="mt-6 block text-sm font-medium">
        Your name <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="e.g. Tita Liza, apo Miguel"
        className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-gold"
      />

      <label className="mt-4 block text-sm font-medium">
        A memory or message <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder={`A memory, a prayer, or a few words for ${tribute.nickname}…`}
        className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-3 font-serif text-lg outline-none focus:border-gold"
      />

      <button
        onClick={submit}
        disabled={!items.length || busy}
        className="mt-6 w-full rounded-full bg-ink px-6 py-4 font-medium text-cream shadow-md disabled:opacity-40"
      >
        {busy
          ? `Sharing… ${uploaded}/${items.length}`
          : hasErrors
            ? "Try again"
            : items.length
              ? `Share ${label}`
              : "Share"}
      </button>
      {busy && videos > 0 && (
        <p className="mt-2 text-center text-xs text-muted">Please keep this page open until the video finishes.</p>
      )}
    </main>
  );
}
