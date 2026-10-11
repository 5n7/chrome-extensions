import { describe, expect, it } from "vitest";

import { createLanes, firstFreeLane, occupyLane, travelTime } from "./lanes";

describe("lanes", () => {
  it("hands out Lanes top first and refuses when all are taken", () => {
    const lanes = createLanes(3);
    const taken = [];
    for (let i = 0; i < 5; i++) {
      const lane = firstFreeLane(lanes, 10);
      taken.push(lane);
      if (lane >= 0) occupyLane(lanes, lane, 10, 0.2, 8);
    }
    expect(taken).toEqual([0, 1, 2, -1, -1]);
  });

  it("frees a Lane once the Comment's tail and gap have entered", () => {
    const lanes = createLanes(1);
    occupyLane(lanes, 0, 10, 0.25, 8);
    expect(firstFreeLane(lanes, 11.99)).toBe(-1);
    expect(firstFreeLane(lanes, 12)).toBe(0);
  });

  it("never shortens a Lane's busy time for a Comment spawned in the past", () => {
    const lanes = createLanes(1);
    occupyLane(lanes, 0, 10, 0.5, 8);
    occupyLane(lanes, 0, 5, 0.1, 8);
    expect(firstFreeLane(lanes, 13.9)).toBe(-1);
  });

  it("keeps every Comment at one speed, so a longer one stays on screen longer", () => {
    expect(travelTime(0, 8)).toBe(8);
    expect(travelTime(0.5, 8)).toBe(12);
  });
});
