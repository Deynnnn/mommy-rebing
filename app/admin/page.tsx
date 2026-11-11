"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type AdminPost, GuestUploads } from "@/components/GuestUploads";
import { PortraitManager } from "@/components/PortraitManager";
import { TimingSettings } from "@/components/TimingSettings";

export default function AdminPage() {
  // null = still checking the login cookie
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  // pause background refreshes while someone is dragging or a new order is being saved
  const busyRef = useRef(false);

  const signIn = useCallback(async (key: string) => {
    setSigningIn(true);
    setError("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        setAuthed(true);
        setInput("");
      } else {
        setAuthed(false);
        setError("Wrong admin key.");
      }
    } catch {
      setAuthed(false);
      setError("Could not reach the server. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }, []);

  // On load: an old /admin?key=… link signs in once and the key is removed from the address bar;
  // otherwise check whether this browser is already signed in.
  useEffect(() => {
    const url = new URL(window.location.href);
    const k = url.searchParams.get("key");
    if (k) {
      url.searchParams.delete("key");
      window.history.replaceState(null, "", url.pathname + url.search);
      signIn(k);
      return;
    }
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, [signIn]);

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    setAuthed(false);
    setPosts(null);
  }

  const load = useCallback(async () => {
    if (!authed) return;
    const res = await fetch("/api/admin/posts", { cache: "no-store" });
    if (res.status === 401) {
      // session expired or ADMIN_KEY changed
      setAuthed(false);
      setPosts(null);
      return;
    }
    if (!res.ok) {
      setLoadError(`Server error (${res.status}). Check DATABASE_URL and bucket settings.`);
      return;
    }
    setLoadError("");
    const list = (await res.json()) as AdminPost[];
    if (!busyRef.current) setPosts(list);
  }, [authed]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function toggle(p: AdminPost) {
    setPosts((cur) => cur?.map((x) => (x.id === p.id ? { ...x, hidden: !p.hidden } : x)) ?? null);
    await fetch("/api/admin/hide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

  if (authed === null) {
    return <main className="flex min-h-dvh items-center justify-center text-muted">Loading…</main>;
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <h1 className="font-serif text-3xl">Family admin</h1>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) signIn(input.trim());
          }}
        >
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin key"
            autoComplete="current-password"
            className="flex-1 rounded-xl border border-line bg-paper px-4 py-3"
          />
          <button disabled={signingIn} className="rounded-xl bg-ink px-4 text-cream disabled:opacity-50">
            {signingIn ? "…" : "Open"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">This device stays signed in for 30 days.</p>
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
        <div className="flex flex-wrap gap-2">
          <a href="/slideshow" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm">
            Open slideshow
          </a>
          <a href="/qr" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm">
            QR card
          </a>
          <a
            href="/api/admin/export"
            className="rounded-full bg-ink px-4 py-2 text-sm text-cream"
          >
            Download all (ZIP)
          </a>
          <button onClick={signOut} className="rounded-full px-3 py-2 text-sm text-muted underline underline-offset-4">
            Sign out
          </button>
        </div>
      </div>

      <TimingSettings />
      <PortraitManager />

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
