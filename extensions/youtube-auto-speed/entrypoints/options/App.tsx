import { cn } from "@repo/ui/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

import iconUrl from "@/assets/icon.svg";
import { ErrorNote } from "@/components/error-note";
import { WobbleFilter } from "@/components/wobble-filter";
import {
  channelNamesItem,
  describeSaveError,
  getSettings,
  saveSetting,
  watchSettings,
  type Settings,
} from "@/utils/settings";
import { formatSpeed, SPEEDS } from "@/utils/speed";

import { ChannelRules } from "./channel-rules";
import { ShortcutsCard } from "./shortcuts-card";
import { TitleRules } from "./title-rules";

const SAVED_MS = 1500;

/** Why the last save of each setting failed, until that setting is saved or changed elsewhere. */
type SaveErrors = Partial<Record<keyof Settings, string>>;

function without(errors: SaveErrors, keys: readonly string[]): SaveErrors {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => !keys.includes(key)));
}

export function App() {
  const [settings, setSettings] = useState<Settings>();
  const [names, setNames] = useState<Record<string, string>>({});
  // The latest save, shown as "Saved" until its timer ends; a new save restarts the timer.
  const [saved, setSaved] = useState<number>();
  const [errors, setErrors] = useState<SaveErrors>({});
  const error = Object.values(errors)[0];

  useEffect(() => {
    void getSettings().then(setSettings);
    return watchSettings((change) => {
      setSettings((current) => current && { ...current, ...change });
      // What is stored is the truth again, so an earlier failure to save it no longer applies.
      setErrors((current) => without(current, Object.keys(change)));
    });
  }, []);

  useEffect(() => {
    void channelNamesItem.getValue().then(setNames);
    return channelNamesItem.watch(setNames);
  }, []);

  useEffect(() => {
    if (saved === undefined) return;
    const timer = setTimeout(() => setSaved(undefined), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!settings) return null;

  /**
   * Shows the edit at once, then saves it. A rejected write keeps the edit on screen, so nothing typed
   * is lost; the next edit to that setting saves all of it again.
   */
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => current && { ...current, [key]: value });
    saveSetting(key, value).then(
      () => {
        setErrors((current) => without(current, [key]));
        setSaved(performance.now());
      },
      (reason: unknown) =>
        setErrors((current) => ({ ...current, [key]: describeSaveError(reason) })),
    );
  }

  return (
    <main className="mx-auto grid max-w-[940px] gap-x-7 gap-y-6 px-6 pt-9 pb-16 md:grid-cols-[minmax(0,1fr)_250px]">
      <WobbleFilter />
      <header className="flex flex-wrap items-center gap-3.5 md:col-span-2">
        <img alt="" className="size-[54px]" src={iconUrl} />
        <div>
          <h1 className="font-hand title-squiggle text-[30px] leading-none font-bold">
            YouTube Auto Speed
          </h1>
          <p className="text-ink/70 mt-1.5 text-sm">
            Each video plays at the speed of the first step that matches it.
          </p>
        </div>
        <p
          className={cn(
            "wobbly font-hand ml-auto -rotate-3 px-3 pt-1.5 pb-1 text-[15px] leading-none font-bold transition-opacity [--fill:var(--color-blush)] [--r:8px]",
            saved === undefined ? "opacity-0" : "opacity-100",
          )}
          role="status"
        >
          {saved !== undefined && "Saved ✓"}
        </p>
      </header>

      {error && <ErrorNote className="md:col-span-2">{error}</ErrorNote>}

      <div className="grid content-start gap-1.5">
        <Step
          description="Checked first, from the top. The first pattern found in the title wins, ignoring case. Drag ⠿ to reorder."
          number={1}
          title="Title Rules"
        >
          <TitleRules
            rules={settings.titleRules}
            onChange={(titleRules) => update("titleRules", titleRules)}
          />
        </Step>
        <NoMatch />
        <Step
          description="Matched by handle. Type @name, or paste the channel's URL."
          number={2}
          title="Channel Rules"
        >
          <ChannelRules
            names={names}
            rules={settings.channelRules}
            onChange={(channelRules) => update("channelRules", channelRules)}
          />
        </Step>
        <NoMatch />
        <Step floor description="Every other video." number={3} title="Default Speed">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Default Speed</legend>
            {SPEEDS.map((speed) => (
              <label key={speed} className="relative">
                <input
                  checked={settings.defaultSpeed === speed}
                  className="peer sr-only"
                  name="default-speed"
                  type="radio"
                  value={speed}
                  onChange={() => update("defaultSpeed", speed)}
                />
                <span className="wobbly font-hand peer-focus-visible:outline-youtube grid h-10 w-[74px] place-items-center text-lg leading-none font-bold [--fill:#fff] [--r:999px] peer-checked:text-white peer-checked:[--fill:var(--color-youtube)] peer-focus-visible:rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3">
                  {formatSpeed(speed)}
                </span>
              </label>
            ))}
          </fieldset>
        </Step>
      </div>

      <aside className="grid content-start gap-4">
        <ShortcutsCard
          shortcuts={settings.shortcuts}
          onChange={(shortcuts) => update("shortcuts", shortcuts)}
        />
        <p className="text-ink/60 px-1 text-[13px] leading-normal">
          Settings sync across your Chrome profile. Channel names stay on each device.
        </p>
      </aside>
    </main>
  );
}

function Step({
  children,
  description,
  floor = false,
  number,
  title,
}: {
  children: ReactNode;
  description: string;
  floor?: boolean;
  number: number;
  title: string;
}) {
  return (
    <section
      aria-label={`Step ${number}: ${title}`}
      className={cn(
        "wobbly grid grid-cols-[38px_minmax(0,1fr)] gap-3.5 px-[18px] pt-4 pb-[18px] [--r:16px]",
        floor ? "[--fill:var(--color-paper-deep)]" : "[--fill:#fff]",
      )}
    >
      <span
        aria-hidden
        className="wobbly font-hand grid size-[34px] place-items-center text-lg leading-none font-bold text-white [--fill:var(--color-youtube)] [--r:999px]"
      >
        {number}
      </span>
      <div className="grid min-w-0 gap-2.5">
        <h2 className="font-hand text-[21px] leading-tight font-bold">{title}</h2>
        <p className="text-ink/70 -mt-1 text-sm leading-normal">{description}</p>
        {children}
      </div>
    </section>
  );
}

function NoMatch() {
  return (
    <p aria-hidden className="font-hand text-ink/60 py-0.5 pl-[27px] text-sm font-bold">
      ↓ no match
    </p>
  );
}
