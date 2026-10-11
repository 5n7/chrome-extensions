import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";

/**
 * Runs `cleanups` once the script is invalidated, unless the extension itself reloaded: that orphans
 * the script, any chrome.* call then throws, and its listeners can never fire again.
 */
export function onInvalidatedWhileAlive(
  ctx: ContentScriptContext,
  ...cleanups: (() => void)[]
): void {
  ctx.onInvalidated(() => {
    if (!browser.runtime?.id) return;
    for (const cleanup of cleanups) cleanup();
  });
}

/**
 * What `follow` reads and watches: a `storage.defineItem` item, or anything shaped like one. Each
 * change it reports is a `Change`, the whole new value unless the source reports parts of it.
 */
export interface Followable<T, Change = T> {
  getValue(): Promise<T>;
  watch(callback: (change: Change) => void): () => void;
}

export interface Following {
  /** Settles once the first read is delivered, with any change made meanwhile laid over it. */
  ready: Promise<void>;
  stop: () => void;
}

/**
 * Calls `onValue` with the stored value, then with each change. Watching starts before the read, so
 * a change made meanwhile is never lost, and it wins over the read it made stale.
 */
export function follow<T>(source: Followable<T>, onValue: (value: T) => void): Following {
  return followPatches(source, onValue, (_, next) => next);
}

/**
 * `follow` for a source whose changes are patches, such as some settings of several, which `apply`
 * lays over the value.
 */
export function followPatches<T, Patch>(
  source: Followable<T, Patch>,
  onValue: (value: T) => void,
  apply: (value: T, patch: Patch) => T,
): Following {
  // Boxed, since `T` itself may be undefined; until the read lands, patches wait in `early`.
  let current: { value: T } | undefined;
  const early: Patch[] = [];
  let stopped = false;
  const unwatch = source.watch((patch) => {
    if (current) {
      current.value = apply(current.value, patch);
      onValue(current.value);
    } else {
      early.push(patch);
    }
  });
  const ready = source.getValue().then((read) => {
    if (stopped) return;
    current = { value: early.reduce(apply, read) };
    onValue(current.value);
  });
  return {
    ready,
    stop: () => {
      stopped = true;
      unwatch();
    },
  };
}
