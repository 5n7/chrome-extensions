import { cn } from "@repo/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

import { browser, type Browser } from "#imports";
import iconUrl from "@/assets/icon.svg";
import { ErrorNote } from "@/components/error-note";
import { WobbleFilter } from "@/components/wobble-filter";
import { POPUP_PORT, type PageState, type PickedMessage } from "@/utils/page-state";
import {
  findChannelRule,
  newRuleId,
  readChannelRules,
  sameHandle,
  type ChannelRule,
} from "@/utils/rules";
import { channelRulesItem, describeSaveError, saveSetting } from "@/utils/settings";
import { formatSpeed, SPEEDS, type Speed } from "@/utils/speed";
import type { SpeedSource } from "@/utils/target";
import { YOUTUBE_ORIGIN } from "@/utils/youtube";

type PopupState = PageState | { kind: "connecting" } | { kind: "reload"; tabId: number };

const SOURCE_LABELS: Record<SpeedSource["kind"], string> = {
  channel: "Channel Rule",
  default: "Default Speed",
  manual: "Manual Speed",
  title: "Title Rule",
};

/**
 * Follows the active tab's content script; a tab without one is not a YouTube page it controls.
 * Also returns how to tell it a speed was just picked.
 */
function useTabState(): [PopupState, () => void] {
  const [state, setState] = useState<PopupState>({ kind: "connecting" });
  const portRef = useRef<Browser.runtime.Port>(undefined);

  useEffect(() => {
    let closed = false;
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (closed) return;
      if (tab?.id === undefined) return setState({ kind: "none" });
      const tabId = tab.id;
      // `activeTab` reveals the URL, telling a YouTube tab opened before install from any other page.
      const onYouTube = tab.url?.startsWith(`${YOUTUBE_ORIGIN}/`) ?? false;
      const port = browser.tabs.connect(tabId, { name: POPUP_PORT });
      portRef.current = port;
      port.onMessage.addListener((message) => setState(message as PageState));
      port.onDisconnect.addListener(() => {
        portRef.current = undefined;
        setState(onYouTube ? { kind: "reload", tabId } : { kind: "none" });
      });
    });
    return () => {
      closed = true;
      portRef.current?.disconnect();
      portRef.current = undefined;
    };
  }, []);

  function notifyPicked() {
    const message: PickedMessage = { kind: "picked" };
    portRef.current?.postMessage(message);
  }

  return [state, notifyPicked];
}

export function App() {
  const [state, notifyPicked] = useTabState();
  // Undefined until read, so nothing is saved over rules this popup has not seen.
  const [channelRules, setChannelRules] = useState<ChannelRule[]>();
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    void channelRulesItem.getValue().then((stored) => setChannelRules(readChannelRules(stored)));
    return channelRulesItem.watch((stored) => setChannelRules(readChannelRules(stored)));
  }, []);

  const rule =
    state.kind === "ready" && channelRules
      ? findChannelRule(channelRules, state.handle)
      : undefined;

  /** Resolves to whether the write went through. */
  async function save(next: ChannelRule[], done: string): Promise<boolean> {
    setChannelRules(next);
    setError(undefined);
    try {
      await saveSetting("channelRules", next);
      setAnnouncement(done);
      return true;
    } catch (error) {
      setError(describeSaveError(error));
      setChannelRules(readChannelRules(await channelRulesItem.getValue()));
      return false;
    }
  }

  function pick(rules: ChannelRule[], handle: string, speed: Speed) {
    const next = rule
      ? rules.with(rules.indexOf(rule), { ...rule, speed })
      : [...rules, { handle, id: newRuleId(), speed }];
    void save(next, `Saved ${formatSpeed(speed)} for ${handle}.`).then((saved) => {
      if (saved) notifyPicked();
    });
  }

  function remove(rules: ChannelRule[], handle: string) {
    void save(
      rules.filter((each) => !sameHandle(each.handle, handle)),
      `Removed the rule for ${handle}.`,
    );
  }

  return (
    <main className="font-hand flex w-[360px] flex-col gap-3.5 px-4 pt-4 pb-[18px]">
      <WobbleFilter />
      <header className="flex items-center gap-2.5">
        <img alt="" className="size-[42px]" src={iconUrl} />
        <h1 className="title-squiggle text-[23px] leading-none font-bold">YouTube Auto Speed</h1>
      </header>
      {/* Mounted for the popup's whole life, so screen readers announce each change. */}
      <p className="sr-only" role="status">
        {announcement}
      </p>

      {(state.kind === "connecting" || state.kind === "loading") && <Loading />}

      {state.kind === "none" && (
        <Notice
          drawing
          detail="Shorts and live streams are left alone."
          title="No video to control on this page."
        />
      )}

      {state.kind === "unreadable" && (
        <Notice detail="Reload the tab to try again." title="Couldn't read this video's channel." />
      )}

      {state.kind === "reload" && (
        <>
          <Notice
            detail="Reload it to control its video."
            title="This tab was open before YouTube Auto Speed started."
          />
          <button
            className="wobbly mx-auto px-5 pt-2.5 pb-2 text-lg leading-none font-bold text-white transition-transform [--fill:var(--color-youtube)] [--r:14px] motion-safe:hover:-translate-y-px motion-safe:hover:-rotate-1"
            type="button"
            onClick={() => void browser.tabs.reload(state.tabId).then(() => window.close())}
          >
            Reload tab
          </button>
        </>
      )}

      {state.kind === "ready" && (
        <>
          <ChannelCard handle={state.handle} name={state.channelName} />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
            Playing at <b className="text-[19px]">{formatSpeed(state.speed)}</b>
            <span className="wobbly px-2.5 pt-1 pb-[3px] text-sm font-bold [--fill:var(--color-blush)] [--r:999px]">
              {SOURCE_LABELS[state.source.kind]}
            </span>
          </p>
          <div
            aria-label={`Speed for ${state.handle}`}
            className="grid grid-cols-3 gap-2"
            role="group"
          >
            {SPEEDS.map((speed) => {
              const chosen = rule?.speed === speed;
              return (
                <button
                  key={speed}
                  aria-pressed={chosen}
                  className={cn(
                    "wobbly h-11 text-xl leading-none font-bold transition-transform [--r:999px] motion-safe:hover:-translate-y-px",
                    chosen ? "text-white [--fill:var(--color-youtube)]" : "[--fill:#fff]",
                  )}
                  disabled={!channelRules}
                  type="button"
                  onClick={() => channelRules && pick(channelRules, state.handle, speed)}
                >
                  {formatSpeed(speed)}
                </button>
              );
            })}
          </div>
          {state.source.kind === "title" && (
            <p className="wobbly px-3 pt-2.5 pb-2 text-[15px] leading-snug [--fill:var(--color-blush)] [--r:12px]">
              The Title Rule{" "}
              <code className="rounded bg-white/70 px-1 font-mono text-[13px]">
                {state.source.pattern}
              </code>{" "}
              sets this video to {formatSpeed(state.speed)}.{" "}
              {rule
                ? `Your ${formatSpeed(rule.speed)} applies to this channel's other videos.`
                : "A speed picked here applies to this channel's other videos."}
            </p>
          )}
          {state.source.kind === "manual" && (
            <p className="text-ink/70 text-sm leading-snug">
              Changed with a shortcut. The next video plays at its rule&apos;s speed.
            </p>
          )}
        </>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <footer className="border-ink/15 flex items-center gap-3 border-t-2 border-dashed pt-2.5 text-[15px]">
        {state.kind === "ready" && channelRules && rule && (
          <button
            className="text-rust decoration-rust/45 underline decoration-wavy underline-offset-4"
            type="button"
            onClick={() => remove(channelRules, state.handle)}
          >
            Remove rule
          </button>
        )}
        <button
          className="text-ink/75 decoration-ink/40 hover:text-ink ml-auto underline decoration-wavy underline-offset-4"
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          Settings →
        </button>
      </footer>
    </main>
  );
}

function ChannelCard({ handle, name }: { handle: string; name: string }) {
  return (
    <div className="wobbly grid gap-0.5 px-3.5 pt-[11px] pb-2.5 [--fill:#fff] [--r:14px]">
      <span className="truncate text-[19px] leading-tight font-bold">{name}</span>
      <span className="text-ink/70 truncate font-mono text-[13px]">{handle || "\u00a0"}</span>
    </div>
  );
}

function Loading() {
  return (
    <>
      <ChannelCard handle="" name="Reading this video…" />
      <div aria-hidden className="grid grid-cols-3 gap-2">
        {SPEEDS.map((speed) => (
          <span
            key={speed}
            className="wobbly h-11 [--edge:#c9c3b3] [--r:999px] before:border-dashed"
          />
        ))}
      </div>
    </>
  );
}

function Notice({
  detail,
  drawing = false,
  title,
}: {
  detail: string;
  drawing?: boolean;
  title: string;
}) {
  return (
    <div className="grid justify-items-center gap-1.5 px-1.5 pt-2.5 pb-1 text-center">
      {drawing && (
        <svg aria-hidden className="h-[74px] w-[120px]" viewBox="0 0 120 74">
          <rect
            fill="none"
            filter="url(#wobble)"
            height="62"
            rx="12"
            stroke="#8b8576"
            strokeDasharray="6 7"
            strokeWidth="2.5"
            width="108"
            x="6"
            y="6"
          />
          <path
            d="M52 26L72 37L52 48Z"
            fill="none"
            stroke="#8b8576"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        </svg>
      )}
      <p className="text-[19px] leading-tight font-bold">{title}</p>
      <p className="text-ink/70 text-[15px]">{detail}</p>
    </div>
  );
}
