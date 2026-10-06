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
    const extra: VaultFile[] = [{ path: 'Other.md', kind: 'note', content: '# Other\n## Part\nFirst ^block\n\n## Other part\nNot included\n\n![[Host]]' }];
    const { document, html } = render('[[Other#Part|go]] [go too](Other.md#Part)\n\n![[Other#Part]]\n\n![[Other#^block]]\n\n![[Host]]', extra);
    expect(document.querySelectorAll('a[data-note="Other.md"][data-anchor="part"]')).toHaveLength(3);
    expect(document.querySelector('a')?.getAttribute('href')).toBe('#/other?anchor=part');
    expect(document.querySelector('.note-embed-content')?.textContent).toContain('First');
    expect(document.querySelector('.note-embed-content')?.textContent).not.toContain('Not included');
    expect(document.querySelector('[data-anchor="block"] #block')).not.toBeNull();
    expect(html).toContain('embed recursion limit');
  });
  it('anchors and transcludes standalone list/table/blockquote block references precisely', () => {
    const other = '- One\n- Two\n\n^list\n\n> Quote\n> Second\n\n^quote\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n^table';
    const { document } = render('![[Other#^list]]\n\n![[Other#^quote]]\n\n![[Other#^table]]', [{ path: 'Other.md', kind: 'note', content: other }]);
    expect(document.querySelector('ul#list')?.querySelectorAll('li')).toHaveLength(2);
    expect(document.querySelector('blockquote#quote')?.textContent).toContain('Second');
    expect(document.querySelector('table#table')?.textContent).toContain('2');
  });
  it('renders Base embeds with host this.file context and all asset media types', () => {
    const extra: VaultFile[] = [
      { path: 'View.base', kind: 'base', content: 'filters: \'project == this.file.name\'\nviews: [{type: table, name: Projects}]' },
      { path: 'Child.md', kind: 'note', content: '---\nproject: Host\n---\n# Child' },
      { path: 'pic.png', kind: 'asset', content: '', mime: 'image/png', data: 'data:image/png;base64,AAAA' },
      { path: 'sound.mp3', kind: 'asset', content: '', mime: 'audio/mpeg', data: 'AAAA' },
      { path: 'movie.mp4', kind: 'asset', content: '', mime: 'video/mp4', data: 'AAAA' },
      { path: 'doc.pdf', kind: 'asset', content: '', mime: 'application/pdf', data: 'JVBERi0xLjc=' },
    ];
    const { document, html } = render('![[View.base]]\n\n![[pic.png|120x80]]\n\n![[sound.mp3]]\n\n![[movie.mp4]]\n\n![[doc.pdf]]', extra);
    expect(document.querySelector('.base-embed [data-note="Child.md"]')).not.toBeNull();
    expect(document.querySelector('img')?.getAttribute('width')).toBe('120');
    expect(document.querySelector('audio[controls]')?.getAttribute('src')).toContain('data:audio/mpeg');
    expect(document.querySelector('video[controls]')).not.toBeNull();
    expect(document.querySelector('iframe.pdf-embed')?.getAttribute('src')).toContain('data:application/pdf;base64,');
    expect(document.querySelector('iframe.pdf-embed')?.getAttribute('sandbox')).toBe('');
    expect(document.querySelector('.pdf-embed-link[download]')).not.toBeNull();
    expect(html).not.toContain('data-pdf-capability');
  });
  it('keeps block IDs on fenced code transclusions without parsing literal reference text', () => {
    const { document } = render('![[Other#^code]]', [{ path: 'Other.md', kind: 'note', content: '```js\nconst x = "^not-a-block";\n```\n\n^code' }]);
    expect(document.querySelector('pre#code')?.textContent).toContain('^not-a-block');
  });
  it('keeps aliased wikilinks inside table cells and collects their targets', () => {
    const { document, notes } = render('| Note | Value |\n| --- | --- |\n| [[Other|Friendly name]] | 42 |', [{ path: 'Other.md', kind: 'note', content: '# Other' }]);
    expect(document.querySelector('tbody tr')?.querySelectorAll('td')).toHaveLength(2);
    expect(document.querySelector('td a')?.textContent).toBe('Friendly name');
    expect(notes[0].links).toContain('Other');
  });
  it('sanitizes SVG assets before granting generated image-only data URL access', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>Safe</title><script>alert(1)</script><foreignObject>bad</foreignObject><image href="https://tracker.test/a"/><rect width="10" height="10" onload="alert(1)"/></svg>';
    const { document, html } = render('![[image.svg]]', [{ path: 'image.svg', kind: 'asset', content: svg, mime: 'image/svg+xml', data: `data:image/svg+xml,${encodeURIComponent(svg)}` }]);
    const source = document.querySelector('img')?.getAttribute('src') ?? '';
    expect(source).toContain('data:image/svg+xml');
    const safeSvg = decodeURIComponent(source.split(',')[1]);
    expect(safeSvg).not.toMatch(/<script|foreignObject|onload|tracker/);
    expect(html).not.toContain('data-svg-capability');
  });
  it('renders safe bounded previews', () => {
    const { notes, files } = render('Intro\n\n![[Other]]\n\n' + 'Long text '.repeat(100), [{ path: 'Other.md', kind: 'note', content: 'Embeddable' }]);
    const html = renderPreview(notes[0], notes, files);
    expect(html).toContain('Intro');
    expect(html).not.toContain('note-embed-content');
  });
});

describe('HTML security', () => {
  it('removes event handlers, unsafe links, script/style, srcdoc and raw data iframes', () => {
    const { document, html } = render('<img src="x" onerror="alert(1)"><script>alert(1)</script>\n<a href="javascript:alert(1)" onclick="alert(1)">bad</a>\n<iframe src="data:text/html;base64,AAAA" srcdoc="bad"></iframe>\n<iframe class="pdf-embed" src="data:application/pdf;base64,JVBERg=="></iframe>\n<iframe src="https://example.com" srcdoc="<script>bad</script>"></iframe>\n<a target="_blank" href="https://example.com">safe</a>');
    expect(html).not.toMatch(/onerror|onclick|javascript:|srcdoc|<script|data:text\/html/);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(document.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation');
    expect(document.querySelector('a[target="_blank"]')?.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('forces media controls and rejects SVG/HTML data URLs and unsafe KaTeX trusted HTML', () => {
    const { document, html } = render('<audio src="https://example.com/a.mp3" autoplay></audio><video src="https://example.com/a.mp4"></video>\n<img src="data:image/svg+xml;base64,AAAA">\n<a href="data:text/html;base64,AAAA">no</a>\n$\\href{javascript:alert(1)}{bad}$');
    expect(document.querySelector('audio[controls]')).not.toBeNull();
    expect(document.querySelector('video[controls]')).not.toBeNull();
    expect(html).not.toMatch(/autoplay|data:image\/svg|data:text\/html/);
    for (const element of document.querySelectorAll('[href],[src]')) {
      expect(`${element.getAttribute('href') ?? ''}${element.getAttribute('src') ?? ''}`).not.toContain('javascript:');
    }
  });
});
