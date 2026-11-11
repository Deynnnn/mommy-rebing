"use client";

import { useRef, useState } from "react";
import { kindOf, MAX_VIDEO_MB, uploadImage, uploadVideo } from "@/lib/client-upload";

/**
 * Admin bulk upload: pick many photos and videos at once; they are added as uploads
 * (shown in the gallery and slideshow) one after another, under an optional name.
 */
export function AdminUploader({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pct, setPct] = useState(0);

  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    const list = Array.from(files);
    const errs: string[] = [];
    const queue = list.filter((f) => {
      const kind = kindOf(f);
      if (!kind) errs.push(`${f.name}: not a photo or video.`);
      else if (kind === "video" && f.size > MAX_VIDEO_MB * 1024 * 1024) errs.push(`${f.name}: over ${MAX_VIDEO_MB} MB.`);
      else return true;
      return false;
    });
    setBusy(true);
    setErrors([]);
    let ok = 0;
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      setPct(i / queue.length);
      setStatus(`Uploading ${i + 1} of ${queue.length}: ${f.name}`);
      try {
        if (kindOf(f) === "video") {
          await uploadVideo(f, name, "", (p) => setPct((i + p) / queue.length));
        } else {
          await uploadImage(f, name, "");
        }
        ok++;
        // refresh the list every few files so progress shows up below
        if (ok % 5 === 0) onUploaded();
      } catch (e) {
        errs.push(`${f.name}: ${e instanceof Error ? e.message : "upload failed."}`);
      }
    }
    setPct(1);
    setBusy(false);
    setErrors(errs);
    setStatus(`${ok} of ${list.length} uploaded.`);
    onUploaded();
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl">Upload photos &amp; videos</h2>
          <p className="text-sm text-muted">
            Add many at once, for example old family photos. They show in the gallery and the slideshow like guest
            uploads.
          </p>
          <label className="mt-3 block max-w-xs text-sm">
            <span className="font-medium">Shown as from</span> <span className="text-muted">(optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={busy}
              placeholder="e.g. The Madriaga family"
              className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2 outline-none focus:border-gold"
            />
          </label>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-50"
        >
          {busy ? "Uploading…" : "+ Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {(busy || status) && (
        <div className="mt-4">
          <p className="truncate text-sm text-muted">{status}</p>
          {busy && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-gold transition-[width]" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
          )}
          {busy && <p className="mt-1 text-xs text-muted">Keep this page open until it finishes.</p>}
        </div>
      )}
      {errors.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
