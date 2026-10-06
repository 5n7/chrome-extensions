/** Roughens outlines the way the icon's own filter roughens its strokes. */
export function WobbleFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter height="180%" id="wobble" width="120%" x="-10%" y="-40%">
        <feTurbulence baseFrequency=".035" numOctaves={2} seed={3} type="fractalNoise" />
        <feDisplacementMap in="SourceGraphic" scale={4} />
      </filter>
    </svg>
  );
}
