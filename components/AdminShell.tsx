"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { DialogProvider } from "@/components/Dialog";

const MENU = [
  { href: "/admin", label: "Guest uploads" },
  { href: "/admin/settings", label: "Settings" },
] as const;

/**
 * Shared frame for the admin pages: checks the login cookie, shows the sign-in form when needed,
 * and draws the header with the menu. `children` gets a callback to call on a 401 (session expired).
 */
export function AdminShell({
  active,
  children,
}: {
  active: (typeof MENU)[number]["href"];
  children: (onUnauthorized: () => void) => ReactNode;
}) {
  // null = still checking the login cookie
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

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

  const onUnauthorized = useCallback(() => setAuthed(false), []);

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    setAuthed(false);
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Family admin</h1>
        <div className="flex flex-wrap gap-2">
          <a href="/slideshow" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm">
            Open slideshow
          </a>
          <a href="/qr" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm">
            QR card
          </a>
          <a href="/api/admin/export" className="rounded-full bg-ink px-4 py-2 text-sm text-cream">
            Download all (ZIP)
          </a>
          <button onClick={signOut} className="rounded-full px-3 py-2 text-sm text-muted underline underline-offset-4">
            Sign out
          </button>
        </div>
      </div>

      <nav className="mt-5 flex gap-1 border-b border-line" aria-label="Admin menu">
        {MENU.map((m) => {
          const on = m.href === active;
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={on ? "page" : undefined}
              className={`-mb-px rounded-t-xl border px-4 py-2 text-sm ${
                on ? "border-line border-b-cream bg-cream font-medium" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>

      <DialogProvider>{children(onUnauthorized)}</DialogProvider>
    </main>
  );
}
