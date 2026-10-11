import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildIndex, parse7tvUser, parseBttvUser, parseFfzGlobal, parseFfzRoom } from "./emotes";

const seventvSet = (name: string, id: string) => ({
  emotes: [
    {
      name,
      data: {
        host: {
          url: `//cdn.7tv.app/emote/${id}`,
          files: [
            { name: "1x.webp", width: 64, height: 32 },
            { name: "2x.webp", width: 128, height: 64 },
          ],
        },
      },
    },
  ],
});

describe("provider parsers", () => {
  it("reads a 7TV user's emote set, with each Emote's shape", () => {
    expect(parse7tvUser({ emote_set: seventvSet("GAMBA", "01G3") })).toEqual([
      { kind: "emote", code: "GAMBA", src: "https://cdn.7tv.app/emote/01G3/2x.webp", aspect: 2 },
    ]);
  });

  it("reads a BetterTTV user's channel and shared Emotes, square when no size is given", () => {
    const user = {
      channelEmotes: [{ id: "a1", code: "catJAM" }],
      sharedEmotes: [{ id: "b2", code: "Wide", width: 84, height: 28 }],
    };
    expect(parseBttvUser(user)).toEqual([
      { kind: "emote", code: "Wide", src: "https://cdn.betterttv.net/emote/b2/2x", aspect: 3 },
      { kind: "emote", code: "catJAM", src: "https://cdn.betterttv.net/emote/a1/2x", aspect: 1 },
    ]);
  });

  it("reads an FFZ room's Twitch user id and its set", () => {
    const room = {
      room: { twitch_id: 71092938, set: 166907 },
      sets: {
        "166907": {
          emoticons: [
            {
              name: "WideHard",
              width: 50,
              height: 20,
              urls: { "1": "https://f/1", "2": "https://f/2" },
            },
          ],
        },
      },
    };
    expect(parseFfzRoom(room)).toEqual({
      twitchId: "71092938",
      emotes: [{ kind: "emote", code: "WideHard", src: "https://f/2", aspect: 2.5 }],
    });
  });

  it("reads only FFZ's default global sets", () => {
    const global = {
      default_sets: [3],
      sets: {
        "3": {
          emoticons: [{ name: "ZreknarF", width: 40, height: 30, urls: { "1": "https://f/z" } }],
        },
        "4": { emoticons: [{ name: "Hidden", urls: { "1": "https://f/h" } }] },
      },
    };
    expect(parseFfzGlobal(global).map((entry) => entry.code)).toEqual(["ZreknarF"]);
  });

  it("returns nothing for a malformed answer rather than throwing", () => {
    expect(parse7tvUser({ emote_set: { emotes: [{ name: "x" }] } })).toEqual([]);
    expect(parseBttvUser("nope")).toEqual([]);
    expect(parseFfzRoom({ error: "Not Found" })).toEqual({ twitchId: undefined, emotes: [] });
  });

  it("lets the channel's own Emote win over a global one with the same code", () => {
    const global = { kind: "emote", code: "Clap", src: "https://global", aspect: 1 } as const;
    const own = { kind: "emote", code: "Clap", src: "https://channel", aspect: 1 } as const;
    expect(buildIndex([global], [own]).get("Clap")?.src).toBe("https://channel");
  });
});

describe("loadEmotes", () => {
  const fetched: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    fetched.length = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url.includes("/v1/room/nobody")) return json({ error: "Not Found" }, 404);
      if (url.includes("/v1/room/"))
        return json({ room: { twitch_id: 42, set: 1 }, sets: { "1": { emoticons: [] } } });
      if (url.includes("7tv.io/v3/users/twitch/42"))
        return json({ emote_set: seventvSet("GAMBA", "g") });
      if (url.includes("7tv.io/v3/emote-sets/global")) return json(seventvSet("reckH", "r"));
      if (url.includes("betterttv")) return json({ error: "down" }, 500);
      return json({ default_sets: [], sets: {} });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("combines globals with the channel's sets and survives a provider that is down", async () => {
    const { loadEmotes } = await import("./emotes");
    const index = await loadEmotes("xqc");
    expect([...index.keys()].sort()).toEqual(["GAMBA", "reckH"]);
  });

  it("fetches each channel once", async () => {
    const { loadEmotes } = await import("./emotes");
    await loadEmotes("xqc");
    const count = fetched.length;
    await loadEmotes("xqc");
    expect(fetched.length).toBe(count);
  });

  it("counts a provider that cannot be reached or answers garbage as empty", async () => {
    const answer = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("frankerfacez.com/v1/set/global")) throw new TypeError("offline");
      if (url.includes("7tv.io/v3/users/")) return new Response("<html>");
      return answer(url);
    });
    const { loadEmotes } = await import("./emotes");
    expect([...(await loadEmotes("xqc")).keys()]).toEqual(["reckH"]);
  });

  it("falls back to global Emotes when FFZ does not know the channel", async () => {
    const { loadEmotes } = await import("./emotes");
    const index = await loadEmotes("nobody");
    expect([...index.keys()]).toEqual(["reckH"]);
    expect(fetched.some((url) => url.includes("/users/twitch/"))).toBe(false);
  });

  it("looks the channel up again after FFZ failed to name it, keeping the globals", async () => {
    const answer = globalThis.fetch;
    let ffzDown = true;
    vi.stubGlobal("fetch", async (url: string) => {
      if (ffzDown && url.includes("/v1/room/")) throw new TypeError("offline");
      return answer(url);
    });
    const { loadEmotes } = await import("./emotes");
    expect([...(await loadEmotes("xqc")).keys()]).toEqual(["reckH"]);
    ffzDown = false;
    expect([...(await loadEmotes("xqc")).keys()].sort()).toEqual(["GAMBA", "reckH"]);
    expect(fetched.filter((url) => url.includes("/emote-sets/global"))).toHaveLength(1);
  });
});
