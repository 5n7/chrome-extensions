/** The six Speeds, slowest first; no other playback rate is ever applied. */
export const SPEEDS = [0.5, 1, 1.5, 2, 2.5, 3] as const;

export type Speed = (typeof SPEEDS)[number];

export function isSpeed(value: unknown): value is Speed {
  return SPEEDS.includes(value as Speed);
}

/** Always one decimal place, e.g. `1.0x`. */
export function formatSpeed(speed: Speed): string {
  return `${speed.toFixed(1)}x`;
}

/** The next Speed in the direction, or the same Speed at either end. */
export function stepSpeed(speed: Speed, direction: "down" | "up"): Speed {
  const index = SPEEDS.indexOf(speed) + (direction === "up" ? 1 : -1);
  return SPEEDS[index] ?? speed;
}
