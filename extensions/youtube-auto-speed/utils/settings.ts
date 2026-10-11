import { defineSyncSettings } from "@repo/wxt-kit/settings";

import { storage } from "#imports";

import { readChannelRules, readTitleRules, type Rules } from "./rules";
import { DEFAULT_SHORTCUTS, readShortcuts, type Shortcuts } from "./shortcuts";
import { isSpeed, type Speed } from "./speed";

const DEFAULT_SPEED: Speed = 1;

export interface Settings extends Rules {
  shortcuts: Shortcuts;
}

export const INITIAL_SETTINGS: Settings = {
  defaultSpeed: DEFAULT_SPEED,
  titleRules: [],
  channelRules: [],
  shortcuts: DEFAULT_SHORTCUTS,
};

export const {
  follow: followSettings,
  get: getSettings,
  save: saveSetting,
  watch: watchSettings,
} = defineSyncSettings<Settings>({
  defaultSpeed: (stored) => (isSpeed(stored) ? stored : DEFAULT_SPEED),
  titleRules: readTitleRules,
  channelRules: readChannelRules,
  shortcuts: readShortcuts,
});

/**
 * Display names last seen per lowercased handle, for showing beside a Channel Rule. Kept on this
 * device only, so refreshing a name never spends sync storage's write quota.
 */
export const channelNamesItem = storage.defineItem<Record<string, string>>("local:channelNames", {
  fallback: {},
});

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
