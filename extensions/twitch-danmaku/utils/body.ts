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

function appendText(parts: Part[], text: string): void {
  const last = parts.at(-1);
  if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + text };
  else parts.push({ kind: "text", text });
}

function collapseSpace(parts: readonly Part[]): Part[] {
  const merged: Part[] = [];
  for (const part of parts) {
    if (part.kind === "emote") merged.push(part);
    else appendText(merged, part.text);
  }
  const last = merged.length - 1;
  return merged.flatMap((part, index): Part[] => {
    if (part.kind === "emote") return [part];
    let text = part.text.replaceAll(/\s+/g, " ");
    if (index === 0) text = text.trimStart();
    if (index === last) text = text.trimEnd();
    return text ? [{ kind: "text", text }] : [];
  });
}

export function applyEmotes(parts: readonly Part[], emotes: EmoteIndex): Part[] {
  if (emotes.size === 0) return [...parts];
  const out: Part[] = [];
  for (const part of parts) {
    if (part.kind === "emote") {
      out.push(part);
      continue;
    }
    for (const piece of part.text.split(/(\s+)/)) {
      const emote = emotes.get(piece);
      if (emote) out.push(emote);
      else if (piece) appendText(out, piece);
    }
  }
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
  appendText(parts, "…");
  return parts;
}

export function plainText(parts: readonly Part[]): string {
  return parts.map((part) => (part.kind === "text" ? part.text : part.code)).join("");
}
