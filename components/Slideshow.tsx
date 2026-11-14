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
/** On phones the controls stay up a little longer after a tap or swipe. */
const TOUCH_IDLE_MS = 4500;

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
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [timelineH, setTimelineH] = useState(0);
  const settings = useSettings();
  const slideMs = settings.slideSeconds * 1000;
  const wantSound = settings.videoSound === 1;
  const wantMusic = settings.music === 1;
  const onSoundBlocked = useCallback(() => setSoundBlocked(true), []);

  const postsRef = useRef<PublicPost[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const priorityRef = useRef<PublicPost[]>([]);
  const skipOnceRef = useRef(new Set<string>());
  const indexRef = useRef(-1);
  const stepRef = useRef(0);

  const current = slides[slides.length - 1];

  useEffect(() => {
    setUrl(shareUrl());
    // iPhones can't make a page fullscreen, so don't offer a button that does nothing
    setCanFullscreen(!!document.fullscreenEnabled);
  }, []);

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
      // it was just shown as new, so the regular rotation skips it once (otherwise it looks duplicated)
      skipOnceRef.current.add(post.id);
      return { kind: "post", key: `${post.id}-${stepRef.current}`, post };
    }
    if (!posts.length || stepRef.current % TRIBUTE_EVERY === 0) {
      return { kind: "tribute", key: `tribute-${stepRef.current}` };
    }
    let post: PublicPost | undefined;
    for (let tries = 0; tries < posts.length; tries++) {
      indexRef.current = (indexRef.current + 1) % posts.length;
      const candidate = posts[indexRef.current];
      if (skipOnceRef.current.delete(candidate.id) && posts.length > 1) continue;
      post = candidate;
      break;
    }
    post ??= posts[indexRef.current];
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

  // Show the controls and restart the countdown that hides them again.
  const idleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const poke = useCallback((ms = 3000) => {
    setShowControls(true);
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => setShowControls(false), ms);
  }, []);
  const hideControls = useCallback(() => {
    clearTimeout(idleRef.current);
    setShowControls(false);
  }, []);

  // Phones: swipe left/right to browse, tap to show or hide the controls.
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    // leave the timeline, buttons and links to handle their own touches
    const onChrome = (e.target as HTMLElement).closest("[data-chrome]");
    touchRef.current = e.touches.length === 1 && !onChrome ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx < 0 ? 1 : -1);
      poke(TOUCH_IDLE_MS);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - start.t < 500) {
      if (showControls) hideControls();
      else poke(TOUCH_IDLE_MS);
    }
  };

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

    // touches are handled by the tap/swipe handlers; this is for the mouse and keyboard
    const onMove = (e: Event) => {
      if (e instanceof PointerEvent && e.pointerType === "touch") return;
      poke();
    };
    poke(matchMedia("(pointer: coarse)").matches ? TOUCH_IDLE_MS : 3000);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    window.addEventListener("keydown", onMove);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("keydown", onMove);
      clearTimeout(idleRef.current);
      lock?.release().catch(() => {});
    };
  }, [poke]);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  // If an admin turns public viewing off, screens that are already open lock within ~15 s.
  if (!isAdmin && settings.slideshowPublic !== 1) return <SlideshowLocked />;

  return (
    <main
      className="fixed inset-0 touch-manipulation select-none overflow-hidden bg-[#0d0b09] text-white"
      style={
        {
          cursor: showControls ? "default" : "none",
          // captions and the QR card ride up above the timeline while it is showing
          "--chrome-b": showControls ? `${timelineH}px` : "0px",
        } as React.CSSProperties
      }
      // any click counts as the user gesture browsers require before playing sound
      onClick={() => setSoundBlocked(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
        // turn the music down to 10% while a guest video plays, back up when it ends
        ducked={isVideo}
        blocked={soundBlocked}
        onBlocked={onSoundBlocked}
      />

      {/* On a phone the viewer is already holding the device, so a QR code is no use: link straight to sharing. */}
      {url && (
        <div
          className="absolute right-6 z-30 flex items-center gap-4 rounded-2xl bg-black/55 p-3 pr-5 backdrop-blur transition-[bottom] duration-300 compact:hidden"
          style={{ bottom: "calc(var(--chrome-b) + 1.5rem)" }}
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
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div
          className="flex min-w-0 flex-wrap items-center gap-2 transition-opacity duration-300 compact:flex-col compact:items-start"
          style={{ opacity: showControls || soundBlocked ? 1 : 0 }}
        >
          {canFullscreen && (
            <button
              data-chrome
              onClick={fullscreen}
              aria-label="Toggle fullscreen"
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20 compact:h-10 compact:w-10 compact:justify-center compact:bg-black/45 compact:p-0"
              style={{ pointerEvents: showControls ? "auto" : "none" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
              <span className="compact:hidden">Toggle fullscreen</span>
            </button>
          )}
          {soundBlocked && (wantSound || wantMusic) && (
            <span className="rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur compact:px-3 compact:text-xs">
              🔇 Tap anywhere to turn on sound
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <a
            data-chrome
            href="/share"
            className="pointer-events-auto hidden items-center gap-1.5 rounded-full bg-[#d9bf8c] px-4 py-2 text-sm font-medium text-[#1a1510] shadow-lg compact:flex"
          >
            <span aria-hidden className="text-base leading-none">＋</span> Share a memory
          </a>
          {paused && (
            <button
              data-chrome
              onClick={() => setPaused(false)}
              className="pointer-events-auto rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur compact:text-xs"
            >
              ⏸ Paused · tap to play
            </button>
          )}
        </div>
      </div>

      <Timeline
        onHeight={setTimelineH}
        // keep the bar up while someone is scrolling through it with a finger
        onActivity={() => poke(TOUCH_IDLE_MS)}
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
    <div
      className="pointer-events-none absolute inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-12 pb-8 pt-24 pr-[22rem] transition-[bottom] duration-300 compact:px-5 compact:pb-[max(1.25rem,env(safe-area-inset-bottom))] compact:pt-16"
      style={{ bottom: "var(--chrome-b, 0px)" }}
    >
      {post.message && (
        <p className="line-clamp-3 font-serif text-4xl leading-snug compact:line-clamp-4 compact:text-[1.4rem] compact:leading-snug">
          “{post.message}”
        </p>
      )}
      {post.name && <p className="mt-3 text-xl text-white/75 compact:mt-1.5 compact:text-sm">— {post.name}</p>}
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
      <div className="absolute inset-0 flex items-center justify-center p-10 pb-40 compact:px-2 compact:pb-24 compact:pt-16">
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
      <div className="absolute inset-0 flex items-center justify-center bg-black p-6 pb-36 compact:px-0 compact:pb-24 compact:pt-16">
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
    <div className="flex h-full flex-col items-center justify-center px-10 pb-24 text-center compact:px-6 compact:pb-20 compact:pt-12 short:pb-6 short:pt-6">
      <p className="text-sm uppercase tracking-[0.4em] text-white/60 compact:text-xs compact:tracking-[0.3em]">
        In Loving Memory
      </p>
      <PortraitRotator
        alt=""
        // min() keeps it a circle on narrow screens instead of squashing into an oval
        className="mt-8 h-[38vh] w-[38vh] shrink-0 border-4 border-[#a8874f]/60 shadow-2xl compact:mt-5 compact:h-[min(34vh,64vw)] compact:w-[min(34vh,64vw)] compact:border-[3px] short:mt-3"
      />
      <h1 className="mt-8 text-balance font-serif text-6xl compact:mt-5 compact:text-[2.5rem] compact:leading-[1.05] short:mt-3 short:text-3xl">
        {tribute.name}
      </h1>
      <p className="mt-2 font-serif text-3xl italic text-[#d9bf8c] compact:text-2xl short:text-xl">“{tribute.nickname}”</p>
      <p className="mt-3 text-xl text-white/70 compact:mt-2 compact:text-sm">
        <span className="whitespace-nowrap">{tribute.born}</span> — <span className="whitespace-nowrap">{tribute.died}</span>
      </p>
      <div className="mt-6 compact:mt-4 short:hidden">
        <Candle className="h-14 w-8 compact:h-11 compact:w-6" />
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
  onHeight,
  onActivity,
}: {
  posts: PublicPost[];
  currentId: string | null;
  visible: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onPick: (p: PublicPost) => void;
  onStep: (dir: 1 | -1) => void;
  onHeight: (px: number) => void;
  onActivity: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Tell the slideshow how tall the bar is so captions can sit just above it.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);
  const currentIndex = currentId ? posts.findIndex((p) => p.id === currentId) : -1;
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
      ref={barRef}
      data-chrome
      className="absolute inset-x-0 bottom-0 z-20 bg-black/90 pt-4 backdrop-blur transition-transform duration-300 compact:pt-3"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        // nothing to tap while it is hidden (it would swallow taps meant for the slide)
        pointerEvents: visible ? "auto" : "none",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="flex items-center gap-4 px-5 pb-5 compact:gap-3 compact:px-3 compact:pb-3 max-md:flex-col max-md:items-stretch">
        <div className="flex shrink-0 items-center gap-2 max-md:justify-center max-md:gap-5">
          <span className="hidden w-14 text-right text-xs tabular-nums text-white/50 max-md:block">
            {currentIndex >= 0 ? `${currentIndex + 1} / ${posts.length}` : ""}
          </span>
          <button
            onClick={() => onStep(-1)}
            aria-label="Previous photo"
            className="h-11 w-11 rounded-full bg-white/10 text-lg hover:bg-white/20 active:bg-white/25 compact:h-10 compact:w-10"
          >
            ⏮
          </button>
          <button
            onClick={onTogglePause}
            aria-label={paused ? "Play" : "Pause"}
            className="h-14 w-14 rounded-full bg-white text-2xl text-black shadow-lg active:scale-95 compact:h-12 compact:w-12 compact:text-xl"
          >
            {paused ? "▶" : "⏸"}
          </button>
          <button
            onClick={() => onStep(1)}
            aria-label="Next photo"
            className="h-11 w-11 rounded-full bg-white/10 text-lg hover:bg-white/20 active:bg-white/25 compact:h-10 compact:w-10"
          >
            ⏭
          </button>
          {/* balances the counter so the buttons stay centred */}
          <span className="hidden w-14 max-md:block" />
        </div>

        <div className="h-12 w-px shrink-0 bg-white/15 compact:hidden" />

        <Chevron dir="left" disabled={!canLeft} onClick={() => page(-1)} />

        <div
          ref={stripRef}
          onScroll={updateArrows}
          onTouchMove={onActivity}
          className="flex min-w-0 flex-1 gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] compact:gap-2 [&::-webkit-scrollbar]:hidden"
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
                className={`w-28 shrink-0 p-0.5 text-left transition-opacity compact:w-[5.9rem] ${on ? "" : "opacity-60 hover:opacity-100"}`}
              >
                <div
                  className={`relative h-16 w-full overflow-hidden rounded-lg bg-white/10 ring-2 compact:h-12 ${
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
                  className={`mt-1.5 truncate text-xs font-medium tabular-nums compact:text-[11px] ${on ? "text-[#d9bf8c]" : "text-white/85"}`}
                >
                  {shownAt(p.createdAt)}
                </p>
                <p className="truncate text-[11px] text-white/50 compact:hidden">{p.name || " "}</p>
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
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:hover:bg-white/10 compact:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
