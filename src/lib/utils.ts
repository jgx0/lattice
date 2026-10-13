import type { Heading } from '../types';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]!));
}

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(0, Math.max(0, normalized.lastIndexOf('/')));
}

export function basename(path: string): string {
  return normalizePath(path).split('/').pop() ?? '';
}

export function stripExtension(path: string): string {
  return path.replace(/\.(?:md|markdown)$/i, '');
}

export function decodeTarget(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Unicode is preserved; IDs are shared by metadata, links and rendered headings. */
export function slugify(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';
}

export function uniqueHeadingId(text: string, seen: Map<string, number>): string {
  const base = slugify(text);
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

export function headingAnchor(target: string, headings: Heading[]): string {
  const raw = decodeTarget(target).trim();
  if (!raw) return '';
  if (raw.startsWith('^')) return raw.slice(1);
  return headings.find(heading => heading.id === raw)?.id
    ?? headings.find(heading => heading.text.toLocaleLowerCase() === raw.toLocaleLowerCase())?.id
    ?? slugify(raw);
}

export function noteHref(slug: string, anchor = ''): string {
  return `#/${slug}${anchor ? `?anchor=${encodeURIComponent(anchor)}` : ''}`;
}

export function internalLink(path: string, slug: string, label: unknown, anchor = ''): string {
  return `<a class="internal-link" data-note="${escapeHtml(path)}" data-anchor="${escapeHtml(anchor)}" href="${escapeHtml(noteHref(slug, anchor))}">${escapeHtml(label)}</a>`;
}
