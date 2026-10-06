import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import {
  channelName,
  channelNamesItem,
  channelRulesItem,
  defaultSpeedItem,
  getSettings,
  INITIAL_SETTINGS,
  rememberChannelName,
  saveSetting,
  shortcutsItem,
} from "./settings";

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts at 1.0x with no rules and S / D", async () => {
    expect(await getSettings()).toEqual(INITIAL_SETTINGS);
  });

  it("falls back per setting, keeping the well-formed ones", async () => {
    await defaultSpeedItem.setValue(1.25);
    await shortcutsItem.setValue("junk");
    await channelRulesItem.setValue([{ handle: "@a", id: "a", speed: 2 }, { id: "b" }]);
    await saveSetting("titleRules", [{ id: "t", pattern: "asmr", speed: 1 }]);
    expect(await getSettings()).toEqual({
      ...INITIAL_SETTINGS,
      channelRules: [{ handle: "@a", id: "a", speed: 2 }],
      titleRules: [{ id: "t", pattern: "asmr", speed: 1 }],
    });
  });

  it("remembers channel names by handle, ignoring case", async () => {
    await rememberChannelName("@DailyLisp", "Daily Lisp Talks");
    expect(channelName(await channelNamesItem.getValue(), "@dailylisp")).toBe("Daily Lisp Talks");
  });
});
