"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Candle } from "@/components/Candle";
import { compressImage as prepare } from "@/lib/compress";
import { tribute } from "@/lib/tribute";

type Item = {
  file: File;
  preview: string;
  status: "waiting" | "uploading" | "done" | "error";
  error?: string;
};

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function SharePage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const n = localStorage.getItem("guestName");
      if (n) setName(n);
    } catch {}
  }, []);

  function pick(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .map((file) => ({ file, preview: URL.createObjectURL(file), status: "waiting" as const }));
    setItems((cur) => [...cur, ...next].slice(0, 20));
  }

  function remove(i: number) {
    setItems((cur) => cur.filter((_, j) => j !== i));
  }

  async function submit() {
    if (!items.length || busy) return;
    setBusy(true);
    try {
      localStorage.setItem("guestName", name.trim());
    } catch {}

    let failures = 0;
    let messageSent = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue;
      setItems((cur) => cur.map((it, j) => (j === i ? { ...it, status: "uploading", error: undefined } : it)));
      try {
        const file = await prepare(items[i].file);
        if (!OK_TYPES.includes(file.type)) throw new Error("Format not supported. Try a JPG.");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", name);
        // attach the message to the first successful photo only
        if (!messageSent) fd.append("message", message);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Upload failed. Please try again.");
        }
        messageSent = true;
        setItems((cur) => cur.map((it, j) => (j === i ? { ...it, status: "done" } : it)));
      } catch (e) {
        failures++;
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setItems((cur) => cur.map((it, j) => (j === i ? { ...it, status: "error", error: msg } : it)));
      }
    }
    if (messageSent) setMessage("");
    setBusy(false);
    if (failures === 0) setDone(true);
  }

  function again() {
    items.forEach((it) => URL.revokeObjectURL(it.preview));
    setItems([]);
    setMessage("");
    setDone(false);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <Candle className="h-16 w-10" />
        <h1 className="mt-4 font-serif text-4xl">Salamat po.</h1>
        <p className="mt-3 font-serif text-lg text-ink/80">
          Thank you for sharing your memory of {tribute.nickname}. It will appear on the screen shortly.
        </p>
        <button onClick={again} className="mt-8 w-full rounded-full bg-ink px-6 py-4 font-medium text-cream">
          Share another photo
        </button>
        <Link href="/" className="mt-4 text-sm text-muted underline underline-offset-4">
          See all shared memories
        </Link>
      </main>
    );
  }

  const uploaded = items.filter((i) => i.status === "done").length;
  const hasErrors = items.some((i) => i.status === "error");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-12 pt-8">
      <Link href="/" className="text-sm text-muted">
        ← Back
      </Link>
      <h1 className="mt-4 font-serif text-3xl leading-tight">Share a photo of {tribute.nickname}</h1>
      <p className="mt-1 text-sm text-muted">Magbahagi ng larawan at alaala</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-6 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gold/50 bg-paper px-4 py-8 text-center"
      >
        <span className="text-3xl">📷</span>
        <span className="mt-2 font-medium">{items.length ? "Add more photos" : "Choose or take photos"}</span>
        <span className="mt-1 text-xs text-muted">You can pick several at once</span>
      </button>

      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {items.map((it, i) => (
            <div key={it.preview} className="relative aspect-square overflow-hidden rounded-lg bg-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="h-full w-full object-cover" />
              {it.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                  Uploading…
                </div>
              )}
              {it.status === "done" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-2xl text-white">✓</div>
              )}
              {it.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 p-1 text-center text-[10px] text-white">
                  {it.error}
                </div>
              )}
              {!busy && it.status !== "done" && (
                <button
                  onClick={() => remove(i)}
                  className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-sm leading-6 text-white"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <label className="mt-6 block text-sm font-medium">
        Your name <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="e.g. Tita Liza, apo Miguel"
        className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-gold"
      />

      <label className="mt-4 block text-sm font-medium">
        A memory or message <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder={`A memory, a prayer, or a few words for ${tribute.nickname}…`}
        className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-3 font-serif text-lg outline-none focus:border-gold"
      />

      <button
        onClick={submit}
        disabled={!items.length || busy}
        className="mt-6 w-full rounded-full bg-ink px-6 py-4 font-medium text-cream shadow-md disabled:opacity-40"
      >
        {busy
          ? `Sharing… ${uploaded}/${items.length}`
          : hasErrors
            ? "Try again"
            : `Share ${items.length > 1 ? `${items.length} photos` : "photo"}`}
      </button>
    </main>
  );
}
