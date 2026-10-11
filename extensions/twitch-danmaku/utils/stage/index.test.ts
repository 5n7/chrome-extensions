// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Part } from "../body";
import { createStage, type StageConfig } from "./index";

const CONFIG: StageConfig = { area: 70, laneCount: 10, opacity: 85, crossingTime: 8 };
const BODY: Part[] = [{ kind: "text", text: "gg" }];
const COMMENT_PX = 100;
const AREA_PX = 1000;
const ENTRY_SECONDS = CONFIG.crossingTime * (COMMENT_PX / AREA_PX);

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(COMMENT_PX);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(AREA_PX);
});
afterEach(() => vi.restoreAllMocks());

function mount(config = CONFIG) {
  let wall = 0;
  const stage = createStage(config, () => wall);
  document.body.append(stage.element);
  const comments = () => stage.element.querySelectorAll("twitch-danmaku-comment").length;
  const animations = () =>
    [...stage.element.querySelectorAll("twitch-danmaku-comment")].flatMap((comment) => {
      const found = comment.getAnimations();
      // Browsers mark a canceled animation's `finished` promise handled; happy-dom does not.
      for (const animation of found) animation.finished.catch(() => {});
      return found;
    });
  return { advance: (seconds: number) => (wall += seconds), animations, comments, stage };
}

describe("createStage", () => {
  it("builds at most Lane Count Comments from a burst and Drops the rest without producing them", () => {
    const { comments, stage } = mount();
    const produce = vi.fn(() => BODY);
    const results = Array.from({ length: 40 }, () => stage.offer(0, produce));
    expect(results.filter((result) => result === "shown")).toHaveLength(10);
    expect(results.slice(10).every((result) => result === "no-lane")).toBe(true);
    expect(produce).toHaveBeenCalledTimes(10);
    expect(comments()).toBe(10);
  });

  it("frees a Lane once the Comment ahead has fully entered", () => {
    const { advance, stage } = mount({ ...CONFIG, laneCount: 1 });
    expect(stage.offer(0, () => BODY)).toBe("shown");
    advance(ENTRY_SECONDS - 0.01);
    expect(stage.offer(0, () => BODY)).toBe("no-lane");
    advance(0.01);
    expect(stage.offer(0, () => BODY)).toBe("shown");
  });

  it("keeps Lanes taken while paused, since Comments stand still", () => {
    const { advance, stage } = mount({ ...CONFIG, laneCount: 1 });
    stage.offer(0, () => BODY);
    stage.pause();
    advance(60);
    expect(stage.offer(0, () => BODY)).toBe("no-lane");
    stage.resume();
    advance(1);
    expect(stage.offer(0, () => BODY)).toBe("shown");
  });

  it("starts a Restored Comment partway across", () => {
    const { animations, stage } = mount();
    stage.offer(3, () => BODY);
    const [animation, ...rest] = animations();
    expect(rest).toEqual([]);
    expect(Number(animation?.currentTime)).toBeGreaterThanOrEqual(3000);
    expect(Number(animation?.currentTime)).toBeLessThan(3100);
  });

  it("drops a Restored Comment that would already have left", () => {
    const { comments, stage } = mount();
    expect(stage.offer(8.8, () => BODY)).toBe("expired");
    expect(comments()).toBe(0);
  });

  it("reads no message while the area has no width, so none is marked as shown", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(0);
    const { stage } = mount();
    const produce = vi.fn(() => BODY);
    expect(stage.offer(0, produce)).toBe("hidden");
    expect(produce).not.toHaveBeenCalled();
  });

  it("uses no Lane for a message with nothing to show", () => {
    const { stage } = mount({ ...CONFIG, laneCount: 1 });
    expect(stage.offer(0, () => undefined)).toBe("skipped");
    expect(stage.offer(0, () => BODY)).toBe("shown");
  });

  it("clears the screen when the Lane Count changes, but not for opacity", () => {
    const { animations, comments, stage } = mount();
    stage.offer(0, () => BODY);
    animations();
    stage.configure({ ...CONFIG, opacity: 50 });
    expect(comments()).toBe(1);
    expect(stage.element.style.opacity).toBe("0.5");
    stage.configure({ ...CONFIG, laneCount: 12 });
    expect(comments()).toBe(0);
  });

  it("shows an Emote as an image sized before it loads", () => {
    const { stage } = mount();
    stage.offer(0, () => [{ kind: "emote", code: "Wide", src: "https://e/w", aspect: 2 }]);
    const image = stage.element.querySelector("img");
    expect(image?.alt).toBe("Wide");
    expect(image?.style.width).toBe("2.3em");
  });
});
