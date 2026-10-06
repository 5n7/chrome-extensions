import { storage } from "#imports";

import { readChannelRules, readTitleRules, type Rules } from "./rules";
import { DEFAULT_SHORTCUTS, readShortcuts, type Shortcuts } from "./shortcuts";
import { isSpeed, type Speed } from "./speed";

// Each setting is its own sync item, so a malformed one falls back alone and an edit to one list
// never rewrites the others. Reads go through the `read*` guards, since another device may store anything.

export const defaultSpeedItem = storage.defineItem<unknown>("sync:defaultSpeed");
export const titleRulesItem = storage.defineItem<unknown>("sync:titleRules");
export const channelRulesItem = storage.defineItem<unknown>("sync:channelRules");
export const shortcutsItem = storage.defineItem<unknown>("sync:shortcuts");

/**
 * Display names last seen per lowercased handle, for showing beside a Channel Rule. Kept on this
 * device only, so refreshing a name never spends sync storage's write quota.
 */
export const channelNamesItem = storage.defineItem<Record<string, string>>("local:channelNames", {
  fallback: {},
});

export const DEFAULT_SPEED: Speed = 1;

export interface Settings extends Rules {
  shortcuts: Shortcuts;
}

export const INITIAL_SETTINGS: Settings = {
  defaultSpeed: DEFAULT_SPEED,
  titleRules: [],
  channelRules: [],
  shortcuts: DEFAULT_SHORTCUTS,
};

export function readDefaultSpeed(stored: unknown): Speed {
  return isSpeed(stored) ? stored : DEFAULT_SPEED;
}

export async function getSettings(): Promise<Settings> {
  const [defaultSpeed, titleRules, channelRules, shortcuts] = await Promise.all([
    defaultSpeedItem.getValue(),
    titleRulesItem.getValue(),
    channelRulesItem.getValue(),
    shortcutsItem.getValue(),
  ]);
  return {
    defaultSpeed: readDefaultSpeed(defaultSpeed),
    titleRules: readTitleRules(titleRules),
    channelRules: readChannelRules(channelRules),
    shortcuts: readShortcuts(shortcuts),
  };
}

/**
 * Calls back with just the setting that changed, so an unsaved edit to another one stays put;
 * returns the unwatch function.
 */
export function watchSettings(callback: (change: Partial<Settings>) => void): () => void {
  const unwatchers = [
    defaultSpeedItem.watch((stored) => callback({ defaultSpeed: readDefaultSpeed(stored) })),
    titleRulesItem.watch((stored) => callback({ titleRules: readTitleRules(stored) })),
    channelRulesItem.watch((stored) => callback({ channelRules: readChannelRules(stored) })),
    shortcutsItem.watch((stored) => callback({ shortcuts: readShortcuts(stored) })),
  ];
  return () => unwatchers.forEach((unwatch) => unwatch());
}

const ITEMS = {
  defaultSpeed: defaultSpeedItem,
  titleRules: titleRulesItem,
  channelRules: channelRulesItem,
  shortcuts: shortcutsItem,
};

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  return ITEMS[key].setValue(value);
}

/** Remembers a channel's display name for this device, skipping the write when nothing changed. */
export async function rememberChannelName(handle: string, name: string): Promise<void> {
  const key = handle.toLowerCase();
  const names = await channelNamesItem.getValue();
  if (names[key] === name) return;
  await channelNamesItem.setValue({ ...names, [key]: name });
}

export function channelName(names: Record<string, string>, handle: string): string | undefined {
  return names[handle.toLowerCase()];
}

/** Says why sync storage refused a write, and what to do about it. */
export function describeSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("MAX_WRITE_OPERATIONS")) {
    return "Couldn't save: Chrome limits how often settings sync. Try again later.";
  }
  if (message.includes("QUOTA_BYTES")) {
    return "Couldn't save: Chrome's sync storage is full. Remove or shorten some rules first.";
  }
  return "Couldn't save. Try again.";
}
