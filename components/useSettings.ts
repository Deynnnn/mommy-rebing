"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type PublicSettings } from "@/lib/settings-shared";

/** Reads the admin timing settings and re-checks them periodically, so open screens pick up changes. */
export function useSettings(refreshMs = 15000): PublicSettings {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next = (await res.json()) as PublicSettings;
        setSettings((cur) =>
          cur.slideSeconds === next.slideSeconds && cur.portraitSeconds === next.portraitSeconds ? cur : next,
        );
      } catch {}
    };
    load();
    const t = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshMs]);

  return settings;
}
