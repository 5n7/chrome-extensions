export type Part =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "emote";
      readonly code: string;
      readonly src: string;
      readonly aspect: number;
    };

export type Emote = Extract<Part, { kind: "emote" }>;

export type EmoteIndex = ReadonlyMap<string, Emote>;

const COMMENT_LIMIT = 50;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function isCommand(parts: readonly Part[]): boolean {
  const first = parts[0];
  return first?.kind === "text" && first.text.trimStart().startsWith("!");
}

export function toComment(parts: readonly Part[], emotes: EmoteIndex): Part[] | undefined {
  const shown = truncate(applyEmotes(collapseSpace(parts), emotes), COMMENT_LIMIT);
  return shown.length > 0 ? shown : undefined;
}

function collapseSpace(parts: readonly Part[]): Part[] {
  const out: Part[] = [];
  for (const part of parts) {
    if (part.kind === "emote") {
      out.push(part);
      continue;
    }
    const text = part.text.replaceAll(/\s+/g, " ");
    const last = out.at(-1);
    if (last?.kind === "text") out[out.length - 1] = { kind: "text", text: last.text + text };
    else out.push({ kind: "text", text });
  }
  const first = out[0];
  if (first?.kind === "text") out[0] = { kind: "text", text: first.text.trimStart() };
  const last = out.at(-1);
  if (last?.kind === "text") out[out.length - 1] = { kind: "text", text: last.text.trimEnd() };
  return out.filter((part) => part.kind === "emote" || part.text !== "");
}

export function applyEmotes(parts: readonly Part[], emotes: EmoteIndex): Part[] {
  if (emotes.size === 0) return [...parts];
  const out: Part[] = [];
  let text = "";
  for (const part of parts) {
    if (part.kind === "emote") {
      if (text) out.push({ kind: "text", text });
      text = "";
      out.push(part);
      continue;
    }
    for (const piece of part.text.split(/(\s+)/)) {
      const emote = emotes.get(piece);
      if (!emote) {
        text += piece;
        continue;
      }
      if (text) out.push({ kind: "text", text });
      text = "";
      out.push(emote);
    }
  }
  if (text) out.push({ kind: "text", text });
  return out;
}

export function truncate(parts: readonly Part[], limit: number): Part[] {
  const out: Part[] = [];
  let left = limit;
  for (const part of parts) {
    if (part.kind === "emote") {
      if (left === 0) return withEllipsis(out);
      out.push(part);
      left--;
      continue;
    }
    const graphemes = Array.from(segmenter.segment(part.text), (s) => s.segment);
    if (graphemes.length <= left) {
      out.push(part);
      left -= graphemes.length;
      continue;
    }
    if (left > 0) out.push({ kind: "text", text: graphemes.slice(0, left).join("") });
    return withEllipsis(out);
  }
  return out;
}

function withEllipsis(parts: Part[]): Part[] {
  const last = parts.at(-1);
  if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: `${last.text}…` };
  else parts.push({ kind: "text", text: "…" });
  return parts;
}

export function plainText(parts: readonly Part[]): string {
  return parts.map((part) => (part.kind === "text" ? part.text : part.code)).join("");
}
