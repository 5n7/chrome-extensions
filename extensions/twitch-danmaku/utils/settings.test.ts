import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { browser } from "#imports";

import { DEFAULT_SETTINGS, getSettings, resetSettings, saveSetting } from "./settings";

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts on, with a 70% area, 24 Lanes, 80% opacity, and an 8 s Crossing Time", async () => {
    expect(await getSettings()).toEqual({
      enabled: true,
      area: 70,
      laneCount: 24,
      opacity: 80,
      crossingTime: 8,
    });
  });

  it("falls back per item, keeping the well-formed ones", async () => {
    await browser.storage.sync.set({
      laneCount: "many",
      opacity: 60,
      enabled: false,
    });
    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      enabled: false,
      opacity: 60,
    });
  });

  it("clamps a stored number into its slider's range and step", async () => {
    await browser.storage.sync.set({ area: 7, crossingTime: 99, laneCount: 35.6 });
    const settings = await getSettings();
    expect([settings.area, settings.crossingTime, settings.laneCount]).toEqual([30, 16, 36]);
  });

  it("keeps each setting under its own sync storage key", async () => {
    await saveSetting("enabled", false);
    await saveSetting("area", 50);
    await saveSetting("laneCount", 12);
    await saveSetting("opacity", 60);
    await saveSetting("crossingTime", 10);
    expect(await browser.storage.sync.get()).toEqual({
      enabled: false,
      area: 50,
      laneCount: 12,
      opacity: 60,
      crossingTime: 10,
    });
  });

  it("resets every setting to its default", async () => {
    await saveSetting("enabled", false);
    await saveSetting("crossingTime", 12);
    await resetSettings();
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
