import { useId } from "react";

import { newRuleId, normalizeHandle, sameHandle, type ChannelRule } from "@/utils/rules";
import { channelName } from "@/utils/settings";

import {
  AddButton,
  DeleteButton,
  ProblemText,
  RuleField,
  SpeedSelect,
  type Problem,
} from "./rule-parts";
import { useDraft } from "./use-draft";
import { useRuleList, type RowProps } from "./use-rule-list";

function problemOf(text: string, takenAbove: boolean): Problem | undefined {
  if (text.trim() === "") {
    return { tone: "hint", text: "Type a handle like @name. Until then, this rule is skipped." };
  }
  const handle = normalizeHandle(text);
  if (!handle) {
    return { tone: "error", text: "That isn't a handle. Type @name, or paste the channel's URL." };
  }
  if (takenAbove) {
    return {
      tone: "error",
      text: `A rule above already covers ${handle}, so this one is skipped.`,
    };
  }
  return undefined;
}

function blankRule(): ChannelRule {
  return { handle: "", id: newRuleId(), speed: 1 };
}

export function ChannelRules({
  names,
  rules,
  onChange,
}: {
  names: Record<string, string>;
  rules: readonly ChannelRule[];
  onChange: (rules: ChannelRule[]) => void;
}) {
  const { add, addRef, row } = useRuleList(rules, onChange, blankRule);

  return (
    <>
      {rules.length === 0 ? (
        <p className="text-ink/60 text-sm">
          No channel rules yet. Add one here, or pick a speed in the popup while watching the
          channel.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {rules.map((rule, index) => (
            <ChannelRuleRow
              key={rule.id}
              {...row(rule, index)}
              names={names}
              rule={rule}
              takenAbove={rules
                .slice(0, index)
                .some((each) => sameHandle(each.handle, rule.handle))}
            />
          ))}
        </ul>
      )}
      <AddButton ref={addRef} onClick={add}>
        Add channel rule
      </AddButton>
    </>
  );
}

function ChannelRuleRow({
  armed,
  autoFocus,
  names,
  rule,
  takenAbove,
  onArm,
  onChange,
  onDelete,
}: RowProps<ChannelRule> & {
  names: Record<string, string>;
  rule: ChannelRule;
  takenAbove: boolean;
}) {
  const { text, inputProps } = useDraft(
    rule.handle,
    (handle) => onChange({ ...rule, handle }),
    (typed) => normalizeHandle(typed) ?? typed.trim(),
  );
  const handle = normalizeHandle(text);
  const problem = problemOf(text, takenAbove);
  const problemId = useId();
  const name = handle && channelName(names, handle);
  const label = handle ? `channel rule ${handle}` : "new channel rule";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_96px_auto] items-center gap-x-2.5 gap-y-1">
      <RuleField
        autoFocus={autoFocus}
        inputProps={inputProps}
        label="Channel handle"
        placeholder="@name"
        problem={problem}
        problemId={problemId}
      />
      <span className="truncate text-sm">
        {name ??
          (handle && <span className="text-ink/45 italic">Not seen on this device yet</span>)}
      </span>
      <SpeedSelect
        label={`Speed for ${label}`}
        speed={rule.speed}
        onChange={(speed) => onChange({ ...rule, speed })}
      />
      <DeleteButton armed={armed} label={label} onArm={onArm} onDelete={onDelete} />
      <ProblemText className="col-span-full" id={problemId} problem={problem} />
    </li>
  );
}
