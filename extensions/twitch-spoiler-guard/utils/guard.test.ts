import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { guard } from "./guard";

describe("guard", () => {
  beforeEach(() => fakeBrowser.reset());

  it("is on after install", async () => {
    expect(await guard.getValue()).toBe(true);
  });

  it("stays off once turned off", async () => {
    await guard.setValue(false);
    expect(await guard.getValue()).toBe(false);
  });
});
