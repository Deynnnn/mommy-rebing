"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type AdminPost, GuestUploads } from "@/components/GuestUploads";
import { PortraitManager } from "@/components/PortraitManager";
import { TimingSettings } from "@/components/TimingSettings";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [input, setInput] = useState("");
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  // pause background refreshes while someone is dragging or a new order is being saved
  const busyRef = useRef(false);

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
    const list = (await res.json()) as AdminPost[];
    if (!busyRef.current) setPosts(list);
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

  async function reorder(next: AdminPost[]) {
    setPosts(next);
    busyRef.current = true;
    setOrderStatus("Saving order…");
    try {
      const res = await fetch("/api/admin/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error();
      setOrderStatus("Order saved. The slideshow uses it on its next round.");
    } catch {
      setOrderStatus("Could not save the order. Please try again.");
    } finally {
      busyRef.current = false;
      load();
    }
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

      <TimingSettings adminKey={key} />
      <PortraitManager adminKey={key} />

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">Guest uploads</h2>
        <p className="text-xs text-muted">
          Drag to rearrange. On a phone, press and hold a photo, then drag.
        </p>
      </div>
      {orderStatus && <p className="mt-1 text-sm text-muted">{orderStatus}</p>}
      {posts && posts.length === 0 && <p className="mt-3 text-sm text-muted">No guest uploads yet.</p>}
      {posts && posts.length > 0 && (
        <GuestUploads
          posts={posts}
          onReorder={reorder}
          onToggle={toggle}
          onDragState={(d) => (busyRef.current = d)}
        />
      )}
    </main>
  );
}
