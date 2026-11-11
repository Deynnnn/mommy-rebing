"use client";

import { useEffect, useRef } from "react";

type Track = { id: string; title: string };

const POLL_MS = 30000;
const FADE_MS = 800;

/**
 * Background music for the TV slideshow. Plays the admin's playlist in order (or shuffled) and
 * loops it. `paused` fades it out, e.g. while a guest video with sound is playing.
 * Calls onBlocked if the browser refuses to play sound before a click; it retries once
 * `blocked` turns false again.
 */
export function SlideshowMusic({
  enabled,
  volume,
  shuffle,
  paused,
  blocked,
  onBlocked,
}: {
  enabled: boolean;
  volume: number;
  shuffle: boolean;
  paused: boolean;
  blocked: boolean;
  onBlocked: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const tracksRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const failsRef = useRef(0);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({ enabled, volume, shuffle, paused, blocked, onBlocked });
  stateRef.current = { enabled, volume, shuffle, paused, blocked, onBlocked };

  const target = () => Math.max(0, Math.min(1, stateRef.current.volume / 100));
  const shouldPlay = () => stateRef.current.enabled && !stateRef.current.paused && tracksRef.current.length > 0;

  function fadeTo(to: number, then?: () => void) {
    const a = audioRef.current;
    if (!a) return;
    if (fadeRef.current) clearInterval(fadeRef.current);
    const from = a.volume;
    const start = Date.now();
    fadeRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / FADE_MS);
      a.volume = from + (to - from) * t;
      if (t >= 1) {
        clearInterval(fadeRef.current!);
        fadeRef.current = null;
        then?.();
      }
    }, 40);
  }

  function play() {
    const a = audioRef.current;
    if (!a || !shouldPlay()) return;
    if (!a.src) {
      loadNext();
      return;
    }
    a.play()
      .then(() => fadeTo(target()))
      .catch((e: Error) => {
        if (e.name === "NotAllowedError") stateRef.current.onBlocked();
      });
  }

  function loadNext() {
    const a = audioRef.current;
    const list = tracksRef.current;
    if (!a || !list.length) return;
    let i = indexRef.current + 1;
    if (stateRef.current.shuffle && list.length > 1) {
      do i = Math.floor(Math.random() * list.length);
      while (i === indexRef.current);
    }
    indexRef.current = i % list.length;
    a.src = `/api/music/${list[indexRef.current].id}`;
    a.volume = 0;
    play();
  }

  // Load the playlist and keep it fresh so newly uploaded songs join in.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/music", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const list = (await res.json()) as Track[];
        const hadNone = tracksRef.current.length === 0;
        tracksRef.current = list;
        const a = audioRef.current;
        if (!list.length) {
          a?.pause();
          a?.removeAttribute("src");
          indexRef.current = -1;
        } else if (hadNone || (a && a.paused && !a.src)) {
          play();
        }
      } catch {}
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to on/off, pausing for videos, and the click that unblocks sound.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (enabled && !paused && !blocked) play();
    else if (!a.paused) fadeTo(0, () => a.pause());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, blocked]);

  // Volume changes from the admin page.
  useEffect(() => {
    const a = audioRef.current;
    if (a && !a.paused && !fadeRef.current) a.volume = target();
  }, [volume]);

  useEffect(() => () => void (fadeRef.current && clearInterval(fadeRef.current)), []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      onPlaying={() => (failsRef.current = 0)}
      onEnded={loadNext}
      onError={() => {
        // skip broken songs, but don't spin if every song fails (e.g. the network is down)
        failsRef.current++;
        if (failsRef.current < Math.max(1, tracksRef.current.length)) loadNext();
        else setTimeout(() => ((failsRef.current = 0), loadNext()), POLL_MS);
      }}
      className="hidden"
    />
  );
}
