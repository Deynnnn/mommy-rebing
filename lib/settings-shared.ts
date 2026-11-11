// Client-safe defaults (keep in sync with SETTING_LIMITS in lib/settings.ts).
export const DEFAULT_SETTINGS = {
  slideSeconds: 7,
  portraitSeconds: 5,
  videoSound: 1,
  slideshowPublic: 1,
  music: 1,
  musicVolume: 40,
  musicShuffle: 0,
};
export type PublicSettings = typeof DEFAULT_SETTINGS;
