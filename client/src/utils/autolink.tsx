import { Fragment } from 'react';

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

export function autolink(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE);
  while ((m = re.exec(text)) !== null) {
    const url = m[1];
    const start = m.index;
    if (start > lastIdx) parts.push(text.slice(lastIdx, start));
    parts.push(
      <a key={`${start}-${url}`} href={url} target="_blank" rel="noopener noreferrer" className="autolink">
        {url}
      </a>
    );
    lastIdx = start + url.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const re = new RegExp(URL_RE);
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    seen.add(m[1]);
  }
  return [...seen];
}

export function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname}${path}`.slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}
