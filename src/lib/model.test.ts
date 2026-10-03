import { describe, expect, it } from 'vitest';
import type { VaultFile } from '../types';
import { buildNotes, getBacklinks, resolveLink, resolveNote, searchNotes, slugify } from './model';

const noteFile = (path: string, content: string): VaultFile => ({ path, content, kind: 'note' });
const files = [
  noteFile('Welcome.md', '---\ntitle: Garden\naliases: [Start]\ntags: [garden, topic/deep]\n---\n# Welcome\n## **Same** heading\n## Same heading\nSetext\n------\nHello World #inline/tag [[Projects/Alpha#Plan|project]] [Beta](Projects/Beta.md)\n`[[Ignored]]`\n```md\n# Not a heading\n[[Ignored]] #ignored\n```'),
  noteFile('Projects/Alpha.md', '---\nstatus: active\n---\n# Alpha\n## Plan\nhello world [[../Welcome#^intro]]'),
  noteFile('Projects/Beta.md', '# Beta\nHELLO WORLD #garden [[Alpha]]'),
  noteFile('Archive/Alpha.md', '# Other Alpha\narchived'),
  { path: 'assets/image.png', content: '', kind: 'asset' as const },
];
const notes = buildNotes(files);

describe('note model', () => {
  it('parses YAML, ATX and setext headings, inline links and tags but excludes code', () => {
    const welcome = notes[0];
    expect(notes).toHaveLength(4);
    expect(welcome.title).toBe('Garden');
    expect(welcome.body.startsWith('# Welcome')).toBe(true);
    expect(welcome.headings.map(heading => heading.id)).toEqual(['welcome', 'same-heading', 'same-heading-1', 'setext']);
    expect(welcome.links).toEqual(['Projects/Alpha#Plan', 'Projects/Beta.md']);
    expect(welcome.tags).toEqual(['inline/tag', 'garden', 'topic/deep']);
    expect(welcome.words).toBeGreaterThan(5);
  });
  it('does not count Markdown-looking lines inside display math as headings', () => {
    const [note] = buildNotes([noteFile('math.md', '$$\n# not a heading\n$$\n\n## Actual')]);
    expect(note.headings.map(heading => heading.text)).toEqual(['Actual']);
  });
  it('keeps invalid frontmatter visible', () => {
    const [note] = buildNotes([noteFile('bad.md', '---\na: [\n---\nContent')]);
    expect(note.properties).toEqual({});
    expect(note.body).toContain('a: [');
  });
  it('resolves absolute, local, relative, aliases, encoded names and self links', () => {
    expect(resolveNote('Alpha', notes, 'Projects/Beta.md')?.path).toBe('Projects/Alpha.md');
    expect(resolveNote('../Welcome.md', notes, 'Projects/Alpha.md')?.title).toBe('Garden');
    expect(resolveNote('Start', notes)?.path).toBe('Welcome.md');
    expect(resolveNote('/Archive/Alpha.md', notes)?.path).toBe('Archive/Alpha.md');
    expect(resolveNote('#Plan', notes, 'Projects/Alpha.md')?.path).toBe('Projects/Alpha.md');
    expect(resolveNote('https://example.com', notes)).toBeUndefined();
    expect(resolveNote('missing', notes)).toBeUndefined();
  });
  it('uses shared precise heading and block anchors and Note[] backlinks', () => {
    expect(resolveLink('Welcome#Same heading', notes)).toMatchObject({ anchor: 'same-heading', href: '#/welcome?anchor=same-heading' });
    expect(resolveLink('Welcome#same-heading-1', notes).anchor).toBe('same-heading-1');
    expect(resolveLink('Welcome#^intro', notes).anchor).toBe('intro');
    expect(getBacklinks(notes[1], notes).map(note => note.path)).toEqual(['Welcome.md', 'Projects/Beta.md']);
  });
  it('normalizes Unicode and makes duplicate note slugs unique', () => {
