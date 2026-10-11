import { interceptKeys } from "@repo/wxt-kit/keyboard";
import { follow, onInvalidatedWhileAlive } from "@repo/wxt-kit/lifecycle";

import { defineContentScript } from "#imports";
import { findPlayerVideo, isSeekablePath, seek } from "@/utils/player";
import { findSeekBinding, seekBindings, type SeekBinding } from "@/utils/seek-bindings";
import { createSeekIndicator } from "@/utils/seek-indicator";

export default defineContentScript({
  matches: ["https://www.twitch.tv/*"],
  async main(ctx) {
    let bindings: SeekBinding[] = [];
    const following = follow(seekBindings, (next) => (bindings = next));
    onInvalidatedWhileAlive(ctx, following.stop);
    await following.ready;
    const indicator = createSeekIndicator();
    ctx.onInvalidated(() => indicator.remove());

    // A Seek Binding replaces Native Seek.
    interceptKeys(ctx, (event) => {
      // Twitch is an SPA, so re-check the page and the player on every key press.
      if (!isSeekablePath(location.pathname)) return;
      const binding = findSeekBinding(bindings, event);
      if (!binding) return;
      const video = findPlayerVideo();
      if (!video || !Number.isFinite(video.duration)) return;
      return () => {
        if (seek(video, binding.offset)) indicator.show(video, binding.offset);
      };
    });
  },
});
