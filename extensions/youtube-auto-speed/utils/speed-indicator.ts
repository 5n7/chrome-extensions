import kalam from "@fontsource/kalam/files/kalam-latin-700-normal.woff2?inline";

import { formatSpeed, type Speed } from "./speed";

const SHOWN_MS = 2000;
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

/** The icon's wobble, so the sticker's outline is roughened the way the popup's are. */
function createWobbleFilter(): SVGSVGElement {
  const svg = svgElement("svg", { "aria-hidden": "true" }, [
    svgElement("filter", { height: "180%", id: FILTER_ID, width: "120%", x: "-10%", y: "-40%" }, [
      svgElement("feTurbulence", {
        baseFrequency: ".035",
        numOctaves: "2",
        seed: "3",
        type: "fractalNoise",
      }),
      svgElement("feDisplacementMap", { in: "SourceGraphic", scale: "4" }),
    ]),
  ]);
  Object.assign(svg.style, { height: "0", position: "absolute", width: "0" });
  return svg;
}

/**
 * The hand-drawn Speed Indicator: a paper sticker in the player's top-right corner. A plain element
 * with inline `px` styles, since it renders inside YouTube's own DOM and carries no page CSS.
 */
export function createSpeedIndicator() {
  const element = document.createElement("youtube-auto-speed-indicator");
  Object.assign(element.style, {
    color: "#18181b",
    font: `700 18px/1 ${FONT_FAMILY}, "Comic Sans MS", cursive`,
    isolation: "isolate",
    opacity: "0",
    padding: "6px 11px 4px",
    pointerEvents: "none",
    position: "absolute",
    right: "10px",
    rotate: "-4deg",
    top: "10px",
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
  element.append(createWobbleFilter(), shadow, paper, label);

  let fontLoaded = false;
  let restTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    /** Shows the Speed clearly, then rests dimmed, or hidden at 1.0x; `nudge` marks a limit hit. */
    show(player: HTMLElement, speed: Speed, nudge = false) {
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
