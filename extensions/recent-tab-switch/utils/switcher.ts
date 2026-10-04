import {
  append,
  markUsed,
  recencyOrders,
  reconcile,
  remove,
  replace,
  type OpenTab,
  type RecencyOrder,
} from "./recency";
import { current, step, without, type Direction, type Walk } from "./walk";

/** How long after the last press a Walk settles. */
export const SETTLE_MS = 1000;

/** The part of the tabs and windows APIs the switcher drives, so tests can stand in for Chrome. */
export interface Tabs {
  inWindow(windowId: number): Promise<(OpenTab & { active: boolean })[]>;
  activate(tabId: number): Promise<unknown>;
  lastFocusedWindow(): Promise<number | undefined>;
}

/**
 * Keeps each window's Recency Order and runs Walks over it. Every method queues behind the ones
 * called before it, since each reads and writes the stored orders, and resolves once its turn is done.
 */
export function createSwitcher(tabs: Tabs) {
  // The Walk lives only in memory: the service worker outlives a one-second pause, and a lost Walk
  // just leaves the Recency Order as it was.
  let walk: Walk | undefined;
  // The tab the Walk last showed, which becomes the most recently used when it settles.
  let shown: number | undefined;
  // How many times the Walk asked Chrome to show each tab without its activation arriving yet; any
  // other activation settles the Walk.
  const pending = new Map<number, number>();
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  let queue = Promise.resolve();
  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task).catch((error: unknown) => console.error(error));
    return queue;
  }

  async function update(
    windowId: number,
    change: (order: RecencyOrder) => RecencyOrder,
    arrivingTabId?: number,
  ) {
    const orders = await recencyOrders.getValue();
    // Orders start empty after an install, an update, or a browser restart. Rank the tabs already
    // open by Chrome's own last access, leaving out one only now arriving, which ranks behind them.
    const order =
      orders[windowId] ??
      reconcile(
        [],
        (await tabs.inWindow(windowId)).filter((tab) => tab.id !== arrivingTabId),
      );
    orders[windowId] = change(order);
    await recencyOrders.setValue(orders);
  }

  /** Counts off one awaited activation of the tab, telling whether there was one. */
  function arrive(tabId: number): boolean {
    const count = pending.get(tabId);
    if (count === undefined) return false;
    if (count > 1) pending.set(tabId, count - 1);
    else pending.delete(tabId);
    return true;
  }

  function end() {
    walk = undefined;
    shown = undefined;
    pending.clear();
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }

  async function settle() {
    if (!walk) return;
    const { windowId } = walk;
    const settled = shown;
    end();
    if (settled !== undefined) await update(windowId, (order) => markUsed(order, settled));
  }

  function scheduleSettle() {
    clearTimeout(settleTimer);
    const timer = setTimeout(
      // A press queued just as the timer fired has started a new countdown, so this one stands down.
      () => void enqueue(async () => (settleTimer === timer ? settle() : undefined)),
      SETTLE_MS,
    );
    settleTimer = timer;
  }

  async function press(direction: Direction, pressedIn: number | undefined) {
    const windowId = pressedIn ?? (await tabs.lastFocusedWindow());
    if (windowId === undefined) return;
    if (walk && walk.windowId !== windowId) await settle();
    if (!walk) {
      // Ctrl+Shift+Tab has nothing to step back to outside a Walk.
      if (direction === "newer") return;
      const open = await tabs.inWindow(windowId);
      const orders = await recencyOrders.getValue();
      let order = reconcile(orders[windowId] ?? [], open);
      const active = open.find((tab) => tab.active)?.id;
      if (active !== undefined) order = markUsed(order, active);
      // Stored now, as the tabs the Walk passes will look recently accessed to Chrome by the time it
      // settles.
      orders[windowId] = order;
      await recencyOrders.setValue(orders);
      walk = { position: 0, tabs: order, windowId };
    }
    const next = step(walk, direction);
    const moved = next.position !== walk.position;
    walk = next;
    scheduleSettle();
    const target = current(next);
    // At either end there is nothing new to show.
    if (!moved || target === undefined) return;
    pending.set(target, (pending.get(target) ?? 0) + 1);
    try {
      await tabs.activate(target);
      shown = target;
    } catch (error) {
      arrive(target);
      throw error;
    }
  }

  /** Ranks a tab that has just joined a window, by opening or moving there, behind every used one. */
  function admit(tabId: number, windowId: number) {
    return enqueue(() => update(windowId, (order) => append(order, tabId), tabId));
  }

  function forget(tabId: number) {
    if (walk) walk = without(walk, tabId);
    if (shown === tabId) shown = undefined;
    pending.delete(tabId);
  }

  return {
    /**
     * Ctrl+Tab steps to an older tab, Ctrl+Shift+Tab back toward the start. Without the window it
     * was pressed in, the last focused one is used.
     */
    press: (direction: Direction, windowId?: number) => enqueue(() => press(direction, windowId)),

    activated: (tabId: number, windowId: number) =>
      enqueue(async () => {
        if (walk?.windowId === windowId && arrive(tabId)) return;
        // Any other switch, such as a click on a tab, settles the Walk at once.
        await settle();
        await update(windowId, (order) => markUsed(order, tabId));
      }),

    created: admit,

    removed: (tabId: number, windowId: number, isWindowClosing: boolean) =>
      enqueue(async () => {
        forget(tabId);
        // The window's whole order goes with it in `windowRemoved`.
        if (!isWindowClosing) await update(windowId, (order) => remove(order, tabId));
      }),

    detached: (tabId: number, windowId: number) =>
      enqueue(async () => {
        forget(tabId);
        await update(windowId, (order) => remove(order, tabId));
      }),

    attached: admit,

    replaced: (addedId: number, removedId: number) =>
      enqueue(async () => {
        if (walk) walk = { ...walk, tabs: replace(walk.tabs, removedId, addedId) };
        if (shown === removedId) shown = addedId;
        const count = pending.get(removedId);
        if (count !== undefined) {
          pending.delete(removedId);
          pending.set(addedId, count);
        }
        const orders = await recencyOrders.getValue();
        for (const [windowId, order] of Object.entries(orders)) {
          orders[windowId] = replace(order, removedId, addedId);
        }
        await recencyOrders.setValue(orders);
      }),

    windowRemoved: (windowId: number) =>
      enqueue(async () => {
        if (walk?.windowId === windowId) end();
        const orders = await recencyOrders.getValue();
        delete orders[windowId];
        await recencyOrders.setValue(orders);
      }),
  };
}
