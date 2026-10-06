import { cn } from "@repo/ui/lib/utils";
import { useEffect, useId, useRef, useState } from "react";

import { SpeedSelect } from "@/components/speed-select";
import { compilePattern, newRuleId, type TitleRule } from "@/utils/rules";

import { AddButton, DeleteButton, ProblemText, RuleField, type Problem } from "./rule-parts";
import { useConfirm } from "./use-confirm";
import { useDraft } from "./use-draft";

/** A row's part in dragging rules into a new order. */
interface Drag {
  /** Where the dragged rule would land, drawn as a line on that edge of this row. */
  edge: "bottom" | "top" | undefined;
  /** Whether a rule is being dragged, so this row accepts the drop instead of its fields. */
  active: boolean;
  onStart: () => void;
  onOver: () => void;
  onDrop: () => void;
  onEnd: () => void;
}

function problemOf(pattern: string): Problem | undefined {
  if (pattern === "") {
    return { tone: "hint", text: "Type a pattern. Until then, this rule is skipped." };
  }
  if (!compilePattern(pattern)) {
    return {
      tone: "error",
      text: "This isn't a valid regular expression, so this rule is skipped.",
    };
  }
  return undefined;
}

export function TitleRules({
  rules,
  onChange,
}: {
  rules: readonly TitleRule[];
  onChange: (rules: TitleRule[]) => void;
}) {
  const [armed, setArmed] = useConfirm();
  const [added, setAdded] = useState<string>();
  const [dragging, setDragging] = useState<number>();
  const [over, setOver] = useState<number>();
  // The rule whose handle keeps focus after a keyboard move re-renders the list.
  const [movedByKeyboard, setMovedByKeyboard] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const addRef = useRef<HTMLButtonElement>(null);

  /** Moves the rule at `from` into the place of the rule at `to`, shifting the ones between. */
  function reorder(from: number, to: number, byKeyboard: boolean) {
    const rule = rules[from];
    // A move that changes nothing would still spend one of sync storage's limited writes.
    if (!rule || to < 0 || to >= rules.length || from === to) return;
    onChange(rules.toSpliced(from, 1).toSpliced(to, 0, rule));
    if (!byKeyboard) return;
    setMovedByKeyboard(rule.id);
    setAnnouncement(`Moved to position ${to + 1} of ${rules.length}.`);
  }

  function endDrag() {
    setDragging(undefined);
    setOver(undefined);
  }

  function dropEdge(index: number): Drag["edge"] {
    if (dragging === undefined || over !== index || dragging === index) return undefined;
    return dragging < index ? "bottom" : "top";
  }

  return (
    <>
      {/* Mounted for the list's whole life, so screen readers announce each keyboard move. */}
      <p className="sr-only" role="status">
        {announcement}
      </p>
      {rules.length === 0 ? (
        <p className="text-ink/60 text-sm">
          No title rules yet. Add one to set a speed for every title that matches a pattern, such as{" "}
          <code className="font-mono text-[13px]">ASMR|relaxing</code>.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {rules.map((rule, index) => (
            <TitleRuleRow
              key={rule.id}
              armed={armed === rule.id}
              autoFocus={added === rule.id}
              drag={{
                active: dragging !== undefined,
                edge: dropEdge(index),
                onDrop: () => {
                  if (dragging !== undefined) reorder(dragging, index, false);
                  endDrag();
                },
                onEnd: endDrag,
                onOver: () => setOver(index),
                onStart: () => setDragging(index),
              }}
              focusGrip={movedByKeyboard === rule.id}
              index={index}
              rule={rule}
              onArm={() => setArmed(rule.id)}
              onChange={(next) => onChange(rules.with(index, next))}
              onDelete={() => {
                onChange(rules.toSpliced(index, 1));
                addRef.current?.focus();
              }}
              onGripFocused={() => setMovedByKeyboard(undefined)}
              onMove={(offset) => reorder(index, index + offset, true)}
            />
          ))}
        </ul>
      )}
      <AddButton
        ref={addRef}
        onClick={() => {
          const rule: TitleRule = { id: newRuleId(), pattern: "", speed: 1 };
          onChange([...rules, rule]);
          setAdded(rule.id);
        }}
      >
        Add title rule
      </AddButton>
    </>
  );
}

function TitleRuleRow({
  armed,
  autoFocus,
  drag,
  focusGrip,
  index,
  rule,
  onArm,
  onChange,
  onDelete,
  onGripFocused,
  onMove,
}: {
  armed: boolean;
  autoFocus: boolean;
  drag: Drag;
  focusGrip: boolean;
  index: number;
  rule: TitleRule;
  onArm: () => void;
  onChange: (rule: TitleRule) => void;
  onDelete: () => void;
  onGripFocused: () => void;
  onMove: (offset: -1 | 1) => void;
}) {
  const { draft, inputProps } = useDraft(rule.pattern, (pattern) => onChange({ ...rule, pattern }));
  const problem = problemOf(draft);
  const problemId = useId();
  const rowRef = useRef<HTMLLIElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const label = draft ? `title rule ${draft}` : `title rule ${index + 1}`;

  useEffect(() => {
    if (!focusGrip) return;
    gripRef.current?.focus();
    onGripFocused();
  }, [focusGrip, onGripFocused]);

  return (
    <li
      ref={rowRef}
      className="relative grid grid-cols-[22px_minmax(0,1fr)_96px_auto] items-center gap-x-2.5 gap-y-1"
      onDragOver={(event) => {
        if (!drag.active) return;
        event.preventDefault();
        drag.onOver();
      }}
      onDrop={(event) => {
        if (!drag.active) return;
        event.preventDefault();
        drag.onDrop();
      }}
    >
      {drag.edge && (
        <span
          aria-hidden
          className={cn(
            "bg-youtube absolute right-0 left-0 h-[3px] rounded-full",
            drag.edge === "top" ? "-top-[7px]" : "-bottom-[7px]",
          )}
        />
      )}
      <button
        ref={gripRef}
        aria-label={`Move ${label}. Drag, or press the up and down arrow keys.`}
        className="text-ink/45 hover:text-ink cursor-grab text-center text-lg leading-none active:cursor-grabbing"
        draggable
        type="button"
        onDragEnd={drag.onEnd}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          if (rowRef.current) event.dataTransfer.setDragImage(rowRef.current, 12, 18);
          drag.onStart();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onMove(event.key === "ArrowUp" ? -1 : 1);
        }}
      >
        ⠿
      </button>
      <RuleField
        autoFocus={autoFocus}
        inputProps={inputProps}
        label="Title pattern (regular expression)"
        placeholder="ASMR|relaxing"
        problem={problem}
        problemId={problemId}
      />
      <SpeedSelect
        label={`Speed for ${label}`}
        speed={rule.speed}
        onChange={(speed) => onChange({ ...rule, speed })}
      />
      <DeleteButton armed={armed} label={label} onArm={onArm} onDelete={onDelete} />
      <ProblemText className="col-start-2 col-end-[-1]" id={problemId} problem={problem} />
    </li>
  );
}
