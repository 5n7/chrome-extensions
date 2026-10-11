import type { Browser } from "#imports";

import {
  append,
  markUsed,
  recencyOrders,
  reconcile,
  remove,
  replace,
  type RecencyOrder,
} from "./recency";
import { current, step, without, type Direction, type Walk } from "./walk";

/** How long after the last press a Walk settles. */
export const SETTLE_MS = 1000;

/** The part of the tabs and windows APIs the switcher drives, so tests can stand in for Chrome. */
export interface Tabs {
  inWindow(windowId: number): Promise<Pick<Browser.tabs.Tab, "active" | "id" | "lastAccessed">[]>;
  activate(tabId: number): Promise<unknown>;
  lastFocusedWindow(): Promise<number | undefined>;
}

interface OngoingWalk {
  walk: Walk;
  shown?: number;
  awaitedActivations: Map<number, number>;
  settleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Keeps each window's Recency Order and runs Walks over it. Every method queues behind the ones
 * called before it, since each reads and writes the stored orders, and resolves once its turn is done.
 */
export function createSwitcher(tabs: Tabs) {
  // The Walk lives only in memory: the service worker outlives a one-second pause, and a lost Walk
  // just leaves the Recency Order as it was.
  let ongoing: OngoingWalk | undefined;

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
  function arrive(walking: OngoingWalk, tabId: number): boolean {
    const count = walking.awaitedActivations.get(tabId);
    if (count === undefined) return false;
    if (count > 1) walking.awaitedActivations.set(tabId, count - 1);
    else walking.awaitedActivations.delete(tabId);
    return true;
  }

  function end() {
    clearTimeout(ongoing?.settleTimer);
    ongoing = undefined;
  }

  async function settle() {
    if (!ongoing) return;
    const { shown, walk } = ongoing;
    end();
    if (shown !== undefined) await update(walk.windowId, (order) => markUsed(order, shown));
  }

  function scheduleSettle(walking: OngoingWalk) {
    clearTimeout(walking.settleTimer);
    const timer = setTimeout(
      // A press queued just as the timer fired has started a new countdown, so this one stands down.
      () => void enqueue(async () => (ongoing?.settleTimer === timer ? settle() : undefined)),
      SETTLE_MS,
    );
    walking.settleTimer = timer;
  }

  async function press(direction: Direction, pressedIn: number | undefined) {
    const windowId = pressedIn ?? (await tabs.lastFocusedWindow());
    if (windowId === undefined) return;
    if (ongoing && ongoing.walk.windowId !== windowId) await settle();
    if (!ongoing) {
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
      ongoing = { awaitedActivations: new Map(), walk: { position: 0, tabs: order, windowId } };
    }
    const walking = ongoing;
    const next = step(walking.walk, direction);
    const moved = next.position !== walking.walk.position;
    walking.walk = next;
    scheduleSettle(walking);
    const target = current(next);
    // At either end there is nothing new to show.
    if (!moved || target === undefined) return;
    const { awaitedActivations } = walking;
    awaitedActivations.set(target, (awaitedActivations.get(target) ?? 0) + 1);
    try {
      await tabs.activate(target);
      walking.shown = target;
    } catch (error) {
      arrive(walking, target);
      throw error;
    }
  }

  /** Ranks a tab that has just joined a window, by opening or moving there, behind every used one. */
  function admit(tabId: number, windowId: number) {
    return enqueue(() => update(windowId, (order) => append(order, tabId), tabId));
  }

  function forget(tabId: number) {
    if (!ongoing) return;
    ongoing.walk = without(ongoing.walk, tabId);
    if (ongoing.shown === tabId) ongoing.shown = undefined;
    ongoing.awaitedActivations.delete(tabId);
  }

  function release(tabId: number, windowId: number) {
    return enqueue(async () => {
      forget(tabId);
      await update(windowId, (order) => remove(order, tabId));
    });
  }

  function rename(removedId: number, addedId: number) {
    if (!ongoing) return;
    ongoing.walk = { ...ongoing.walk, tabs: replace(ongoing.walk.tabs, removedId, addedId) };
    if (ongoing.shown === removedId) ongoing.shown = addedId;
    const count = ongoing.awaitedActivations.get(removedId);
    if (count !== undefined) {
      ongoing.awaitedActivations.delete(removedId);
      ongoing.awaitedActivations.set(addedId, count);
    }
  }

  return {
    /**
     * Ctrl+Tab steps to an older tab, Ctrl+Shift+Tab back toward the start. Without the window it
     * was pressed in, the last focused one is used.
     */
    press: (direction: Direction, windowId?: number) => enqueue(() => press(direction, windowId)),

    activated: (tabId: number, windowId: number) =>
      enqueue(async () => {
        if (ongoing?.walk.windowId === windowId && arrive(ongoing, tabId)) return;
        // Any other switch, such as a click on a tab, settles the Walk at once.
        await settle();
        await update(windowId, (order) => markUsed(order, tabId));
      }),

    created: admit,

    // A closing window's whole order goes with it in `windowRemoved`.
    removed: (tabId: number, windowId: number, isWindowClosing: boolean) =>
      isWindowClosing ? enqueue(async () => forget(tabId)) : release(tabId, windowId),

    detached: release,

    attached: admit,

    replaced: (addedId: number, removedId: number) =>
      enqueue(async () => {
        rename(removedId, addedId);
        const orders = await recencyOrders.getValue();
        for (const [windowId, order] of Object.entries(orders)) {
          orders[windowId] = replace(order, removedId, addedId);
        }
        await recencyOrders.setValue(orders);
      }),

    windowRemoved: (windowId: number) =>
      enqueue(async () => {
        if (ongoing?.walk.windowId === windowId) end();
        const orders = await recencyOrders.getValue();
        delete orders[windowId];
        await recencyOrders.setValue(orders);
      }),
  };
}
