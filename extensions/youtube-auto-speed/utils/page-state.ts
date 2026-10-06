import type { Speed } from "./speed";
import type { SpeedSource } from "./target";

/** The port the popup opens to its tab's content script, which posts a `PageState` on every change. */
export const POPUP_PORT = "popup";

/** Sent by the popup once a speed picked there is saved, so it replaces any Manual Speed at once. */
export interface PickedMessage {
  kind: "picked";
}

export type PageState =
  | { kind: "none" }
  | { kind: "loading" }
  // The Target Video's channel could not be read in time, so no Channel Rule can be made for it.
  | { kind: "unreadable" }
  | {
      kind: "ready";
      handle: string;
      channelName: string;
      speed: Speed;
      source: SpeedSource;
    };
