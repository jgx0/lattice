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
    const page = /#page=(\d+)/i.exec(target)?.[1];
    // Keep an exact URL allowlist: PDF fragment navigation is handled by the viewer itself.
    const iframe = `<iframe class="pdf-embed" src="${escapeHtml(source)}" data-pdf-capability="${capability}" title="${escapeHtml(label)}" width="100%" height="600"${page ? ` data-page="${page}"` : ''}></iframe>`;
    return `<div class="pdf-embed-wrapper">${iframe}<a class="asset-embed pdf-embed-link" href="${escapeHtml(source)}" download="${escapeHtml(basename(file.path))}">Download ${escapeHtml(label)}</a></div>`;
  }
  return `<span class="embed-unsupported">Unsupported asset: ${escapeHtml(target)}</span>`;
}
function mathHtml(source: string, displayMode: boolean): string {
  try { return katex.renderToString(source, { displayMode, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000, output: 'htmlAndMathml' }); }
  catch { return `<span class="math-error">${escapeHtml(source)}</span>`; }
}
function missingLink(target: string, label: string): string {
  return `<a class="internal-link is-unresolved" data-note="${escapeHtml(target.split('#')[0])}" data-anchor="" href="#" aria-disabled="true">${escapeHtml(label)}</a>`;
}
function wikiHtml(content: string, embed: boolean, context: RenderContext): string {
  const pipe = content.indexOf('|');
  const target = (pipe < 0 ? content : content.slice(0, pipe)).trim();
  const alias = pipe < 0 ? '' : content.slice(pipe + 1).trim();
  const label = alias || target.replace(/\.md(?=#|$)/i, '').replace(/^.*\//, '') || context.note.title;
  const file = resolveFile(target, context);
  if (embed && file?.kind === 'base') {
    return `<div class="base-embed" data-base="${escapeHtml(file.path)}">${renderBase(file.content, context.notes, context.note)}</div>`;
  }
  const link = resolveLink(target, context.notes, context.note.path);
  if (file?.kind === 'asset') {
    if (embed) return assetHtml(file, alias, target, context);
    const source = assetSource(file);
    if (!/^data:(?:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf);base64,[a-z0-9+/=]+$/i.test(source)) {
      return `<span class="asset-link">${escapeHtml(label)}</span>`;
    }
    return `<a class="asset-link" href="${escapeHtml(source)}" download="${escapeHtml(basename(file.path))}">${escapeHtml(label)}</a>`;
  }
  if (!link.note) return embed ? `<span class="embed-missing">Missing embed: ${escapeHtml(target)}</span>` : missingLink(target, label);
  if (!embed) return internalLink(link.note.path, link.note.slug, label, link.anchor);
  const key = `${link.note.path}#${link.anchor}`;
  if (context.depth >= MAX_EMBED_DEPTH || context.stack.includes(key)) {
    return `<span class="embed-limit">${internalLink(link.note.path, link.note.slug, label, link.anchor)} (embed recursion limit)</span>`;
  }
  const markdown = transclusionBody(link.note, target);
  if (markdown === undefined) return `<span class="embed-missing">Missing section: ${escapeHtml(target)}</span>`;
  const nested: RenderContext = { ...context, note: link.note, depth: context.depth + 1, stack: [...context.stack, key] };
  const rendered = renderBody(markdown, nested, headingOffset(link.note, markdown));
  return `<div class="note-embed" data-note="${escapeHtml(link.note.path)}" data-anchor="${escapeHtml(link.anchor)}"><div class="note-embed-title">${internalLink(link.note.path, link.note.slug, alias || link.note.title, link.anchor)}</div><div class="note-embed-content">${rendered}</div></div>`;
}

function transclusionBody(note: Note, target: string): string | undefined {
  const fragment = decodeTarget(target.slice(target.indexOf('#') + 1));
  if (!target.includes('#') || !fragment.trim()) return note.body;
  const tokens = createMarkdown().parse(stripComments(note.body), {});
  const lines = note.body.replace(/\r\n?/g, '\n').split('\n');
  if (fragment.startsWith('^')) {
    const range = findBlockRange(tokens, fragment.slice(1));
    return range ? lines.slice(...range).join('\n') : undefined;
  }
  const link = resolveLink(`#${fragment}`, [note], note.path);
  const headingIndex = note.headings.findIndex(heading => heading.id === link.anchor);
  if (headingIndex < 0) return undefined;
  const headings = tokens.filter(token => token.type === 'heading_open' && token.map);
  const heading = headings[headingIndex];
  if (!heading?.map) return undefined;
  const level = Number(heading.tag.slice(1));
  const next = headings.slice(headingIndex + 1).find(token => Number(token.tag.slice(1)) <= level);
  return lines.slice(heading.map[0], next?.map?.[0] ?? lines.length).join('\n');
}
function headingOffset(note: Note, body: string): number {
  const offset = note.body.indexOf(body);
  if (offset <= 0) return 0;
  return createMarkdown().parse(stripComments(note.body.slice(0, offset)), {}).filter(token => token.type === 'heading_open').length;
}

function configureMarkdown(context: RenderContext): MarkdownIt {
  const md = createMarkdown();
  md.inline.ruler.before('link', 'obsidian_wikilink', (state, silent) => {
    const start = state.pos;
    const embed = state.src.startsWith('![[', start);
    if (!embed && !state.src.startsWith('[[', start)) return false;
    const end = state.src.indexOf(']]', start + (embed ? 3 : 2));
    if (end < 0 || state.src.slice(start, end).includes('\n')) return false;
    if (!silent) {
      const token = state.push('obsidian_wiki', '', 0);
      token.content = state.src.slice(start + (embed ? 3 : 2), end);
      token.meta = { embed };
    }
    state.pos = end + 2; return true;
  });
  md.renderer.rules.obsidian_wiki = (tokens, index) => wikiHtml(tokens[index].content, tokens[index].meta.embed, context);
  md.block.ruler.before('paragraph', 'obsidian_embed', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
    const match = /^!\[\[([^\]\n]+)\]\]\s*$/.exec(line);
    if (!match) return false;
    if (!silent) { const token = state.push('obsidian_embed', '', 0); token.content = match[1]; token.map = [start, start + 1]; }
    state.line = start + 1; return true;
  });
  md.renderer.rules.obsidian_embed = (tokens, index) => `${wikiHtml(tokens[index].content, true, context)}\n`;
  md.inline.ruler.after('escape', 'obsidian_math', (state, silent) => {
    const start = state.pos;
    const bracket = state.src.startsWith('\\(', start);
    if (!bracket && (state.src[start] !== '$' || state.src[start + 1] === '$' || /\s/.test(state.src[start + 1] ?? ' '))) return false;
    const close = bracket ? '\\)' : '$';
    let end = start + (bracket ? 2 : 1);
    while ((end = state.src.indexOf(close, end)) >= 0) {
      if (state.src[end - 1] !== '\\' && (bracket || !/\s/.test(state.src[end - 1]))) break;
      end += close.length;
    }
    if (end < 0 || state.src.slice(start, end).includes('\n') || !bracket && /\d/.test(state.src[end + 1] ?? '')) return false;
    if (!silent) { const token = state.push('obsidian_math_inline', '', 0); token.content = state.src.slice(start + (bracket ? 2 : 1), end); }
    state.pos = end + close.length; return true;
  });
  // Run before escapes so the \(...\) spelling remains available.
  md.inline.ruler.before('escape', 'obsidian_bracket_math', (state, silent) => {
    if (!state.src.startsWith('\\(', state.pos)) return false;
    const end = state.src.indexOf('\\)', state.pos + 2);
    if (end < 0) return false;
    if (!silent) { const token = state.push('obsidian_math_inline', '', 0); token.content = state.src.slice(state.pos + 2, end); }
    state.pos = end + 2; return true;
  });
  md.renderer.rules.obsidian_math_inline = (tokens, index) => mathHtml(tokens[index].content, false);
  md.renderer.rules.obsidian_math_block = (tokens, index) => `${mathHtml(tokens[index].content, true)}\n`;
  md.inline.ruler.before('emphasis', 'obsidian_highlight', (state, silent) => {
    if (!state.src.startsWith('==', state.pos)) return false;
    const end = state.src.indexOf('==', state.pos + 2);
    if (end <= state.pos + 2) return false;
    if (!silent) {
      state.push('mark_open', 'mark', 1);
      const children = md.parseInline(state.src.slice(state.pos + 2, end), state.env)[0].children ?? [];
      state.tokens.push(...children);
      state.push('mark_close', 'mark', -1);
    }
    state.pos = end + 2; return true;
  });
  const defaultLink = md.renderer.rules.link_open ?? ((tokens, index, options, _env, renderer) => renderer.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index]; const href = token.attrGet('href') ?? '';
    if (!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) {
      const link = resolveLink(href, context.notes, context.note.path);
      if (link.note) {
        token.attrSet('class', 'internal-link'); token.attrSet('data-note', link.note.path);
        token.attrSet('data-anchor', link.anchor); token.attrSet('href', link.href);
      } else {
        const file = resolveFile(href, context);
        if (file?.kind === 'asset') {
          const source = assetSource(file);
          if (/^data:application\/pdf;/i.test(source)) { token.attrSet('class', 'pdf-embed-link'); token.attrSet('href', source); token.attrSet('download', basename(file.path)); }
          else token.attrSet('href', '#');
        } else if (!href.startsWith('#fn')) {
          token.attrSet('class', 'internal-link is-unresolved'); token.attrSet('href', '#'); token.attrSet('aria-disabled', 'true');
        }
      }
    }
    return defaultLink(tokens, index, options, env, renderer);
  };
  const defaultImage = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index]; const source = token.attrGet('src') ?? '';
    const file = resolveFile(source, context);
    if (file?.kind === 'asset') return assetHtml(file, token.content, source, context);
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, index, options, env, renderer);
  };
  return md;
}

function decorateTokens(tokens: Token[], md: MarkdownIt, context: RenderContext, offset: number): void {
  const seen = new Map<string, number>();
  for (const heading of context.note.headings.slice(0, offset)) {
    // IDs can contain numeric suffixes; derive counts from text, not ID spelling.
    uniqueHeadingId(heading.text, seen);
  }
  const ancestors: number[] = [];
  const callouts: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = plainInline(inline?.content ?? '').replace(/\s+\^[A-Za-z0-9-]+\s*$/, '');
      token.attrSet('id', uniqueHeadingId(text, seen));
    }
    if (token.type === 'blockquote_open') {
      callouts.push(i);
      const inline = tokens[i + 2];
      const match = inline?.type === 'inline' ? /^\[!([^\]\n]+)\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n|$)/.exec(inline.content) : null;
      if (match) {
        const type = match[1].toLowerCase().replace(/[^a-z0-9-]/g, '') || 'note';
        const title = match[3]?.trim() || type.replace(/-/g, ' ').replace(/^./, value => value.toUpperCase());
        token.meta = { callout: true, type, title: md.renderInline(title), fold: match[2] };
        inline.content = inline.content.slice(match[0].length);
        inline.children = md.parseInline(inline.content, {})[0].children;
        if (!inline.content) {
          tokens[i + 1].hidden = true; inline.hidden = true; inline.children = []; tokens[i + 3].hidden = true;
        }
      }
    }
    if (token.type === 'blockquote_close') {
      const opening = callouts.pop();
      if (opening != null && tokens[opening].meta?.callout) token.meta = tokens[opening].meta;
    }
    if (token.nesting === 1) ancestors.push(i);
    if (token.type === 'inline') {
      const marker = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/.exec(token.content);
      if (marker && token.children?.at(-1)?.type === 'text' && token.children.at(-1)!.content.endsWith(`^${marker[1]}`)) {
        const id = marker[1];
        let opening = ancestors.at(-1);
        if (token.content.trim() === `^${id}`) {
          const range = findBlockRange(tokens, id);
          const previous = range ? tokens.findIndex(item => item.block && item.map?.[0] === range[0]
            && item.map[1] <= token.map![0]) : -1;
          if (previous >= 0) opening = previous;
          if (ancestors.at(-1) !== undefined) tokens[ancestors.at(-1)!].hidden = true;
          token.hidden = true; if (tokens[i + 1]?.type === 'paragraph_close') tokens[i + 1].hidden = true;
        } else {
          const container = ancestors.find(index => ['bullet_list_open', 'ordered_list_open', 'blockquote_open', 'table_open'].includes(tokens[index].type));
          if (container !== undefined) opening = container;
        }
        if (opening != null) {
          // A heading retains its heading ID; an empty span exposes its block ID separately.
          if (tokens[opening].type === 'heading_open') tokens[opening].meta = { ...tokens[opening].meta, blockId: id };
          else tokens[opening].attrSet('id', id);
        }
        token.content = token.content.slice(0, marker.index).trimEnd();
        token.children = md.parseInline(token.content, {})[0].children;
      }
      const task = /^\[([ xX])\][ \t]+/.exec(token.content);
      const parentListItem = [...ancestors].reverse().find(index => tokens[index].type === 'list_item_open');
      if (task && parentListItem !== undefined && tokens[i - 1]?.type === 'paragraph_open'
        && !tokens.slice(parentListItem + 1, i - 1).some(item => item.type === 'inline')) {
        tokens[parentListItem].attrJoin('class', 'task-list-item');
        const list = [...ancestors].reverse().find(index => ['bullet_list_open', 'ordered_list_open'].includes(tokens[index].type));
        if (list !== undefined) tokens[list].attrJoin('class', 'contains-task-list');
        token.content = token.content.slice(task[0].length);
        token.children = md.parseInline(token.content, {})[0].children ?? [];
        const checkbox = new Token('html_inline', '', 0);
        checkbox.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${task[1].toLowerCase() === 'x' ? ' checked' : ''} aria-label="${escapeHtml(plainInline(token.content) || 'Task')}"> `;
        token.children.unshift(checkbox);
      }
    }
    if (token.nesting === -1) ancestors.pop();
  }
  for (const type of ['fence', 'code_block']) {
    const original = md.renderer.rules[type]!;
    md.renderer.rules[type] = (items, index, options, env, renderer) => {
      const html = original(items, index, options, env, renderer);
      const id = items[index].attrGet('id');
      return id ? html.replace('<pre', `<pre id="${escapeHtml(id)}"`) : html;
    };
  }
  const open = md.renderer.rules.blockquote_open;
  const close = md.renderer.rules.blockquote_close;
  md.renderer.rules.blockquote_open = (items, index, options, env, renderer) => {
    const token = items[index];
    if (!token.meta?.callout) return open ? open(items, index, options, env, renderer) : renderer.renderToken(items, index, options);
    const { type, title, fold } = token.meta;
    const id = token.attrGet('id');
    const attrs = ` class="callout" data-callout="${escapeHtml(type)}"${id ? ` id="${escapeHtml(id)}"` : ''}`;
    return fold ? `<details${attrs}${fold === '+' ? ' open' : ''}><summary class="callout-title">${title}</summary><div class="callout-content">\n`
      : `<aside${attrs}><div class="callout-title">${title}</div><div class="callout-content">\n`;
  };
  md.renderer.rules.blockquote_close = (items, index, options, env, renderer) => items[index].meta?.callout
    ? `</div></${items[index].meta.fold ? 'details' : 'aside'}>\n`
    : close ? close(items, index, options, env, renderer) : renderer.renderToken(items, index, options);
  md.renderer.rules.heading_open = (items, index, options, _env, renderer) => {
    const id = items[index].meta?.blockId;
    return `${renderer.renderToken(items, index, options)}${id ? `<span id="${escapeHtml(id)}" class="block-anchor"></span>` : ''}`;
  };
}
function renderBody(body: string, context: RenderContext, offset = 0): string {
  const md = configureMarkdown(context);
  const env = {};
  const tokens = md.parse(stripComments(body), env);
  decorateTokens(tokens, md, context, offset);
  return md.renderer.render(tokens, md.options, env);
}

export function renderMarkdown(note: Note, notes: Note[], files: VaultFile[], sanitizers: Sanitizers = { sanitizeHtml, sanitizeSvg }): string {
  const pdfEmbeds = new Map<string, string>();
  const svgEmbeds = new Map<string, string>();
  return sanitizers.sanitizeHtml(renderBody(note.body, { note, notes, files, sanitizers, depth: 0, stack: [`${note.path}#`], pdfEmbeds, svgEmbeds }), pdfEmbeds, svgEmbeds);
}

/** Lightweight, sanitized excerpt: omit recursive embeds and trim at complete block boundaries. */
export function renderPreview(note: Note, notes: Note[], files: VaultFile[], sanitizers: Sanitizers = { sanitizeHtml, sanitizeSvg }): string {
  const tokens = createMarkdown().parse(stripComments(note.body), {});
  let end = 0;
  for (const token of tokens) {
    if (token.map) end = Math.max(end, token.map[1]);
    if (end && note.body.split('\n').slice(0, end).join('\n').length >= 600 && token.level === 0) break;
  }
  const body = note.body.split('\n').slice(0, end || 12).join('\n');
  const pdfEmbeds = new Map<string, string>();
  const svgEmbeds = new Map<string, string>();
  return sanitizers.sanitizeHtml(renderBody(body, { note, notes, files, sanitizers, depth: MAX_EMBED_DEPTH, stack: [], preview: true, pdfEmbeds, svgEmbeds }), pdfEmbeds, svgEmbeds);
}
