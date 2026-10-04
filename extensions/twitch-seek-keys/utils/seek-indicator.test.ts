import { describe, expect, it } from "vitest";

import { accumulateOffset } from "./seek-indicator";

describe("accumulateOffset", () => {
  it("starts a total from the first seek", () => {
    expect(accumulateOffset(undefined, { direction: "forward", seconds: 30 })).toEqual({
      direction: "forward",
      seconds: 30,
    });
  });

  it("adds seeks in the same direction", () => {
    expect(
      accumulateOffset(
        { direction: "backward", seconds: 10 },
        { direction: "backward", seconds: 5 },
      ),
    ).toEqual({ direction: "backward", seconds: 15 });
  });

  it("starts over when the direction changes", () => {
    expect(
      accumulateOffset(
        { direction: "forward", seconds: 60 },
        { direction: "backward", seconds: 5 },
      ),
    ).toEqual({ direction: "backward", seconds: 5 });
  });
});
