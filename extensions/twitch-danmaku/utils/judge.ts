const ON_TIME_LAG = 2;
/** Replay Times are whole seconds, so a line may read up to a second ahead of the position. */
const AHEAD_LAG = -1;

export type Verdict =
  | { readonly kind: "drop"; readonly reason: "ahead" | "stale" }
  | { readonly kind: "show"; readonly age: number };

export function judgeLag(lag: number, rate: number, crossingTime: number): Verdict {
  if (lag < AHEAD_LAG) return { kind: "drop", reason: "ahead" };
  if (lag <= ON_TIME_LAG) return { kind: "show", age: 0 };
  // The lag is in playback seconds, but a Comment's age and the Crossing Time are in wall seconds.
  const age = lag / rate;
  return age <= crossingTime ? { kind: "show", age } : { kind: "drop", reason: "stale" };
}

/**
 * Twitch re-adds the lines around the position when it rebuilds the list after a seek, and the second
 * copy must not show again.
 */
export class Seen {
  readonly #replayTimes = new Map<string, number>();

  firstSight(replayTime: number, login: string, text: string): boolean {
    const key = `${replayTime}|${login}|${text}`;
    if (this.#replayTimes.has(key)) return false;
    this.#replayTimes.set(key, replayTime);
    return true;
  }

  prune(replayTime: number): void {
    for (const [key, time] of this.#replayTimes) {
      if (time < replayTime) this.#replayTimes.delete(key);
    }
  }

  clear(): void {
    this.#replayTimes.clear();
  }

  get size(): number {
    return this.#replayTimes.size;
  }
}

const BACKLOG_LINES = 30;
const BACKLOG_SECONDS = 2;

/**
 * Twitch holds live chat back while its tab is hidden and adds it all at once on return, in one large
 * batch and a few smaller ones. Those messages did not arrive now, so a live session Drops them.
 */
export function judgeBacklog(
  lines: number,
  now: number,
  quietUntil: number,
): { readonly drop: boolean; readonly quietUntil: number } {
  const until = lines > BACKLOG_LINES ? now + BACKLOG_SECONDS : quietUntil;
  return { drop: now < until, quietUntil: until };
}
