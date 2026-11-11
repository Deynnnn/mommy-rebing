"use client";

import { useEffect, useState } from "react";
import { tribute } from "@/lib/tribute";

const ROTATE_MS = 5000;
const REFRESH_MS = 30000;

/**
 * Mommy Rebing's portrait. Crossfades through the photos the family uploads in /admin;
 * falls back to the static portrait in lib/tribute.ts when none are uploaded.
 */
export function PortraitRotator({ className = "", alt = tribute.name }: { className?: string; alt?: string }) {
  const [srcs, setSrcs] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/portraits", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const rows: { id: string }[] = await res.json();
        const next = rows.map((r) => `/api/portraits/${r.id}`);
        setSrcs((cur) => (cur.join() === next.join() ? cur : next));
        next.forEach((src) => {
          const img = new Image();
          img.src = src;
        });
      } catch {}
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (srcs.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % srcs.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [srcs.length]);

  const list = srcs.length ? srcs : [tribute.portrait];
  const current = index % list.length;

  return (
    <div className={`relative overflow-hidden rounded-full ${className}`}>
      {list.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={i === current ? alt : ""}
          aria-hidden={i !== current}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
