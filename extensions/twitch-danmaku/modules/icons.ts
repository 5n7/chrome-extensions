import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { defineWxtModule } from "wxt/modules";

// Renders each size from the closest SVG master, so the toolbar sizes (16 px at 1x, 32 px at 2x) get
// pixel-fitted artwork instead of a blurry downscale. Each master is drawn at its own size in px.
const MASTERS = {
  16: { path: "assets/icon-16.svg", size: 16 },
  32: { path: "assets/icon-32.svg", size: 32 },
  48: { path: "assets/icon.svg", size: 128 },
  128: { path: "assets/icon.svg", size: 128 },
};

export default defineWxtModule({
  name: "icons",
  setup(wxt) {
    const files = Object.keys(MASTERS).map((size) => [size, `icons/${size}.png`] as const);

    wxt.hooks.hook("build:manifestGenerated", (_, manifest) => {
      manifest.icons = Object.fromEntries(files);
    });

    wxt.hooks.hook("build:done", async (_, output) => {
      await mkdir(resolve(wxt.config.outDir, "icons"), { recursive: true });
      await Promise.all(
        Object.entries(MASTERS).map(async ([size, master]) => {
          const fileName = `icons/${size}.png`;
          // Rasterize the vector at the target size rather than resizing a bitmap.
          const image = sharp(resolve(wxt.config.root, master.path), {
            density: (72 * Number(size)) / master.size,
          });
          // Grey out dev builds so they are easy to tell apart from the installed extension.
          if (wxt.config.mode === "development") image.grayscale();
          await image.png().toFile(resolve(wxt.config.outDir, fileName));
          output.publicAssets.push({ type: "asset", fileName });
        }),
      );
    });

    wxt.hooks.hook("prepare:publicPaths", (_, paths) => {
      paths.push(...files.map(([, file]) => file));
    });
  },
});
