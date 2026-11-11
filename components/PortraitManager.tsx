"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compress";
import { tribute } from "@/lib/tribute";

/** Admin section: upload/remove the photos that rotate in Mommy Rebing's profile portrait. */
export function PortraitManager({ adminKey }: { adminKey: string }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portraits", { cache: "no-store" });
      if (res.ok) setIds(((await res.json()) as { id: string }[]).map((r) => r.id));
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files);
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const fd = new FormData();
        fd.append("file", await compressImage(list[i], 1600));
        const res = await fetch("/api/admin/portraits", {
          method: "POST",
          headers: { "x-admin-key": adminKey },
          body: fd,
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error);
      } catch (e) {
        failed++;
        setError(e instanceof Error && e.message ? e.message : "Some photos failed to upload.");
      }
      await load();
    }
    setProgress(failed ? `${list.length - failed} of ${list.length} uploaded` : "");
  }

  async function remove(id: string) {
    if (!confirm("Remove this photo from the portrait slideshow?")) return;
    setIds((cur) => cur?.filter((x) => x !== id) ?? null);
    await fetch(`/api/admin/portraits?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    load();
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Photos of {tribute.nickname}</h2>
          <p className="text-sm text-muted">
            These rotate in her round portrait on the tribute page and the TV slideshow.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={!!progress && progress.startsWith("Uploading")}
          className="rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50"
        >
          + Upload photos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {progress && <p className="mt-3 text-sm text-muted">{progress}</p>}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        {ids === null && <p className="text-sm text-muted">Loading…</p>}
        {ids?.length === 0 && (
          <p className="text-sm text-muted">No photos yet. The placeholder portrait is showing.</p>
        )}
        {ids?.map((id, i) => (
          <div key={id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/portraits/${id}`}
              alt={`Portrait ${i + 1}`}
              className="h-24 w-24 rounded-full border border-gold-soft object-cover"
            />
            <button
              onClick={() => remove(id)}
              aria-label="Remove photo"
              className="absolute -right-1 -top-1 h-7 w-7 rounded-full bg-red-700 text-sm leading-7 text-white shadow"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
