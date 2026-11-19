import type { Heading, Note, VaultFile } from '../types';
import { createMarkdown, plainInline, splitFrontmatter, stripComments } from './markdown';
import { basename, decodeTarget, dirname, headingAnchor, normalizePath, noteHref, slugify, stripExtension, uniqueHeadingId } from './utils';
import { findNoteCandidate, getNoteIndex, notePathKey } from './noteIndex';

export { slugify } from './utils';
export { invalidateNoteIndex } from './noteIndex';
const markdown = createMarkdown();

export function buildNotes(files: VaultFile[]): Note[] {
  const usedSlugs = new Set<string>();
  return files.filter(file => file.kind === 'note').map(file => {
    const path = normalizePath(file.path);
    const { body, properties } = splitFrontmatter(file.content);
    const tokens = markdown.parse(stripComments(body), {});
    const headings: Heading[] = [];
    const links = new Set<string>();
    const tags = new Set<string>();
    const seenIds = new Map<string, number>();
    const prose: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'heading_open') {
        const text = plainInline(tokens[i + 1]?.content ?? '').replace(/\s+\^[\w-]+\s*$/, '');
        headings.push({ level: Number(token.tag.slice(1)), text, id: uniqueHeadingId(text, seenIds) });
      }
      if (token.type !== 'inline') continue;
      const children = token.children ?? [];
      for (const child of children) {
        if (child.type === 'link_open') {
          const href = child.attrGet('href');
          if (href && !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) links.add(decodeTarget(href));
        }
        if (child.type === 'text') {
          const text = child.content;
          for (const match of text.matchAll(/!?\[\[([^\]\n]+)\]\]/g)) links.add(match[1].split('|')[0].trim());
          for (const match of text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_/-]+)/gu)) {
            if (/[\p{L}_/-]/u.test(match[1])) tags.add(match[1]);
          }
          prose.push(plainInline(text));
        } else if (child.type === 'code_inline') prose.push(child.content);
      }
    }
    const propertyTags = properties.tags ?? properties.tag;
    for (const tag of Array.isArray(propertyTags) ? propertyTags : typeof propertyTags === 'string' ? propertyTags.split(/[,\s]+/) : []) {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim().replace(/^#/, ''));
    }
    const baseSlug = stripExtension(path).split('/').map(slugify).join('/');
    let slug = baseSlug;
    let suffix = 1;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);
    return {
      path, title: typeof properties.title === 'string' && properties.title.trim() ? properties.title : stripExtension(basename(path)),
      slug, folder: dirname(path), content: file.content, body, properties, headings,
      links: [...links], tags: [...tags], words: prose.join(' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0,
    };
  });
}

export function resolveNote(target: string, notes: Note[], currentPath?: string): Note | undefined {
  const original = decodeTarget(target.trim().replace(/^!?\[\[|\]\]$/g, '').split('|')[0].split('#')[0]);
  if (!original) return currentPath ? getNoteIndex(notes).selfPaths.get(normalizePath(currentPath)) : undefined;
  if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(original)) return undefined;
  const relative = /^\.\.?\//.test(original);
  const rooted = original.startsWith('/');
  const path = normalizePath(original);
  // Resolve explicit relative paths before normalizing away their parent segments.
  const localPath = normalizePath(`${currentPath ? dirname(currentPath) : ''}/${original}`);
  const index = getNoteIndex(notes);
  const find = (value: string) => index.paths.get(notePathKey(value));
  if (relative) return find(localPath);
  if (rooted) return find(path);
  const exact = find(path);
  if (exact) return exact;
  if (currentPath) {
    const local = find(localPath);
    if (local) return local;
  }
  return findNoteCandidate(index, path, currentPath ? dirname(currentPath).split('/') : []);
}

export function resolveLink(target: string, notes: Note[], currentPath?: string): { note?: Note; anchor: string; href: string } {
  const clean = target.trim().replace(/^!?\[\[|\]\]$/g, '').split('|')[0];
  const hash = clean.indexOf('#');
  const note = resolveNote(clean, notes, currentPath);
  const fragment = hash < 0 ? '' : clean.slice(hash + 1);
  const anchor = headingAnchor(fragment, note?.headings ?? []);
  return { note, anchor, href: note ? noteHref(note.slug, anchor) : '#' };
}

export function getBacklinks(note: Note, notes: Note[]): Note[] {
  const index = getNoteIndex(notes);
  if (!index.backlinks) {
    const backlinks = new Map<string, Note[]>();
    for (const candidate of notes) {
      const targets = new Set<string>();
      for (const link of candidate.links) {
        const target = resolveNote(link, notes, candidate.path);
        if (target && target.path !== candidate.path) targets.add(target.path);
      }
      for (const path of targets) {
        const sources = backlinks.get(path);
        if (sources) sources.push(candidate);
        else backlinks.set(path, [candidate]);
      }
    }
    index.backlinks = backlinks;
  }
  // Keep the original fresh-array contract: callers cannot mutate cached lists.
  return index.backlinks.get(note.path)?.slice() ?? [];
}

export { searchNotes } from './search';
