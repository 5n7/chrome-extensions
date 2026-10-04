import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Twitch Spoiler Guard",
    permissions: ["storage"],
  },
  vite: () => ({
    plugins: [babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  }),
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
  },
});
