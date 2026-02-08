import React from 'react';

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Parses markdown-style links in a plain text string and returns React nodes.
 * Non-link text is kept as-is; `[text](url)` becomes a clickable `<a>`.
 */
export function renderLinkedText(
  text: string,
  options?: { stopPropagation?: boolean; className?: string },
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(LINK_RE.source, LINK_RE.flags);

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const linkText = match[1];
    const href = match[2];
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={options?.className ?? 'text-blue-600 dark:text-blue-400 underline cursor-pointer'}
        onClick={options?.stopPropagation ? (e) => e.stopPropagation() : undefined}
      >
        {linkText}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}
