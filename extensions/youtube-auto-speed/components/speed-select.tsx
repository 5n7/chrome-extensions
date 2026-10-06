import { cn } from "@repo/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";

import { formatSpeed, isSpeed, SPEEDS, type Speed } from "@/utils/speed";

/** A native select dressed as an ink pill, so it keeps the browser's keyboard and screen-reader support. */
export function SpeedSelect({
  className,
  label,
  speed,
  onChange,
}: {
  className?: string;
  label: string;
  speed: Speed;
  onChange: (speed: Speed) => void;
}) {
  return (
    <label
      className={cn(
        "wobbly font-hand relative block [--fill:#fff] [--r:999px] focus-within:[--edge:var(--color-youtube)]",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <select
        className="w-full appearance-none bg-transparent py-2 pr-7 pl-3.5 text-base leading-none font-bold outline-none"
        value={speed}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (isSpeed(next)) onChange(next);
        }}
      >
        {SPEEDS.map((option) => (
          <option key={option} value={option}>
            {formatSpeed(option)}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2"
        strokeWidth={2.6}
      />
    </label>
  );
}
