// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { VaultFile } from '../types';
import { buildNotes } from './model';
import { renderMarkdown, renderPreview } from './render';

function render(source: string, extra: VaultFile[] = []) {
  const files: VaultFile[] = [{ path: 'Host.md', kind: 'note', content: source }, ...extra];
  const notes = buildNotes(files);
  const html = renderMarkdown(notes[0], notes, files);
  const document = new DOMParser().parseFromString(html, 'text/html');
  return { html, document, notes, files };
}

describe('Obsidian rendering', () => {
  it('shares heading IDs, removes comments, supports footnotes, highlights and read-only tasks', () => {
    const { html, document, notes } = render('# **Title**\n## Repeat\n## Repeat\nParagraph ^para\n\n- [x] Done\n- [ ] Pending\n\n==highlight== and note[^a]\n\n[^a]: A footnote\n\n%% hidden %%');
    expect([...document.querySelectorAll('h1,h2')].map(element => element.id)).toEqual(notes[0].headings.map(heading => heading.id));
    expect(document.getElementById('para')?.textContent).toBe('Paragraph');
    expect(document.querySelector('mark')?.textContent).toBe('highlight');
    expect(document.querySelectorAll('input[disabled][aria-label]')).toHaveLength(2);
    expect(document.querySelectorAll('input[checked]')).toHaveLength(1);
    expect(html).toContain('footnote');
    expect(html).not.toContain('hidden');
  });
  it('renders callouts including folds and nested content without leaking marker text', () => {
    const { document, html } = render('> [!warning]- **Careful**\n> Body\n>\n> > [!tip]+\n> > Nested\n\n> [!custom]\n> Custom content');
    expect(document.querySelector('details[data-callout="warning"]')?.hasAttribute('open')).toBe(false);
    expect(document.querySelector('details[data-callout="tip"]')?.hasAttribute('open')).toBe(true);
    expect(document.querySelector('summary strong')?.textContent).toBe('Careful');
    expect(document.querySelector('aside[data-callout="custom"]')?.textContent).toContain('Custom content');
    expect(html).not.toContain('[!');
  });
  it('renders inline/block math with bundled KaTeX', () => {
    const { document } = render('$x^2$ and \\(y+1\\)\n\n$$\n\\frac{1}{2}\n$$\n\n\\[z^3\\]');
    expect(document.querySelectorAll('.katex')).toHaveLength(4);
    expect(document.querySelectorAll('.katex-display')).toHaveLength(2);
  });
  it('resolves wiki/Markdown links and heading/block transclusions, limits cycles', () => {
