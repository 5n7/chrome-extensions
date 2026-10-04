import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { append, markUsed, recencyOrders, reconcile, remove, replace } from "./recency";

describe("markUsed", () => {
  it("moves a tab to the front", () => {
    expect(markUsed([1, 2, 3], 3)).toEqual([3, 1, 2]);
  });

  it("adds a tab it has not seen to the front", () => {
    expect(markUsed([1, 2], 9)).toEqual([9, 1, 2]);
  });
});

describe("append", () => {
  it("places a new tab behind every used one", () => {
    expect(append([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("leaves a tab already in the order where it is", () => {
    expect(append([1, 2], 1)).toEqual([1, 2]);
  });
});

describe("remove", () => {
  it("drops a closed tab", () => {
    expect(remove([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe("replace", () => {
  it("keeps the replaced tab's place", () => {
    expect(replace([1, 2, 3], 2, 7)).toEqual([1, 7, 3]);
  });
});

describe("reconcile", () => {
  it("drops tabs that are no longer open", () => {
    expect(reconcile([1, 2, 3], [{ id: 3 }, { id: 1 }])).toEqual([1, 3]);
  });

  it("ranks unseen tabs behind known ones by last access", () => {
    const tabs = [
      { id: 1, lastAccessed: 10 },
      { id: 2, lastAccessed: 30 },
      { id: 3, lastAccessed: 20 },
      { id: 4 },
    ];
    expect(reconcile([1], tabs)).toEqual([1, 2, 3, 4]);
  });
});

describe("recencyOrders", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts empty", async () => {
    expect(await recencyOrders.getValue()).toEqual({});
  });

  it("keeps each window's order", async () => {
    await recencyOrders.setValue({ 1: [3, 2], 2: [5] });
    expect(await recencyOrders.getValue()).toEqual({ 1: [3, 2], 2: [5] });
  });
});
