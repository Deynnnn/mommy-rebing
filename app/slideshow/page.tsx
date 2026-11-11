"use client";

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Candle } from "@/components/Candle";
import { PortraitRotator } from "@/components/PortraitRotator";
import { useSettings } from "@/components/useSettings";
import type { PublicPost } from "@/lib/types";
import { tribute } from "@/lib/tribute";

const POLL_MS = 8000;
const TRIBUTE_EVERY = 12;
/** Skip a video if it makes no progress for this long (broken file, unsupported codec, network). */
const VIDEO_STALL_MS = 20000;

type Slide = { kind: "tribute"; key: string } | { kind: "post"; key: string; post: PublicPost };

function shareUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/share`;
}

export default function Slideshow() {
  const [slides, setSlides] = useState<Slide[]>([{ kind: "tribute", key: "tribute-0" }]);
  const [count, setCount] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [url, setUrl] = useState("");
  const [soundBlocked, setSoundBlocked] = useState(false);
  const settings = useSettings();
  const slideMs = settings.slideSeconds * 1000;
  const wantSound = settings.videoSound === 1;

  const postsRef = useRef<PublicPost[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const priorityRef = useRef<PublicPost[]>([]);
  const indexRef = useRef(-1);
  const stepRef = useRef(0);

  const current = slides[slides.length - 1];

  useEffect(() => setUrl(shareUrl()), []);

  // Poll for posts (in the admin's order); anything new jumps to the front of the queue.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/posts", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const list: PublicPost[] = await res.json();
        const ids = new Set(list.map((p) => p.id));
        if (seenRef.current === null) {
          seenRef.current = ids;
        } else {
          const fresh = list.filter((p) => !seenRef.current!.has(p.id));
          priorityRef.current.push(...fresh);
          fresh.forEach((p) => seenRef.current!.add(p.id));
        }
        // drop hidden ones from the priority queue
        priorityRef.current = priorityRef.current.filter((p) => ids.has(p.id));
        postsRef.current = list;
        setCount(list.length);
      } catch {}
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const nextSlide = useCallback((): Slide => {
    stepRef.current++;
    const posts = postsRef.current;
    if (priorityRef.current.length) {
      const post = priorityRef.current.shift()!;
      return { kind: "post", key: `${post.id}-${stepRef.current}`, post };
    }
    if (!posts.length || stepRef.current % TRIBUTE_EVERY === 0) {
      return { kind: "tribute", key: `tribute-${stepRef.current}` };
    }
    indexRef.current = (indexRef.current + 1) % posts.length;
    const post = posts[indexRef.current];
    return { kind: "post", key: `${post.id}-${stepRef.current}`, post };
  }, []);

  const advance = useCallback(() => {
    const s = nextSlide();
    const show = () => setSlides((cur) => [cur[cur.length - 1], s]);
    if (s.kind === "post" && s.post.mediaType !== "video") {
      // wait for the photo to load so the crossfade never shows a blank frame
      const img = new Image();
      img.src = `/api/image/${s.post.id}`;
      if (img.complete) show();
      else img.onload = img.onerror = show;
    } else {
      show();
    }
  }, [nextSlide]);

  // Photos and tribute slides advance on a timer; videos advance themselves when they end.
  const isVideo = current.kind === "post" && current.post.mediaType === "video";
  useEffect(() => {
    if (isVideo) return;
    const t = setTimeout(advance, slideMs);
    return () => clearTimeout(t);
  }, [current.key, isVideo, slideMs, advance]);

  const currentKeyRef = useRef(current.key);
  useEffect(() => {
    currentKeyRef.current = current.key;
  }, [current.key]);

  const onVideoDone = useCallback(
    (key: string) => {
      // ignore late events from a slide that is no longer current
      if (currentKeyRef.current === key) advance();
    },
    [advance],
  );

  // Keep the TV awake and hide the cursor/controls when idle.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const wake = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock;
        lock = (await wl?.request("screen")) ?? null;
      } catch {}
    };
    wake();
    const onVis = () => document.visibilityState === "visible" && wake();
    document.addEventListener("visibilitychange", onVis);

    let idle: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setShowControls(true);
      clearTimeout(idle);
      idle = setTimeout(() => setShowControls(false), 3000);
    };
    onMove();
    window.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mousemove", onMove);
      clearTimeout(idle);
      lock?.release().catch(() => {});
    };
  }, []);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#0d0b09] text-white"
      style={{ cursor: showControls ? "default" : "none" }}
      // any click counts as the user gesture browsers require before playing sound
      onClick={() => setSoundBlocked(false)}
    >
      {slides.map((s, i) => {
        const active = i === slides.length - 1;
        return (
          <div
            key={s.key}
            className="absolute inset-0"
            style={active ? { animation: "fadeIn 1.4s ease both" } : undefined}
          >
            {s.kind === "tribute" ? (
              <TributeSlide />
            ) : s.post.mediaType === "video" ? (
              <VideoSlide
                post={s.post}
                active={active}
                sound={wantSound && !soundBlocked}
                onSoundBlocked={() => setSoundBlocked(true)}
                onDone={() => onVideoDone(s.key)}
              />
            ) : (
              <PhotoSlide post={s.post} slideMs={slideMs} />
            )}
          </div>
        );
      })}

      {url && (
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-4 rounded-2xl bg-black/55 p-3 pr-5 backdrop-blur">
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={url} size={112} />
          </div>
          <div className="max-w-[13rem]">
            <p className="font-serif text-2xl leading-tight">Scan to share a photo or video</p>
            <p className="mt-1 text-sm text-white/70">Magbahagi ng larawan o video</p>
            <p className="mt-2 text-xs text-white/50">{count} memories shared</p>
          </div>
        </div>
      )}

      <div
        className="absolute left-4 top-4 z-10 flex items-center gap-3 transition-opacity"
        style={{ opacity: showControls || (wantSound && soundBlocked) ? 1 : 0 }}
      >
        <button onClick={fullscreen} className="rounded-full bg-white/10 px-4 py-2 text-sm">
          Toggle fullscreen
        </button>
        {wantSound && soundBlocked && (
          <span className="rounded-full bg-black/60 px-4 py-2 text-sm">🔇 Click anywhere to turn on video sound</span>
        )}
      </div>
    </main>
  );
}

function Caption({ post }: { post: PublicPost }) {
  if (!post.message && !post.name) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-12 pb-8 pt-24 pr-[22rem]">
      {post.message && <p className="line-clamp-3 font-serif text-4xl leading-snug">“{post.message}”</p>}
      {post.name && <p className="mt-3 text-xl text-white/75">— {post.name}</p>}
    </div>
  );
}

function PhotoSlide({ post, slideMs }: { post: PublicPost; slideMs: number }) {
  const src = `/api/image/${post.id}`;
  return (
    <>
      {/* blurred backdrop fills the screen behind portrait/landscape photos */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      <div className="absolute inset-0 flex items-center justify-center p-10 pb-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
          style={{ animation: `kenburns ${slideMs + 1500}ms ease-out both` }}
        />
      </div>
      <Caption post={post} />
    </>
  );
}

/** Plays a guest video to the end, then calls onDone. Skips it if it errors or stalls. */
function VideoSlide({
  post,
  active,
  sound,
  onSoundBlocked,
  onDone,
}: {
  post: PublicPost;
  active: boolean;
  sound: boolean;
  onSoundBlocked: () => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // Start (or stop) playback when this slide becomes (or stops being) the current one.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!active) {
      v.pause();
      return;
    }
    v.muted = !sound;
    v.play().catch(() => {
      // Browsers block sound until someone clicks the page; fall back to muted playback.
      v.muted = true;
      if (sound) onSoundBlocked();
      v.play().catch(finish);
    });
  }, [active, sound, onSoundBlocked, finish]);

  // Watchdog: skip if the video makes no progress for a while.
  useEffect(() => {
    if (!active) return;
    const v = ref.current;
    if (!v) return;
    let last = -1;
    let lastChange = Date.now();
    const t = setInterval(() => {
      if (v.currentTime !== last) {
        last = v.currentTime;
        lastChange = Date.now();
      } else if (Date.now() - lastChange > VIDEO_STALL_MS) {
        finish();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active, finish]);

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center bg-black p-6 pb-36">
        <video
          ref={ref}
          src={`/api/image/${post.id}`}
          playsInline
          preload="auto"
          onEnded={finish}
          onError={finish}
          className="max-h-full max-w-full rounded-md shadow-2xl"
        />
      </div>
      <Caption post={post} />
    </>
  );
}

function TributeSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 pb-24 text-center">
      <p className="text-sm uppercase tracking-[0.4em] text-white/60">In Loving Memory</p>
      <PortraitRotator
        alt=""
        className="mt-8 h-[38vh] w-[38vh] border-4 border-[#a8874f]/60 shadow-2xl"
      />
      <h1 className="mt-8 font-serif text-6xl">{tribute.name}</h1>
      <p className="mt-2 font-serif text-3xl italic text-[#d9bf8c]">“{tribute.nickname}”</p>
      <p className="mt-3 text-xl text-white/70">
        {tribute.born} — {tribute.died}
      </p>
      <div className="mt-6">
        <Candle className="h-14 w-8" />
      </div>
    </div>
  );
}
