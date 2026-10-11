import type { Emote, EmoteIndex } from "./body";

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function emote(code: unknown, src: string, width?: unknown, height?: unknown): Emote[] {
  if (typeof code !== "string" || code === "") return [];
  const w = positive(width);
  const h = positive(height);
  return [{ kind: "emote", code, src, aspect: w && h ? w / h : 1 }];
}

function parse7tvSet(json: unknown): Emote[] {
  if (!isRecord(json)) return [];
  return list(json.emotes).flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.data) || !isRecord(entry.data.host)) return [];
    const { files, url } = entry.data.host;
    if (typeof url !== "string") return [];
    const file = list(files).find((f) => isRecord(f) && f.name === "2x.webp");
    const size = isRecord(file) ? file : {};
    return emote(entry.name, `https:${url}/2x.webp`, size.width, size.height);
  });
}

export function parse7tvUser(json: unknown): Emote[] {
  return isRecord(json) ? parse7tvSet(json.emote_set) : [];
}

function parseBttvEmotes(json: unknown): Emote[] {
  return list(json).flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") return [];
    return emote(
      entry.code,
      `https://cdn.betterttv.net/emote/${entry.id}/2x`,
      entry.width,
      entry.height,
    );
  });
}

export function parseBttvUser(json: unknown): Emote[] {
  if (!isRecord(json)) return [];
  return [...parseBttvEmotes(json.sharedEmotes), ...parseBttvEmotes(json.channelEmotes)];
}

function parseFfzSet(set: unknown): Emote[] {
  if (!isRecord(set)) return [];
  return list(set.emoticons).flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.urls)) return [];
    const src = entry.urls["2"] ?? entry.urls["1"];
    return typeof src === "string" ? emote(entry.name, src, entry.width, entry.height) : [];
  });
}

export function parseFfzRoom(json: unknown): { twitchId: string | undefined; emotes: Emote[] } {
  if (!isRecord(json) || !isRecord(json.room) || !isRecord(json.sets)) {
    return { twitchId: undefined, emotes: [] };
  }
  const id = json.room.twitch_id;
  return {
    twitchId: typeof id === "number" || typeof id === "string" ? String(id) : undefined,
    emotes: parseFfzSet(json.sets[String(json.room.set)]),
  };
}

export function parseFfzGlobal(json: unknown): Emote[] {
  if (!isRecord(json) || !isRecord(json.sets)) return [];
  const sets = json.sets;
  return list(json.default_sets).flatMap((id) => parseFfzSet(sets[String(id)]));
}

export function buildIndex(...lists: readonly (readonly Emote[])[]): EmoteIndex {
  const index = new Map<string, Emote>();
  for (const emotes of lists) for (const entry of emotes) index.set(entry.code, entry);
  return index;
}

async function fetchProvider<T>(url: string, parse: (json: unknown) => T, fallback: T): Promise<T> {
  try {
    const response = await fetch(url);
    return response.ok ? parse(await response.json()) : fallback;
  } catch {
    return fallback;
  }
}

let globals: Promise<Emote[]> | undefined;
const channels = new Map<string, Promise<EmoteIndex>>();

function loadGlobals(): Promise<Emote[]> {
  globals ??= Promise.all([
    fetchProvider("https://api.frankerfacez.com/v1/set/global", parseFfzGlobal, []),
    fetchProvider("https://api.betterttv.net/3/cached/emotes/global", parseBttvEmotes, []),
    fetchProvider("https://7tv.io/v3/emote-sets/global", parse7tvSet, []),
  ]).then((sets) => sets.flat());
  return globals;
}

export function loadEmotes(login: string): Promise<EmoteIndex> {
  const cached = channels.get(login);
  if (cached) return cached;
  const loaded = (async () => {
    const [global, room] = await Promise.all([
      loadGlobals(),
      fetchProvider(
        `https://api.frankerfacez.com/v1/room/${encodeURIComponent(login)}`,
        parseFfzRoom,
        { twitchId: undefined, emotes: [] },
      ),
    ]);
    const { emotes, twitchId } = room;
    if (!twitchId) {
      // BetterTTV and 7TV know a channel only by its Twitch id, so a later session asks FFZ again.
      channels.delete(login);
      return buildIndex(global, emotes);
    }
    const [bttv, sevenTv] = await Promise.all([
      fetchProvider(
        `https://api.betterttv.net/3/cached/users/twitch/${twitchId}`,
        parseBttvUser,
        [],
      ),
      fetchProvider(`https://7tv.io/v3/users/twitch/${twitchId}`, parse7tvUser, []),
    ]);
    return buildIndex(global, emotes, bttv, sevenTv);
  })();
  channels.set(login, loaded);
  return loaded;
}
