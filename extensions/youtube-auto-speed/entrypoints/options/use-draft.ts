import { useEffect, useEffectEvent, useState, type InputHTMLAttributes } from "react";

// Typing saves once it pauses, so a burst of keys spends one of sync storage's limited writes.
const COMMIT_DELAY_MS = 1000;

/**
 * Keeps a text field's draft while the viewer types and commits it after a pause, on blur, on Enter,
 * or when the page goes away. Until then the draft wins over changes saved elsewhere.
 */
export function useDraft(
  value: string,
  onCommit: (text: string) => void,
  normalize: (text: string) => string = (text) => text,
): { draft: string; inputProps: InputHTMLAttributes<HTMLInputElement> } {
  // Undefined while nothing is typed, so the field follows the saved value, changes from elsewhere included.
  const [draft, setDraft] = useState<string>();

  function commit() {
    if (draft === undefined) return;
    setDraft(undefined);
    const next = normalize(draft);
    if (next !== value) onCommit(next);
  }

  // An Effect Event, so a commit that fires later still sees the latest rules rather than stale ones.
  const commitLater = useEffectEvent(commit);

  useEffect(() => {
    if (draft === undefined) return;
    const timer = setTimeout(() => commitLater(), COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const listener = () => commitLater();
    window.addEventListener("pagehide", listener);
    return () => window.removeEventListener("pagehide", listener);
  }, []);

  const text = draft ?? value;
  return {
    draft: text,
    inputProps: {
      value: text,
      onBlur: commit,
      onChange: (event) => setDraft(event.target.value),
      onKeyDown: (event) => {
        // An IME confirms its conversion with Enter too, which must not end the typing.
        if (event.key === "Enter" && !event.nativeEvent.isComposing) event.currentTarget.blur();
      },
    },
  };
}
