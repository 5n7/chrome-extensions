import { ErrorNote as InkErrorNote } from "@repo/ui/components/error-note";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/** A failed save, edged in rust too, so it reads apart from the red accent. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <InkErrorNote className={cn("[--edge:var(--color-rust)]", className)}>{children}</InkErrorNote>
  );
}
