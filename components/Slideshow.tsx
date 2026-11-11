"use client";

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Candle } from "@/components/Candle";
import { PortraitRotator } from "@/components/PortraitRotator";
import { SlideshowLocked } from "@/components/SlideshowLocked";
import { SlideshowMusic } from "@/components/SlideshowMusic";
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

export function Slideshow({ isAdmin }: { isAdmin: boolean }) {
  const [slides, setSlides] = useState<Slide[]>([{ kind: "tribute", key: "tribute-0" }]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [url, setUrl] = useState("");
  const [soundBlocked, setSoundBlocked] = useState(false);
  const settings = useSettings();
  const slideMs = settings.slideSeconds * 1000;
  const wantSound = settings.videoSound === 1;
  const wantMusic = settings.music === 1;
  const onSoundBlocked = useCallback(() => setSoundBlocked(true), []);

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
        setPosts((cur) => (JSON.stringify(cur) === JSON.stringify(list) ? cur : list));
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

  const showSlide = useCallback((s: Slide) => {
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
  }, []);

  const advance = useCallback(() => showSlide(nextSlide()), [nextSlide, showSlide]);

  /** Jump to a guest post (from the timeline or arrow keys); the slideshow carries on from there. */
  const jumpTo = useCallback(
    (post: PublicPost) => {
      const i = postsRef.current.findIndex((p) => p.id === post.id);
      if (i < 0) return;
      indexRef.current = i;
      stepRef.current++;
      showSlide({ kind: "post", key: `${post.id}-${stepRef.current}`, post });
    },
    [showSlide],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const list = postsRef.current;
      if (!list.length) return;
      const i = (Math.max(indexRef.current, 0) + dir + list.length) % list.length;
      jumpTo(list[i]);
    },
    [jumpTo],
  );

  // Photos and tribute slides advance on a timer; videos advance themselves when they end.
  const isVideo = current.kind === "post" && current.post.mediaType === "video";
  useEffect(() => {
    if (isVideo || paused) return;
    const t = setTimeout(advance, slideMs);
    return () => clearTimeout(t);
  }, [current.key, isVideo, paused, slideMs, advance]);

  // Keyboard: space pauses, left/right arrows go to the previous/next upload.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

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
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    window.addEventListener("keydown", onMove);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("keydown", onMove);
      clearTimeout(idle);
      lock?.release().catch(() => {});
    };
  }, []);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  // If an admin turns public viewing off, screens that are already open lock within ~15 s.
  if (!isAdmin && settings.slideshowPublic !== 1) return <SlideshowLocked />;

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
                paused={paused}
                onSoundBlocked={onSoundBlocked}
                onDone={() => onVideoDone(s.key)}
              />
            ) : (
              <PhotoSlide post={s.post} slideMs={slideMs} paused={paused} />
            )}
          </div>
        );
      })}

      <SlideshowMusic
        enabled={wantMusic}
        volume={settings.musicVolume}
        shuffle={settings.musicShuffle === 1}
        // turn the music down to 20% while a guest video plays, back up when it ends
        ducked={isVideo}
        blocked={soundBlocked}
        onBlocked={onSoundBlocked}
      />

      {url && (
        <div
          className="absolute right-6 z-30 flex items-center gap-4 rounded-2xl bg-black/55 p-3 pr-5 backdrop-blur transition-[bottom] duration-300"
          // sit above the timeline while it is showing
          style={{ bottom: showControls ? "10rem" : "1.5rem" }}
        >
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={url} size={112} />
          </div>
          <div className="max-w-[13rem]">
            <p className="font-serif text-2xl leading-tight">Scan to share a photo or video</p>
            <p className="mt-1 text-sm text-white/70">Magbahagi ng larawan o video</p>
            <p className="mt-2 text-xs text-white/50">{posts.length} memories shared</p>
          </div>
        </div>
      )}

      <div
        className="absolute left-4 top-4 z-10 flex items-center gap-3 transition-opacity"
        style={{ opacity: showControls || soundBlocked ? 1 : 0 }}
      >
        <button onClick={fullscreen} className="rounded-full bg-white/10 px-4 py-2 text-sm">
          Toggle fullscreen
        </button>
        {soundBlocked && (wantSound || wantMusic) && (
          <span className="rounded-full bg-black/60 px-4 py-2 text-sm">🔇 Click anywhere to turn on sound</span>
        )}
      </div>

      {paused && (
        <button
          onClick={() => setPaused(false)}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur"
        >
          ⏸ Paused · tap to play
        </button>
      )}

      <Timeline
        posts={posts}
        currentId={current.kind === "post" ? current.post.id : null}
        visible={showControls}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onPick={jumpTo}
        onStep={step}
      />
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

function PhotoSlide({ post, slideMs, paused }: { post: PublicPost; slideMs: number; paused: boolean }) {
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
          style={{
            animation: `kenburns ${slideMs + 1500}ms ease-out both`,
            animationPlayState: paused ? "paused" : "running",
          }}
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
  paused,
  onSoundBlocked,
  onDone,
}: {
  post: PublicPost;
  active: boolean;
  sound: boolean;
  paused: boolean;
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
    if (!active || paused) {
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
  }, [active, paused, sound, onSoundBlocked, finish]);

  // Watchdog: skip if the video makes no progress for a while (not while paused on purpose).
  useEffect(() => {
    if (!active || paused) return;
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
  }, [active, paused, finish]);

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

function shownAt(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

/** Bottom bar shown on mouse move: pause/play, previous/next, and every upload with its time. */
function Timeline({
  posts,
  currentId,
  visible,
  paused,
  onTogglePause,
  onPick,
  onStep,
}: {
  posts: PublicPost[];
  currentId: string | null;
  visible: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onPick: (p: PublicPost) => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // Keep the one on screen centred. Only the strip scrolls (scrollIntoView would also shift the page).
  useEffect(() => {
    const strip = stripRef.current;
    const item = currentId ? itemRefs.current.get(currentId) : null;
    if (!visible || !strip || !item) return;
    const left = item.offsetLeft - strip.offsetLeft - (strip.clientWidth - item.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [visible, currentId]);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [posts.length, visible, updateArrows]);

  const page = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 bg-black/90 pt-4 backdrop-blur transition-transform duration-300"
      style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
    >
      <div className="flex items-center gap-4 px-5 pb-5">
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onStep(-1)}
            aria-label="Previous photo"
            className="h-11 w-11 rounded-full bg-white/10 text-lg hover:bg-white/20"
          >
            ⏮
          </button>
          <button
            onClick={onTogglePause}
            aria-label={paused ? "Play" : "Pause"}
            className="h-14 w-14 rounded-full bg-white text-2xl text-black shadow-lg"
          >
            {paused ? "▶" : "⏸"}
          </button>
          <button
            onClick={() => onStep(1)}
            aria-label="Next photo"
            className="h-11 w-11 rounded-full bg-white/10 text-lg hover:bg-white/20"
          >
            ⏭
          </button>
        </div>

        <div className="h-12 w-px shrink-0 bg-white/15" />

        <Chevron dir="left" disabled={!canLeft} onClick={() => page(-1)} />

        <div
          ref={stripRef}
          onScroll={updateArrows}
          className="flex min-w-0 flex-1 gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {posts.length === 0 && <p className="self-center text-sm text-white/60">No uploads yet.</p>}
          {posts.map((p) => {
            const on = p.id === currentId;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(p.id, el);
                  else itemRefs.current.delete(p.id);
                }}
                onClick={() => onPick(p)}
                title={p.name ? `${p.name} · ${shownAt(p.createdAt)}` : shownAt(p.createdAt)}
                className={`w-28 shrink-0 p-0.5 text-left transition-opacity ${on ? "" : "opacity-60 hover:opacity-100"}`}
              >
                <div
                  className={`relative h-16 w-full overflow-hidden rounded-lg bg-white/10 ring-2 ${
                    on ? "ring-[#d9bf8c]" : "ring-white/0"
                  }`}
                >
                  {p.mediaType === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#3a3128] to-[#15110d] text-2xl">
                      ▶
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/image/${p.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <p
                  className={`mt-1.5 truncate text-xs font-medium tabular-nums ${on ? "text-[#d9bf8c]" : "text-white/85"}`}
                >
                  {shownAt(p.createdAt)}
                </p>
                <p className="truncate text-[11px] text-white/50">{p.name || " "}</p>
              </button>
            );
          })}
        </div>

        <Chevron dir="right" disabled={!canRight} onClick={() => page(1)} />
      </div>
    </div>
  );
}

function Chevron({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Scroll timeline left" : "Scroll timeline right"}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
