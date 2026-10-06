// The player's own data lives in the page's JavaScript world, out of a content script's reach. A
// MAIN-world script answers a request event with it as a JSON string, the one kind of event detail
// that crosses between worlds. Events dispatch synchronously, so the answer arrives before
// `dispatchEvent` returns.

import { isRecord } from "./is-record";

export const REQUEST_EVENT = "youtube-auto-speed:request";
export const RESPONSE_EVENT = "youtube-auto-speed:response";

/** The watch-page player; Shorts, hover previews, and channel trailers use other players. */
export const PLAYER_SELECTOR = "#movie_player";

/** The video loaded in the watch-page player right now, which may be an ad. */
export interface PlayerVideo {
  videoId: string;
  title: string;
  /** The channel's display name. */
  author: string;
  isLive: boolean;
}

/** What the player was asked to play, which an ad before it does not replace. */
export interface PlayerDetails {
  videoId: string;
  isLive: boolean;
  /** The channel's URL, which names its handle. */
  ownerUrl?: string;
}

export interface PlayerReport {
  video?: PlayerVideo;
  details?: PlayerDetails;
}

function readVideo(value: unknown): PlayerVideo | undefined {
  if (!isRecord(value) || typeof value.videoId !== "string" || !value.videoId) return undefined;
  return {
    author: typeof value.author === "string" ? value.author : "",
    isLive: value.isLive === true,
    title: typeof value.title === "string" ? value.title : "",
    videoId: value.videoId,
  };
}

function readDetails(value: unknown): PlayerDetails | undefined {
  if (!isRecord(value) || typeof value.videoId !== "string" || !value.videoId) return undefined;
  return {
    isLive: value.isLive === true,
    ownerUrl: typeof value.ownerUrl === "string" ? value.ownerUrl : undefined,
    videoId: value.videoId,
  };
}

function parseReport(json: string): PlayerReport {
  try {
    const value: unknown = JSON.parse(json);
    if (!isRecord(value)) return {};
    return { details: readDetails(value.details), video: readVideo(value.video) };
  } catch {
    return {};
  }
}

/** Empty when no video is loaded, or before the MAIN-world script has started. */
export function readPlayer(): PlayerReport {
  let report: PlayerReport = {};
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<unknown>;
    if (typeof detail === "string") report = parseReport(detail);
  };
  document.addEventListener(RESPONSE_EVENT, listener);
  document.dispatchEvent(new CustomEvent(REQUEST_EVENT));
  document.removeEventListener(RESPONSE_EVENT, listener);
  return report;
}
