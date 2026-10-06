import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "YouTube Auto Speed",
    // `activeTab` lets the popup see that its tab is on YouTube even before the content script runs.
    permissions: ["activeTab", "storage"],
  },
  vite: () => ({
    plugins: [babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  }),
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
  },
});
