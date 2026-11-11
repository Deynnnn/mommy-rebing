"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type PublicSettings } from "@/lib/settings-shared";

const FIELDS: { key: "slideSeconds" | "portraitSeconds"; label: string; hint: string; min: number; max: number }[] = [
  {
    key: "slideSeconds",
    label: "TV slideshow",
    hint: "How long each shared photo stays on the TV. Videos always play to the end.",
    min: 3,
    max: 60,
  },
  {
    key: "portraitSeconds",
    label: "Her portrait",
    hint: "How long each of her photos stays in the round portrait.",
    min: 2,
    max: 30,
  },
];

const TOGGLES: { key: "slideshowPublic" | "videoSound"; label: string; hint: string }[] = [
  {
    key: "slideshowPublic",
    label: "Anyone can open the TV slideshow",
    hint: "When off, /slideshow only works on devices signed in to this admin page (like the TV laptop). The gallery and sharing stay open to everyone.",
  },
  {
    key: "videoSound",
    label: "Play video sound on the TV",
    hint: "Turn off for a quiet room. The browser needs one click on the slideshow before sound can play.",
  },
];

/** Admin section: change how long each image stays on screen. Open screens pick it up within ~15 s. */
export function TimingSettings() {
  const [values, setValues] = useState<PublicSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<PublicSettings | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: PublicSettings | null) => {
        if (s) {
          setValues(s);
          setSaved(s);
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setStatus("Saving…");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      const s = (await res.json()) as PublicSettings;
      setValues(s);
      setSaved(s);
      setStatus("Saved. Screens update within 15 seconds.");
    } catch {
      setStatus("Could not save. Please try again.");
    }
  }

  const dirty = !saved || JSON.stringify(values) !== JSON.stringify(saved);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <h2 className="font-serif text-2xl">Slideshow settings</h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="flex items-baseline justify-between">
              <span className="font-medium">{f.label}</span>
              <span className="font-serif text-xl">{values[f.key]} sec</span>
            </span>
            <input
              type="range"
              min={f.min}
              max={f.max}
              value={values[f.key]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }));
                setStatus("");
              }}
              className="mt-2 w-full accent-[#a8874f]"
            />
            <span className="flex justify-between text-xs text-muted">
              <span>{f.min}s</span>
              <span>{f.max}s</span>
            </span>
            <span className="mt-1 block text-xs text-muted">{f.hint}</span>
          </label>
        ))}
      </div>
      {TOGGLES.map((t) => (
        <label key={t.key} className="mt-5 flex items-center gap-3">
          <input
            type="checkbox"
            checked={values[t.key] === 1}
            onChange={(e) => {
              setValues((v) => ({ ...v, [t.key]: e.target.checked ? 1 : 0 }));
              setStatus("");
            }}
            className="h-5 w-5 shrink-0 accent-[#a8874f]"
          />
          <span>
            <span className="font-medium">{t.label}</span>
            <span className="block text-xs text-muted">{t.hint}</span>
          </span>
        </label>
      ))}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || status === "Saving…"}
          className="rounded-full bg-ink px-5 py-2 text-sm text-cream disabled:opacity-40"
        >
          Save settings
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </section>
  );
}
