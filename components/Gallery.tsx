"use client";

import { useEffect, useState } from "react";
import { LoopVideoPlayer } from "@/components/LoopVideoPlayer";
import type { PublicPost } from "@/lib/types";

export function Gallery() {
  const [posts, setPosts] = useState<PublicPost[] | null>(null);
  const [open, setOpen] = useState<PublicPost | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/posts", { cache: "no-store" });
        if (res.ok && alive) setPosts(await res.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (posts === null) return <p className="py-10 text-center text-muted">Loading…</p>;
  if (posts.length === 0)
    return (
      <p className="py-10 text-center font-serif text-lg italic text-muted">
        No photos yet. Be the first to share one.
      </p>
    );

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {posts.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpen(p)}
            className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-lg border border-line bg-paper text-left shadow-sm"
          >
            {p.mediaType === "video" ? (
              <div className="relative">
                <video
                  src={`/api/image/${p.id}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 pl-1 text-xl text-white">
                    ▶
                  </span>
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/image/${p.id}`} alt={p.message || "Shared photo"} loading="lazy" className="w-full" />
            )}
            {(p.name || p.message) && (
              <div className="px-3 py-2">
                {p.message && <p className="line-clamp-3 font-serif text-[15px] leading-snug">{p.message}</p>}
                {p.name && <p className="mt-1 text-xs text-muted">— {p.name}</p>}
              </div>
            )}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          {open.mediaType === "video" ? (
            <LoopVideoPlayer key={open.id} src={`/api/image/${open.id}`} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/image/${open.id}`} alt="" className="max-h-[78dvh] max-w-full rounded object-contain" />
          )}
          {(open.message || open.name) && (
            <div className="mt-4 max-w-xl text-center text-white">
              {open.message && <p className="font-serif text-xl">{open.message}</p>}
              {open.name && <p className="mt-1 text-sm text-white/70">— {open.name}</p>}
            </div>
          )}
          <p className="mt-4 text-xs text-white/50">Tap outside to close</p>
        </div>
      )}
    </>
  );
}
