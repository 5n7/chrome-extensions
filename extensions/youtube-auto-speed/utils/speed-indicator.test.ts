// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSpeedIndicator } from "./speed-indicator";

// happy-dom has no font loading.
beforeEach(() => {
  vi.stubGlobal("FontFace", class {});
  Object.defineProperty(document, "fonts", { configurable: true, value: { add() {} } });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("speed indicator", () => {
  it("sits in the top-right corner of the player it shows for", () => {
    document.body.innerHTML = `<div id="movie_player"></div><div id="shorts-player"></div>`;
    const indicator = createSpeedIndicator();
    indicator.show("shorts", 2);
    const element = document.querySelector<HTMLElement>("youtube-auto-speed-indicator");
    expect(element?.parentElement?.id).toBe("shorts-player");
    expect(element?.lastElementChild?.textContent).toBe("2.0x");
    indicator.show("watch", 1.5);
    expect(element?.parentElement?.id).toBe("movie_player");
    expect(element && getComputedStyle(element).top).toBe("10px");
    indicator.remove();
  });
});
