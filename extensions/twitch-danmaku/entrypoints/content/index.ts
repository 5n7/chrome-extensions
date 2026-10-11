import { onInvalidatedWhileAlive } from "@repo/wxt-kit/lifecycle";

import { defineContentScript } from "#imports";
import { canKeep } from "@/utils/attach";
import { ensurePlayerButton, removePlayerButton } from "@/utils/player-button";
import { startSession, type Session, type SessionTarget } from "@/utils/session";
import { followSettings, saveSetting, type Settings } from "@/utils/settings";
import { findButtonSlot, findChatList, findPlayer } from "@/utils/twitch-dom";
import { pageKey, parseWatchPage, type WatchPage } from "@/utils/watch-page";

// Twitch re-renders the player and chat and swaps the <video> without any event, so the page is
// looked at again this often as well as on navigation.
const HEARTBEAT_MS = 1000;

export default defineContentScript({
  matches: ["https://www.twitch.tv/*"],
  async main(ctx) {
    let settings: Settings;
    let session: Session | undefined;

    function findTarget(page: WatchPage): SessionTarget | undefined {
      const parts = findPlayer(document);
      const chatList = findChatList(document, page.kind);
      return parts && chatList ? { key: pageKey(page), page, ...parts, chatList } : undefined;
    }

    function reconcile() {
      const page = parseWatchPage(location.href);
      const target = page && settings.enabled ? findTarget(page) : undefined;
      if (session && !(target && canKeep(session.binding, session.connected(), target))) {
        session.destroy();
        session = undefined;
      }
      if (!session && target) session = startSession(target, settings);
      session?.syncEmotes();
      const slot = page && findButtonSlot(document);
      if (slot) ensurePlayerButton(slot, settings.enabled, toggle);
      else removePlayerButton(document);
    }

    function toggle() {
      // The button shows what is stored, so a write sync storage refuses, such as one over its rate
      // limit, leaves the button as it was.
      saveSetting("enabled", !settings.enabled).catch(() => {});
    }

    ctx.onInvalidated(() => {
      session?.destroy();
      removePlayerButton(document);
    });
    const following = followSettings((next) => {
      settings = next;
      session?.configure(settings);
      reconcile();
    });
    onInvalidatedWhileAlive(ctx, following.stop);
    await following.ready;

    ctx.addEventListener(window, "wxt:locationchange", reconcile);
    ctx.addEventListener(document, "fullscreenchange", reconcile);
    ctx.setInterval(reconcile, HEARTBEAT_MS);
  },
});
