import { defineContentScript } from "#imports";
import { findPlayerVideo, isSeekablePath, ownsKeyboard, seek } from "@/utils/player";
import { findSeekBinding, seekBindings, type SeekBinding } from "@/utils/seek-bindings";
import { createSeekIndicator } from "@/utils/seek-indicator";

export default defineContentScript({
  matches: ["https://www.twitch.tv/*"],
  async main(ctx) {
    // Watch before reading so a change made in between is not lost.
    let changed: SeekBinding[] | undefined;
    ctx.onInvalidated(seekBindings.watch((next) => (changed = next)));
    const initial = await seekBindings.getValue();
    const indicator = createSeekIndicator();
    ctx.onInvalidated(() => indicator.remove());
    // Codes whose keydown was taken over, so only their keyup is hidden from Twitch too.
    const intercepted = new Set<string>();

    // Capture on `window` runs before Twitch's own handlers, so a Seek Binding replaces Native Seek.
    ctx.addEventListener(
      window,
      "keydown",
      (event) => {
        // Twitch is an SPA, so re-check the page and the player on every key press.
        if (ownsKeyboard(event) || !isSeekablePath(location.pathname)) return;
        const binding = findSeekBinding(changed ?? initial, event);
        if (!binding) return;
        const video = findPlayerVideo();
        if (!video || !Number.isFinite(video.duration)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        intercepted.add(event.code);
        if (seek(video, binding.offset)) indicator.show(video, binding.offset);
      },
      { capture: true },
    );
    ctx.addEventListener(
      window,
      "keyup",
      (event) => {
        if (!intercepted.delete(event.code)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true },
    );
    // A keyup never arrives after the window loses focus, or on macOS while Meta is held.
    ctx.addEventListener(window, "blur", () => intercepted.clear());
  },
});
