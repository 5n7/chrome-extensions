import { browser, defineContentScript } from "#imports";
import { planAttach } from "@/utils/attach";
import { loadEmotes } from "@/utils/emotes";
import { ensurePlayerButton, removePlayerButton } from "@/utils/player-button";
import { startSession, type Session, type SessionTarget } from "@/utils/session";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSetting,
  watchSettings,
  type Settings,
} from "@/utils/settings";
import { findButtonSlot, findChatList, findPlayer, findVodOwnerLogin } from "@/utils/twitch-dom";
import { pageKey, parseWatchPage } from "@/utils/watch-page";

// Twitch re-renders the player and chat and swaps the <video> without any event, so the page is
// looked at again this often as well as on navigation.
const HEARTBEAT_MS = 1000;

export default defineContentScript({
  matches: ["https://www.twitch.tv/*"],
  async main(ctx) {
    let settings: Settings = DEFAULT_SETTINGS;
    let session: Session | undefined;
    let emotesFor: string | undefined;

    function findTarget(): SessionTarget | undefined {
      const page = parseWatchPage(location.href);
      if (!page || !settings.enabled) return undefined;
      const parts = findPlayer(document);
      const chatList = findChatList(document, page.kind);
      if (!parts || !chatList) return undefined;
      return {
        key: pageKey(page),
        page,
        parts,
        player: parts.player,
        video: parts.video,
        chatList,
      };
    }

    function requestEmotes(target: SessionTarget) {
      const login = target.page.kind === "live" ? target.page.login : findVodOwnerLogin(document);
      if (!login || login === emotesFor) return;
      emotesFor = login;
      const requested = session;
      void loadEmotes(login).then((emotes) => {
        if (session === requested) session?.setEmotes(emotes);
      });
    }

    function reconcile() {
      const target = findTarget();
      const plan = planAttach(session?.binding, session?.connected() ?? false, target);
      if (plan === "detach" || plan === "replace") {
        session?.destroy();
        session = undefined;
      }
      if (target && (plan === "attach" || plan === "replace")) {
        session = startSession(target, settings);
        emotesFor = undefined;
      }
      if (session && target) requestEmotes(target);
      const slot = parseWatchPage(location.href) && findButtonSlot(document);
      if (slot) ensurePlayerButton(slot, settings.enabled, toggle);
      else removePlayerButton(document);
    }

    function toggle() {
      void saveSetting("enabled", !settings.enabled);
    }

    ctx.onInvalidated(() => {
      session?.destroy();
      removePlayerButton(document);
    });
    const unwatchSettings = watchSettings((change) => {
      settings = { ...settings, ...change };
      session?.configure(settings);
      reconcile();
    });
    ctx.onInvalidated(() => {
      // Once the extension reloads, this script is orphaned and any storage call throws; its
      // listeners can no longer fire, so there is nothing to remove.
      if (browser.runtime?.id) unwatchSettings();
    });
    settings = await getSettings();

    ctx.addEventListener(window, "wxt:locationchange", reconcile);
    ctx.addEventListener(document, "fullscreenchange", reconcile);
    ctx.setInterval(reconcile, HEARTBEAT_MS);
    reconcile();
  },
});
