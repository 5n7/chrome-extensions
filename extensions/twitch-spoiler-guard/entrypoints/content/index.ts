import { browser, defineContentScript } from "#imports";
import { guard } from "@/utils/guard";

import "./style.css";

/** `style.css` hides Spoiler Cues only while `<html>` carries this attribute. */
const GUARD_ATTRIBUTE = "data-twitch-spoiler-guard";

export default defineContentScript({
  matches: ["https://www.twitch.tv/*"],
  // Before Twitch renders anything, so no Spoiler Cue shows while the stored state loads.
  runAt: "document_start",
  async main(ctx) {
    const apply = (on: boolean) => document.documentElement.toggleAttribute(GUARD_ATTRIBUTE, on);
    // Guard until the stored state arrives: unhiding late is harmless, showing early is a spoiler.
    apply(true);
    // Watch before reading so a change made in between is not lost.
    let changed: boolean | undefined;
    const unwatch = guard.watch((next) => apply((changed = next)));
    ctx.onInvalidated(() => {
      // Once the extension reloads, this script is orphaned and any storage call throws; its
      // listeners can no longer fire, so there is nothing to remove.
      if (browser.runtime?.id) unwatch();
    });
    const initial = await guard.getValue();
    apply(changed ?? initial);
    // A page restored from the back/forward cache missed any change made while it was away.
    ctx.addEventListener(window, "pageshow", (event) => {
      if (event.persisted) void guard.getValue().then(apply);
    });
  },
});
