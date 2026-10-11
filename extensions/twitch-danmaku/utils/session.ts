import type { Binding } from "./attach";
import { isCommand, plainText, toComment, type EmoteIndex, type Part } from "./body";
import { loadEmotes } from "./emotes";
import { judgeBacklog, judgeLag, Seen } from "./judge";
import type { Settings } from "./settings";
import { createStage } from "./stage";
import {
  findVodOwnerLogin,
  mountArea,
  readLiveLine,
  readReplayLine,
  type ChatLine,
} from "./twitch-dom";
import type { WatchPage } from "./watch-page";

export interface SessionTarget extends Binding {
  readonly page: WatchPage;
  readonly player: HTMLElement;
  readonly video: HTMLVideoElement;
  readonly chatList: Element;
}

export interface Session {
  readonly binding: Binding;
  connected(): boolean;
  configure(settings: Settings): void;
  syncEmotes(): void;
  destroy(): void;
}

const SEEN_LIMIT = 1000;

export function startSession(target: SessionTarget, initial: Settings): Session {
  const { chatList, page, video } = target;
  let settings = initial;
  let emotes: EmoteIndex = new Map();
  let emotesFor: string | undefined;

  const stage = createStage(settings);
  mountArea(target, stage.element);

  const abort = new AbortController();
  const on = (type: string, listener: () => void) =>
    video.addEventListener(type, listener, { signal: abort.signal });
  on("pause", () => stage.pause());
  on("playing", () => stage.resume());
  if (video.paused) stage.pause();

  const watching = () => !video.paused && !video.seeking && !document.hidden;

  function show(
    age: number,
    line: ChatLine,
    isNew: (body: readonly Part[]) => boolean = () => true,
  ) {
    stage.offer(age, () => {
      const body = line.readBody();
      if (!body || isCommand(body) || !isNew(body)) return undefined;
      return toComment(body, emotes);
    });
  }

  function followLive(): MutationCallback {
    let quietUntil = 0;
    return (records) => {
      const lines = records.reduce((count, record) => count + record.addedNodes.length, 0);
      const backlog = judgeBacklog(lines, performance.now() / 1000, quietUntil);
      quietUntil = backlog.quietUntil;
      if (backlog.drop || !watching()) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          const line = readLiveLine(node);
          if (line) show(0, line);
        }
      }
    };
  }

  function followReplay(): MutationCallback {
    const seen = new Seen();
    let restorePending = true;

    function offerAll(nodes: Iterable<Node>) {
      const position = video.currentTime;
      const rate = video.playbackRate || 1;
      if (seen.size > SEEN_LIMIT) seen.prune(position - settings.crossingTime * rate);
      for (const node of nodes) {
        const line = readReplayLine(node);
        if (!line) continue;
        const verdict = judgeLag(position - line.replayTime, rate, settings.crossingTime);
        if (verdict.kind === "drop") continue;
        show(verdict.age, line, (body) =>
          seen.firstSight(line.replayTime, line.login, plainText(body)),
        );
      }
    }

    function restore() {
      if (!restorePending || video.paused || video.seeking) return;
      restorePending = false;
      stage.clear();
      offerAll([...chatList.children]);
    }

    on("playing", restore);
    on("seeking", () => {
      stage.clear();
      seen.clear();
      restorePending = true;
    });
    on("seeked", restore);
    restore();
    return (records) => {
      if (watching()) for (const record of records) offerAll(record.addedNodes);
    };
  }

  const observer = new MutationObserver(page.kind === "live" ? followLive() : followReplay());
  observer.observe(chatList, { childList: true });

  return {
    binding: target,
    connected: () => stage.element.isConnected,
    configure(next) {
      settings = next;
      stage.configure(next);
    },
    syncEmotes() {
      const login = page.kind === "live" ? page.login : findVodOwnerLogin(document);
      if (!login || login === emotesFor) return;
      emotesFor = login;
      void loadEmotes(login).then((loaded) => {
        if (emotesFor === login) emotes = loaded;
      });
    },
    destroy() {
      observer.disconnect();
      abort.abort();
      stage.destroy();
    },
  };
}
