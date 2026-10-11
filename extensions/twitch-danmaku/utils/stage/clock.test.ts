import { describe, expect, it } from "vitest";

import { createPlayClock } from "./clock";

describe("createPlayClock", () => {
  it("stands still while paused", () => {
    let wall = 100;
    const clock = createPlayClock(() => wall);
    wall = 103;
    clock.pause();
    wall = 110;
    expect(clock.now()).toBe(3);
    clock.resume();
    wall = 112;
    expect(clock.now()).toBe(5);
  });

  it("ignores a repeated pause or resume", () => {
    let wall = 0;
    const clock = createPlayClock(() => wall);
    wall = 1;
    clock.pause();
    wall = 2;
    clock.pause();
    clock.resume();
    wall = 3;
    clock.resume();
    wall = 4;
    expect(clock.now()).toBe(3);
    expect(clock.running).toBe(true);
  });
});
