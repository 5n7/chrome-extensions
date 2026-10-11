const ATTRIBUTE = "data-twitch-danmaku-button";
const SVG = "http://www.w3.org/2000/svg";

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

const path = (d: string, attributes: Record<string, string> = {}) =>
  svgElement("path", { d, ...attributes });

function icon(enabled: boolean): SVGSVGElement {
  const svg = svgElement("svg", {
    "aria-hidden": "true",
    fill: "none",
    height: "20",
    stroke: "currentColor",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "2",
    viewBox: "0 0 20 20",
    width: "20",
  });
  svg.append(
    path(
      "M6 4h9a2.5 2.5 0 012.5 2.5v4A2.5 2.5 0 0115 13h-4l-3.5 3v-3H6a2.5 2.5 0 01-2.5-2.5v-4A2.5 2.5 0 016 4z",
    ),
    path("M1 7.5h1M1 10h1.2"),
  );
  if (enabled) svg.append(path("M7.5 8.5h6"));
  else {
    svg.append(
      path("M3.5 16.5L16.5 3.5"),
      path("M5 17.5L17.5 5", { stroke: "rgba(0,0,0,.6)", "stroke-width": "1.4" }),
    );
  }
  return svg;
}

function createButton(onToggle: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute(ATTRIBUTE, "");
  Object.assign(button.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    padding: "0",
    border: "0",
    borderRadius: "9000px",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
  });
  button.addEventListener(
    "pointerenter",
    () => (button.style.background = "rgba(255, 255, 255, 0.13)"),
  );
  button.addEventListener("pointerleave", () => (button.style.background = "transparent"));
  button.addEventListener("click", onToggle);
  return button;
}

export function ensurePlayerButton(slot: Element, enabled: boolean, onToggle: () => void): void {
  let button = slot.ownerDocument.querySelector<HTMLButtonElement>(`button[${ATTRIBUTE}]`);
  button ??= createButton(onToggle);
  if (button.nextElementSibling !== slot) slot.before(button);
  const label = enabled ? "Hide danmaku" : "Show danmaku";
  if (button.getAttribute("aria-label") === label) return;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.setAttribute("aria-pressed", String(enabled));
  button.replaceChildren(icon(enabled));
}

export function removePlayerButton(doc: Document): void {
  doc.querySelector(`button[${ATTRIBUTE}]`)?.remove();
}
