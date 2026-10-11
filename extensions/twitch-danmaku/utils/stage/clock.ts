export interface PlayClock {
  now(): number;
  pause(): void;
  resume(): void;
  readonly running: boolean;
}

export function createPlayClock(wallSeconds: () => number): PlayClock {
  let base = 0;
  let since: number | undefined = wallSeconds();
  return {
    now: () => (since === undefined ? base : base + wallSeconds() - since),
    pause() {
      if (since === undefined) return;
      base += wallSeconds() - since;
      since = undefined;
    },
    resume() {
      since ??= wallSeconds();
    },
    get running() {
      return since !== undefined;
    },
  };
}
