import { describe, expect, it } from "vitest";

import { judgeBacklog, judgeLag, Seen } from "./judge";

describe("judgeLag", () => {
  it.each([
    [-1.01, { kind: "drop", reason: "ahead" }],
    [-1, { kind: "show", age: 0 }],
    [2, { kind: "show", age: 0 }],
    [2.01, { kind: "show", age: 2.01 }],
    [8, { kind: "show", age: 8 }],
    [8.01, { kind: "drop", reason: "stale" }],
    [300, { kind: "drop", reason: "stale" }],
  ])("at a lag of %s s with an 8 s Crossing Time gives %o", (lag, verdict) => {
    expect(judgeLag(lag, 1, 8)).toEqual(verdict);
  });

  it("places a Restored Comment by wall seconds, not playback seconds", () => {
    expect(judgeLag(6, 2, 8)).toEqual({ kind: "show", age: 3 });
  });

  it.each([
    [2, 16, { kind: "show", age: 8 }],
    [2, 16.02, { kind: "drop", reason: "stale" }],
    [0.5, 4, { kind: "show", age: 8 }],
    [0.5, 4.01, { kind: "drop", reason: "stale" }],
  ])(
    "at %sx, judges a lag of %s s by the wall seconds it takes to play, giving %o",
    (rate, lag, verdict) => {
      expect(judgeLag(lag, rate, 8)).toEqual(verdict);
    },
  );

  it("counts a line as on time by playback seconds at any rate", () => {
    expect(judgeLag(2, 0.5, 8)).toEqual({ kind: "show", age: 0 });
    expect(judgeLag(2, 2, 8)).toEqual({ kind: "show", age: 0 });
  });
});

describe("Seen", () => {
  it("drops a copy Twitch re-adds, but not a different message in the same second", () => {
    const seen = new Seen();
    expect(seen.firstSight(100, "a", "gg")).toBe(true);
    expect(seen.firstSight(100, "a", "gg")).toBe(false);
    expect(seen.firstSight(100, "a", "gg wp")).toBe(true);
    expect(seen.firstSight(100, "b", "gg")).toBe(true);
  });

  it("forgets messages older than the pruning point", () => {
    const seen = new Seen();
    seen.firstSight(90, "a", "x");
    seen.firstSight(100, "a", "y");
    seen.prune(95);
    expect(seen.firstSight(90, "a", "x")).toBe(true);
    expect(seen.firstSight(100, "a", "y")).toBe(false);
  });
});

describe("judgeBacklog", () => {
  it("lets ordinary live batches through", () => {
    expect(judgeBacklog(4, 100, 0)).toEqual({ drop: false, quietUntil: 0 });
    expect(judgeBacklog(30, 100, 0).drop).toBe(false);
  });

  it("drops a flushed backlog and the smaller batches that trail it", () => {
    const flush = judgeBacklog(150, 100, 0);
    expect(flush.drop).toBe(true);
    expect(judgeBacklog(21, 101.9, flush.quietUntil).drop).toBe(true);
    expect(judgeBacklog(3, 102, flush.quietUntil).drop).toBe(false);
  });
});
