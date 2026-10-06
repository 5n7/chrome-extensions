import { PLAYER_SELECTOR, type PlayerDetails, type PlayerVideo } from "./player-bridge";
import { normalizeHandle } from "./rules";

export const YOUTUBE_ORIGIN = "https://www.youtube.com";

/** Fired as YouTube navigates without reloading or loads a page's data. */
export const NAVIGATION_EVENTS = ["yt-navigate-finish", "yt-page-data-updated"] as const;

export function findPlayer(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(PLAYER_SELECTOR) ?? undefined;
}

export function findPlayerVideo(): HTMLVideoElement | undefined {
  return findPlayer()?.querySelector<HTMLVideoElement>("video.html5-main-video") ?? undefined;
}

/** Whether the player is showing an ad, which plays in the same `<video>` as the Target Video. */
export function isAdShowing(): boolean {
  return findPlayer()?.classList.contains("ad-showing") ?? false;
}

function isMiniplayerActive(): boolean {
  return document.querySelector("ytd-app[miniplayer-is-active], ytd-miniplayer[active]") !== null;
}

/** A watch page, or a watch-page video playing on in the miniplayer: the only places a Target Video plays. */
export function isWatchContext(): boolean {
  return location.pathname === "/watch" || isMiniplayerActive();
}

/**
 * The id of the Target Video: the one a watch page's URL names, even while an ad plays before it,
 * or the one playing on in the miniplayer after leaving the watch page. `reported` is the video
 * the player itself says is loaded, and `current` the Target Video so far.
 */
export function findTargetVideoId(
  reported: string | undefined,
  current: string | undefined,
): string | undefined {
  if (location.pathname === "/watch") {
    return new URLSearchParams(location.search).get("v") ?? undefined;
  }
  if (!isMiniplayerActive()) return undefined;
  // An ad in the miniplayer may report its own video, so the Target Video stays the one before it.
  return isAdShowing() ? current : (reported ?? current);
}

function squish(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The handle of the loaded video's channel: from the player's details when they describe this
 * video, else from the channel shown under the player once that belongs to it. YouTube keeps
 * showing the previous video's channel for a moment after moving to the next.
 */
export function readHandle(
  video: PlayerVideo,
  details: PlayerDetails | undefined,
): string | undefined {
  const ownerUrl = details?.videoId === video.videoId ? details.ownerUrl : undefined;
  const fromPlayer = ownerUrl && normalizeHandle(ownerUrl);
  if (fromPlayer) return fromPlayer;
  const shownFor = document.querySelector("ytd-watch-flexy")?.getAttribute("video-id");
  if (shownFor && shownFor !== video.videoId) return undefined;
  const owner = document.querySelector("ytd-watch-metadata ytd-video-owner-renderer");
  // Only `#text`: the rest of `#channel-name` repeats the name in a hover tooltip.
  const name = owner?.querySelector("#channel-name #text")?.textContent;
  if (!name || !video.author || squish(name) !== squish(video.author)) return undefined;
  const href = owner?.querySelector<HTMLAnchorElement>('a[href^="/@"]')?.getAttribute("href");
  return href ? normalizeHandle(href.slice(1).split(/[/?#]/)[0] ?? "") : undefined;
}

// Inputs that ignore letter keys, so a Speed Shortcut may take them over.
// Text fields, sliders such as the volume control, and radio groups keep their keys.
const KEYLESS_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "reset",
  "submit",
]);

/** Whether the key belongs to the focused control or an IME composition rather than the player. */
export function ownsKeyboard(event: KeyboardEvent): boolean {
  if (event.isComposing || event.key === "Process") return true;
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !KEYLESS_INPUT_TYPES.has(target.type);
}
