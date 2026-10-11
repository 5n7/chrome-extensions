import { useEffect, useEffectEvent, useRef } from "react";

import type { Range } from "@/utils/settings";

/**
 * A slider that reports its value as it moves, and again once let go: after a drag, or on the keyup
 * that ends keyboard steps, since Chrome fires `change` on every step a held key repeats.
 */
export function RangeInput({
  id,
  range,
  value,
  onInput,
  onRelease,
}: {
  id: string;
  range: Range;
  value: number;
  onInput: (value: number) => void;
  onRelease: (value: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const release = useEffectEvent((input: HTMLInputElement) => onRelease(Number(input.value)));

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    let keyHeld = false;
    const abort = new AbortController();
    const on = (type: string, listener: () => void) =>
      input.addEventListener(type, listener, { signal: abort.signal });
    const endKey = () => {
      if (keyHeld) release(input);
      keyHeld = false;
    };
    on("keydown", () => (keyHeld = true));
    on("keyup", endKey);
    // A keyup lost to a focus change would otherwise hold back every later release.
    on("blur", endKey);
    on("change", () => {
      if (!keyHeld) release(input);
    });
    return () => abort.abort();
  }, []);

  return (
    <input
      ref={ref}
      className="col-span-full"
      id={id}
      max={range.max}
      min={range.min}
      step={range.step}
      type="range"
      value={value}
      onChange={(event) => onInput(Number(event.target.value))}
    />
  );
}
