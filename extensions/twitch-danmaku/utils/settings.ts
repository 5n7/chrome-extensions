import { storage } from "#imports";

export interface Settings {
  readonly enabled: boolean;
  readonly area: number;
  readonly laneCount: number;
  readonly opacity: number;
  readonly crossingTime: number;
}

export type SliderKey = Exclude<keyof Settings, "enabled">;

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

const ITEMS = {
  enabled: storage.defineItem<unknown>("sync:enabled"),
  area: storage.defineItem<unknown>("sync:area"),
  laneCount: storage.defineItem<unknown>("sync:laneCount"),
  opacity: storage.defineItem<unknown>("sync:opacity"),
  crossingTime: storage.defineItem<unknown>("sync:crossingTime"),
} satisfies Record<keyof Settings, unknown>;

const KEYS = Object.keys(ITEMS) as (keyof Settings)[];

async function read<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  return FIELDS[key](await ITEMS[key].getValue());
}

export async function getSettings(): Promise<Settings> {
  const [enabled, area, laneCount, opacity, crossingTime] = await Promise.all([
    read("enabled"),
    read("area"),
    read("laneCount"),
    read("opacity"),
    read("crossingTime"),
  ]);
  return { enabled, area, laneCount, opacity, crossingTime };
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
