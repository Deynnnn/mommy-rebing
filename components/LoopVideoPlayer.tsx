"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_LOOP = 0.5; // seconds

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Video with the normal controls plus an A–B loop: pick a start and end (drag the handles or
 * tap "Set start/end here" while watching) and that part repeats. Nothing is saved.
 */
export function LoopVideoPlayer({ src, className = "" }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(0);
  const [looping, setLooping] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const loopRef = useRef({ looping, start, end });
  loopRef.current = { looping, start, end };

  const onMeta = useCallback(() => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    setDuration(v.duration);
    setEnd((e) => (e > 0 ? Math.min(e, v.duration) : v.duration));
  }, []);

  // Keep the playhead inside the loop. Checked every frame while playing so the jump back is tight.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const keepInLoop = () => {
      const { looping, start, end } = loopRef.current;
      if (looping && end - start >= MIN_LOOP) {
        if (v.currentTime >= end - 0.03 || v.currentTime < start - 0.25) {
          v.currentTime = start;
          if (v.paused && v.ended) v.play().catch(() => {});
        }
      }
      setNow(Math.round(v.currentTime * 10) / 10); // re-renders ~10x a second, not every frame
    };
    const check = () => {
      keepInLoop();
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    // frames stop when the tab is in the background; timeupdate still fires a few times a second
    v.addEventListener("timeupdate", keepInLoop);
    // when the loop ends exactly at the video's end, "ended" fires instead
    const onEnded = () => {
      const { looping, start } = loopRef.current;
      if (!looping) return;
      v.currentTime = start;
      v.play().catch(() => {});
    };
    v.addEventListener("ended", onEnded);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("timeupdate", keepInLoop);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  function enableLoop() {
    const v = videoRef.current;
    if (!duration) return;
    // start from where the viewer is now, 5 seconds long by default
    const s = Math.max(0, Math.min(v?.currentTime ?? 0, duration - MIN_LOOP));
    setStart(s);
    setEnd(Math.min(duration, s + 5));
    setLooping(true);
    if (v) {
      v.currentTime = s;
      v.play().catch(() => {});
    }
  }

  function setStartAt(t: number) {
    const s = Math.max(0, Math.min(t, end - MIN_LOOP));
    setStart(s);
    const v = videoRef.current;
    if (v && (v.currentTime < s || v.currentTime > end)) v.currentTime = s;
  }

  function setEndAt(t: number) {
    setEnd(Math.min(duration, Math.max(t, start + MIN_LOOP)));
  }

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const cur = videoRef.current?.currentTime ?? now;

  return (
    <div className={`flex w-full max-w-3xl flex-col items-center ${className}`} onClick={(e) => e.stopPropagation()}>
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay
        playsInline
        onLoadedMetadata={onMeta}
        onDurationChange={onMeta}
        className="max-h-[62dvh] max-w-full rounded"
      />

      <div className="mt-3 w-full rounded-2xl bg-neutral-900/95 p-3 text-white ring-1 ring-white/10 sm:p-4">
        {!looping ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white/75">Want to watch a part again and again?</p>
            <button
              onClick={enableLoop}
              disabled={!duration}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              <LoopIcon /> Loop a part
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <LoopIcon /> Looping {fmt(start)} – {fmt(end)}
                <span className="text-white/50">({(end - start).toFixed(1)}s)</span>
              </span>
              <button onClick={() => setLooping(false)} className="rounded-full px-3 py-1 text-white/70 underline underline-offset-4">
                Stop loop
              </button>
            </div>

            {/* timeline with two handles; the gold band is the looped part */}
            <div className="relative mt-4 h-8">
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20" />
              <div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#d9bf8c]"
                style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white"
                style={{ left: `${pct(cur)}%` }}
              />
              <input
                type="range"
                aria-label="Loop start"
                min={0}
                max={duration}
                step={0.1}
                value={start}
                onChange={(e) => setStartAt(Number(e.target.value))}
                className="loop-thumb absolute inset-0 w-full"
              />
              <input
                type="range"
                aria-label="Loop end"
                min={0}
                max={duration}
                step={0.1}
                value={end}
                onChange={(e) => setEndAt(Number(e.target.value))}
                className="loop-thumb absolute inset-0 w-full"
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/50">
              <span>0:00.0</span>
              <span>{fmt(duration)}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setStartAt(videoRef.current?.currentTime ?? 0)}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                Set start here
                <span className="block text-xs tabular-nums text-white/60">{fmt(cur)}</span>
              </button>
              <button
                onClick={() => setEndAt(videoRef.current?.currentTime ?? 0)}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                Set end here
                <span className="block text-xs tabular-nums text-white/60">{fmt(cur)}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}
