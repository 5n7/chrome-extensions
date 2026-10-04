import { describe, expect, it } from "vitest";

import { current, step, without, type Walk } from "./walk";

const walk = (position: number): Walk => ({ position, tabs: [10, 20, 30], windowId: 1 });

describe("step", () => {
  it("moves to the next older tab", () => {
    expect(current(step(walk(0), "older"))).toBe(20);
  });

  it("steps back toward the start", () => {
    expect(current(step(walk(2), "newer"))).toBe(20);
  });

  it("stops at the oldest tab rather than wrapping around", () => {
    expect(step(walk(2), "older").position).toBe(2);
  });

  it("stops at the tab it started from", () => {
    expect(step(walk(0), "newer").position).toBe(0);
  });
});

describe("without", () => {
  it("stays on the same tab when an earlier one closes", () => {
    const next = without(walk(2), 10);
    expect(current(next)).toBe(30);
  });

  it("moves to the next older tab when the current one closes", () => {
    expect(current(without(walk(1), 20))).toBe(30);
  });

  it("falls back to the last tab when the oldest one closes", () => {
    expect(current(without(walk(2), 30))).toBe(20);
  });

  it("ignores tabs outside the Walk", () => {
    expect(without(walk(1), 99)).toEqual(walk(1));
  });
});
