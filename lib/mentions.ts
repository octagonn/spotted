/**
 * Caption/comment @mention parsing. Splits text into plain and mention
 * segments so render sites can make handles tappable (→ /user/[handle]).
 *
 * Rules: a mention starts at "@" preceded by start-of-string or a
 * non-word character (so emails like a@b.com are NOT mentions), the handle is
 * [A-Za-z0-9_.]+ with trailing dots trimmed (sentence punctuation).
 */
export type MentionSegment = { text: string; handle: string | null };

const MENTION = /(^|[^A-Za-z0-9_.])@([A-Za-z0-9_.]+)/g;

export function splitMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;
  MENTION.lastIndex = 0;
  for (let match = MENTION.exec(text); match; match = MENTION.exec(text)) {
    const lead = match[1];
    let handle = match[2];
    // Trailing dots are sentence punctuation, not part of the handle.
    const trimmed = handle.replace(/\.+$/, "");
    if (!trimmed) continue;
    handle = trimmed;
    const start = match.index + lead.length;
    const end = start + 1 + handle.length; // "@" + handle
    if (start > cursor) segments.push({ text: text.slice(cursor, start), handle: null });
    segments.push({ text: `@${handle}`, handle });
    cursor = end;
    // Re-scan from the end of the trimmed handle so ".." after it stays text.
    MENTION.lastIndex = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), handle: null });
  return segments.length ? segments : [{ text, handle: null }];
}

/** True when the text contains at least one mention. */
export function hasMentions(text: string): boolean {
  return splitMentions(text).some((seg) => seg.handle !== null);
}
