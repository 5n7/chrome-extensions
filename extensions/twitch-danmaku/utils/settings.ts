import { defineSyncSettings } from "@repo/wxt-kit/settings";

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

export const {
  follow: followSettings,
  get: getSettings,
  reset: resetSettings,
  save: saveSetting,
} = defineSyncSettings<Settings>({
  enabled: (stored) => (typeof stored === "boolean" ? stored : DEFAULT_SETTINGS.enabled),
  area: readRanged("area"),
  laneCount: readRanged("laneCount"),
  opacity: readRanged("opacity"),
  crossingTime: readRanged("crossingTime"),
});
