// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import { guard } from "@/utils/guard";

import contentScript from "./index";

let ctx: ContentScriptContext;

const guarded = () => document.documentElement.hasAttribute("data-twitch-spoiler-guard");

beforeEach(() => {
  fakeBrowser.reset();
  ctx = new ContentScriptContext("content");
});

afterEach(() => {
  ctx.abort();
  document.documentElement.removeAttribute("data-twitch-spoiler-guard");
  vi.restoreAllMocks();
});

describe("content script", () => {
  it("guards the page until the stored state arrives, then follows it", async () => {
    await guard.setValue(false);
    const running = contentScript.main(ctx);
    expect(guarded()).toBe(true);
    await running;
    expect(guarded()).toBe(false);
    await guard.setValue(true);
    await vi.waitFor(() => expect(guarded()).toBe(true));
  });

  it("keeps a change made while the stored state loads", async () => {
    const { promise: staleRead, resolve: resolveStaleRead } = Promise.withResolvers<boolean>();
    vi.spyOn(guard, "getValue").mockReturnValueOnce(staleRead);
    const running = contentScript.main(ctx);
    await guard.setValue(false);
    resolveStaleRead(true);
    await running;
    expect(guarded()).toBe(false);
  });
});
