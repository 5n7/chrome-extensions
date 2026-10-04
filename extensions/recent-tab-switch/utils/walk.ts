import type { RecencyOrder } from "./recency";

/**
 * Consecutive presses of the switch shortcuts in one window. It steps through the Recency Order as it
 * stood when the Walk began, which stays unchanged until the Walk settles.
 */
export interface Walk {
  windowId: number;
  tabs: RecencyOrder;
  /** The index in `tabs` of the tab the Walk is on; 0 is the tab it started from. */
  position: number;
}

export type Direction = "newer" | "older";

/** Moves one tab along, stopping at either end rather than wrapping around. */
export function step(walk: Walk, direction: Direction): Walk {
  const offset = direction === "older" ? 1 : -1;
  const position = Math.max(Math.min(walk.position + offset, walk.tabs.length - 1), 0);
  return { ...walk, position };
}

/** The tab the Walk is on. */
export function current(walk: Walk): number | undefined {
  return walk.tabs[walk.position];
}

/** Drops a closed tab, staying on the same tab if it remains, else on the next older one. */
export function without(walk: Walk, tabId: number): Walk {
  const index = walk.tabs.indexOf(tabId);
  if (index === -1) return walk;
  const tabs = walk.tabs.filter((id) => id !== tabId);
  const position = index < walk.position ? walk.position - 1 : walk.position;
  return { ...walk, position: Math.min(position, Math.max(tabs.length - 1, 0)), tabs };
}
