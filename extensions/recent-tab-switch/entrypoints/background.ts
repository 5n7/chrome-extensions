import { browser, defineBackground } from "#imports";
import { createSwitcher } from "@/utils/switcher";
import type { Direction } from "@/utils/walk";

const COMMANDS: Record<string, Direction> = { "walk-newer": "newer", "walk-older": "older" };

export default defineBackground(() => {
  const switcher = createSwitcher({
    activate: (tabId) => browser.tabs.update(tabId, { active: true }),
    inWindow: (windowId) => browser.tabs.query({ windowId }),
    lastFocusedWindow: async () => (await browser.windows.getLastFocused()).id,
  });

  browser.commands.onCommand.addListener((command, tab) => {
    const direction = COMMANDS[command];
    if (direction) void switcher.press(direction, tab?.windowId);
  });

  browser.tabs.onActivated.addListener(({ tabId, windowId }) =>
    switcher.activated(tabId, windowId),
  );
  browser.tabs.onCreated.addListener(({ id, windowId }) => {
    if (id !== undefined) void switcher.created(id, windowId);
  });
  browser.tabs.onRemoved.addListener((tabId, { isWindowClosing, windowId }) =>
    switcher.removed(tabId, windowId, isWindowClosing),
  );
  browser.tabs.onDetached.addListener((tabId, { oldWindowId }) =>
    switcher.detached(tabId, oldWindowId),
  );
  browser.tabs.onAttached.addListener((tabId, { newWindowId }) =>
    switcher.attached(tabId, newWindowId),
  );
  browser.tabs.onReplaced.addListener((addedId, removedId) =>
    switcher.replaced(addedId, removedId),
  );
  browser.windows.onRemoved.addListener((windowId) => switcher.windowRemoved(windowId));
});
