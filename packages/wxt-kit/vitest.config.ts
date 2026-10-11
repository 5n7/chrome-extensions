import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  // Not a WXT project, so no auto-imports; the plugin still mocks `wxt/browser` with `fakeBrowser`.
  plugins: [WxtVitest({ imports: false, root: import.meta.dirname })],
});
