"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Track = { id: string; title: string };

const MAX_MB = 60;
const EXT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
  webm: "audio/webm",
};

/** Some browsers leave file.type empty (or odd) for audio, so fall back to the extension. */
function audioType(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("audio/") && file.type !== "audio/x-ms-wma") return file.type;
  return EXT_TYPES[ext] ?? file.type;
}

function titleFrom(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "Untitled song";
}

function uploadOne(file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/music?title=${encodeURIComponent(titleFrom(file.name))}`);
    xhr.setRequestHeader("Content-Type", audioType(file));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Upload failed.";
      try {
        msg = (JSON.parse(xhr.responseText) as { error?: string }).error || msg;
      } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error. Please try again."));
    xhr.send(file);
  });
}

/** Admin section: upload, order, rename, preview and remove the TV slideshow's background music. */
export function MusicManager() {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/music", { cache: "no-store" });
      if (res.ok) setTracks(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files);
    const errors: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.size > MAX_MB * 1024 * 1024) {
        errors.push(`${f.name}: too large (max ${MAX_MB} MB).`);
        continue;
      }
      try {
        await uploadOne(f, (pct) => setProgress(`Uploading ${i + 1} of ${list.length}: ${f.name} (${pct}%)`));
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
      await load();
    }
    setProgress("");
    setError(errors.join(" "));
  }

  async function remove(t: Track) {
    if (!confirm(`Remove “${t.title}” from the slideshow music?`)) return;
    setTracks((cur) => cur?.filter((x) => x.id !== t.id) ?? null);
    await fetch(`/api/admin/music?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
    load();
  }

  async function rename(t: Track) {
    const title = prompt("Song name", t.title)?.trim();
    if (!title || title === t.title) return;
    setTracks((cur) => cur?.map((x) => (x.id === t.id ? { ...x, title } : x)) ?? null);
    await fetch("/api/admin/music", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, title }),
    });
  }

  async function move(index: number, dir: -1 | 1) {
    if (!tracks) return;
    const j = index + dir;
    if (j < 0 || j >= tracks.length) return;
    const next = [...tracks];
    [next[index], next[j]] = [next[j], next[index]];
    setTracks(next);
    await fetch("/api/admin/music/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((t) => t.id) }),
    });
  }

  const busy = progress.startsWith("Uploading");

  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Slideshow music</h2>
          <p className="text-sm text-muted">
            Plays on the TV in this order, then starts again. It drops to 20% volume while a guest video plays.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50"
        >
          + Upload music
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac"
          multiple
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">MP3, M4A, AAC, OGG, WAV or FLAC, up to {MAX_MB} MB each.</p>

      {progress && <p className="mt-3 text-sm text-muted">{progress}</p>}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}

      <ol className="mt-4 space-y-2">
        {tracks === null && <p className="text-sm text-muted">Loading…</p>}
        {tracks?.length === 0 && <p className="text-sm text-muted">No music yet. The slideshow is silent.</p>}
        {tracks?.map((t, i) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-cream/60 p-2 sm:flex-nowrap">
            <span className="w-6 text-center font-serif text-lg text-muted">{i + 1}</span>
            <button onClick={() => rename(t)} className="min-w-0 flex-1 truncate text-left" title="Rename">
              {t.title}
            </button>
            <audio src={`/api/music/${t.id}`} controls preload="none" className="h-9 w-full sm:w-64" />
            <div className="flex gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="h-8 w-8 rounded-full border border-line disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === tracks.length - 1}
                aria-label="Move down"
                className="h-8 w-8 rounded-full border border-line disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => remove(t)}
                aria-label="Remove song"
                className="h-8 w-8 rounded-full bg-red-700 text-white"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
