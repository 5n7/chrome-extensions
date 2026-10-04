import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Recent Tab Switch",
    permissions: ["storage"],
    // No suggested keys: Chrome refuses Ctrl+Tab there, so the popup walks through binding it.
    commands: {
      "walk-older": { description: "Switch to the previously used tab" },
      "walk-newer": { description: "Step back toward the tab you started from" },
    },
  },
  vite: () => ({
    plugins: [babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  }),
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
  },
});
