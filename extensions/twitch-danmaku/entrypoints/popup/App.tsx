import { ErrorNote } from "@repo/ui/components/error-note";
import { WobbleFilter } from "@repo/ui/components/wobble-filter";
import { useEffect, useState } from "react";

import iconUrl from "@/assets/icon.svg";
import {
  getSettings,
  RANGES,
  resetSettings,
  saveSetting,
  watchSettings,
  type Settings,
  type SliderKey,
} from "@/utils/settings";

import { Preview } from "./Preview";
import { RangeInput } from "./RangeInput";

interface Slider {
  key: SliderKey;
  label: string;
  format: (value: number) => string;
  hint?: string;
}

const SLIDERS: readonly Slider[] = [
  { key: "area", label: "Area", format: (value) => `Top ${value}%` },
  { key: "laneCount", label: "Lanes", format: String, hint: "More lanes, smaller text." },
  { key: "opacity", label: "Opacity", format: (value) => `${value}%` },
  {
    key: "crossingTime",
    label: "Crossing time",
    format: (value) => `${value} s`,
    hint: "Seconds to cross the player.",
  },
];

const CONFIRM_MS = 3000;

export function App() {
  const [settings, setSettings] = useState<Settings>();
  // Slider values being dragged; storage.sync rate-limits writes, so they are saved on release.
  const [draft, setDraft] = useState<Partial<Record<SliderKey, number>>>({});
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const unwatch = watchSettings((change) => setSettings((old) => old && { ...old, ...change }));
    void getSettings().then(setSettings);
    return unwatch;
  }, []);

  useEffect(() => {
    if (!confirmingReset) return;
    const timer = setTimeout(() => setConfirmingReset(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmingReset]);

  async function save<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((old) => old && { ...old, [key]: value });
    setError(undefined);
    try {
      await saveSetting(key, value);
    } catch {
      setError("Couldn't save. Try again shortly.");
      setSettings(await getSettings());
    }
  }

  function commit(key: SliderKey, value: number) {
    setDraft((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
    if (value !== settings?.[key]) void save(key, value);
  }

  async function reset() {
    setConfirmingReset(false);
    setError(undefined);
    try {
      await resetSettings();
    } catch {
      setError("Couldn't reset. Try again shortly.");
    }
  }

  if (!settings) return null;
  const shown = { ...settings, ...draft };

  return (
    <main className="font-hand flex w-[360px] flex-col gap-3.5 px-4 pt-4 pb-[18px]">
      <WobbleFilter />
      <header className="flex items-center gap-2.5">
        <img alt="" className="size-[42px]" src={iconUrl} />
        <h1 className="title-squiggle text-[23px] leading-none font-bold">Twitch Danmaku</h1>
        <span className="flex-1" />
        <button
          aria-label="Danmaku"
          aria-pressed={settings.enabled}
          className="switch"
          type="button"
          onClick={() => void save("enabled", !settings.enabled)}
        >
          <span className="track wobbly">
            <span className="knob" />
          </span>
        </button>
      </header>

      <Preview config={shown} on={settings.enabled} />
      <div className="grid gap-2.5">
        {SLIDERS.map(({ format, hint, key, label }) => (
          <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5">
            <label className="text-[17px] font-bold" htmlFor={key}>
              {label}
            </label>
            <output className="text-twitch text-[17px] font-bold tabular-nums" htmlFor={key}>
              {format(shown[key])}
            </output>
            <RangeInput
              id={key}
              range={RANGES[key]}
              value={shown[key]}
              onInput={(value) => setDraft((old) => ({ ...old, [key]: value }))}
              onRelease={(value) => commit(key, value)}
            />
            {hint && (
              <span className="text-ink/65 col-span-full text-[13px] leading-tight">{hint}</span>
            )}
          </div>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <footer className="pfoot text-ink/75 flex justify-end pt-2.5 text-[15px]">
        <button
          className={confirmingReset ? "text-rust" : undefined}
          type="button"
          onClick={() => (confirmingReset ? void reset() : setConfirmingReset(true))}
        >
          {confirmingReset ? "Reset everything?" : "Reset"}
        </button>
      </footer>
    </main>
  );
}
