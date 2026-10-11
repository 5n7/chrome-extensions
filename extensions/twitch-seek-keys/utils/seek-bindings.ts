import { combination, isSameCombination, type KeyCombination } from "@repo/wxt-kit/keyboard";

import { storage } from "#imports";

export interface SeekOffset {
  direction: "backward" | "forward";
  seconds: number;
}

export interface SeekBinding {
  combination: KeyCombination;
  offset: SeekOffset;
}

export const MIN_SECONDS = 1;
export const MAX_SECONDS = 3600;

function binding(
  combo: KeyCombination,
  direction: SeekOffset["direction"],
  seconds: number,
): SeekBinding {
  return { combination: combo, offset: { direction, seconds } };
}

// Ordered from the finest to the coarsest step, backward before forward.
export const DEFAULT_BINDINGS: SeekBinding[] = [
  binding(combination("ArrowLeft"), "backward", 5),
  binding(combination("ArrowRight"), "forward", 5),
  binding(combination("KeyJ"), "backward", 10),
  binding(combination("KeyL"), "forward", 10),
  binding(combination("KeyJ", { shiftKey: true }), "backward", 30),
  binding(combination("KeyL", { shiftKey: true }), "forward", 30),
  binding(combination("ArrowLeft", { shiftKey: true }), "backward", 60),
  binding(combination("ArrowRight", { shiftKey: true }), "forward", 60),
];

export const seekBindings = storage.defineItem<SeekBinding[]>("sync:seekBindings", {
  fallback: DEFAULT_BINDINGS,
});

export function findSeekBinding(
  bindings: readonly SeekBinding[],
  event: KeyCombination,
): SeekBinding | undefined {
  return bindings.find((b) => isSameCombination(b.combination, event));
}

export function isValidSeconds(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;
}

export function formatOffset(offset: SeekOffset): string {
  return `${offset.direction === "backward" ? "−" : "+"}${offset.seconds}s`;
}
