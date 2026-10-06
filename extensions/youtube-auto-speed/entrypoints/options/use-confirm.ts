import { useEffect, useState } from "react";

/**
 * Which row's Delete is waiting for its second click, in a list where only one may wait. A click
 * anywhere but that `[data-armed]` button, another list's included, or Escape stops the wait.
 */
export function useConfirm(): [string | undefined, (id: string | undefined) => void] {
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
