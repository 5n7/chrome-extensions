import type { SeekOffset } from "./seek-bindings";

// VODs (including highlights and uploads) live at `/videos/<id>`, clips at `/<channel>/clip/<slug>`.
const SEEKABLE_PATH = /^\/(?:videos\/\d+|[^/]+\/clip\/[^/]+)\/?$/;

// Inputs that ignore arrow and letter keys, so a Seek Binding may take them over.
// Text fields, sliders such as the volume control, and radio groups keep their keys.
const KEYLESS_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "reset",
  "submit",
]);

export function isSeekablePath(pathname: string): boolean {
  return SEEKABLE_PATH.test(pathname);
}

/** Twitch swaps the `<video>` on SPA navigation, so look it up on every use instead of caching it. */
export function findPlayerVideo(): HTMLVideoElement | undefined {
  let largest: HTMLVideoElement | undefined;
  let largestArea = 0;
  for (const video of document.querySelectorAll("video")) {
    const { height, width } = video.getBoundingClientRect();
    if (width * height > largestArea) {
      largest = video;
      largestArea = width * height;
    }
  }
  return largest;
}

/** Whether the key belongs to the focused control or an IME composition rather than the player. */
export function ownsKeyboard(event: KeyboardEvent): boolean {
  if (event.isComposing || event.key === "Process") return true;
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !KEYLESS_INPUT_TYPES.has(target.type);
}

/** Returns the new playback position, clamped inside the video. */
export function seekTarget(currentTime: number, duration: number, offset: SeekOffset): number {
  const delta = offset.direction === "backward" ? -offset.seconds : offset.seconds;
  // Twitch ignores a seek to exactly 0 and bounces back from the very end.
  const target = Math.min(Math.max(currentTime + delta, 0.001), Math.max(duration - 1, 0.001));
  // Within the last second, a forward seek holds still instead of stepping back.
  return delta > 0 ? Math.max(target, currentTime) : target;
}

/** Returns whether the playback position moved. */
export function seek(video: HTMLVideoElement, offset: SeekOffset): boolean {
  const target = seekTarget(video.currentTime, video.duration, offset);
  if (target === video.currentTime) return false;
  video.currentTime = target;
  return true;
}
