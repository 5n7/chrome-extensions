import { cn } from "@repo/ui/lib/utils";
import { Fragment, useEffect, useEffectEvent, useState } from "react";

import {
  formatCombination,
  isModifierKey,
  isSameCombination,
  toKeyCombination,
  type KeyCombination,
  type Shortcuts,
} from "@/utils/shortcuts";

const ACTIONS: { key: keyof Shortcuts; label: string }[] = [
  { key: "speedDown", label: "Speed down" },
  { key: "speedUp", label: "Speed up" },
];

// Keys recording waits past, alongside lone modifiers: Tab so the keyboard can still leave, and
// codes some virtual keyboards send instead of a real key.
const IGNORED_CODES = new Set(["", "CapsLock", "Tab", "Unidentified"]);

function comboLabel(combo: KeyCombination): string {
  return formatCombination(combo).join(" + ");
}

export function ShortcutsCard({
  shortcuts,
  onChange,
}: {
  shortcuts: Shortcuts;
  onChange: (shortcuts: Shortcuts) => void;
}) {
  const [recording, setRecording] = useState<keyof Shortcuts>();
  const [error, setError] = useState<string>();

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!recording || event.repeat) return;
    if (isModifierKey(event) || IGNORED_CODES.has(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    setRecording(undefined);
    if (event.code === "Escape") return;
    const combo = toKeyCombination(event);
    const other = ACTIONS.find(({ key }) => key !== recording);
    if (other && isSameCombination(combo, shortcuts[other.key])) {
      setError(`${other.label} already uses ${comboLabel(combo)}.`);
      return;
    }
    setError(undefined);
    onChange({ ...shortcuts, [recording]: combo });
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener, { capture: true });
    return () => window.removeEventListener("keydown", listener, { capture: true });
  }, []);

  return (
    <section
      aria-labelledby="shortcuts-title"
      className="wobbly grid content-start gap-3 px-[18px] pt-4 pb-[18px] [--fill:#fff] [--r:16px]"
    >
      <h2 className="font-hand text-[21px] leading-tight font-bold" id="shortcuts-title">
        Shortcuts
      </h2>
      <p className="text-ink/70 text-sm leading-normal">
        Click a key, then press the combination to use. Esc cancels.
      </p>
      {/* Mounted for the card's whole life, so screen readers announce recording. */}
      <p className="sr-only" role="status">
        {recording &&
          `Press a key combination for ${ACTIONS.find(({ key }) => key === recording)?.label}.`}
      </p>
      <dl className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5">
        {ACTIONS.map(({ key, label }) => (
          <Fragment key={key}>
            <dt className="text-[15px]">{label}</dt>
            <dd>
              <button
                aria-label={
                  recording === key
                    ? `${label}: press a key combination, or Escape to cancel`
                    : `${label}: ${comboLabel(shortcuts[key])}. Change`
                }
                className={cn(
                  "wobbly font-hand inline-flex h-10 min-w-[42px] items-center justify-center gap-1 px-3 text-lg leading-none font-bold [--r:9px]",
                  recording === key
                    ? "motion-safe:animate-wiggle-loop [--fill:var(--color-blush)]"
                    : "[--fill:#fff]",
                )}
                type="button"
                // Leaving the button stops recording, so a later key typed elsewhere stays there.
                onBlur={() => setRecording((current) => (current === key ? undefined : current))}
                onClick={() => {
                  setError(undefined);
                  setRecording(recording === key ? undefined : key);
                }}
              >
                {recording === key ? "Press a key…" : comboLabel(shortcuts[key])}
              </button>
            </dd>
          </Fragment>
        ))}
      </dl>
      {error && (
        <p className="text-rust text-[13px] leading-snug font-semibold" role="alert">
          {error}
        </p>
      )}
      <p className="text-ink/60 text-[13px] leading-normal">
        YouTube&apos;s own &lt; and &gt; work too. Keys do nothing while you type in a text field.
      </p>
    </section>
  );
}
