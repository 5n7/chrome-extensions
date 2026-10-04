import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { recencyOrders } from "./recency";
import { createSwitcher, SETTLE_MS } from "./switcher";

const WINDOW = 1;
const OTHER_WINDOW = 2;

/**
 * Stands in for Chrome's tabs: activating a tab records it and stamps its last access, as Chrome
 * does, but each test delivers the activation event itself, in the order Chrome would. Tabs start
 * last accessed in the order listed.
 */
function setup(windows: Record<number, number[]>, active: Record<number, number>) {
  const activated: number[] = [];
  const lastAccessed = new Map<number, number>();
  let clock = 0;
  const switcher = createSwitcher({
    activate: async (tabId) => {
      activated.push(tabId);
      lastAccessed.set(tabId, ++clock);
      for (const [windowId, ids] of Object.entries(windows)) {
        if (ids.includes(tabId)) active[Number(windowId)] = tabId;
      }
    },
    inWindow: async (windowId) =>
      (windows[windowId] ?? []).map((id, index) => ({
        active: active[windowId] === id,
        id,
        lastAccessed: lastAccessed.get(id) ?? -index,
      })),
    lastFocusedWindow: async () => WINDOW,
  });

  /** Presses Ctrl+Tab (or Ctrl+Shift+Tab), then delivers the activation it caused, if any. */
  async function press(direction: "newer" | "older" = "older", windowId = WINDOW) {
    const before = activated.length;
    await switcher.press(direction, windowId);
    const tabId = activated[before];
    if (tabId !== undefined) await switcher.activated(tabId, windowId);
  }

  /** Switches to a tab some other way, such as a click. */
  async function click(tabId: number, windowId = WINDOW) {
    active[windowId] = tabId;
    await switcher.activated(tabId, windowId);
  }

  return { activated, click, press, switcher };
}

async function order(windowId = WINDOW) {
  return (await recencyOrders.getValue())[windowId];
}

async function settle() {
  await vi.advanceTimersByTimeAsync(SETTLE_MS);
}

describe("createSwitcher", () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("switches to the previously used tab and makes it the most recent", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3] });
    const { activated, press } = setup({ [WINDOW]: [1, 2, 3] }, { [WINDOW]: 1 });
    await press();
    expect(activated).toEqual([2]);
    await settle();
    expect(await order()).toEqual([2, 1, 3]);
  });

  it("goes further back on each press and holds the order still until the Walk settles", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3, 4] });
    const { activated, press } = setup({ [WINDOW]: [1, 2, 3, 4] }, { [WINDOW]: 1 });
    await press();
    await press();
    await press();
    expect(activated).toEqual([2, 3, 4]);
    expect(await order()).toEqual([1, 2, 3, 4]);
    await settle();
    expect(await order()).toEqual([4, 1, 2, 3]);
  });

  it("keeps the Walk going while presses come less than a second apart", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3] });
    const { activated, press } = setup({ [WINDOW]: [1, 2, 3] }, { [WINDOW]: 1 });
    await press();
    await vi.advanceTimersByTimeAsync(SETTLE_MS - 1);
    await press();
    expect(activated).toEqual([2, 3]);
  });

  it("steps back toward the start with Ctrl+Shift+Tab", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3] });
    const { activated, press } = setup({ [WINDOW]: [1, 2, 3] }, { [WINDOW]: 1 });
    await press();
    await press();
    await press("newer");
    expect(activated).toEqual([2, 3, 2]);
    await settle();
    expect(await order()).toEqual([2, 1, 3]);
  });

  it("does nothing on Ctrl+Shift+Tab outside a Walk", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2] });
    const { activated, press } = setup({ [WINDOW]: [1, 2] }, { [WINDOW]: 1 });
    await press("newer");
    await settle();
    expect(activated).toEqual([]);
    expect(await order()).toEqual([1, 2]);
  });

  it("stops at the oldest tab", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2] });
    const { activated, press } = setup({ [WINDOW]: [1, 2] }, { [WINDOW]: 1 });
    await press();
    await press();
    expect(activated).toEqual([2]);
  });

  it("settles at once when a tab the Walk passed is clicked", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3, 4] });
    const { activated, click, press } = setup({ [WINDOW]: [1, 2, 3, 4] }, { [WINDOW]: 1 });
    await press();
    await press();
    await click(2);
    expect(await order()).toEqual([2, 3, 1, 4]);
    // The next press starts a new Walk from the clicked tab.
    await press();
    expect(activated.at(-1)).toBe(3);
  });

  it("never promotes a tab the Walk did not show when the shown tab closes", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3, 4] });
    const windows = { [WINDOW]: [1, 2, 3, 4] };
    const { click, press, switcher } = setup(windows, { [WINDOW]: 1 });
    await press();
    await press();
    // Chrome reports the closed tab before activating a neighbor.
    windows[WINDOW] = [1, 2, 4];
    await switcher.removed(3, WINDOW, false);
    await click(2);
    expect(await order()).toEqual([2, 1, 4]);
  });

  it("settles a Walk in one window when another window's Walk begins", async () => {
    await recencyOrders.setValue({ [OTHER_WINDOW]: [5, 6], [WINDOW]: [1, 2] });
    const { press } = setup({ [OTHER_WINDOW]: [5, 6], [WINDOW]: [1, 2] }, { 1: 1, 2: 5 });
    await press();
    await press("older", OTHER_WINDOW);
    expect(await order()).toEqual([2, 1]);
  });

  it("ranks a tab opened in the background behind the tabs already open", async () => {
    // The stored orders are empty, as after a browser restart.
    const windows = { [WINDOW]: [1, 2, 3] };
    const { activated, press, switcher } = setup(windows, { [WINDOW]: 1 });
    windows[WINDOW].push(9);
    await switcher.created(9, WINDOW);
    expect(await order()).toEqual([1, 2, 3, 9]);
    await press();
    expect(activated).toEqual([2]);
  });

  it("keeps the order a first Walk started from, though the tabs it passed were just accessed", async () => {
    // The stored orders are empty, as after a browser restart.
    const { press } = setup({ [WINDOW]: [1, 2, 3, 4] }, { [WINDOW]: 1 });
    await press();
    await press();
    await settle();
    expect(await order()).toEqual([3, 1, 2, 4]);
  });

  it("waits for every activation it asked for before treating one as a switch", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2, 3] });
    const { switcher } = setup({ [WINDOW]: [1, 2, 3] }, { [WINDOW]: 1 });
    // Key repeat outpaces Chrome: tab 2 is asked for twice before either activation arrives.
    await switcher.press("older", WINDOW);
    await switcher.press("older", WINDOW);
    await switcher.press("newer", WINDOW);
    await switcher.activated(2, WINDOW);
    await switcher.activated(3, WINDOW);
    await switcher.activated(2, WINDOW);
    expect(await order()).toEqual([1, 2, 3]);
    await settle();
    expect(await order()).toEqual([2, 1, 3]);
  });

  it("walks the last focused window when Chrome names none", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2] });
    const { activated, switcher } = setup({ [WINDOW]: [1, 2] }, { [WINDOW]: 1 });
    await switcher.press("older");
    expect(activated).toEqual([2]);
  });

  it("forgets a closed window's order", async () => {
    await recencyOrders.setValue({ [WINDOW]: [1, 2] });
    const { switcher } = setup({}, {});
    await switcher.windowRemoved(WINDOW);
    expect(await order()).toBeUndefined();
  });
});
