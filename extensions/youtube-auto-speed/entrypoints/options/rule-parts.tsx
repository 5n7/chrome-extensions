import { cn } from "@repo/ui/lib/utils";
import { PlusIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, Ref } from "react";

/** Why a rule is skipped: a `hint` while it is still being filled in, an `error` when it is wrong. */
export interface Problem {
  tone: "error" | "hint";
  text: string;
}

/** A rule's text field, in monospace since it holds a pattern or a handle. */
export function RuleField({
  autoFocus = false,
  inputProps,
  label,
  placeholder,
  problem,
  problemId,
}: {
  /** Set for a rule just added, so typing can start at once. */
  autoFocus?: boolean;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  label: string;
  placeholder: string;
  problem: Problem | undefined;
  problemId: string;
}) {
  return (
    <label
      className={cn(
        "wobbly block min-w-0 [--r:10px]",
        problem?.tone === "error"
          ? "outline-rust rounded-[10px] [--edge:var(--color-rust)] [--fill:var(--color-rust-tint)] focus-within:outline-2 focus-within:outline-offset-2"
          : "[--fill:#fff] focus-within:[--edge:var(--color-youtube)]",
      )}
    >
      <span className="sr-only">{label}</span>
      <input
        aria-describedby={problem ? problemId : undefined}
        aria-invalid={problem?.tone === "error"}
        autoComplete="off"
        autoFocus={autoFocus}
        className="placeholder:text-ink/35 w-full bg-transparent px-3 pt-2.5 pb-2 font-mono text-sm outline-none"
        placeholder={placeholder}
        spellCheck={false}
        type="text"
        {...inputProps}
      />
    </label>
  );
}

export function ProblemText({
  className,
  id,
  problem,
}: {
  className?: string;
  id: string;
  problem: Problem | undefined;
}) {
  if (!problem) return null;
  return (
    <p
      className={cn(
        "text-[13px] leading-snug",
        problem.tone === "error" ? "text-rust font-semibold" : "text-ink/60",
        className,
      )}
      id={id}
    >
      {problem.text}
    </p>
  );
}

/** The first click arms it, the second deletes; see `useConfirm`, which `data-armed` tells about. */
export function DeleteButton({
  armed,
  label,
  onArm,
  onDelete,
}: {
  armed: boolean;
  label: string;
  onArm: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      aria-label={armed ? `Confirm deleting ${label}` : `Delete ${label}`}
      className={cn(
        "font-hand min-w-[74px] px-2 pt-[7px] pb-[5px] text-[15px] leading-none font-bold",
        armed
          ? "wobbly text-white [--edge:var(--color-rust)] [--fill:var(--color-rust)] [--r:8px]"
          : "text-ink/50 hover:text-rust",
      )}
      data-armed={armed || undefined}
      type="button"
      onClick={armed ? onDelete : onArm}
    >
      {armed ? "Delete?" : "Delete"}
    </button>
  );
}

export function AddButton({
  children,
  ref,
  onClick,
}: {
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      className="wobbly font-hand inline-flex items-center gap-1.5 justify-self-start px-3.5 pt-2 pb-1.5 text-base leading-none font-bold transition-transform [--fill:var(--color-blush)] [--r:999px] motion-safe:hover:-translate-y-px motion-safe:hover:-rotate-1"
      type="button"
      onClick={onClick}
    >
      <PlusIcon aria-hidden className="size-4" strokeWidth={2.6} />
      {children}
    </button>
  );
}
