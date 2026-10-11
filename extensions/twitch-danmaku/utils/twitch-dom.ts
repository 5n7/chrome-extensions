import type { Part } from "./body";
import type { WatchPage } from "./watch-page";

// The front page, channel tabs, and offline channels have players of other types.
const PLAYER = '[data-a-target="video-player"][data-a-player-type="site"]';
// An ad plays in a second <video> inside the controls overlay.
const VIDEO = '[data-a-target="video-ref"] > video';
const LIVE_CHAT_LIST = '[data-test-selector="chat-scrollable-area__message-container"]';
const VOD_CHAT_LIST = ".video-chat__message-list-wrapper ul";
const LIVE_LINE = ".chat-line__message[data-a-user]";
const LIVE_BODY = '[data-a-target="chat-line-message-body"]';
const VOD_LINE = ".vod-message";
const VOD_TIME = ".vod-message__header p";
const VOD_AUTHOR = ".chat-author__display-name[data-a-user]";
const VOD_BODY = ".video-chat__message";
const EMOTE = "img.chat-line__message--emote";
const FRAGMENTS = `.text-fragment, .mention-fragment, .link-fragment, ${EMOTE}`;
// A hidden second control bar carries a gear too.
const SETTINGS_BUTTON = '[data-a-target="video-ref"] [data-a-target="player-settings-button"]';
const CONTROL_ROW_ITEM = ".player-controls__right-control-group > *";
const OWNER_LINK = ".channel-info-content a:has(> h1)";
// Chat Replay shows a sub notice as a message from the subscriber that names them first.
const VOD_NOTICE = /^\S+ (?:subscribed|gifted|is gifting|converted)\b/i;

export interface PlayerParts {
  readonly player: HTMLElement;
  readonly video: HTMLVideoElement;
}

export function findPlayer(doc: Document): PlayerParts | undefined {
  const player = doc.querySelector<HTMLElement>(PLAYER);
  const video = player?.querySelector<HTMLVideoElement>(VIDEO);
  return player && video ? { player, video } : undefined;
}

/**
 * Places the Danmaku Area right after the video: above it, and below the controls, menus, and ads
 * that Twitch draws later in the same container.
 */
export function mountArea(parts: PlayerParts, area: Element): void {
  parts.video.after(area);
}

export function findChatList(doc: Document, kind: WatchPage["kind"]): Element | undefined {
  return doc.querySelector(kind === "live" ? LIVE_CHAT_LIST : VOD_CHAT_LIST) ?? undefined;
}

export function listLines(list: Element): Element[] {
  return [...list.children];
}

export interface ChatLine {
  readonly login: string;
  readonly replayTime: number | undefined;
  readBody(): Part[] | undefined;
}

export function parseReplayTime(text: string): number | undefined {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return undefined;
  const [, hours = "0", minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function readLine(node: Node, kind: WatchPage["kind"]): ChatLine | undefined {
  if (!(node instanceof Element)) return undefined;
  if (kind === "live") {
    const line = node.matches(LIVE_LINE) ? node : node.querySelector(LIVE_LINE);
    const login = line?.getAttribute("data-a-user");
    if (!line || !login) return undefined;
    return {
      login: login.toLowerCase(),
      replayTime: undefined,
      readBody: () => readFragments(line.querySelector(LIVE_BODY)),
    };
  }
  const line = node.querySelector(VOD_LINE);
  const login = line?.querySelector(VOD_AUTHOR)?.getAttribute("data-a-user");
  const replayTime = parseReplayTime(line?.querySelector(VOD_TIME)?.textContent ?? "");
  if (!line || !login || replayTime === undefined) return undefined;
  return {
    login: login.toLowerCase(),
    replayTime,
    readBody: () => {
      const body = line.querySelector(VOD_BODY);
      return VOD_NOTICE.test(body?.textContent?.replace(/^\s*:\s*/, "") ?? "")
        ? undefined
        : readFragments(body);
    },
  };
}

function readFragments(body: Element | null): Part[] | undefined {
  if (!body) return undefined;
  return [...body.querySelectorAll(FRAGMENTS)].map((fragment) =>
    fragment instanceof HTMLImageElement
      ? readEmote(fragment)
      : { kind: "text", text: fragment.textContent ?? "" },
  );
}

function readEmote(image: HTMLImageElement): Part {
  const largest = image.srcset.split(",").at(-1)?.trim().split(/\s+/)[0];
  const { naturalHeight, naturalWidth } = image;
  return {
    kind: "emote",
    code: image.alt,
    src: largest || image.src,
    aspect: naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1,
  };
}

export function findButtonSlot(doc: Document): Element | undefined {
  return doc.querySelector(SETTINGS_BUTTON)?.closest(CONTROL_ROW_ITEM) ?? undefined;
}

export function findVodOwnerLogin(doc: Document): string | undefined {
  const href = doc.querySelector(OWNER_LINK)?.getAttribute("href");
  const login = href && /^\/([a-z0-9_]{1,25})$/i.exec(href)?.[1];
  return login ? login.toLowerCase() : undefined;
}
