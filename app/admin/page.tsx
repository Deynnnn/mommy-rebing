"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { type AdminPost, GuestUploads } from "@/components/GuestUploads";
import { PortraitManager } from "@/components/PortraitManager";

export default function AdminPage() {
  return <AdminShell active="/admin">{(onUnauthorized) => <Uploads onUnauthorized={onUnauthorized} />}</AdminShell>;
}

function Uploads({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  // pause background refreshes while someone is dragging or a new order is being saved
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/posts", { cache: "no-store" });
    if (res.status === 401) {
      // session expired or ADMIN_KEY changed
      onUnauthorized();
      return;
    }
    if (!res.ok) {
      setLoadError(`Server error (${res.status}). Check DATABASE_URL and bucket settings.`);
      return;
    }
    setLoadError("");
    const list = (await res.json()) as AdminPost[];
    if (!busyRef.current) setPosts(list);
  }, [onUnauthorized]);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 15000);
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
      load().catch(() => {});
    }
  }

  const visible = posts?.filter((p) => !p.hidden).length ?? 0;

  return (
    <>
      <PortraitManager />

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-2xl">Guest uploads</h2>
          <p className="text-sm text-muted">
            {posts === null ? "Loading…" : `${posts.length} uploads · ${visible} visible`}
          </p>
          {loadError && <p className="text-sm text-red-700">{loadError}</p>}
        </div>
        <p className="text-xs text-muted">Drag to rearrange. On a phone, press and hold a photo, then drag.</p>
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
    </>
  );
}
