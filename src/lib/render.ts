import type MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import katex from 'katex';
import type { Note, VaultFile } from '../types';
import { renderBase } from './bases';
import { findBlockRange } from './blocks';
import { createMarkdown, plainInline, stripComments } from './markdown';
import { resolveLink, resolveNote } from './model';
import { sanitizeHtml, sanitizeSvg } from './sanitize';
import type { Sanitizers } from './sanitize';
import { basename, decodeTarget, dirname, escapeHtml, internalLink, normalizePath, uniqueHeadingId } from './utils';

const MAX_EMBED_DEPTH = 5;
export interface RenderContext {
  sanitizers: Sanitizers;
  note: Note;
  notes: Note[];
  files: VaultFile[];
  depth: number;
  stack: string[];
  preview?: boolean;
  pdfEmbeds: Map<string, string>;
  svgEmbeds: Map<string, string>;
}
const mimeTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf',
};
function resolveFile(target: string, context: RenderContext): VaultFile | undefined {
  const path = decodeTarget(target.split('#')[0].split('|')[0].trim());
  const local = normalizePath(`${dirname(context.note.path)}/${path}`);
  const normalized = normalizePath(path);
  const key = (value: string) => normalizePath(value).toLocaleLowerCase();
  const find = (value: string) => context.files.find(file => key(file.path) === key(value));
  if (/^\.\.?\//.test(path)) return find(local);
  if (path.startsWith('/')) return find(normalized);
  return find(normalized) ?? find(local)
    ?? context.files.filter(file => key(basename(file.path)) === key(basename(path)))
      .sort((a, b) => Number(dirname(b.path) === context.note.folder) - Number(dirname(a.path) === context.note.folder) || a.path.localeCompare(b.path))[0];
}
function assetSource(file: VaultFile): string {
  const mime = file.mime ?? mimeTypes[basename(file.path).split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
  const data = file.data ?? '';
  return data.startsWith('data:') ? data : data ? `data:${mime};base64,${data.replace(/\s/g, '')}` : '';
}
function assetHtml(file: VaultFile, alias: string, target: string, context: RenderContext): string {
  const source = assetSource(file);
  if (!source) return `<span class="embed-missing">Missing asset data: ${escapeHtml(file.path)}</span>`;
  const mime = file.mime ?? /^data:([^;,]+)/.exec(source)?.[1] ?? '';
  const dimensions = /^(\d+)(?:x(\d+))?$/.exec(alias);
  const size = dimensions ? ` width="${Math.min(Number(dimensions[1]), 4096)}"${dimensions[2] ? ` height="${Math.min(Number(dimensions[2]), 4096)}"` : ''}` : '';
  const label = dimensions ? basename(file.path) : alias || basename(file.path);
  if (mime === 'image/svg+xml') {
    try {
      const encoded = source.slice(source.indexOf(',') + 1);
      const svg = file.content.trim().startsWith('<svg') ? file.content
        : /^data:[^,]*;base64,/i.test(source) ? new TextDecoder().decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0))) : decodeURIComponent(encoded);
      const sanitized = context.sanitizers.sanitizeSvg(svg);
      if (!sanitized.includes('<svg')) throw new Error('Invalid SVG');
      const safeSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
      const capability = crypto.randomUUID();
      context.svgEmbeds.set(capability, safeSource);
      return `<img class="asset-embed" src="${escapeHtml(safeSource)}" data-svg-capability="${capability}" alt="${escapeHtml(label)}" loading="lazy"${size}>`;
    } catch { return `<span class="embed-unsupported">Invalid SVG: ${escapeHtml(file.path)}</span>`; }
  }
  if (mime.startsWith('image/')) return `<img class="asset-embed" src="${escapeHtml(source)}" alt="${escapeHtml(label)}" loading="lazy"${size}>`;
  if (mime.startsWith('audio/')) return `<audio class="asset-embed" controls preload="metadata" src="${escapeHtml(source)}" aria-label="${escapeHtml(label)}"></audio>`;
  if (mime.startsWith('video/')) return `<video class="asset-embed" controls preload="metadata" src="${escapeHtml(source)}" aria-label="${escapeHtml(label)}"${size}></video>`;
  if (mime === 'application/pdf' && /^data:application\/pdf;base64,[a-z0-9+/=]+$/i.test(source)) {
    const capability = crypto.randomUUID();
    context.pdfEmbeds.set(capability, source);
