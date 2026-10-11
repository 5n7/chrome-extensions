import {
  combination,
  isSameCombination,
  toKeyCombination,
  type KeyCombination,
} from "@repo/wxt-kit/keyboard";

import { isRecord } from "./is-record";
import type { Direction } from "./speed";

export interface Shortcuts {
  speedDown: KeyCombination;
  speedUp: KeyCombination;
}

export const DEFAULT_SHORTCUTS: Shortcuts = {
  speedDown: combination("KeyS"),
  speedUp: combination("KeyD"),
};

/**
 * YouTube's own `<` and `>`, which step the Speed too unless a Speed Shortcut takes them. Matched
 * by the character typed, as YouTube does, since they sit on different keys across layouts.
 */
const NATIVE_DIRECTIONS: Record<string, Direction> = { "<": "down", ">": "up" };

/** The Speed Shortcut a key press triggers, checking the viewer's own before YouTube's. */
export function findDirection(
  shortcuts: Shortcuts,
  event: KeyCombination & Pick<KeyboardEvent, "key">,
): Direction | undefined {
  if (isSameCombination(shortcuts.speedDown, event)) return "down";
  if (isSameCombination(shortcuts.speedUp, event)) return "up";
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
  return NATIVE_DIRECTIONS[event.key];
}

function isKeyCombination(value: unknown): value is KeyCombination {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.altKey === "boolean" &&
    typeof value.ctrlKey === "boolean" &&
    typeof value.metaKey === "boolean" &&
    typeof value.shiftKey === "boolean"
  );
}

/** Falls back to the defaults unless both Speed Shortcuts are well-formed. */
export function readShortcuts(stored: unknown): Shortcuts {
  if (!isRecord(stored)) return DEFAULT_SHORTCUTS;
  const { speedDown, speedUp } = stored;
  if (!isKeyCombination(speedDown) || !isKeyCombination(speedUp)) return DEFAULT_SHORTCUTS;
  return { speedDown: toKeyCombination(speedDown), speedUp: toKeyCombination(speedUp) };
}
