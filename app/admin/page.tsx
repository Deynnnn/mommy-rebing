"use client";

import { useCallback, useEffect, useState } from "react";
import { PortraitManager } from "@/components/PortraitManager";

type AdminPost = {
  id: string;
  createdAt: string;
  name: string | null;
  message: string | null;
  hidden: boolean;
};

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("key");
    if (k) setKey(k);
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    const res = await fetch("/api/admin/posts", { headers: { "x-admin-key": key }, cache: "no-store" });
    if (res.status === 401) {
      setError("Wrong admin key.");
      setPosts(null);
      setKey(""); // stop polling with a bad key
      return;
    }
    setError("");
    if (!res.ok) {
      setLoadError(`Server error (${res.status}). Check DATABASE_URL and bucket settings.`);
      return;
    }
    setLoadError("");
    setPosts(await res.json());
  }, [key]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function toggle(p: AdminPost) {
    setPosts((cur) => cur?.map((x) => (x.id === p.id ? { ...x, hidden: !p.hidden } : x)) ?? null);
    await fetch("/api/admin/hide", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ id: p.id, hidden: !p.hidden }),
    });
  }

  if (!key || error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <h1 className="font-serif text-3xl">Family admin</h1>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setKey(input.trim());
          }}
        >
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin key"
            className="flex-1 rounded-xl border border-line bg-paper px-4 py-3"
          />
          <button className="rounded-xl bg-ink px-4 text-cream">Open</button>
        </form>
      </main>
    );
  }

  const visible = posts?.filter((p) => !p.hidden).length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Family admin</h1>
          <p className="text-sm text-muted">
            {posts === null ? "Loading…" : `${posts.length} uploads · ${visible} visible`}
          </p>
          {loadError && <p className="text-sm text-red-700">{loadError}</p>}
        </div>
        <div className="flex gap-2">
          <a href="/slideshow" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm">
            Open slideshow
          </a>
          <a href="/qr" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm">
            QR card
          </a>
          <a
            href={`/api/admin/export?key=${encodeURIComponent(key)}`}
            className="rounded-full bg-ink px-4 py-2 text-sm text-cream"
          >
            Download all (ZIP)
          </a>
        </div>
      </div>

      <PortraitManager adminKey={key} />

      <h2 className="mt-8 font-serif text-2xl">Guest uploads</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {posts?.map((p) => (
          <div
            key={p.id}
            className={`overflow-hidden rounded-lg border bg-paper ${p.hidden ? "border-red-300 opacity-50" : "border-line"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/image/${p.id}`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            <div className="space-y-1 p-2 text-xs">
              {p.message && <p className="line-clamp-3 font-serif text-sm">{p.message}</p>}
              <p className="text-muted">
                {p.name || "Guest"} · {new Date(p.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
              <button
                onClick={() => toggle(p)}
                className={`w-full rounded-md py-1.5 font-medium ${p.hidden ? "bg-ink text-cream" : "bg-red-50 text-red-700"}`}
              >
                {p.hidden ? "Show again" : "Hide"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
