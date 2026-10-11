// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import {
  findButtonSlot,
  findPlayer,
  findVodOwnerLogin,
  parseReplayTime,
  readLine,
} from "./twitch-dom";

const LIVE_LINE = `
<div><div><div class="chat-line__message" data-a-target="chat-line-message" data-a-user="SomeViewer">
  <span class="chat-line__username"><span class="chat-author__display-name" data-a-user="someviewer">SomeViewer</span></span>
  <span aria-hidden="true">: </span>
  <span data-a-target="chat-line-message-body" dir="auto">
    <span class="mention-fragment" data-a-target="chat-message-mention">@xQc</span>
    <span class="text-fragment" data-a-target="chat-message-text"> nice </span>
    <div class="chat-line__message--emote-button"><div><span data-a-target="emote-name"><div class="chat-image__container">
      <img class="chat-image chat-line__message--emote" alt="Kappa" src="https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0"
        srcset="https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0 1x, https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0 4x">
    </div></span></div></div>
  </span>
</div></div></div>`;

const vodLine = (time: string, login: string, text: string) => `
<li><div class="vod-message">
  <div class="vod-message__header"><button><div><p>${time}</p></div></button></div>
  <div><div><div>
    <span><img class="chat-badge" alt="Subscriber"></span>
    <a class="video-chat__message-author" href="/${login}"><span><span class="chat-author__display-name" data-a-user="${login}">${login}</span></span></a>
    <div class="video-chat__message"><span>:</span><span><span class="text-fragment" data-a-target="chat-message-text">${text}</span></span></div>
  </div></div></div>
</div></li>`;

function node(html: string): Element {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild!;
}

describe("readLine", () => {
  it("reads a live message: login, then its mentions, text, and Emotes in order", () => {
    const line = readLine(node(LIVE_LINE), "live");
    expect(line?.login).toBe("someviewer");
    expect(line?.replayTime).toBeUndefined();
    expect(line?.readBody()).toEqual([
      { kind: "text", text: "@xQc" },
      { kind: "text", text: " nice " },
      {
        kind: "emote",
        code: "Kappa",
        src: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0",
        aspect: 1,
      },
    ]);
  });

  it("skips a live sub notice and Twitch's empty placeholders", () => {
    const notice = `<div><div data-test-selector="user-notice-line"><p><span class="chatter-name">a</span> Subscribed with Prime.</p></div></div>`;
    expect(readLine(node(notice), "live")).toBeUndefined();
    expect(readLine(node("<div><div></div></div>"), "live")).toBeUndefined();
  });

  it("reads a Chat Replay message without the separator before its body", () => {
    const line = readLine(node(vodLine("1:00:20", "Viewer_1", "gg")), "vod");
    expect(line?.login).toBe("viewer_1");
    expect(line?.replayTime).toBe(3620);
    expect(line?.readBody()).toEqual([{ kind: "text", text: "gg" }]);
  });

  it("has no body for a sub notice that Chat Replay shows as a message", () => {
    const notice = vodLine(
      "0:33",
      "trippie_tim",
      "trippie_tim subscribed at Tier 1. They've subscribed for 37 months!",
    );
    expect(readLine(node(notice), "vod")?.readBody()).toBeUndefined();
  });
});

describe("parseReplayTime", () => {
  it.each([
    ["0:34", 34],
    ["59:54", 3594],
    ["1:00:20", 3620],
    ["12:00:00", 43200],
  ])("reads %s as %i s", (text, seconds) => {
    expect(parseReplayTime(text)).toBe(seconds);
  });

  it("rejects anything else", () => {
    expect(parseReplayTime("Loading")).toBeUndefined();
    expect(parseReplayTime("1:2")).toBeUndefined();
  });
});

describe("page lookups", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="channel-info-content"><a href="/Kato_Junichi0817"><h1 class="tw-title">加藤純一</h1></a></div>
      <div data-a-target="video-player" data-a-player-type="frontpage"><div><div data-a-target="video-ref"><video id="front"></video></div></div></div>
      <div data-a-target="video-player" data-a-player-type="site"><div class="video-player__container">
        <div data-a-target="video-ref">
          <video id="main"></video>
          <div class="video-player__overlay"><div data-a-target="ax-overlay"><video id="ad"></video></div>
            <div class="player-controls__right-control-group">
              <div id="gear-item"><div><button data-a-target="player-settings-button"></button></div></div>
              <div id="theatre"></div>
            </div>
          </div>
        </div>
        <div style="display:none"><div class="player-controls__right-control-group">
          <div id="hidden-gear"><button data-a-target="player-settings-button"></button></div>
        </div></div>
      </div></div>`;
  });

  it("finds the watch player's own video, not a preview's or an ad's", () => {
    expect(findPlayer(document)?.video.id).toBe("main");
  });

  it("puts the button slot before the visible gear's item in the control row", () => {
    expect(findButtonSlot(document)?.id).toBe("gear-item");
  });

  it("reads the VOD owner's login from the channel link", () => {
    expect(findVodOwnerLogin(document)).toBe("kato_junichi0817");
  });
});
