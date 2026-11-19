// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import MarkdownIt from 'markdown-it';
import { JSDOM } from 'jsdom';
import type { WindowLike } from 'dompurify';
import type { VaultFile } from '../types';
import { createSanitizers } from './sanitize';
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
  it('renders the inline Topic Base with host-relative links and modification-time sorting', () => {
    const source='```base\nviews:\n  - type: table\n    name: Topic\n    filters:\n      and:\n        - file.links.contains(this.file)\n    order:\n      - file.name\n    sort:\n      - property: file.mtime\n        direction: DESC\n```';
    const {document,notes,files,html}=render(source,[
      {path:'Older.md',kind:'note',mtime:100,content:'---\ncategory: "[[Host]]"\n---\nOld'},
      {path:'Newer.md',kind:'note',mtime:200,content:'[[Host]]'},
      {path:'Unrelated.md',kind:'note',mtime:300,content:'Nothing linked'},
    ]);
    expect(document.querySelector('pre')).toBeNull();
    expect(document.querySelector('.base-inline .base-view-title')?.textContent).toBe('Topic');
    expect([...document.querySelectorAll('.base-inline tbody a')].map(a=>a.textContent)).toEqual(['Newer','Older']);
    expect(html).not.toContain('Unrelated');
    expect(renderMarkdown(notes[0],notes,files)).toBe(html);
    expect(new DOMParser().parseFromString(renderPreview(notes[0],notes,files),'text/html').querySelector('.base-inline')).not.toBeNull();
  });
  it('keeps ordinary YAML fences literal and reports invalid inline Bases safely', () => {
    const {document}=render('```yaml\nviews: [{type: table}]\n```\n\n~~~base\nviews: [{type: unsafe, name: "<script>bad()</script>"}]\n~~~');
    expect(document.querySelector('pre code.language-yaml')?.textContent).toContain('views:');
    expect(document.querySelector('.base-inline .base-error')?.textContent).toContain('Unsupported view');
    expect(document.querySelector('script')).toBeNull();
  });
  it('uses the embedded note as an inline Base host and preserves a block reference', () => {
    const {document}=render('![[Other#^topic]]',[
      {path:'Other.md',kind:'note',content:'```base\nfilters: file.hasLink(this.file)\nviews: [{type: list, name: Linked, order: [file.name]}]\n```\n\n^topic'},
      {path:'Child.md',kind:'note',content:'[[Other]]'},
    ]);
    expect(document.querySelector('.base-inline#topic')).not.toBeNull();
    expect(document.querySelector('.base-inline [data-note="Child.md"]')).not.toBeNull();
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
  it('reuses one pristine parse for huge-note previews and full renders', () => {
    const files: VaultFile[] = [{ path: 'Large.md', kind: 'note', content: '# Large\n\n' + 'A long paragraph with **formatting**.\n\n'.repeat(3000) }];
    const notes = buildNotes(files);
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    try {
      const preview = renderPreview(notes[0], notes, files);
      expect(preview).toContain('<strong>formatting</strong>');
      expect(preview.length).toBeLessThan(2000);
      const html = renderMarkdown(notes[0], notes, files);
      expect(html.match(/<strong>/g)).toHaveLength(3000);
      expect(renderPreview(notes[0], notes, files)).toBe(preview);
      expect(parse).toHaveBeenCalledTimes(1);
    } finally { parse.mockRestore(); }
  });
  it('keeps previews at complete list, table, quote and fence boundaries', () => {
    for (const block of [
      '- ' + 'List item '.repeat(70) + '\n- Last item',
      '> ' + 'Quoted text '.repeat(70) + '\n> Last quote',
      '| Header |\n| --- |\n| ' + 'Table text '.repeat(70) + ' |\n| Last cell |',
      '```text\n' + 'Literal text '.repeat(70) + '\nLast code line\n```',
    ]) {
      const files: VaultFile[] = [{ path: 'Host.md', kind: 'note', content: block + '\n\nAFTER EXCERPT' }];
      const notes = buildNotes(files);
      const preview = renderPreview(notes[0], notes, files);
      expect(preview).toContain('Last');
      expect(preview).not.toContain('AFTER EXCERPT');
      expect(preview).toBe(renderMarkdown(notes[0], notes, files).split('<p>AFTER EXCERPT')[0]);
    }
  });
  it('preserves excerpt-scoped reference and footnote definitions', () => {
    const content = '[outside][ref] and note[^a]\n\n' + 'Long paragraph '.repeat(60)
      + '\n\nNot in preview\n\n[ref]: https://example.com\n[^a]: Outside footnote';
    const files: VaultFile[] = [{ path: 'Host.md', kind: 'note', content }];
    const notes = buildNotes(files);
    const preview = renderPreview(notes[0], notes, files);
    expect(preview).toContain('[outside][ref]');
    expect(preview).toContain('[^a]');
    expect(preview).not.toContain('footnote');
    expect(preview).not.toContain('https://example.com');
    const full = renderMarkdown(notes[0], notes, files);
    expect(full).toContain('Outside footnote');
    expect(full).toContain('https://example.com');
  });
  it('caches transclusion sources and section parses while retaining duplicate heading offsets', () => {
    const files: VaultFile[] = [
      { path: 'Host.md', kind: 'note', content: '![[Other#repeat-1]]\n\n![[Other#repeat-1]]\n\n![[Other#^second]]' },
      { path: 'Other.md', kind: 'note', content: '## Repeat\nFirst\n\n## Repeat\nSecond\n\n^second\n\n## Last\nLast' },
    ];
    const notes = buildNotes(files);
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    try {
      const html = renderMarkdown(notes[0], notes, files);
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.querySelectorAll('h2#repeat-1')).toHaveLength(2);
      expect(document.querySelector('#second')?.textContent).toBe('Second');
      expect(parse).toHaveBeenCalledTimes(4); // host, source, heading section, block section
      expect(renderMarkdown(notes[0], notes, files)).toBe(html);
      expect(parse).toHaveBeenCalledTimes(4);
    } finally { parse.mockRestore(); }
  });
  it('isolates render contexts and mutations across previews, hosts and nested embeds', () => {
    const files: VaultFile[] = [
      { path: 'A/Host.md', kind: 'note', content: '> [!tip] [[../Target|Callout link]]\n> - [x] [Target](../Target.md)\n\n![[B/Host]]' },
      { path: 'B/Host.md', kind: 'note', content: '> [!tip] [[../Other|Other link]]\n> - [ ] [Other](../Other.md)' },
      { path: 'Target.md', kind: 'note', content: '# Target' },
      { path: 'Other.md', kind: 'note', content: '# Other' },
    ];
    const notes = buildNotes(files);
    const html = renderMarkdown(notes[0], notes, files);
    renderPreview(notes[0], notes, files);
    renderMarkdown(notes[1], notes, files);
    expect(renderMarkdown(notes[0], notes, files)).toBe(html);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('.callout-title a')?.getAttribute('data-note')).toBe('Target.md');
    expect(document.querySelector('.note-embed .callout-title a')?.getAttribute('data-note')).toBe('Other.md');
    expect(document.querySelectorAll('input')).toHaveLength(2);
    expect(document.querySelectorAll('input[checked]')).toHaveLength(1);
  });
  it('indexes exact, relative and basename asset paths with deterministic folder preferences', () => {
    const asset = (path: string, data: string): VaultFile => ({ path, kind: 'asset', content: '', mime: 'image/png', data });
    const files: VaultFile[] = [
      { path: 'B/Host.md', kind: 'note', content: '![[PIC.png]]\n\n![[../A/pic.png]]\n\n![[/A/pic.png]]\n\n![[unknown/pic.png]]\n\n![[shared.png]]\n\n![[root.png]]\n\n![[encoded%20name.png]]' },
      asset('Z/pic.png', 'Wlpa'), asset('B/pic.png', 'QkJC'), asset('A/pic.png', 'QUFB'),
      asset('Z/shared.png', 'Wlpa'), asset('A/shared.png', 'QUFB'),
      asset('B/root.png', 'QkJC'), asset('root.png', 'Uk9PVA=='), asset('B/encoded name.png', 'QUFB'),
    ];
    const notes = buildNotes(files);
    const find = vi.spyOn(files, 'find');
    const filter = vi.spyOn(files, 'filter');
    try {
      const document = new DOMParser().parseFromString(renderMarkdown(notes[0], notes, files), 'text/html');
      expect([...document.querySelectorAll('img')].map(element => element.getAttribute('src')?.split(',')[1]))
        .toEqual(['QkJC', 'QUFB', 'QUFB', 'QkJC', 'QUFB', 'Uk9PVA==', 'QUFB']);
      renderMarkdown(notes[0], notes, files);
      expect(find).not.toHaveBeenCalled();
      expect(filter).not.toHaveBeenCalled();
    } finally { find.mockRestore(); filter.mockRestore(); }
  });
  it('invalidates parsed tokens when a Note body is replaced', () => {
    const files: VaultFile[] = [{ path: 'Host.md', kind: 'note', content: 'Before' }];
    const notes = buildNotes(files);
    expect(renderPreview(notes[0], notes, files)).toContain('Before');
    notes[0].body = 'After';
    expect(renderMarkdown(notes[0], notes, files)).toContain('After');
    expect(renderPreview(notes[0], notes, files)).not.toContain('Before');
  });
  it('renders safe bounded previews', () => {
    const { notes, files } = render('Intro\n\n![[Other]]\n\n' + 'Long text '.repeat(100), [{ path: 'Other.md', kind: 'note', content: 'Embeddable' }]);
    const html = renderPreview(notes[0], notes, files);
    expect(html).toContain('Intro');
    expect(html).not.toContain('note-embed-content');
  });
});

describe('HTML security', () => {
  it('rejects unsupported DOM adapters instead of returning unsanitized input', () => {
    expect(() => createSanitizers({} as WindowLike)).toThrow('supported DOM');
  });
  it('transforms only the sanitized DOM and serializes it without another parse', () => {
    const transformHtml = vi.fn((body: HTMLElement) => {
      expect(body.querySelector('script,[onclick],[onerror],[srcdoc]')).toBeNull();
      expect(body.querySelector('a')?.hasAttribute('href')).toBe(false);
      for (const link of body.querySelectorAll('a[data-note]')) link.setAttribute('href', '/published/target/');
    });
    const sanitizers = createSanitizers(window, { transformHtml });
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    try {
      const html = sanitizers.sanitizeHtml('<script>bad()</script><a data-note="Target.md" href="javascript:bad()" onclick="bad()">Target</a><img onerror="bad()" src="x">');
      expect(transformHtml).toHaveBeenCalledTimes(1);
      expect(html).toContain('href="/published/target/"');
      expect(html).not.toMatch(/javascript:|<script|onclick|onerror/);
      expect(parse).toHaveBeenCalledTimes(1); // DOMPurify's initial parse only
    } finally { parse.mockRestore(); }
  });
  it('resets PDF/SVG capabilities on reused sanitizers and never trusts raw lookalikes', () => {
    const sanitizers = createSanitizers(window);
    const source = 'data:application/pdf;base64,JVBERg==';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1"/></svg>';
    const svgSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizers.sanitizeSvg(svg))}`;
    const files: VaultFile[] = [
      { path: 'Host.md', kind: 'note', content: '![[doc.pdf]]\n\n![[image.svg]]' },
      { path: 'doc.pdf', kind: 'asset', content: '', mime: 'application/pdf', data: source },
      { path: 'image.svg', kind: 'asset', content: svg, mime: 'image/svg+xml', data: `data:image/svg+xml,${encodeURIComponent(svg)}` },
    ];
    const notes = buildNotes(files);
    const generated = renderMarkdown(notes[0], notes, files, sanitizers);
    expect(generated).toContain(source);
    expect(generated).toContain('data:image/svg+xml');
    expect(generated).not.toMatch(/data-(?:pdf|svg)-capability/);
    const trusted = `<iframe src="${source}" data-pdf-capability="pdf"></iframe><img src="${svgSource}" data-svg-capability="svg">`;
    expect(sanitizers.sanitizeHtml(trusted, new Map([['pdf', source]]), new Map([['svg', svgSource]]))).toContain(svgSource);
    const malicious = trusted + '<iframe src="data:text/html;base64,AAAA" srcdoc="bad"></iframe><img src="data:image/svg+xml,<svg onload=bad()>" onerror="bad()">';
    for (let i = 0; i < 2; i++) {
      const html = sanitizers.sanitizeHtml(malicious);
      expect(html).not.toMatch(/<iframe|data:application\/pdf|data:image\/svg|srcdoc|onerror|data-(?:pdf|svg)-capability/);
    }
    expect(sanitizers.sanitizeHtml(trusted, new Map([['pdf', 'data:application/pdf;base64,AAAA']]), new Map([['svg', 'different']]))).not.toContain(source);
  });
  it('isolates factory DOMs, HTML/SVG hooks, and identical-source SVG caching', () => {
    const dom = new JSDOM('');
    try {
      const transformHtml = vi.fn((body: HTMLElement) => {
        expect(body).toBeInstanceOf(dom.window.HTMLElement);
        body.querySelector('a')?.setAttribute('href', '/one/');
      });
      const first = createSanitizers(dom.window, { transformHtml });
      const second = createSanitizers(window);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.test/image"/><rect onload="bad()"/></svg>';
      expect(first.sanitizeSvg(svg)).not.toMatch(/tracker|onload/);
      expect(first.sanitizeSvg(svg)).toBe(first.sanitizeSvg(svg));
      expect(first.sanitizeSvg(svg.replace('rect', 'circle'))).toContain('<circle');
      expect(first.sanitizeHtml('<a href="https://example.com">link</a>')).toContain('/one/');
      expect(second.sanitizeHtml('<a href="https://example.com">link</a>')).toContain('https://example.com');
      expect(transformHtml).toHaveBeenCalledTimes(1);
      expect(first.sanitizeHtml('')).toBe('');
    } finally { dom.window.close(); }
  });
  it('fails closed on callback errors/reentrancy and resets active trust afterward', () => {
    let fail = true;
    let nested = false;
    const source = 'data:application/pdf;base64,JVBERg==';
    const sanitizers = createSanitizers(window, { transformHtml(body) {
      expect(body.querySelector('script')).toBeNull();
      if (fail) throw new Error('transform failed');
      if (nested) sanitizers.sanitizeHtml('<p>nested</p>');
    } });
    expect(() => sanitizers.sanitizeHtml('<script>bad()</script><iframe src="' + source + '" data-pdf-capability="pdf"></iframe>', new Map([['pdf', source]]))).toThrow('transform failed');
    fail = false;
    expect(sanitizers.sanitizeHtml('<iframe src="' + source + '" data-pdf-capability="pdf"></iframe>')).toBe('');
    nested = true;
    expect(() => sanitizers.sanitizeHtml('<p>safe</p>')).toThrow('reentrantly');
    nested = false;
    expect(sanitizers.sanitizeHtml('<p onclick="bad()">safe</p>')).toBe('<p>safe</p>');
  });
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
