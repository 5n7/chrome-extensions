import type { PlayerDetails, PlayerReport, PlayerVideo } from "./player-bridge";
import { normalizeHandle } from "./rules";

export const YOUTUBE_ORIGIN = "https://www.youtube.com";

export type PlayerKind = "shorts" | "watch";

interface CornerButtons {
  bottomPx: number;
  shownWhilePageHas: string;
}

interface PlayerSpec {
  selector: string;
  cornerButtons?: CornerButtons;
}

export const PLAYERS: Record<PlayerKind, PlayerSpec> = {
  shorts: {
    // The menu and full-screen buttons fill 16–64 px down the corner.
    cornerButtons: {
      bottomPx: 64,
      shownWhilePageHas: "ytd-reel-video-renderer[show-player-controls]",
    },
    selector: "#shorts-player",
  },
  watch: { selector: "#movie_player" },
};

export function isPlayerKind(value: unknown): value is PlayerKind {
  return typeof value === "string" && Object.hasOwn(PLAYERS, value);
}

/** Fired as YouTube navigates without reloading or loads a page's data. */
export const NAVIGATION_EVENTS = ["yt-navigate-finish", "yt-page-data-updated"] as const;

export type Stage =
  | { kind: "page"; player: PlayerKind; videoId: string }
  | { kind: "miniplayer"; player: "watch" };

/** Each player stays in the page after the viewer leaves its pages, so the URL picks the player. */
export function findStage(): Stage | undefined {
  const { pathname, search } = location;
  if (pathname === "/watch") {
    const videoId = new URLSearchParams(search).get("v");
    return videoId ? { kind: "page", player: "watch", videoId } : undefined;
  }
  const short = /^\/shorts\/([^/]+)/.exec(pathname)?.[1];
  if (short) return { kind: "page", player: "shorts", videoId: short };
  return isMiniplayerActive() ? { kind: "miniplayer", player: "watch" } : undefined;
}

export function findPlayer(kind: PlayerKind): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(PLAYERS[kind].selector) ?? undefined;
}

export function findPlayerVideo(kind: PlayerKind): HTMLVideoElement | undefined {
  return findPlayer(kind)?.querySelector<HTMLVideoElement>("video.html5-main-video") ?? undefined;
}

/** Whether the player is showing an ad, which plays in the same `<video>` as the Target Video. */
export function isAdShowing(kind: PlayerKind): boolean {
  return findPlayer(kind)?.classList.contains("ad-showing") ?? false;
}

function isMiniplayerActive(): boolean {
  return document.querySelector("ytd-app[miniplayer-is-active], ytd-miniplayer[active]") !== null;
}

export function findTargetVideoId(
  stage: Stage,
  report: PlayerReport,
  currentTargetId: string | undefined,
): string | undefined {
  const videoId =
    stage.kind === "page"
      ? stage.videoId
      : isAdShowing(stage.player)
        ? currentTargetId
        : (report.video?.videoId ?? currentTargetId);
  if (videoId === undefined) return undefined;
  const live = [report.video, report.details].some(
    (part) => part?.videoId === videoId && part.isLive,
  );
  return live ? undefined : videoId;
}

function squish(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function readHandle(
  video: PlayerVideo,
  details: PlayerDetails | undefined,
): string | undefined {
  const ownerUrl = details?.videoId === video.videoId ? details.ownerUrl : undefined;
  const fromPlayer = ownerUrl && normalizeHandle(ownerUrl);
  return fromPlayer || readWatchPageHandle(video);
}

function readWatchPageHandle(video: PlayerVideo): string | undefined {
  const shownFor = document.querySelector("ytd-watch-flexy")?.getAttribute("video-id");
  if (shownFor && shownFor !== video.videoId) return undefined;
  const owner = document.querySelector("ytd-watch-metadata ytd-video-owner-renderer");
  // Only `#text`: the rest of `#channel-name` repeats the name in a hover tooltip.
  const name = owner?.querySelector("#channel-name #text")?.textContent;
  if (!name || !video.author || squish(name) !== squish(video.author)) return undefined;
  const href = owner?.querySelector<HTMLAnchorElement>('a[href^="/@"]')?.getAttribute("href");
  return href ? normalizeHandle(href.slice(1).split(/[/?#]/)[0] ?? "") : undefined;
}
