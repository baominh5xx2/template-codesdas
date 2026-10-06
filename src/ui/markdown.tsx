import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown subset for MarkdownBlock: headings (###/####), paragraphs, bullet and
 * numbered lists, **bold**, *italic* and `code`. Everything renders as React text nodes — no HTML
 * from the payload is ever injected.
 */
export function renderMarkdown(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length) out.push(<p key={out.length}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, index) => <li key={index}>{inline(item)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      out.push(level <= 3 ? <h3 key={out.length}>{inline(heading[2])}</h3> : <h4 key={out.length}>{inline(heading[2])}</h4>);
      continue;
    }
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph(); flushList();
  return out;
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) parts.push(<code key={index}>{token.slice(1, -1)}</code>);
    else parts.push(<em key={index}>{token.slice(1, -1)}</em>);
    last = index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
