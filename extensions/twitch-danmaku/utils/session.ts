import type { Binding } from "./attach";
import { isCommand, plainText, toComment, type EmoteIndex } from "./body";
import { judge, judgeBacklog, Seen, type JudgeContext } from "./judge";
import type { Settings } from "./settings";
import { createStage } from "./stage";
import { listLines, mountArea, readLine, type ChatLine, type PlayerParts } from "./twitch-dom";
import type { WatchPage } from "./watch-page";

export interface SessionTarget extends Binding {
  readonly page: WatchPage;
  readonly parts: PlayerParts;
  readonly chatList: Element;
}

export interface Session {
  readonly binding: Binding;
  connected(): boolean;
  configure(settings: Settings): void;
  setEmotes(emotes: EmoteIndex): void;
  destroy(): void;
}

const SEEN_LIMIT = 1000;

export function startSession(target: SessionTarget, initial: Settings): Session {
  const { chatList, page, parts } = target;
  const { video } = parts;
  const vod = page.kind === "vod";
  let settings = initial;
  let emotes: EmoteIndex = new Map();
  const seen = new Seen();
  let restorePending = vod;

  const stage = createStage(settings);
  mountArea(parts, stage.element);

  function context(): JudgeContext {
    return {
      crossingTime: settings.crossingTime,
      playback: vod ? { position: video.currentTime, rate: video.playbackRate || 1 } : undefined,
    };
  }

  function offer(line: ChatLine, judged: JudgeContext) {
    const verdict = judge(line.replayTime, judged);
    if (verdict.kind === "drop") return;
    stage.offer(verdict.age, () => {
      const body = line.readBody();
      if (!body || isCommand(body)) return undefined;
      if (line.replayTime !== undefined) {
        const key = Seen.key(line.replayTime, line.login, plainText(body));
        if (seen.has(key)) return undefined;
        seen.add(key, line.replayTime);
      }
      return toComment(body, emotes);
    });
  }

  function offerAll(nodes: Iterable<Node>) {
    const judged = context();
    if (judged.playback && seen.size > SEEN_LIMIT) {
      seen.prune(judged.playback.position - settings.crossingTime);
    }
    for (const node of nodes) {
      const line = readLine(node, page.kind);
      if (line) offer(line, judged);
    }
  }

  function restore() {
    if (!restorePending || video.paused || video.seeking) return;
    restorePending = false;
    stage.clear();
    offerAll(listLines(chatList));
  }

  let backlogQuietUntil = 0;
  const observer = new MutationObserver((records) => {
    if (!vod) {
      const lines = records.reduce((count, record) => count + record.addedNodes.length, 0);
      const backlog = judgeBacklog(lines, performance.now() / 1000, backlogQuietUntil);
      backlogQuietUntil = backlog.quietUntil;
      if (backlog.drop) return;
    }
    if (video.paused || video.seeking || document.hidden) return;
    for (const record of records) offerAll(record.addedNodes);
  });
  observer.observe(chatList, { childList: true });

  const abort = new AbortController();
  const on = (type: string, listener: () => void) =>
    video.addEventListener(type, listener, { signal: abort.signal });
  on("pause", () => stage.pause());
  on("playing", () => {
    stage.resume();
    restore();
  });
  if (vod) {
    on("seeking", () => {
      stage.clear();
      seen.clear();
      restorePending = true;
    });
    on("seeked", restore);
  }

  if (video.paused) stage.pause();
  else restore();

  return {
    binding: target,
    connected: () => stage.element.isConnected,
    configure(next) {
      settings = next;
      stage.configure(next);
    },
    setEmotes(next) {
      emotes = next;
    },
    destroy() {
      observer.disconnect();
      abort.abort();
      stage.destroy();
    },
  };
}
