import { storage } from "#imports";

/** A window's Recency Order: its tab ids, from the most recently used to the least. */
export type RecencyOrder = number[];

/** Every window's Recency Order, keyed by window id; cleared when the browser quits, as tab ids are. */
export const recencyOrders = storage.defineItem<Record<string, RecencyOrder>>(
  "session:recencyOrders",
  { fallback: {} },
);

/** Moves a tab to the front, as the one used last. */
export function markUsed(order: RecencyOrder, tabId: number): RecencyOrder {
  return [tabId, ...order.filter((id) => id !== tabId)];
}

/** Places a tab that has not been used yet behind every used one. */
export function append(order: RecencyOrder, tabId: number): RecencyOrder {
  return order.includes(tabId) ? order : [...order, tabId];
}

export function remove(order: RecencyOrder, tabId: number): RecencyOrder {
  return order.filter((id) => id !== tabId);
}

/** Swaps a tab id that Chrome replaced, such as on a prerendered page, keeping its place. */
export function replace(order: RecencyOrder, removedId: number, addedId: number): RecencyOrder {
  return order.map((id) => (id === removedId ? addedId : id));
}

export interface OpenTab {
  id?: number;
  lastAccessed?: number;
}

/**
 * Matches an order to the window's open tabs: closed tabs drop out, and tabs it has not seen, such
 * as those already open when the extension started, join behind the rest by Chrome's own last access.
 */
export function reconcile(order: RecencyOrder, tabs: OpenTab[]): RecencyOrder {
  const open = new Set(tabs.map((tab) => tab.id));
  const known = order.filter((id) => open.has(id));
  const unseen = tabs
    .filter(
      (tab): tab is OpenTab & { id: number } => tab.id !== undefined && !known.includes(tab.id),
    )
    .toSorted((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    .map((tab) => tab.id);
  return [...known, ...unseen];
}
