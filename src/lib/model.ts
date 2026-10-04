import type { Heading, Note, VaultFile } from '../types';
import { createMarkdown, plainInline, splitFrontmatter, stripComments } from './markdown';
import { basename, decodeTarget, dirname, headingAnchor, normalizePath, noteHref, slugify, stripExtension, uniqueHeadingId } from './utils';

export { slugify } from './utils';
const markdown = createMarkdown();

function aliases(note: Note): string[] {
  const value = note.properties.aliases ?? note.properties.alias;
  return (Array.isArray(value) ? value : value == null ? [] : [value]).filter(item => typeof item === 'string');
}

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
