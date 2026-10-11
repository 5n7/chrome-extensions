import type { ReactNode } from "react";

import { cn } from "../lib/utils";

/** A failed save, written in rust on a rust tint. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "wobbly text-rust px-3 py-2 text-[15px] leading-snug font-bold [--fill:var(--color-rust-tint)]",
        className,
      )}
      role="alert"
    >
      {children}
    </p>
  );
}
