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

/** The Target Video playing in this tab, and what this script tracks while it plays. */
interface Session {
  target: Target;
  /** Whether the player has reported the Target Video itself, which also shows it is not live. */
  reported: boolean;
  channelName?: string;
  /** When reading the Target Video began, ads before it aside, so reading it can time out. */
  readingSince: number;
  /** The Speed last set on the Target Video, which the Speed Lock holds it to. */
  applied?: Speed;
}

export default defineContentScript({
  matches: [`${YOUTUBE_ORIGIN}/*`],
  async main(ctx) {
    let settings: Settings = INITIAL_SETTINGS;
    // Whether the page has been looked at once, before which a popup hears "loading", not "none".
    let synced = false;
    let session: Session | undefined;
    const indicator = createSpeedIndicator();
    // Each open popup, with the state last posted to it, so an unchanged one is not posted again.
    const ports = new Map<Browser.runtime.Port, string | undefined>();
    // Codes whose keydown was taken over, so only their keyup is hidden from YouTube too.
    const intercepted = new Set<string>();
    // Plain timers, cleared on invalidation: `ctx.setTimeout` adds an invalidation listener per
    // call and never removes it, and this script re-arms its poll every second or sooner.
    let lockTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    // Listening before the settings load, so a popup opened meanwhile still finds this tab.
    const onConnect = (port: Browser.runtime.Port) => {
      if (port.name !== POPUP_PORT) return;
      ports.set(port, undefined);
      port.onDisconnect.addListener(() => ports.delete(port));
      // The only message is `PickedMessage`.
      port.onMessage.addListener(() => void takePick());
      publish();
    };
    browser.runtime.onConnect.addListener(onConnect);

    /** The session while the extension controls the player: the Target Video itself, or an ad within it. */
    function controlled(): Session | undefined {
      return session && (session.reported || isAdShowing()) ? session : undefined;
    }

    function timedOut({ readingSince }: Session): boolean {
      return performance.now() - readingSince > READ_TIMEOUT_MS;
    }

    function pageState(): PageState {
      if (!synced) return { kind: "loading" };
      if (!session) return { kind: "none" };
      const { channelName, target } = session;
      const source = currentSource(target);
      const { handle } = target.facts;
      if (!source || handle === undefined) {
        return { kind: timedOut(session) ? "unreadable" : "loading" };
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
      for (const [port, posted] of ports) {
        if (posted === json) continue;
        ports.set(port, json);
        port.postMessage(state);
      }
    }

    /** The Speed Lock: once outside changes to the rate settle, set it back to the applied Speed. */
    function holdSpeed() {
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        const video = findPlayerVideo();
        const applied = controlled()?.applied;
        if (!video || applied === undefined) return;
        if (video.playbackRate !== applied) video.playbackRate = applied;
      }, LOCK_DELAY_MS);
    }

    /**
     * Sets the Target Video to its current Speed. The indicator shows when the Speed changes, or with
     * a `nudge` when a Speed Shortcut hits a limit.
     */
    function apply(nudge = false) {
      const current = controlled();
      if (!current) return;
      const player = findPlayer();
      const video = findPlayerVideo();
      if (!player || !video) return;
      const speed = currentSpeed(current.target, settings);
      const changed = speed !== current.applied;
      if (changed) {
        current.applied = speed;
        video.playbackRate = speed;
      }
      if (changed || nudge) {
        indicator.show(player, speed, nudge);
      } else if (video.playbackRate !== speed) {
        holdSpeed();
      }
    }

    /** Ends the Target Video, handing the player back to YouTube's normal speed if it was changed. */
    function release() {
      const video = findPlayerVideo();
      if (video && session?.applied !== undefined) video.playbackRate = 1;
      clearTimeout(lockTimer);
      session = undefined;
      indicator.hide();
    }

    /** Records what the player reports about the Target Video; an ad or the previous video says nothing. */
    function learn(data: PlayerVideo, details: PlayerDetails | undefined) {
      if (!session || data.videoId !== session.target.videoId) return;
      session.reported = true;
      const { facts } = session.target;
      const handle = facts.handle ?? readHandle(data, details);
      const title = data.title || undefined;
      if (handle !== facts.handle || title !== facts.title) {
        session.target = learnFacts(session.target, { handle, title }, settings);
      }
      // The name can arrive after the handle, so it is checked on its own.
      if (handle === undefined || !data.author || session.channelName === data.author) return;
      session.channelName = data.author;
      void rememberChannelName(handle, data.author);
    }

    function sync() {
      clearTimeout(pollTimer);
      // Elsewhere no Target Video can play, so the player is not worth asking.
      const report = isWatchContext() ? readPlayer() : {};
      const videoId = findTargetVideoId(report, session?.target.videoId);
      if (videoId !== session?.target.videoId) {
        release();
        if (videoId !== undefined) {
          session = {
            readingSince: performance.now(),
            reported: false,
            target: startTarget(videoId),
          };
        }
      }
      // Reading the video can only start once the ads before it are over.
      if (session && isAdShowing()) session.readingSince = performance.now();
      if (report.video) learn(report.video, report.details);
      apply();
      synced = true;
      // Also while nothing changes, so the popup learns when reading the video timed out.
      publish();
      const pending =
        session !== undefined && session.target.ruleSpeed === undefined && !timedOut(session);
      pollTimer = setTimeout(sync, pending ? PENDING_POLL_MS : IDLE_POLL_MS);
    }

    function adoptSettings(next: Settings) {
      const previous = settings;
      settings = next;
      if (!session) return;
      session.target = applyRules(session.target, previous, next);
      apply();
      publish();
    }

    /** A speed picked in the popup is meant for this video now, so it replaces any Manual Speed. */
    async function takePick() {
      const next = await getSettings();
      if (session) session.target = { ...session.target, manualSpeed: undefined };
      adoptSettings(next);
    }

    const unwatchSettings = watchSettings((change) => adoptSettings({ ...settings, ...change }));
    ctx.onInvalidated(() => {
      indicator.remove();
      clearTimeout(lockTimer);
      clearTimeout(pollTimer);
      // Once the extension reloads, this script is orphaned and any chrome.* call throws; its
      // listeners can no longer fire, so there is nothing to remove.
      if (!browser.runtime?.id) return;
      browser.runtime.onConnect.removeListener(onConnect);
      unwatchSettings();
    });
    settings = await getSettings();

    for (const type of NAVIGATION_EVENTS) {
      ctx.addEventListener(document, type, sync);
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
        if (controlled()?.applied !== undefined) holdSpeed();
      },
      { capture: true },
    );

    // Capture on `window` runs before YouTube's own handlers, so a Speed Shortcut replaces theirs.
    ctx.addEventListener(
      window,
      "keydown",
      (event) => {
        const current = controlled();
        if (!current || ownsKeyboard(event)) return;
        const direction = findDirection(settings.shortcuts, event);
        if (!direction) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        intercepted.add(event.code);
        const before = currentSpeed(current.target, settings);
        current.target = stepTarget(current.target, direction, settings);
        apply(currentSpeed(current.target, settings) === before);
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
