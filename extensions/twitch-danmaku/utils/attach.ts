export interface Binding {
  readonly key: string;
  readonly player: object;
  readonly video: object;
  readonly chatList: object;
}

export type AttachPlan = "attach" | "detach" | "keep" | "replace";

export function planAttach(
  attached: Binding | undefined,
  connected: boolean,
  wanted: Binding | undefined,
): AttachPlan {
  if (!wanted) return attached ? "detach" : "keep";
  if (!attached) return "attach";
  const same =
    connected &&
    attached.key === wanted.key &&
    attached.player === wanted.player &&
    attached.video === wanted.video &&
    attached.chatList === wanted.chatList;
  return same ? "keep" : "replace";
}
