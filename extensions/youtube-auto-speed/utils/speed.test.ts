import { describe, expect, it } from "vitest";

import { formatSpeed, isSpeed, stepSpeed } from "./speed";

describe("formatSpeed", () => {
  it("always shows one decimal place", () => {
    expect([0.5, 1, 3].map((speed) => formatSpeed(speed as 0.5 | 1 | 3))).toEqual([
      "0.5x",
      "1.0x",
      "3.0x",
    ]);
  });
});

describe("isSpeed", () => {
  it("accepts only the six Speeds", () => {
    expect(isSpeed(1.5)).toBe(true);
    expect(isSpeed(1.25)).toBe(false);
    expect(isSpeed("1")).toBe(false);
  });
});

describe("stepSpeed", () => {
  it("moves one Speed at a time", () => {
    expect(stepSpeed(1, "up")).toBe(1.5);
    expect(stepSpeed(1, "down")).toBe(0.5);
  });

  it("stops at either end instead of wrapping around", () => {
    expect(stepSpeed(3, "up")).toBe(3);
    expect(stepSpeed(0.5, "down")).toBe(0.5);
  });
});
