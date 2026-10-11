import { WOBBLE } from "../lib/wobble";

/** Roughens outlines the way the icon's own filter roughens its strokes. */
export function WobbleFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter id="wobble" {...WOBBLE.region}>
        <feTurbulence {...WOBBLE.turbulence} />
        <feDisplacementMap {...WOBBLE.displacement} />
      </filter>
    </svg>
  );
}
