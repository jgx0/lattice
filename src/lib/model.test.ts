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
