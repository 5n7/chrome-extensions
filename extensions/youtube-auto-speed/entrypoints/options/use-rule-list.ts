import { useEffect, useRef, useState } from "react";

export interface RowProps<R> {
  armed: boolean;
  autoFocus: boolean;
  onArm: () => void;
  onChange: (rule: R) => void;
  onDelete: () => void;
}

export function useRuleList<R extends { id: string }>(
  rules: readonly R[],
  onChange: (rules: R[]) => void,
  blank: () => R,
) {
  const [armed, setArmed] = useConfirm();
  const [added, setAdded] = useState<string>();
  const addRef = useRef<HTMLButtonElement>(null);
  return {
    addRef,
    add: () => {
      const rule = blank();
      onChange([...rules, rule]);
      setAdded(rule.id);
    },
    row: (rule: R, index: number): RowProps<R> => ({
      armed: armed === rule.id,
      autoFocus: added === rule.id,
      onArm: () => setArmed(rule.id),
      onChange: (next) => onChange(rules.with(index, next)),
      onDelete: () => {
        onChange(rules.toSpliced(index, 1));
        addRef.current?.focus();
      },
    }),
  };
}

/**
 * Which row's Delete is waiting for its second click, in a list where only one may wait. A click
 * anywhere but that `[data-armed]` button, another list's included, or Escape stops the wait.
 */
function useConfirm(): [string | undefined, (id: string | undefined) => void] {
  const [pending, setPending] = useState<string>();

  useEffect(() => {
    if (pending === undefined) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-armed]")) {
        setPending(undefined);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPending(undefined);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pending]);

  return [pending, setPending];
}
