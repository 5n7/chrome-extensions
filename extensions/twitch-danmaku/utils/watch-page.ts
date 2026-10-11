export type WatchPage =
  | { readonly kind: "live"; readonly login: string }
  | { readonly kind: "vod"; readonly videoId: string };

const LOGIN = /^[a-z0-9_]{1,25}$/i;

const RESERVED = new Set([
  "directory",
  "downloads",
  "drops",
  "following",
  "friends",
  "inventory",
  "jobs",
  "login",
  "messages",
  "p",
  "payments",
  "prime",
  "privacy",
  "search",
  "settings",
  "signup",
  "store",
  "subscriptions",
  "turbo",
  "videos",
  "wallet",
]);

export function parseWatchPage(url: string): WatchPage | undefined {
  const { hostname, pathname } = new URL(url);
  if (hostname !== "www.twitch.tv") return undefined;
  const [first, second, ...rest] = pathname.split("/").filter(Boolean);
  if (first === undefined || rest.length > 0) return undefined;
  if (second !== undefined) {
    return first === "videos" && /^\d+$/.test(second)
      ? { kind: "vod", videoId: second }
      : undefined;
  }
  const login = first.toLowerCase();
  return LOGIN.test(first) && !RESERVED.has(login) ? { kind: "live", login } : undefined;
}

export function pageKey(page: WatchPage): string {
  return page.kind === "live" ? `live:${page.login}` : `vod:${page.videoId}`;
}
