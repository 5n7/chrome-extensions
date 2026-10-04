import { useEffect, useState, type ReactNode } from "react";

import { browser } from "#imports";
import iconUrl from "@/assets/icon.svg";

/** The shortcut to bind to each command in the manifest. */
const BINDINGS = { "walk-older": "Ctrl+Tab", "walk-newer": "Ctrl+Shift+Tab" };

const SHORTCUTS_PAGE = "chrome://extensions/shortcuts";
const DEVTOOLS_KEYS = navigator.userAgent.includes("Mac") ? "⌥⌘I" : "Ctrl+Shift+I";

/**
 * Chrome's shortcuts page refuses Tab, but the page's own private API accepts it. On macOS, "Ctrl"
 * there means the Control key.
 */
function setupCode(extensionId: string): string {
  const pairs = Object.entries(BINDINGS)
    .map(([command, keybinding]) => `["${command}", "${keybinding}"]`)
    .join(", ");
  return `for (const [commandName, keybinding] of [${pairs}])
  chrome.developerPrivate.updateExtensionCommand({ extensionId: "${extensionId}", commandName, keybinding });`;
}

/**
 * Splits "Ctrl+Shift+Tab" into keys. macOS reports modifier symbols with no separator, as in "⌃⇧⇥"
 * or "⌃F10", so each symbol is a key and the rest is one more.
 */
function keysOf(shortcut: string): string[] {
  if (shortcut.includes("+")) return shortcut.split("+");
  const [, modifiers = "", key = ""] = /^([⌃⌥⇧⌘]*)(.*)$/.exec(shortcut) ?? [];
  return [...modifiers.split(""), key].filter(Boolean);
}

interface Command {
  name: string;
  description: string;
  shortcut: string;
}

export function App() {
  const [commands, setCommands] = useState<Command[]>();
  const [error, setError] = useState<string>();
  // Set once the clipboard refuses the code, so the next press only opens the page.
  const [copyByHand, setCopyByHand] = useState(false);
  const code = setupCode(browser.runtime.id);

  useEffect(() => {
    void browser.commands.getAll().then((all) =>
      setCommands(
        Object.keys(BINDINGS).map((name) => {
          const command = all.find((each) => each.name === name);
          return {
            description: command?.description ?? "",
            name,
            shortcut: command?.shortcut ?? "",
          };
        }),
      ),
    );
  }, []);

  // Opening the page closes the popup, so the code goes to the clipboard first.
  async function copyAndOpen() {
    if (!copyByHand) {
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        setCopyByHand(true);
        setError("Couldn't copy. Copy the code below yourself, then open the page.");
        return;
      }
    }
    await browser.tabs.create({ url: SHORTCUTS_PAGE });
  }

  if (!commands) return null;
  const bound = commands.every(({ shortcut }) => shortcut);

  return (
    <main className="font-hand flex w-[360px] flex-col gap-3.5 px-4 pt-4 pb-[18px]">
      <WobbleFilter />
      <header className="flex items-center gap-2.5">
        <img alt="" className="size-[42px]" src={iconUrl} />
        <h1 className="title-squiggle text-[23px] leading-none font-bold">Recent Tab Switch</h1>
      </header>
      <ul className="wobbly grid gap-2.5 px-3.5 py-3 [--fill:#fff] [--r:14px]">
        {commands.map(({ description, name, shortcut }) => (
          <li className="flex items-center justify-between gap-3" key={name}>
            <span className="text-[15px] leading-tight">{description}</span>
            <Shortcut keys={shortcut ? keysOf(shortcut) : undefined} />
          </li>
        ))}
      </ul>
      <p className="text-ink/70 text-sm leading-snug">
        Keep pressing to go further back. Pause for a second, and the tab you stopped on becomes the
        most recent one.
      </p>
      <Setup
        code={code}
        copyByHand={copyByHand}
        open={!bound}
        onCopyAndOpen={() => void copyAndOpen()}
      />
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

function Shortcut({ keys }: { keys: string[] | undefined }) {
  if (!keys) return <span className="text-ink/60 shrink-0 text-sm">Not set</span>;
  return (
    <span className="flex shrink-0 gap-1">
      {keys.map((key, index) => (
        <kbd
          className="wobbly min-w-7 px-1.5 pt-0.5 text-center text-sm leading-6 font-bold [--fill:var(--color-peach)] [--r:7px]"
          key={`${index}-${key}`}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

interface SetupProps {
  code: string;
  copyByHand: boolean;
  /** Open while a shortcut is missing; folded away once both are set. */
  open: boolean;
  onCopyAndOpen: () => void;
}

function Setup({ code, copyByHand, open, onCopyAndOpen }: SetupProps) {
  return (
    <details className="grid gap-2.5" open={open}>
      <summary className="cursor-pointer text-[17px] font-bold [--r:8px]">
        {open ? "Bind Ctrl+Tab" : "Bind Ctrl+Tab again"}
      </summary>
      <ol className="mt-2.5 grid list-none gap-3 text-[15px] leading-snug">
        <Step n={1}>
          <button
            className="wobbly justify-self-start px-3 py-1 font-bold [--fill:var(--color-tangerine)] [--r:10px]"
            type="button"
            onClick={onCopyAndOpen}
          >
            {copyByHand ? "Open the shortcuts page" : "Copy the code and open shortcuts"}
          </button>
          <pre className="bg-ink/5 mt-2 max-h-24 overflow-auto rounded-md p-2 font-mono text-[10.5px] leading-snug whitespace-pre-wrap select-all">
            {code}
          </pre>
        </Step>
        <Step n={2}>
          There, open DevTools with <b>{DEVTOOLS_KEYS}</b>, paste the code into the Console, and
          press Enter. If Chrome asks, type <b>allow pasting</b> first.
        </Step>
        <Step n={3}>Reopen this popup to check the shortcuts above.</Step>
      </ol>
      <p className="text-ink/70 mt-2.5 text-sm leading-snug">
        The shortcuts page won't take Ctrl+Tab itself, so the Console sets it directly. Any other
        shortcut you pick on that page works too.
      </p>
    </details>
  );
}

function Step({ children, n }: { children: ReactNode; n: number }) {
  return (
    <li className="grid grid-cols-[22px_1fr] items-start gap-2">
      <span className="wobbly grid size-[22px] place-items-center text-xs font-bold [--r:11px]">
        {n}
      </span>
      <div className="grid">{children}</div>
    </li>
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
