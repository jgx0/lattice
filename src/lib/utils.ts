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
