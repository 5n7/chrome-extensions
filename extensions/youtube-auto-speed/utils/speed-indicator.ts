import kalam from "@fontsource/kalam/files/kalam-latin-700-normal.woff2?inline";
import { WOBBLE } from "@repo/ui/lib/wobble";

import { formatSpeed, type Speed } from "./speed";
import { findPlayer, PLAYERS, type PlayerKind } from "./youtube";

const TAG = "youtube-auto-speed-indicator";
const SHOWN_MS = 2000;
const INSET_PX = 10;
const SHOWN_OPACITY = "0.9";
const RESTING_OPACITY = "0.4";
const FONT_FAMILY = "youtube-auto-speed-kalam";
const FILTER_ID = "youtube-auto-speed-wobble";
const SVG = "http://www.w3.org/2000/svg";

// Played through the Web Animations API, so a replay never fights the sticker's own rotation.
const NUDGE: Keyframe[] = [
  { translate: "0 0" },
  { translate: "-3px 0" },
  { translate: "3px 0" },
  { translate: "0 0" },
];

/** Registers Kalam from bytes bundled into the script, so YouTube's CSP never sees a font request. */
function loadFont() {
  const base64 = kalam.slice(kalam.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const face = new FontFace(FONT_FAMILY, bytes, { weight: "700" });
  document.fonts.add(face);
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
  children: SVGElement[] = [],
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

/** The popup's `#wobble`, so the sticker's outline is roughened the way the popup's are. */
function createWobbleFilter(): SVGSVGElement {
  const svg = svgElement("svg", { "aria-hidden": "true" }, [
    svgElement("filter", { ...WOBBLE.region, id: FILTER_ID }, [
      svgElement("feTurbulence", WOBBLE.turbulence),
      svgElement("feDisplacementMap", WOBBLE.displacement),
    ]),
  ]);
  Object.assign(svg.style, { height: "0", position: "absolute", width: "0" });
  return svg;
}

function createCornerStyle(): HTMLStyleElement {
  const style = document.createElement("style");
  const belowButtons = Object.values(PLAYERS).flatMap(({ cornerButtons, selector }) =>
    cornerButtons
      ? `html:has(${cornerButtons.shownWhilePageHas}) ${selector} > ${TAG} { top: ${cornerButtons.bottomPx + INSET_PX}px; }`
      : [],
  );
  style.textContent = [`${TAG} { top: ${INSET_PX}px; }`, ...belowButtons].join("\n");
  return style;
}

/**
 * The hand-drawn Speed Indicator: a paper sticker in the player's top-right corner. A plain element
 * sized in `px`, since inside YouTube's own DOM `rem` would follow YouTube's root font size.
 */
export function createSpeedIndicator() {
  const element = document.createElement(TAG);
  Object.assign(element.style, {
    color: "#18181b",
    font: `700 18px/1 ${FONT_FAMILY}, "Comic Sans MS", cursive`,
    isolation: "isolate",
    opacity: "0",
    padding: "6px 11px 4px",
    pointerEvents: "none",
    position: "absolute",
    right: `${INSET_PX}px`,
    rotate: "-4deg",
    transition: "opacity 300ms",
    userSelect: "none",
    // Above the video, below YouTube's controls and menus.
    zIndex: "30",
  });
  const shadow = document.createElement("span");
  Object.assign(shadow.style, {
    background: "rgba(0, 0, 0, 0.35)",
    borderRadius: "8px",
    inset: "3px -3px -3px 3px",
    position: "absolute",
    zIndex: "-2",
  });
  const paper = document.createElement("span");
  Object.assign(paper.style, {
    background: "#fffdf5",
    border: "2.5px solid #18181b",
    borderRadius: "8px",
    filter: `url(#${FILTER_ID})`,
    inset: "0",
    position: "absolute",
    zIndex: "-1",
  });
  const label = document.createElement("span");
  element.append(createCornerStyle(), createWobbleFilter(), shadow, paper, label);

  let fontLoaded = false;
  let restTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    show(kind: PlayerKind, speed: Speed, nudge = false) {
      const player = findPlayer(kind);
      if (!player) return;
      if (!fontLoaded) {
        loadFont();
        fontLoaded = true;
      }
      if (element.parentElement !== player) player.append(element);
      label.textContent = formatSpeed(speed);
      element.style.opacity = SHOWN_OPACITY;
      if (nudge && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        element.animate(NUDGE, { duration: 300, easing: "ease-in-out", iterations: 2 });
      }
      clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        element.style.opacity = speed === 1 ? "0" : RESTING_OPACITY;
      }, SHOWN_MS);
    },
    hide() {
      clearTimeout(restTimer);
      element.style.opacity = "0";
    },
    remove() {
      clearTimeout(restTimer);
      element.remove();
    },
  };
}
