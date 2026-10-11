import { describe, expect, it } from "vitest";

import { isSeekablePath, seekTarget } from "./player";

describe("isSeekablePath", () => {
  it("matches VODs and clips", () => {
    expect(isSeekablePath("/videos/123456")).toBe(true);
    expect(isSeekablePath("/videos/123456/")).toBe(true);
    expect(isSeekablePath("/somechannel/clip/FunnyClipSlug-abc")).toBe(true);
  });

  it("rejects live channels and other pages", () => {
    expect(isSeekablePath("/somechannel")).toBe(false);
    expect(isSeekablePath("/somechannel/videos")).toBe(false);
    expect(isSeekablePath("/videos/abc")).toBe(false);
    expect(isSeekablePath("/somechannel/clip/slug/extra")).toBe(false);
    expect(isSeekablePath("/directory")).toBe(false);
  });
});

describe("seekTarget", () => {
  it("moves by the Seek Offset", () => {
    expect(seekTarget(100, 600, { direction: "backward", seconds: 5 })).toBe(95);
    expect(seekTarget(100, 600, { direction: "forward", seconds: 60 })).toBe(160);
  });

  it("stays inside the video", () => {
    expect(seekTarget(3, 600, { direction: "backward", seconds: 10 })).toBe(0.001);
    expect(seekTarget(595, 600, { direction: "forward", seconds: 10 })).toBe(599);
  });

  it("never steps back on a forward seek near the end", () => {
    expect(seekTarget(599.5, 600, { direction: "forward", seconds: 10 })).toBe(599.5);
    expect(seekTarget(0.5, 0.8, { direction: "forward", seconds: 5 })).toBe(0.5);
  });
});
