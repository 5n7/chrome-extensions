import { defineContentScript } from "#imports";
import {
  PLAYER_SELECTOR,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  type PlayerDetails,
  type PlayerReport,
  type PlayerVideo,
} from "@/utils/player-bridge";
import { YOUTUBE_ORIGIN } from "@/utils/youtube";

interface YouTubePlayer extends HTMLElement {
  getVideoData?: () => { author?: string; isLive?: boolean; title?: string; video_id?: string };
  getPlayerResponse?: () => {
    microformat?: { playerMicroformatRenderer?: { ownerProfileUrl?: string } };
    videoDetails?: { isLive?: boolean; videoId?: string };
  };
}

export default defineContentScript({
  matches: [`${YOUTUBE_ORIGIN}/*`],
  world: "MAIN",
  main() {
    document.addEventListener(REQUEST_EVENT, () => {
      const player = document.querySelector<YouTubePlayer>(PLAYER_SELECTOR);
      const data = player?.getVideoData?.();
      const response = player?.getPlayerResponse?.();
      const video: PlayerVideo | undefined = data?.video_id
        ? {
            author: data.author ?? "",
            isLive: data.isLive === true,
            title: data.title ?? "",
            videoId: data.video_id,
          }
        : undefined;
      const details: PlayerDetails | undefined = response?.videoDetails?.videoId
        ? {
            isLive: response.videoDetails.isLive === true,
            ownerUrl: response.microformat?.playerMicroformatRenderer?.ownerProfileUrl,
            videoId: response.videoDetails.videoId,
          }
        : undefined;
      const report: PlayerReport = { details, video };
      document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(report) }));
    });
  },
});
