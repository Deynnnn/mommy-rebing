"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { AdminUploader } from "@/components/AdminUploader";
import { Checkbox } from "@/components/Checkbox";
import { type AdminPost, GuestUploads } from "@/components/GuestUploads";
import { PortraitManager } from "@/components/PortraitManager";

export default function AdminPage() {
  return <AdminShell active="/admin">{(onUnauthorized) => <Uploads onUnauthorized={onUnauthorized} />}</AdminShell>;
}

function Uploads({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
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
    // forget selections of uploads that no longer exist
    setSelected((cur) => {
      const ids = new Set(list.map((p) => p.id));
      const next = new Set([...cur].filter((id) => ids.has(id)));
      return next.size === cur.size ? cur : next;
    });
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

  function select(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function remove(ids: string[]) {
    const n = ids.length;
    if (!n) return;
    if (!confirm(`Permanently delete ${n === 1 ? "this upload" : `${n} uploads`}? This can't be undone.`)) return;
    setBulkBusy(true);
    busyRef.current = true;
    try {
      const res = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error();
      const gone = new Set(ids);
      setPosts((cur) => cur?.filter((p) => !gone.has(p.id)) ?? null);
      setSelected((cur) => new Set([...cur].filter((id) => !gone.has(id))));
      setOrderStatus(`Deleted ${n === 1 ? "1 upload" : `${n} uploads`}.`);
    } catch {
      setOrderStatus("Could not delete. Please try again.");
    } finally {
      busyRef.current = false;
      setBulkBusy(false);
      load().catch(() => {});
    }
  }

  async function setHidden(ids: string[], hidden: boolean) {
    if (!ids.length) return;
    setBulkBusy(true);
    const set = new Set(ids);
    setPosts((cur) => cur?.map((p) => (set.has(p.id) ? { ...p, hidden } : p)) ?? null);
    try {
      await fetch("/api/admin/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, hidden }),
      });
    } finally {
      setBulkBusy(false);
      load().catch(() => {});
    }
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

  const allSelected = !!posts?.length && selected.size === posts.length;
  const chosen = [...selected];

  return (
    <>
      <PortraitManager />
      <AdminUploader onUploaded={() => load().catch(() => {})} />

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
      {posts && posts.length > 0 && (
        <div className="sticky top-0 z-30 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-y border-line bg-cream/95 px-4 py-2 backdrop-blur">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
            <Checkbox
              checked={allSelected}
              indeterminate={selected.size > 0 && !allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)))}
              label={allSelected ? "Unselect all" : "Select all"}
            />
            {selected.size ? `${selected.size} of ${posts.length} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => setHidden(chosen, true)}
                disabled={bulkBusy}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Hide
              </button>
              <button
                onClick={() => setHidden(chosen, false)}
                disabled={bulkBusy}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Show
              </button>
              <button
                onClick={() => remove(chosen)}
                disabled={bulkBusy}
                className="rounded-full bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Delete {selected.size}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-2 py-1.5 text-sm text-muted underline underline-offset-4"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
      {orderStatus && <p className="mt-1 text-sm text-muted">{orderStatus}</p>}
      {posts && posts.length === 0 && <p className="mt-3 text-sm text-muted">No guest uploads yet.</p>}
      {posts && posts.length > 0 && (
        <GuestUploads
          posts={posts}
          onReorder={reorder}
          onToggle={toggle}
          onDelete={(p) => remove([p.id])}
          selected={selected}
          onSelect={select}
          onDragState={(d) => (busyRef.current = d)}
        />
      )}
    </>
  );
}
