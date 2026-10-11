import { browser, type Browser } from "wxt/browser";

import { followPatches, type Following } from "./lifecycle";

export interface SyncSettings<S extends object> {
  /** Every setting, read in one call, each through its reader. */
  get: () => Promise<S>;
  /**
   * Calls back with the settings that changed, those changed together in one call, so an unsaved
   * edit to another one stays put.
   */
  watch: (callback: (change: Partial<S>) => void) => () => void;
  /**
   * Calls `onSettings` with every setting, then again whenever some change. Watching starts before
   * the read, so a change made meanwhile lands on top of what was read.
   */
  follow: (onSettings: (settings: S) => void) => Following;
  save: <K extends keyof S>(key: K, value: S[K]) => Promise<void>;
  /** Removes every setting in one write, so each falls back. */
  reset: () => Promise<void>;
}

/**
 * Settings stored as one `sync:<key>` item per key, so a malformed one falls back alone and saving
 * one never rewrites the others. Every read goes through the key's reader, since another device
 * may have stored anything.
 */
export function defineSyncSettings<S extends object>(readers: {
  [K in keyof S]: (stored: unknown) => S[K];
}): SyncSettings<S> {
  // `Object.keys` forgets the key type, and this is the one place that rebuilds `S` from its parts.
  const keys = Object.keys(readers) as (keyof S & string)[];

  /** Reads each setting in `some` through its reader, from what `stored` holds for it. */
  function read(some: readonly (keyof S & string)[], stored: (key: string) => unknown): Partial<S> {
    const settings: Partial<S> = {};
    for (const key of some) settings[key] = readers[key](stored(key));
    return settings;
  }

  async function get(): Promise<S> {
    const stored = await browser.storage.sync.get(keys);
    return read(keys, (key) => stored[key]) as S;
  }

  function watch(callback: (change: Partial<S>) => void): () => void {
    const { onChanged } = browser.storage.sync;
    const listener = (changes: Record<string, Browser.storage.StorageChange>) => {
      const changed = keys.filter((key) => key in changes);
      if (changed.length > 0) callback(read(changed, (key) => changes[key]?.newValue));
    };
    onChanged.addListener(listener);
    return () => onChanged.removeListener(listener);
  }

  return {
    get,
    watch,
    follow: (onSettings) =>
      followPatches({ getValue: get, watch }, onSettings, (settings, change) => ({
        ...settings,
        ...change,
      })),
    save: (key, value) => browser.storage.sync.set({ [key]: value }),
    reset: () => browser.storage.sync.remove(keys),
  };
}

/**
 * Says why sync storage refused a write, and what to do about it. `bulk` names what the viewer can
 * shorten once storage is full, such as the rules an extension keeps.
 */
export function describeSaveError(error: unknown, bulk = "settings"): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("MAX_WRITE_OPERATIONS")) {
    return "Couldn't save: Chrome limits how often settings sync. Try again later.";
  }
  if (message.includes("QUOTA_BYTES")) {
    return `Couldn't save: Chrome's sync storage is full. Remove or shorten some ${bulk} first.`;
  }
  return "Couldn't save. Try again.";
}
