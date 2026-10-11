import { storage } from "#imports";

export interface Settings {
  readonly enabled: boolean;
  readonly area: number;
  readonly laneCount: number;
  readonly opacity: number;
  readonly crossingTime: number;
}

export type SliderKey = "area" | "crossingTime" | "laneCount" | "opacity";

export interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const RANGES: Record<SliderKey, Range> = {
  area: { min: 30, max: 100, step: 5 },
  crossingTime: { min: 4, max: 16, step: 1 },
  laneCount: { min: 6, max: 36, step: 1 },
  opacity: { min: 20, max: 100, step: 5 },
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  area: 70,
  laneCount: 24,
  opacity: 80,
  crossingTime: 8,
};

function readRanged(key: SliderKey) {
  const { max, min, step } = RANGES[key];
  return (stored: unknown): number => {
    if (typeof stored !== "number" || !Number.isFinite(stored)) return DEFAULT_SETTINGS[key];
    const clamped = Math.min(max, Math.max(min, stored));
    return min + Math.round((clamped - min) / step) * step;
  };
}

const FIELDS: { [K in keyof Settings]: (stored: unknown) => Settings[K] } = {
  enabled: (stored) => (typeof stored === "boolean" ? stored : DEFAULT_SETTINGS.enabled),
  area: readRanged("area"),
  laneCount: readRanged("laneCount"),
  opacity: readRanged("opacity"),
  crossingTime: readRanged("crossingTime"),
};

const KEYS = Object.keys(FIELDS) as (keyof Settings)[];

const ITEMS = Object.fromEntries(
  KEYS.map((key) => [key, storage.defineItem<unknown>(`sync:${key}`)]),
) as Record<keyof Settings, ReturnType<typeof storage.defineItem<unknown>>>;

export async function getSettings(): Promise<Settings> {
  const values = await Promise.all(KEYS.map((key) => ITEMS[key].getValue()));
  return Object.fromEntries(
    KEYS.map((key, index) => [key, FIELDS[key](values[index])]),
  ) as unknown as Settings;
}

export function watchSettings(callback: (change: Partial<Settings>) => void): () => void {
  const unwatchers = KEYS.map((key) =>
    ITEMS[key].watch((stored) => callback({ [key]: FIELDS[key](stored) })),
  );
  return () => unwatchers.forEach((unwatch) => unwatch());
}

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  return ITEMS[key].setValue(value);
}

export async function resetSettings(): Promise<void> {
  await Promise.all(KEYS.map((key) => ITEMS[key].removeValue()));
}
