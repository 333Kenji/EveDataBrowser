import React from 'react';
import { useMarketBrowserStore } from './marketBrowserStore';

/**
 * Parses limited HTML string and converts <a href="showinfo:TYPEID">label</a> into interactive buttons.
 * All other tags are stripped (text content preserved) to avoid XSS; script/style tags removed entirely.
 */
export function useParsedShowInfo(raw?: string): Array<string | JSX.Element> | null {
  const setActiveType = useMarketBrowserStore((s) => s.setActiveType);
  if (!raw) return null;
  // Strip script/style tags completely
  const sanitized = raw.replace(/<\/(?:script|style)>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  const parts: Array<string | JSX.Element> = [];
  const regex = /<a[^>]*href="?showinfo:(\d+)"?[^>]*>(.*?)<\/a>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sanitized)) !== null) {
    const [full, typeId, label] = match;
    if (match.index > lastIndex) parts.push(sanitized.slice(lastIndex, match.index));
    parts.push(
      <button
        key={`${typeId}-${match.index}`}
        onClick={() => setActiveType(String(typeId))}
        className="item-detail__link"
        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-color, #58a6ff)', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {label}
      </button>,
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < sanitized.length) parts.push(sanitized.slice(lastIndex));
  // Remove any remaining angle-bracket sequences to prevent accidental tag rendering
  return parts.map(p => typeof p === 'string' ? p.replace(/<[^>]+>/g, '') : p);
}
