import type { Part } from "../body";
import { createPlayClock } from "./clock";
import { createLanes, firstFreeLane, occupyLane, travelTime, type Lanes } from "./lanes";

export interface StageConfig {
  readonly area: number;
  readonly laneCount: number;
  readonly opacity: number;
  readonly crossingTime: number;
}

export type OfferResult = "expired" | "hidden" | "no-lane" | "shown" | "skipped";

export interface Stage {
  readonly element: HTMLElement;
  offer(age: number, produce: () => readonly Part[] | undefined): OfferResult;
  configure(config: StageConfig): void;
  pause(): void;
  resume(): void;
  clear(): void;
  destroy(): void;
}

const TAG = "twitch-danmaku-area";
const COMMENT_TAG = "twitch-danmaku-comment";
const FONT_STYLE_ID = "twitch-danmaku-fonts";
// Japanese fonts draw Cyrillic and Greek full-width, so those scripts come from a proportional font
// already on the system.
const SCRIPT_FACE = "twitch-danmaku-scripts";
const SCRIPT_FACE_CSS = `@font-face {
  font-family: "${SCRIPT_FACE}";
  font-weight: 700;
  src: local("HelveticaNeue-Bold"), local("Helvetica Neue Bold"), local("Arial-BoldMT"), local("Arial Bold"), local("Segoe UI Bold");
  unicode-range: U+0370-03FF, U+0400-052F, U+1C80-1C8F, U+2DE0-2DFF, U+A640-A69F;
}`;
const FONT = `"${SCRIPT_FACE}", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif`;
const OUTLINE =
  "1.5px 0 #000, -1.5px 0 #000, 0 1.5px #000, 0 -1.5px #000, 1px 1px #000, -1px 1px #000, 1px -1px #000, -1px -1px #000";
const POOL_LIMIT = 64;

interface Flight {
  readonly element: HTMLElement;
  readonly animation: Animation;
}

export function createStage(
  initial: StageConfig,
  wallSeconds: () => number = () => performance.now() / 1000,
): Stage {
  let config = initial;
  let lanes: Lanes = createLanes(config.laneCount);
  const clock = createPlayClock(wallSeconds);
  const flights = new Set<Flight>();
  const pool: HTMLElement[] = [];
  let areaWidth = 0;

  if (!document.getElementById(FONT_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = FONT_STYLE_ID;
    style.textContent = SCRIPT_FACE_CSS;
    document.head.append(style);
  }

  const element = document.createElement(TAG);
  Object.assign(element.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    overflow: "hidden",
    pointerEvents: "none",
    contain: "strict",
    containerType: "size",
  });
  applyConfig();

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) areaWidth = entry.contentRect.width;
  });
  resizeObserver.observe(element);

  function applyConfig() {
    element.style.height = `${config.area}%`;
    element.style.opacity = String(config.opacity / 100);
    element.style.setProperty("--lanes", String(config.laneCount));
  }

  function acquire(): HTMLElement {
    const reused = pool.pop();
    if (reused) return reused;
    const comment = document.createElement(COMMENT_TAG);
    Object.assign(comment.style, {
      position: "absolute",
      left: "100%",
      whiteSpace: "pre",
      paddingRight: "1em",
      font: `700 calc(0.78 * 100cqh / var(--lanes)) / calc(100cqh / var(--lanes)) ${FONT}`,
      color: "#fff",
      textShadow: OUTLINE,
      willChange: "transform",
    });
    return comment;
  }

  function release(flight: Flight) {
    flights.delete(flight);
    flight.element.remove();
    if (pool.length < POOL_LIMIT) pool.push(flight.element);
  }

  function render(comment: HTMLElement, parts: readonly Part[]) {
    comment.replaceChildren(
      ...parts.map((part) => {
        if (part.kind === "text") return part.text;
        const image = document.createElement("img");
        image.alt = part.code;
        image.src = part.src;
        Object.assign(image.style, {
          display: "inline",
          height: "1.15em",
          width: `${1.15 * part.aspect}em`,
          verticalAlign: "middle",
        });
        return image;
      }),
    );
  }

  function clear() {
    for (const flight of flights) {
      flight.animation.cancel();
      release(flight);
    }
    lanes = createLanes(config.laneCount);
  }

  return {
    element,
    clear,

    offer(age, produce) {
      const spawn = clock.now() - age;
      const lane = firstFreeLane(lanes, spawn);
      if (lane < 0) return "no-lane";
      areaWidth ||= element.clientWidth;
      if (areaWidth === 0) return "hidden";
      const parts = produce();
      if (!parts) return "skipped";

      const comment = acquire();
      comment.style.top = `calc(${lane} * 100cqh / var(--lanes))`;
      render(comment, parts);
      element.append(comment);
      const length = comment.offsetWidth / areaWidth;
      const duration = travelTime(length, config.crossingTime);
      if (age >= duration) {
        comment.remove();
        if (pool.length < POOL_LIMIT) pool.push(comment);
        return "expired";
      }
      occupyLane(lanes, lane, spawn, length, config.crossingTime);

      const animation = comment.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(calc(-100cqw - 100%))" }],
        { duration: duration * 1000, easing: "linear" },
      );
      animation.currentTime = age * 1000;
      if (!clock.running) animation.pause();
      const flight = { animation, element: comment };
      flights.add(flight);
      animation.onfinish = () => release(flight);
      return "shown";
    },

    configure(next) {
      const relayout =
        next.area !== config.area ||
        next.laneCount !== config.laneCount ||
        next.crossingTime !== config.crossingTime;
      config = next;
      applyConfig();
      if (relayout) clear();
    },

    pause() {
      clock.pause();
      for (const { animation } of flights) animation.pause();
    },

    resume() {
      clock.resume();
      for (const { animation } of flights) animation.play();
    },

    destroy() {
      clear();
      resizeObserver.disconnect();
      element.remove();
    },
  };
}
