import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/** A failed save, inked in rust so it reads apart from the red accent. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "wobbly text-rust px-3 py-2 text-[15px] leading-snug font-bold [--edge:var(--color-rust)] [--fill:var(--color-rust-tint)]",
        className,
      )}
      role="alert"
    >
      {children}
    </p>
  );
}
