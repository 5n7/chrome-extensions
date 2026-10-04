import { cn } from "@repo/ui/lib/utils";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import iconUrl from "@/assets/icon.svg";
import { guard } from "@/utils/guard";

/** Where the stamp is being held, relative to its top-left corner; the ink spreads from there. */
interface Hold {
  x: number;
  y: number;
  /** The distance to the farthest corner, where the ink has covered the stamp. */
  radius: number;
}

/** Starts the ink under the pointer, or at the stamp's center for a key press. */
function holdAt(stamp: HTMLElement, pointer?: Pick<PointerEvent, "clientX" | "clientY">): Hold {
  // The layout size, which the hover tilt does not stretch.
  const { offsetHeight: height, offsetWidth: width } = stamp;
  const { left, top } = stamp.getBoundingClientRect();
  const x = pointer ? pointer.clientX - left : width / 2;
  const y = pointer ? pointer.clientY - top : height / 2;
  return { radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)), x, y };
}

const HOLD_KEYS = new Set([" ", "Enter"]);
const CONFIRM_MS = 3000;

type Phase = "confirming" | "holding" | "off" | "on";

/** Announced by the live region. */
const STATUS: Record<Phase, string> = {
  confirming: "Press again to turn the Guard off.",
  holding: "Keep holding to turn the Guard off.",
  off: "Guard is off.",
  on: "Guard is on.",
};

/** Shown under the stamp's title. */
const HINT: Record<Phase, string> = {
  confirming: "Press again to show the seek bar and total time",
  holding: "Keep holding…",
  off: "Click to hide the seek bar and total time",
  on: "Hold to show the seek bar and total time",
};

export function App() {
  const [on, setOn] = useState<boolean>();
  const [hold, setHold] = useState<Hold>();
  // Set by a click that comes without a press, until a second one confirms or time runs out.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  // Whether a pointer or a hold key went down before the next click.
  const pressed = useRef(false);
  // Whether the current press held long enough, so the click that ends it never turns the Guard back on.
  const held = useRef(false);

  useEffect(() => {
    void guard.getValue().then(setOn);
    return guard.watch((next) => setOn(next));
  }, []);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  async function save(next: boolean) {
    setOn(next);
    setConfirming(false);
    setError(undefined);
    try {
      await guard.setValue(next);
    } catch {
      // storage.sync rejects writes past its quota or rate limits.
      setError("Couldn't save. Try again shortly.");
      setOn(await guard.getValue());
    }
  }

  function startPress() {
    pressed.current = true;
    held.current = false;
  }

  if (on === undefined) return null;
  // The Guard may turn off elsewhere while a second click is awaited.
  const awaitingConfirm = confirming && on;
  let phase: Phase = on ? "on" : "off";
  if (awaitingConfirm) phase = "confirming";
  if (hold) phase = "holding";

  return (
    <main className="font-hand flex w-[360px] flex-col gap-3.5 px-4 pt-4 pb-[18px]">
      <WobbleFilter />
      <header className="flex items-center gap-2.5">
        <img alt="" className="size-[42px]" src={iconUrl} />
        <h1 className="title-squiggle text-[23px] leading-none font-bold">Twitch Spoiler Guard</h1>
      </header>
      {/* Mounted for the popup's whole life, so screen readers announce each change. */}
      <p className="sr-only" role="status">
        {STATUS[phase]}
      </p>
      {/* Turning the Guard off takes a deliberate hold, so a stray click never reveals a Spoiler Cue. */}
      <button
        className={cn(
          "wobbly grid w-full touch-none justify-items-center gap-1 px-3.5 pt-[18px] pb-4 text-center select-none [--r:18px]",
          "transition-transform motion-safe:hover:-translate-y-px motion-safe:hover:-rotate-1",
          on ? "text-white [--fill:var(--color-twitch)]" : "[--fill:var(--color-lilac)]",
        )}
        type="button"
        onBlur={() => setHold(undefined)}
        onClick={() => {
          const wasPressed = pressed.current;
          const wasHeld = held.current;
          pressed.current = false;
          held.current = false;
          if (!on) {
            if (!wasHeld) void save(true);
            return;
          }
          // Screen readers and voice control click without a press and cannot hold, so they confirm instead.
          if (wasPressed) return;
          if (awaitingConfirm) void save(false);
          else setConfirming(true);
        }}
        onContextMenu={() => setHold(undefined)}
        onKeyDown={(event) => {
          if (!HOLD_KEYS.has(event.key)) return;
          // Enter clicks on every keydown; a repeat must not undo what the press just did.
          if (event.repeat) {
            event.preventDefault();
            return;
          }
          startPress();
          if (!on) return;
          // The hold decides instead of Enter's click.
          event.preventDefault();
          setHold(holdAt(event.currentTarget));
        }}
        onKeyUp={(event) => {
          if (!HOLD_KEYS.has(event.key)) return;
          setHold(undefined);
          // A prevented keydown never clicks, so nothing is left to read these.
          pressed.current = false;
          held.current = false;
        }}
        onLostPointerCapture={() => setHold(undefined)}
        onPointerDown={(event) => {
          // Other buttons never click.
          if (event.button !== 0) return;
          startPress();
          if (!on) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setHold(holdAt(event.currentTarget, event));
        }}
        onPointerUp={() => setHold(undefined)}
      >
        {hold && (
          <span
            aria-hidden
            className="bg-ink animate-ink-spread absolute inset-0 -z-1 rounded-[18px] [filter:url(#wobble)]"
            style={
              {
                "--ink-radius": `${hold.radius}px`,
                "--ink-x": `${hold.x}px`,
                "--ink-y": `${hold.y}px`,
              } as CSSProperties
            }
            onAnimationEnd={() => {
              held.current = true;
              setHold(undefined);
              void save(false);
            }}
          />
        )}
        <Eye open={!on} />
        <span className="text-[26px] leading-none font-bold">
          {on ? "Guard is on" : "Guard is off"}
        </span>
        <span className={cn("text-sm", on ? "text-white/85" : "text-ink/70")}>{HINT[phase]}</span>
      </button>
      <p className="text-ink/70 text-sm">Clips and live streams are left alone.</p>
      {error && (
        <p
          className="wobbly text-rust px-3 py-2 text-[15px] leading-snug font-bold [--fill:#ffe9e7]"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  );
}

/** The icon's closed eye while the Guard is on, opening once it is off. */
function Eye({ open }: { open: boolean }) {
  return (
    <svg aria-hidden className="h-[34px] w-16" viewBox="0 0 64 34">
      <g
        fill="none"
        filter="url(#wobble)"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={4}
      >
        {open ? (
          <>
            <path d="M6 17C18 2 46 2 58 17C46 32 18 32 6 17Z" />
            <circle cx={32} cy={17} r={5} />
          </>
        ) : (
          <>
            <path d="M6 10C18 28 46 28 58 10" />
            <path d="M13 20L9 27M25 24L24 31M39 24L40 31M51 20L55 27" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Roughens outlines the way the icon's own filter roughens its strokes. */
function WobbleFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <filter height="180%" id="wobble" width="120%" x="-10%" y="-40%">
        <feTurbulence baseFrequency=".035" numOctaves={2} seed={3} type="fractalNoise" />
        <feDisplacementMap in="SourceGraphic" scale={4} />
      </filter>
    </svg>
  );
}
