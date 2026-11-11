import { getDb } from "@/db";
import { settings } from "@/db/schema";

/** Timing settings, in seconds. Defaults apply until an admin changes them. */
export const SETTING_LIMITS = {
  slideSeconds: { min: 3, max: 60, default: 7, label: "TV slideshow: seconds per photo" },
  portraitSeconds: { min: 2, max: 30, default: 5, label: "Her portrait: seconds per photo" },
} as const;

export type SettingKey = keyof typeof SETTING_LIMITS;
export type Settings = Record<SettingKey, number>;

function clamp(key: SettingKey, v: unknown) {
  const { min, max, default: d } = SETTING_LIMITS[key];
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function readSettings(): Promise<Settings> {
  const rows = await getDb().select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Settings;
  for (const key of Object.keys(SETTING_LIMITS) as SettingKey[]) {
    out[key] = map.has(key) ? clamp(key, map.get(key)) : SETTING_LIMITS[key].default;
  }
  return out;
}

export async function writeSettings(input: Partial<Record<SettingKey, unknown>>) {
  const db = getDb();
  for (const key of Object.keys(SETTING_LIMITS) as SettingKey[]) {
    if (input[key] === undefined) continue;
    const value = String(clamp(key, input[key]));
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  return readSettings();
}
