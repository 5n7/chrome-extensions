import type { Part } from "@/utils/body";

function face(background: string, mouth: string): Part {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect x="1" y="1" width="26" height="26" rx="8" fill="${background}" stroke="#18181b" stroke-width="2"/><circle cx="10" cy="11" r="2.2" fill="#18181b"/><circle cx="18" cy="11" r="2.2" fill="#18181b"/>${mouth}</svg>`;
  return {
    kind: "emote",
    code: "",
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    aspect: 1,
  };
}

const POG = face("#ffcf5a", '<ellipse cx="14" cy="19" rx="4" ry="4.5" fill="#18181b"/>');
const LUL = face("#9146ff", '<path d="M8 17Q14 24 20 17Z" fill="#18181b"/>');
const SAD = face(
  "#7fc6ff",
  '<path d="M9 21Q14 16 19 21" fill="none" stroke="#18181b" stroke-width="2"/>',
);
const KEK = face("#8ad46a", '<path d="M7 17H21Q20 23 14 23Q8 23 7 17Z" fill="#18181b"/>');

const text = (value: string): Part => ({ kind: "text", text: value });

const SAMPLES: readonly (readonly Part[])[] = [
  ...[
    "草",
    "wwwwww",
    "うますぎる",
    "GG",
    "888888",
    "今の見た？",
    "ナイス！",
    "それはずるい",
    "Clip it!",
    "えぐい反応速度",
    "初見です",
    "lol",
    "nice clutch",
    "かわいい",
    "LETS GOOO",
    "ｗｗｗｗｗｗｗｗｗ",
    "強すぎて草",
    "no way",
    "神プレイ",
    "おつ",
    "?????",
  ].map((sample) => [text(sample)]),
  [POG, POG],
  [text("今のは"), LUL],
  [KEK, text(" KEKW")],
  [SAD],
  [POG, text(" 大勝利")],
];

export function demoComment(random: () => number): readonly Part[] {
  return SAMPLES[Math.floor(random() * SAMPLES.length)]!;
}
