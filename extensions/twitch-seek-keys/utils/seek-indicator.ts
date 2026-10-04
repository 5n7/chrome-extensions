import { formatOffset, type SeekOffset } from "./seek-bindings";

const VISIBLE_MS = 600;

/**
 * A plain element with inline `px` styles: it renders over Twitch's own DOM,
 * so it carries no page-level CSS and no Tailwind.
 */
export function createSeekIndicator() {
  const element = document.createElement("twitch-seek-keys-indicator");
  Object.assign(element.style, {
    background: "rgba(0, 0, 0, 0.7)",
    borderRadius: "8px",
    color: "#fff",
    font: "600 20px/1 system-ui, sans-serif",
    padding: "10px 16px",
    pointerEvents: "none",
    position: "fixed",
    transform: "translate(-50%, -50%)",
    transition: "opacity 150ms",
    zIndex: "2147483647",
  });
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    show(video: HTMLVideoElement, offset: SeekOffset) {
      const rect = video.getBoundingClientRect();
      element.textContent = formatOffset(offset);
      element.style.left = `${rect.left + rect.width / 2}px`;
      element.style.top = `${rect.top + rect.height / 2}px`;
      element.style.opacity = "1";
      // Only the fullscreen element's subtree renders while fullscreen.
      const parent = document.fullscreenElement ?? document.body;
      if (element.parentElement !== parent) parent.append(element);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        element.style.opacity = "0";
      }, VISIBLE_MS);
    },
    remove() {
      clearTimeout(hideTimer);
      element.remove();
    },
  };
}
