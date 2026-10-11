// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ContentScriptContext } from "wxt/utils/content-script-context";
import { storage } from "wxt/utils/storage";

import { follow, onInvalidatedWhileAlive } from "./lifecycle";

beforeEach(() => fakeBrowser.reset());

afterEach(() => vi.restoreAllMocks());

describe("onInvalidatedWhileAlive", () => {
  it("runs every cleanup when a newer script replaces this one", () => {
    const ctx = new ContentScriptContext("test");
    const ran: string[] = [];
    onInvalidatedWhileAlive(
      ctx,
      () => ran.push("a"),
      () => ran.push("b"),
    );
    ctx.notifyInvalidated();
    expect(ran).toEqual(["a", "b"]);
  });

  it("skips them once the extension itself reloaded and orphaned the script", () => {
    const ctx = new ContentScriptContext("test");
    const ran: string[] = [];
    onInvalidatedWhileAlive(ctx, () => ran.push("a"));
    Object.assign(fakeBrowser.runtime, { id: undefined });
    ctx.notifyInvalidated();
    expect(ran).toEqual([]);
  });
});

describe("follow", () => {
  const count = storage.defineItem<number>("sync:count", { fallback: 0 });

  it("delivers the stored value, then each change, until stopped", async () => {
    await count.setValue(3);
    const seen: number[] = [];
    const { ready, stop } = follow(count, (value) => seen.push(value));
    await ready;
    await count.setValue(4);
    stop();
    await count.setValue(5);
    expect(seen).toEqual([3, 4]);
  });

  it("keeps a change made while the stored value loads, over the stale read", async () => {
    const { promise: staleRead, resolve } = Promise.withResolvers<number>();
    vi.spyOn(count, "getValue").mockReturnValueOnce(staleRead);
    const seen: number[] = [];
    const { ready } = follow(count, (value) => seen.push(value));
    await count.setValue(7);
    resolve(0);
    await ready;
    expect(seen).toEqual([7]);
  });

  it("delivers nothing after stop, not even a read still in flight", async () => {
    const { promise: lateRead, resolve } = Promise.withResolvers<number>();
    vi.spyOn(count, "getValue").mockReturnValueOnce(lateRead);
    const seen: number[] = [];
    const { ready, stop } = follow(count, (value) => seen.push(value));
    stop();
    resolve(1);
    await ready;
    expect(seen).toEqual([]);
  });
});
