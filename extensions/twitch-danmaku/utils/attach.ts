export interface Binding {
  readonly key: string;
  readonly player: object;
  readonly video: object;
  readonly chatList: object;
}

export function canKeep(attached: Binding, connected: boolean, wanted: Binding): boolean {
  return (
    connected &&
    attached.key === wanted.key &&
    attached.player === wanted.player &&
    attached.video === wanted.video &&
    attached.chatList === wanted.chatList
  );
}
