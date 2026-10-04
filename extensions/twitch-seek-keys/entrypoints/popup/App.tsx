import { cn } from "@repo/ui/lib/utils";
import { ChevronsLeftIcon, ChevronsRightIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import iconUrl from "@/assets/icon.svg";
import {
  DEFAULT_BINDINGS,
  MAX_SECONDS,
  MIN_SECONDS,
  findSeekBinding,
  formatCombination,
  isModifierKey,
  isValidSeconds,
  seekBindings,
  toKeyCombination,
  type KeyCombination,
  type SeekBinding,
  type SeekOffset,
} from "@/utils/seek-bindings";

const NEW_BINDING_OFFSET: SeekOffset = { direction: "forward", seconds: 10 };

/** A row that just matched a key press, or was just added. */
interface Highlight {
  /** The row's Key Combination as shown, e.g. `Shift+J`. */
  label: string;
  kind: "added" | "pressed";
  /** The key event's timestamp, so pressing the same key again replays the wiggle. */
  id: number;
}

const HIGHLIGHT_MS = { added: 1200, pressed: 600 };
const RESTORED_MS = 1200;

// Played through the Web Animations API, so a replay never fights a CSS animation for the same property.
const WIGGLE: Keyframe[] = [
  { transform: "rotate(0)" },
  { transform: "rotate(-1.6deg)" },
  { transform: "rotate(1.6deg)" },
  { transform: "rotate(0)" },
];
const DRAW_IN: Keyframe[] = [
  { opacity: 0, transform: "translateY(6px) rotate(-1.5deg)" },
  { opacity: 1, transform: "none" },
];
const DRAW_IN_STAGGER_MS = 35;

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function combinationLabel(combination: KeyCombination): string {
  return formatCombination(combination).join("+");
}

export function App() {
  const [bindings, setBindings] = useState<SeekBinding[]>();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string>();
  const [highlight, setHighlight] = useState<Highlight>();
  // Counts restores so each one replays the draw-in, even when the list is unchanged.
  const [restores, setRestores] = useState(0);
  // The restore whose save went through, shown as "restored!" until its timer ends.
  const [restored, setRestored] = useState<number>();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    void seekBindings.getValue().then(setBindings);
    return seekBindings.watch((next) => setBindings(next));
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(undefined), HIGHLIGHT_MS[highlight.kind]);
    return () => clearTimeout(timer);
  }, [highlight]);

  useEffect(() => {
    if (restored === undefined) return;
    const timer = setTimeout(() => setRestored(undefined), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [restored]);

  // A layout effect, so the rows never paint once before their draw-in starts.
  useLayoutEffect(() => {
    if (restores === 0 || prefersReducedMotion()) return;
    listRef.current?.querySelectorAll(":scope > li").forEach((row, index) =>
      row.animate(DRAW_IN, {
        delay: index * DRAW_IN_STAGGER_MS,
        duration: 350,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        fill: "backwards",
      }),
    );
  }, [restores]);

  /** Resolves to whether the write went through. */
  async function save(next: SeekBinding[]): Promise<boolean> {
    setBindings(next);
    setError(undefined);
    try {
      await seekBindings.setValue(next);
      return true;
    } catch {
      // storage.sync rejects writes past its quota or rate limits.
      setError("Couldn't save. Try again shortly.");
      setBindings(await seekBindings.getValue());
      return false;
    }
  }

  function restoreDefaults() {
    const restore = restores + 1;
    setRestores(restore);
    setRestored(undefined);
    setRecording(false);
    void save(DEFAULT_BINDINGS).then((saved) => {
      if (saved) setRestored(restore);
    });
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    // A held key repeats; acting on repeats would stack wiggles or record the key that started recording.
    if (!bindings || event.repeat) return;
    if (!recording) {
      // Pressing a bound key shows which row it is; typing into a field never does.
      if (event.target instanceof HTMLInputElement) return;
      const binding = findSeekBinding(bindings, event);
      if (binding) {
        setHighlight({
          label: combinationLabel(binding.combination),
          kind: "pressed",
          id: event.timeStamp,
        });
      }
      return;
    }
    // Wait for the non-modifier key; some virtual keyboards send no physical code at all.
    if (isModifierKey(event) || !event.code || event.code === "Unidentified") return;
    event.preventDefault();
    event.stopPropagation();
    setRecording(false);
    if (event.code === "Escape") return;
    const combination = toKeyCombination(event);
    if (findSeekBinding(bindings, combination)) {
      setError(`${combinationLabel(combination)} is already bound.`);
      return;
    }
    void save([...bindings, { combination, offset: NEW_BINDING_OFFSET }]);
    setHighlight({ label: combinationLabel(combination), kind: "added", id: event.timeStamp });
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener, { capture: true });
    return () => window.removeEventListener("keydown", listener, { capture: true });
  }, []);

  if (!bindings) return null;

  return (
    <main className="font-hand flex w-[360px] flex-col gap-3.5 px-4 pt-4 pb-[18px]">
      <WobbleFilter />
      <header className="flex items-center gap-2.5">
        <img alt="" className="size-[42px]" src={iconUrl} />
        <h1 className="title-squiggle text-[23px] leading-none font-bold">Twitch Seek Keys</h1>
        <button
          className="decoration-twitch hover:text-twitch ml-auto inline-flex items-center gap-1 px-0.5 py-1 text-[15px] underline decoration-wavy underline-offset-[5px]"
          title="Restore default bindings"
          type="button"
          onClick={restoreDefaults}
        >
          <RotateCcwIcon
            key={restores}
            className={cn("size-[13px]", restores > 0 && "motion-safe:animate-spin-back")}
            strokeWidth={2.4}
          />
          {/* Both labels share one cell, so the button keeps the wider one's width and the icon stays put. */}
          <span className="grid">
            <span className={cn("col-start-1 row-start-1", restored !== undefined && "invisible")}>
              <span className="sr-only">Restore </span>defaults
            </span>
            <span className={cn("col-start-1 row-start-1", restored === undefined && "invisible")}>
              restored!
            </span>
          </span>
        </button>
      </header>
      {/* Mounted for the popup's whole life, so screen readers announce each change. */}
      <p className="sr-only" role="status">
        {recording
          ? "Press a key combination to add it. Escape cancels."
          : restored !== undefined && "Default bindings restored."}
      </p>
      {bindings.length === 0 ? (
        <div className="pt-2.5 pb-0.5 text-center">
          <p className="text-[22px] leading-tight font-bold">No keys yet.</p>
          <p className="text-ink/70 mt-1 text-sm">
            Twitch&apos;s own 10-second arrow-key seek applies.
          </p>
        </div>
      ) : (
        <ul ref={listRef} className="grid gap-2">
          {bindings.map((binding, index) => {
            const label = combinationLabel(binding.combination);
            return (
              <BindingRow
                key={label}
                binding={binding}
                dimmed={recording}
                highlight={highlight?.label === label ? highlight : undefined}
                onChange={(offset) => save(bindings.with(index, { ...binding, offset }))}
                onRemove={() => save(bindings.toSpliced(index, 1))}
              />
            );
          })}
        </ul>
      )}
      {/* One button for both states, so keyboard focus stays on it while recording. */}
      <button
        className={cn(
          "wobbly flex w-full items-center justify-center gap-1.5 p-3 text-lg leading-none font-bold transition-transform [--r:14px]",
          recording
            ? "[--fill:var(--color-lilac)]"
            : "text-white [--fill:var(--color-twitch)] motion-safe:hover:-translate-y-px motion-safe:hover:-rotate-1",
        )}
        type="button"
        onClick={() => {
          setError(undefined);
          setRecording(!recording);
        }}
      >
        {recording ? (
          <>
            <span className="motion-safe:animate-wiggle-loop inline-block">Press a key…</span>
            <span className="text-sm font-normal">(Esc to cancel)</span>
          </>
        ) : (
          <>
            <PlusIcon className="size-[18px]" strokeWidth={2.6} />
            Add a key
          </>
        )}
      </button>
      {error && (
        <p
          className="wobbly text-rust px-3 py-2 text-[15px] leading-snug font-bold [--fill:#ffe9e7]"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  );
}

/** Roughens outlines the way the icon's own filter roughens its strokes. */
function WobbleFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter height="180%" id="wobble" width="120%" x="-10%" y="-40%">
        <feTurbulence baseFrequency=".035" numOctaves={2} seed={3} type="fractalNoise" />
        <feDisplacementMap in="SourceGraphic" scale={4} />
      </filter>
    </svg>
  );
}

function BindingRow({
  binding,
  dimmed,
  highlight,
  onChange,
  onRemove,
}: {
  binding: SeekBinding;
  dimmed: boolean;
  highlight: Highlight | undefined;
  onChange: (offset: SeekOffset) => void;
  onRemove: () => void;
}) {
  const backward = binding.offset.direction === "backward";
  const label = combinationLabel(binding.combination);
  const rowRef = useRef<HTMLLIElement>(null);
  const wiggle = highlight?.id;

  useEffect(() => {
    if (wiggle === undefined || prefersReducedMotion()) return;
    // `add` stacks the wiggle on a draw-in that may still be running.
    const animation = rowRef.current?.animate(WIGGLE, {
      composite: "add",
      duration: 450,
      easing: "ease-in-out",
    });
    return () => animation?.cancel();
  }, [wiggle]);

  return (
    <li
      ref={rowRef}
      className={cn(
        "grid grid-cols-[1fr_auto_76px_28px] items-center gap-2 transition-opacity",
        dimmed && "opacity-35",
      )}
    >
      <span className="flex min-w-0 flex-wrap gap-1.5">
        {formatCombination(binding.combination).map((part) => (
          <kbd
            key={part}
            className={cn(
              "wobbly font-hand inline-grid h-8 min-w-[34px] place-items-center px-[9px] text-[17px] leading-none font-bold [--r:8px]",
              highlight?.kind === "pressed"
                ? "text-white [--fill:var(--color-twitch)]"
                : highlight?.kind === "added"
                  ? "[--fill:var(--color-lilac)]"
                  : "[--fill:#fff]",
            )}
          >
            {part}
          </kbd>
        ))}
      </span>
      <button
        // Starts with the visible word, so voice control can target it by what it shows.
        aria-label={
          backward
            ? `back: ${label} seeks backward, switch to forward`
            : `ahead: ${label} seeks forward, switch to backward`
        }
        className={cn(
          "wobbly inline-flex items-center gap-1 py-[5px] pr-3 pl-[9px] text-[15px] leading-none font-bold transition-transform [--r:999px] motion-safe:hover:-rotate-3",
          backward ? "[--fill:var(--color-lilac)]" : "text-white [--fill:var(--color-twitch)]",
        )}
        type="button"
        onClick={() =>
          onChange({ ...binding.offset, direction: backward ? "forward" : "backward" })
        }
      >
        {backward ? (
          <>
            <ChevronsLeftIcon className="size-[15px]" strokeWidth={2.4} />
            back
          </>
        ) : (
          <>
            ahead
            <ChevronsRightIcon className="size-[15px]" strokeWidth={2.4} />
          </>
        )}
      </button>
      <SecondsInput
        // Remount when the stored value changes elsewhere, e.g. after restoring defaults.
        key={binding.offset.seconds}
        label={label}
        seconds={binding.offset.seconds}
        onCommit={(seconds) => onChange({ ...binding.offset, seconds })}
      />
      <button
        aria-label={`Remove ${label}`}
        className="text-ink/50 hover:text-rust grid size-7 place-items-center transition motion-safe:hover:rotate-90"
        type="button"
        onClick={onRemove}
      >
        <XIcon className="size-[17px]" strokeWidth={2.4} />
      </button>
    </li>
  );
}

/** Keeps a draft while typing and saves only a valid value on blur or Enter. */
function SecondsInput({
  label,
  seconds,
  onCommit,
}: {
  label: string;
  seconds: number;
  onCommit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState(String(seconds));

  function commit() {
    const value = Number(draft);
    if (isValidSeconds(value)) {
      setDraft(String(value));
      if (value !== seconds) onCommit(value);
    } else {
      setDraft(String(seconds));
    }
  }

  return (
    <label className="wobbly-underline flex items-baseline justify-end gap-0.5">
      <input
        aria-label={`Seconds for ${label}, ${MIN_SECONDS} to ${MAX_SECONDS}`}
        autoComplete="off"
        className="font-hand w-[54px] bg-transparent p-0 text-right text-2xl leading-[1.1] font-bold outline-none"
        inputMode="numeric"
        type="text"
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="text-sm">s</span>
    </label>
  );
}
