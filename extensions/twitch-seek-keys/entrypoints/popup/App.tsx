import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

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
  type SeekBinding,
  type SeekOffset,
} from "@/utils/seek-bindings";

const DIRECTIONS = [
  { label: "Backward", value: "backward" },
  { label: "Forward", value: "forward" },
] satisfies { label: string; value: SeekOffset["direction"] }[];

const NEW_BINDING_OFFSET: SeekOffset = { direction: "forward", seconds: 10 };

export function App() {
  const [bindings, setBindings] = useState<SeekBinding[]>();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void seekBindings.getValue().then(setBindings);
    return seekBindings.watch((next) => setBindings(next));
  }, []);

  function save(next: SeekBinding[]) {
    setBindings(next);
    setError(undefined);
    // storage.sync rejects writes past its quota or rate limits.
    seekBindings.setValue(next).catch(async () => {
      setError("Couldn't save. Try again shortly.");
      setBindings(await seekBindings.getValue());
    });
  }

  const recordKey = useEffectEvent((event: KeyboardEvent) => {
    // Wait for the non-modifier key; some virtual keyboards send no physical code at all.
    if (isModifierKey(event) || !event.code || event.code === "Unidentified" || !bindings) return;
    event.preventDefault();
    event.stopPropagation();
    setRecording(false);
    if (event.code === "Escape") return;
    const combination = toKeyCombination(event);
    if (findSeekBinding(bindings, combination)) {
      setError(`${formatCombination(combination).join("+")} is already bound.`);
      return;
    }
    save([...bindings, { combination, offset: NEW_BINDING_OFFSET }]);
  });

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => recordKey(event);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [recording]);

  if (!bindings) return null;

  return (
    <main className="flex w-96 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-base font-semibold">Twitch Seek Keys</h1>
        <Button size="sm" variant="ghost" onClick={() => save(DEFAULT_BINDINGS)}>
          Restore defaults
        </Button>
      </header>
      {bindings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No bindings. Twitch&apos;s 10-second arrow-key seek applies.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bindings.map((binding, index) => (
            <BindingRow
              key={formatCombination(binding.combination).join("+")}
              binding={binding}
              onChange={(offset) => save(bindings.with(index, { ...binding, offset }))}
              onRemove={() => save(bindings.toSpliced(index, 1))}
            />
          ))}
        </ul>
      )}
      <Button
        variant="outline"
        onClick={() => {
          setError(undefined);
          setRecording(true);
        }}
      >
        {recording ? "Press a key… (Esc to cancel)" : "Add binding"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </main>
  );
}

function BindingRow({
  binding,
  onChange,
  onRemove,
}: {
  binding: SeekBinding;
  onChange: (offset: SeekOffset) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <KbdGroup className="flex-1">
        {formatCombination(binding.combination).map((part) => (
          <Kbd key={part}>{part}</Kbd>
        ))}
      </KbdGroup>
      <Select
        items={DIRECTIONS}
        value={binding.offset.direction}
        onValueChange={(direction) => {
          if (direction) onChange({ ...binding.offset, direction });
        }}
      >
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIRECTIONS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SecondsInput
        // Remount when the stored value changes elsewhere, e.g. after restoring defaults.
        key={binding.offset.seconds}
        seconds={binding.offset.seconds}
        onCommit={(seconds) => onChange({ ...binding.offset, seconds })}
      />
      <Button aria-label="Remove" size="icon-sm" variant="ghost" onClick={onRemove}>
        <XIcon />
      </Button>
    </li>
  );
}

/** Keeps a draft while typing and saves only a valid value on blur or Enter. */
function SecondsInput({
  seconds,
  onCommit,
}: {
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
    <label className="flex items-center gap-1 text-sm text-muted-foreground">
      <Input
        aria-label="Seconds"
        className="w-20 text-sm text-foreground"
        max={MAX_SECONDS}
        min={MIN_SECONDS}
        step={1}
        type="number"
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      s
    </label>
  );
}
