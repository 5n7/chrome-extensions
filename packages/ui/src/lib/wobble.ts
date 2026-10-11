/** The `#wobble` roughening as SVG attributes, so every copy of it draws the same strokes. */
export const WOBBLE = {
  region: { height: "180%", width: "120%", x: "-10%", y: "-40%" },
  turbulence: { baseFrequency: ".035", numOctaves: "2", seed: "3", type: "fractalNoise" },
  displacement: { in: "SourceGraphic", scale: "4" },
} as const;
