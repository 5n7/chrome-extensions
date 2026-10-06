import { browser, defineContentScript, type Browser } from "#imports";
import { POPUP_PORT, type PageState } from "@/utils/page-state";
import { readPlayer, type PlayerDetails, type PlayerVideo } from "@/utils/player-bridge";
import {
  getSettings,
  INITIAL_SETTINGS,
  rememberChannelName,
  watchSettings,
  type Settings,
} from "@/utils/settings";
import { findDirection } from "@/utils/shortcuts";
import type { Speed } from "@/utils/speed";
import { createSpeedIndicator } from "@/utils/speed-indicator";
import {
  applyRules,
  currentSource,
  currentSpeed,
  learnFacts,
  startTarget,
  stepTarget,
  type Target,
} from "@/utils/target";
import {
  findPlayer,
  findPlayerVideo,
  findTargetVideoId,
  isAdShowing,
  isWatchContext,
  NAVIGATION_EVENTS,
  ownsKeyboard,
  readHandle,
  YOUTUBE_ORIGIN,
} from "@/utils/youtube";

// While the rules wait on a title or handle, look again soon; otherwise just often enough to notice
// a video YouTube swapped in without an event this script listens to.
const PENDING_POLL_MS = 250;
const IDLE_POLL_MS = 1000;
// How long the popup shows "Reading this video…" before saying the channel could not be read.
const READ_TIMEOUT_MS = 5000;
// A change made by anything else is reverted once it settles, so a burst reverts only once.
const LOCK_DELAY_MS = 100;

export default defineContentScript({
  matches: [`${YOUTUBE_ORIGIN}/*`],
  async main(ctx) {
    let settings: Settings = INITIAL_SETTINGS;
    // Whether the page has been looked at once, before which a popup hears "loading", not "none".
    let synced = false;
    let target: Target | undefined;
    // Whether the player has reported the Target Video itself, which also shows it is not live.
    let reported = false;
    let channelName: string | undefined;
    // When reading the Target Video began, ads before it aside, so reading it can time out.
    let readingSince = 0;
    // The Speed last set on the Target Video, which the Speed Lock holds it to.
    let applied: Speed | undefined;
    const indicator = createSpeedIndicator();
    const ports = new Set<Browser.runtime.Port>();
    // The state last posted to the open popups, so an unchanged one is not posted again.
    let posted = "";
    // Codes whose keydown was taken over, so only their keyup is hidden from YouTube too.
    const intercepted = new Set<string>();
    let lockTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    ctx.onInvalidated(() => {
      indicator.remove();
      clearTimeout(lockTimer);
      clearTimeout(pollTimer);
    });

    // Listening before the settings load, so a popup opened meanwhile still finds this tab.
    const onConnect = (port: Browser.runtime.Port) => {
      if (port.name !== POPUP_PORT) return;
      ports.add(port);
      port.onDisconnect.addListener(() => ports.delete(port));
      // The only message is `PickedMessage`.
      port.onMessage.addListener(() => void takePick());
      port.postMessage(pageState());
    };
    browser.runtime.onConnect.addListener(onConnect);
    ctx.onInvalidated(() => browser.runtime.onConnect.removeListener(onConnect));

    /** Whether the extension controls the player now: the Target Video itself, or an ad within it. */
    function controlling(): boolean {
      return target !== undefined && (reported || isAdShowing());
    }

    function pageState(): PageState {
      if (!synced) return { kind: "loading" };
      if (!target) return { kind: "none" };
      const source = currentSource(target);
      const { handle } = target.facts;
      if (!source || handle === undefined) {
        const timedOut = performance.now() - readingSince > READ_TIMEOUT_MS;
        return { kind: timedOut ? "unreadable" : "loading" };
      }
      return {
        kind: "ready",
        channelName: channelName ?? handle,
        handle,
        source,
        speed: currentSpeed(target, settings),
      };
    }

    function publish() {
      if (ports.size === 0) return;
      const state = pageState();
      const json = JSON.stringify(state);
      if (json === posted) return;
      posted = json;
      for (const port of ports) port.postMessage(state);
    }

    /** The Speed Lock: once outside changes to the rate settle, set it back to the applied Speed. */
    function holdSpeed() {
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        const video = findPlayerVideo();
        if (!video || applied === undefined || !controlling()) return;
        if (video.playbackRate !== applied) video.playbackRate = applied;
      }, LOCK_DELAY_MS);
    }

    /**
     * Sets the Target Video to its current Speed. The indicator shows when the Speed changes, or with
     * a `nudge` when a Speed Shortcut hits a limit.
     */
    function apply(nudge = false) {
      if (!target || !controlling()) return;
      const player = findPlayer();
      const video = findPlayerVideo();
      if (!player || !video) return;
      const speed = currentSpeed(target, settings);
      if (speed !== applied) {
        applied = speed;
        video.playbackRate = speed;
        indicator.show(player, speed, nudge);
      } else if (nudge) {
        indicator.show(player, speed, true);
      } else if (video.playbackRate !== speed) {
        holdSpeed();
      }
    }

    /** Ends the Target Video, handing the player back to YouTube's normal speed if it was changed. */
    function release() {
      const video = findPlayerVideo();
      if (video && applied !== undefined) video.playbackRate = 1;
      clearTimeout(lockTimer);
      target = undefined;
      reported = false;
      channelName = undefined;
      readingSince = 0;
      applied = undefined;
      indicator.hide();
    }

    /** Records what the player reports about the Target Video; an ad or the previous video says nothing. */
    function learn(data: PlayerVideo, details: PlayerDetails | undefined) {
      if (!target || data.videoId !== target.videoId) return;
      reported = true;
      const handle = target.facts.handle ?? readHandle(data, details);
      const title = data.title || undefined;
      if (handle === target.facts.handle && title === target.facts.title) return;
      target = learnFacts(target, { handle, title }, settings);
      if (handle === undefined || !data.author) return;
      channelName = data.author;
      void rememberChannelName(handle, data.author);
    }

    function sync() {
      clearTimeout(pollTimer);
      // Elsewhere no Target Video can play, so the player is not worth asking.
      const { details, video: data } = isWatchContext() ? readPlayer() : {};
      let videoId = findTargetVideoId(data?.videoId, target?.videoId);
      // A live stream is never a Target Video, so its speed is left alone. The details tell even
      // while an ad plays before it.
      const live =
        (data?.videoId === videoId && data?.isLive) ||
        (details?.videoId === videoId && details?.isLive);
      if (live) videoId = undefined;
      if (videoId !== target?.videoId) {
        release();
        if (videoId !== undefined) target = startTarget(videoId);
      }
      // Reading the video can only start once the ads before it are over.
      if (target && (readingSince === 0 || isAdShowing())) readingSince = performance.now();
      if (data) learn(data, details);
      apply();
      synced = true;
      // Also while nothing changes, so the popup learns when reading the video timed out.
      publish();
      // Look again soon while the rules wait on facts, until reading the video has timed out.
      const pending =
        target !== undefined &&
        target.ruleSpeed === undefined &&
        performance.now() - readingSince <= READ_TIMEOUT_MS;
      pollTimer = setTimeout(sync, pending ? PENDING_POLL_MS : IDLE_POLL_MS);
    }

    function adoptSettings(next: Settings, dropManualSpeed: boolean) {
      const previous = settings;
      settings = next;
      if (!target) return;
      target = applyRules(target, previous, next);
      if (dropManualSpeed) target = { ...target, manualSpeed: undefined };
      apply();
      publish();
    }

    /** A speed picked in the popup is meant for this video now, so it replaces any Manual Speed. */
    async function takePick() {
      adoptSettings(await getSettings(), true);
    }

    ctx.onInvalidated(watchSettings((change) => adoptSettings({ ...settings, ...change }, false)));
    settings = await getSettings();

    for (const type of NAVIGATION_EVENTS) {
      ctx.addEventListener(document, type as keyof DocumentEventMap, sync);
    }
    // Media events do not bubble, but a capture listener on the document still sees them.
    for (const type of ["loadedmetadata", "loadstart", "playing"] as const) {
      ctx.addEventListener(document, type, sync, { capture: true });
    }

    // The Speed Lock holds the Target Video to the extension's Speed against YouTube's speed menu,
    // ads, quality switches, and other extensions.
    ctx.addEventListener(
      document,
      "ratechange",
      (event) => {
        if (event.target !== findPlayerVideo()) return;
        if (applied !== undefined && controlling()) holdSpeed();
      },
      { capture: true },
    );

    // Capture on `window` runs before YouTube's own handlers, so a Speed Shortcut replaces theirs.
    ctx.addEventListener(
      window,
      "keydown",
      (event) => {
        if (!target || !controlling() || ownsKeyboard(event)) return;
        const direction = findDirection(settings.shortcuts, event);
        if (!direction) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        intercepted.add(event.code);
        const before = currentSpeed(target, settings);
        target = stepTarget(target, direction, settings);
        apply(currentSpeed(target, settings) === before);
        publish();
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

    sync();
  },
});
