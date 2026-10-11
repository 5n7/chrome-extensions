import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { defineSyncSettings, describeSaveError } from "./settings";

interface Settings {
  readonly enabled: boolean;
  readonly size: number;
}

const settings = defineSyncSettings<Settings>({
  enabled: (stored) => (typeof stored === "boolean" ? stored : true),
  size: (stored) => (typeof stored === "number" ? stored : 10),
});

beforeEach(() => fakeBrowser.reset());

afterEach(() => vi.restoreAllMocks());

/** Holds every read of sync storage until the returned function is called. */
function holdReads() {
  const { sync } = fakeBrowser.storage;
  const get = sync.get.bind(sync);
  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  vi.spyOn(sync, "get").mockImplementation(async (keys) => {
    const read = await get(keys);
    await released;
    return read;
  });
  return release;
}

describe("defineSyncSettings", () => {
  it("keeps each setting under its own sync storage key, named after it", async () => {
    await settings.save("enabled", false);
    await settings.save("size", 20);
    expect(await browser.storage.sync.get()).toEqual({ enabled: false, size: 20 });
  });

  it("reads each setting through its reader, so a malformed one falls back alone", async () => {
    await browser.storage.sync.set({ enabled: "yes", size: 20 });
    const get = vi.spyOn(fakeBrowser.storage.sync, "get");
    expect(await settings.get()).toEqual({ enabled: true, size: 20 });
    expect(get).toHaveBeenCalledOnce();
  });

  it("reports only the setting that changed", async () => {
    const changes: Partial<Settings>[] = [];
    const unwatch = settings.watch((change) => changes.push(change));
    await settings.save("size", 15);
    unwatch();
    await settings.save("size", 16);
    expect(changes).toEqual([{ size: 15 }]);
  });

  it("reports settings changed in one write as one change, read through their readers", async () => {
    const changes: Partial<Settings>[] = [];
    const unwatch = settings.watch((change) => changes.push(change));
    await browser.storage.sync.set({ enabled: false, size: "big", unrelated: 1 });
    unwatch();
    expect(changes).toEqual([{ enabled: false, size: 10 }]);
  });

  it("follows every setting, with a change made while they load laid over the read", async () => {
    await settings.save("size", 20);
    const release = holdReads();
    const seen: Settings[] = [];
    const { ready, stop } = settings.follow((next) => seen.push(next));
    await settings.save("enabled", false);
    expect(seen).toEqual([]);
    release();
    await ready;
    expect(seen).toEqual([{ enabled: false, size: 20 }]);
    await settings.save("size", 30);
    stop();
    await settings.save("size", 40);
    expect(seen).toEqual([
      { enabled: false, size: 20 },
      { enabled: false, size: 30 },
    ]);
  });

  it("resets every setting to its fallback in one write, reported as one change", async () => {
    await settings.save("enabled", false);
    await settings.save("size", 20);
    const remove = vi.spyOn(fakeBrowser.storage.sync, "remove");
    const changes: Partial<Settings>[] = [];
    const unwatch = settings.watch((change) => changes.push(change));
    await settings.reset();
    unwatch();
    expect(remove).toHaveBeenCalledOnce();
    expect(changes).toEqual([{ enabled: true, size: 10 }]);
    expect(await settings.get()).toEqual({ enabled: true, size: 10 });
  });
});

describe("describeSaveError", () => {
  it("names the sync limit that refused the write", () => {
    expect(describeSaveError(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded"))).toBe(
      "Couldn't save: Chrome limits how often settings sync. Try again later.",
    );
    expect(describeSaveError(new Error("QUOTA_BYTES quota exceeded"))).toBe(
      "Couldn't save: Chrome's sync storage is full. Remove or shorten some settings first.",
    );
    expect(describeSaveError("offline")).toBe("Couldn't save. Try again.");
  });

  it("names what to shorten once storage is full", () => {
    expect(describeSaveError(new Error("QUOTA_BYTES quota exceeded"), "rules")).toBe(
      "Couldn't save: Chrome's sync storage is full. Remove or shorten some rules first.",
    );
  });
});
