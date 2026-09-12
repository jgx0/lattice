// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { demoVault, defaultSettings } from './demo';
import { buildNotes, getBacklinks, resolveNote } from './lib/model';
import { renderMarkdown, renderPreview } from './lib/render';
import type { CompiledSite, Vault } from './types';

// Compile test input once, outside App: the reader receives no vault/storage mocks.
function compileFixture(vault: Vault): CompiledSite {
  const notes = buildNotes(vault.files);
  const settings = { ...defaultSettings, title: 'Notes', showProperties: false, hiddenPaths: [] };
  const urls = new Map(notes.map(note => [note.path, note.path === settings.home ? '/garden/' : `/garden/${note.slug}`]));
  function markup(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll<HTMLAnchorElement>('a[data-note]').forEach(link => {
      const url = urls.get(link.dataset.note!);
      if (url) link.setAttribute('href', url + (link.dataset.anchor ? `#${encodeURIComponent(link.dataset.anchor)}` : ''));
    });
    return doc.body.innerHTML;
  }
  return {
    version: 1, name: vault.name, settings,
    notes: notes.map(note => ({
      ...note, url: urls.get(note.path)!,
      html: markup(renderMarkdown(note, notes, vault.files)),
      previewHtml: markup(renderPreview(note, notes, vault.files)),
      outgoing: [...new Set(note.links.map(link => resolveNote(link, notes, note.path)?.path).filter((path): path is string => !!path))],
      backlinks: getBacklinks(note, notes).map(source => source.path),
    })),
    bodyClasses: ['theme-light', 'garden-reader'],
    themeCss: 'body.theme-light{--background-primary:#faf8f4}body.theme-dark{--background-primary:#171717}body.garden-reader{--font-text-size:18px}',
  };
}
const site = compileFixture(demoVault);
const safeSite = compileFixture({ name: 'Safety fixture', files: [
  { path: 'Welcome.md', kind: 'note', content: '---\ntitle: Safe note\n---\n<strong>Readable content</strong>\n\n<img src="x" onerror="alert(1)"><script>alert(1)</script>\n<a href="javascript:alert(1)" onclick="alert(1)">Unsafe link</a>\n<iframe src="data:text/html;base64,AAAA" srcdoc="bad"></iframe>\n\n[[Other|Safe internal link]]' },
  { path: 'Other.md', kind: 'note', content: 'A safe destination.' },
] });
let container: HTMLDivElement;
let root: Root;
let systemDark: boolean;
const mediaListeners = new Set<() => void>();
const originalTitle = document.title;
const originalBodyClass = document.body.className;
const originalTheme = document.documentElement.getAttribute('data-theme');
const shims = [
  [HTMLElement.prototype, 'scrollTo'], [HTMLElement.prototype, 'scrollIntoView'],
  [URL, 'createObjectURL'], [URL, 'revokeObjectURL'],
] as const;
const descriptors = shims.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));

function one<T extends Element = HTMLElement>(selector: string, scope: ParentNode = container): T {
  const element = scope.querySelector<T>(selector);
  expect(element, `Expected ${selector}`).not.toBeNull();
  return element!;
}
function label(text: string, scope: ParentNode = container): HTMLElement { return one(`[aria-label="${text}"]`, scope); }
function nav(title: string): HTMLAnchorElement {
  const matches = [...container.querySelectorAll<HTMLAnchorElement>('a.nav-file-title')].filter(link => link.textContent === title);
  expect(matches, `Expected one sidebar link titled ${title}`).toHaveLength(1);
  return matches[0];
}
function titles() { return [...container.querySelectorAll('.note-header h1')].map(element => element.textContent); }
function compiled(path: string) { return site.notes.find(note => note.path === path)!; }
function prefs() { return JSON.parse(localStorage.getItem('publish-reader-preferences')!); }
async function advance(ms: number) { await act(async () => { vi.advanceTimersByTime(ms); }); }
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await advance(100);
}
async function key(target: EventTarget, value: string, options: KeyboardEventInit = {}) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })); });
  await advance(100);
}
async function input(element: HTMLInputElement | HTMLSelectElement, value: string) {
  // Bypass React's value tracker to simulate a native user edit.
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  await act(async () => { element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
async function mount(inputSite = site) { await act(async () => { root.render(createElement(App, { site: inputSite })); }); }
async function remount(inputSite = site, url = '/garden/') {
  await act(async () => { root.unmount(); });
  vi.clearAllTimers();
  window.history.replaceState(null, '', url);
  root = createRoot(container);
  await mount(inputSite);
  await advance(100);
}

beforeEach(async () => {
  vi.useFakeTimers();
  systemDark = false;
  mediaListeners.clear();
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: key => values.get(String(key)) ?? null, key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(String(key)); }, setItem: (key, value) => { values.set(String(key), String(value)); },
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('innerHeight', 900);
  // These tests only need escaping for quoted attribute selectors.
  vi.stubGlobal('CSS', { ...globalThis.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character.codePointAt(0)!.toString(16)} `) });
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return systemDark; }, media: query, onchange: null,
    addEventListener: vi.fn((_event: string, listener: () => void) => { mediaListeners.add(listener); }),
    removeEventListener: vi.fn((_event: string, listener: () => void) => { mediaListeners.delete(listener); }),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); takeRecords = () => [];
  });
  shims.forEach(([target, name]) => Object.defineProperty(target, name, {
    configurable: true, writable: true, value: vi.fn(name === 'createObjectURL' ? () => 'blob:test' : () => undefined),
  }));
  window.history.replaceState(null, '', '/garden/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await mount();
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  shims.forEach(([target, name], index) => {
    if (descriptors[index]) Object.defineProperty(target, name, descriptors[index]!);
    else Reflect.deleteProperty(target, name);
  });
  document.title = originalTitle;
  document.body.className = originalBodyClass;
  if (originalTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', originalTheme);
});

describe('compiled-site reader', () => {
  it('renders plain demo content without authoring scaffolding and preserves compiled sanitization', async () => {
    expect(titles()).toEqual(['A place for connected ideas']);
    expect(one('.note-header').textContent).toBe('A place for connected ideas');
    expect(one('.markdown-body').innerHTML).toBe(compiled('Welcome.md').html);
    expect(one('[data-callout="tip"]').textContent).toContain('There is no correct route');
    expect(one('.site-header').textContent).toBe('Notes');
    expect(container.querySelector('.note-meta, .note-eyebrow, .garden-paths, .note-footer, .site-brand, footer, input[type="file"]')).toBeNull();
    expect(nav('Digital gardens').querySelector('svg, .tree-item-icon')).toBeNull();
    expect(prefs()).toEqual({});
    // Lattice/author text in authored Markdown is fine; App must not inject it.
    await remount(safeSite);
    expect(titles()).toEqual(['Safe note']);
    const body = one('.markdown-body');
    expect(one('strong', body).textContent).toBe('Readable content');
    expect(body.querySelector('script, iframe, [onerror], [onclick], [srcdoc]')).toBeNull();
    expect(body.innerHTML).not.toMatch(/javascript:|data:text\/html/);
    await click(one('a[data-note="Other.md"]', body));
    expect(titles()).toEqual(['Other']);
    expect(window.location.pathname).toBe('/garden/other');
  });

  it('follows actual sidebar/internal URLs, scrolls anchors and restores a pathname on popstate', async () => {
    expect(nav('Digital gardens').getAttribute('href')).toBe('/garden/field-notes/digital-gardens');
    await click(nav('Digital gardens'));
    expect(titles()).toEqual(['Digital gardens']);
    expect(nav('Digital gardens').getAttribute('aria-current')).toBe('page');
    expect(window.location.pathname).toBe('/garden/field-notes/digital-gardens');
    expect(history.state).toEqual({ note: 'Field Notes/Digital gardens.md' });
    const link = one<HTMLAnchorElement>('a.internal-link[data-note="Field Notes/Attention is a material.md"]', one('.markdown-body'));
    expect(link.pathname).toBe('/garden/field-notes/attention-is-a-material');
    await click(link);
    expect(titles()).toEqual(['Attention is a material']);
    expect(document.title).toBe('Attention is a material - Notes');
    expect(window.location.pathname).toBe(link.pathname);
    await act(async () => {
      history.replaceState({ note: 'Field Notes/Digital gardens.md' }, '', '/garden/field-notes/digital-gardens');
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    });
    await advance(100);
    expect(titles()).toEqual(['Digital gardens']);
    expect(nav('Digital gardens').getAttribute('aria-current')).toBe('page');
    await remount(site, '/garden/field-notes/digital-gardens');
    expect(titles()).toEqual(['Digital gardens']);
    await click(one('.site-name'));
    await click(one('a[data-note="Field Notes/Digital gardens.md"][data-anchor="a-link-should-carry-a-thought"]', one('.markdown-body')));
    expect(window.location.pathname).toBe('/garden/field-notes/digital-gardens');
    expect(window.location.hash).toBe('#a-link-should-carry-a-thought');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(one('.toc-link.current').textContent).toBe('A link should carry a thought');
  });

  it('builds stacked panes and closes the active pane without reopening it or leaving a stale URL', async () => {
    await click(label('Toggle stacked pages'));
    await click(nav('Digital gardens'));
    expect(container.querySelectorAll('.stack-pane')).toHaveLength(2);
    await click(nav('Walking as research'));
    expect(titles()).toEqual(['A place for connected ideas', 'Digital gardens', 'Walking as research']);
    expect(container.querySelectorAll('.stack-pane')).toHaveLength(3);
    await click(label('Close pane Walking as research'));
    expect(titles()).toEqual(['A place for connected ideas', 'Digital gardens']);
    expect(container.querySelectorAll('.stack-pane')).toHaveLength(2);
    expect(nav('Digital gardens').getAttribute('aria-current')).toBe('page');
    expect(window.location.pathname).toBe('/garden/field-notes/digital-gardens');
    expect(window.location.hash).toBe('');
    expect(history.state).toEqual({ note: 'Field Notes/Digital gardens.md' });
    await advance(1000);
    expect(container.querySelector('[aria-label="Close pane Walking as research"]')).toBeNull();
    await click(label('Close pane Digital gardens'));
    expect(titles()).toEqual(['A place for connected ideas']);
    expect(container.querySelectorAll('.stack-pane')).toHaveLength(0);
    expect(window.location.pathname).toBe('/garden/');
    await click(nav('Digital gardens'));
    await click(label('Close pane A place for connected ideas'));
    expect(titles()).toEqual(['Digital gardens']);
    expect(window.location.pathname).toBe('/garden/field-notes/digital-gardens');
    await click(label('Toggle stacked pages'));
    expect(titles()).toEqual(['Digital gardens']);
  });

  it('saves reader-only preferences, applies theme CSS/body classes and follows system color changes', async () => {
    expect(one('style[data-publish-theme]').textContent).toBe(site.themeCss);
    expect(document.body.classList.contains('garden-reader')).toBe(true);
    expect(document.body.classList.contains('publish')).toBe(true);
    expect(getComputedStyle(document.body).getPropertyValue('--background-primary')).toBe('#faf8f4');
    await click(label('Toggle color theme'));
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
    expect(getComputedStyle(document.body).getPropertyValue('--background-primary')).toBe('#171717');
    await click(label('Reader settings'));
    const dialog = label('Reader settings', one('[role="dialog"]').parentElement!);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.querySelector('input, textarea, input[type="file"]')).toBeNull();
    expect(dialog.textContent).not.toMatch(/Homepage|Site name|Upload|Export|Author/);
    for (const name of ['Readable line length', 'Table of contents', 'Properties']) await click(label(name, dialog));
    expect(one('.note-page').classList.contains('is-readable-line-width')).toBe(false);
    expect(container.querySelector('.toc')).toBeNull();
    expect(container.querySelector('.properties')).not.toBeNull();
    expect(prefs()).toEqual({ theme: 'dark', readable: false, showToc: false, showProperties: true });
    await click(label('Close settings', dialog));
    await remount();
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(container.querySelector('.toc')).toBeNull();
    expect(one('.note-page').classList.contains('is-readable-line-width')).toBe(false);
    expect(site.settings).toMatchObject({ theme: 'light', readable: true, showToc: true, showProperties: false });
    await click(label('Reader settings'));
    await input(one<HTMLSelectElement>('#color-mode'), 'system');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    await act(async () => { systemDark = true; mediaListeners.forEach(listener => listener()); });
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getComputedStyle(document.body).getPropertyValue('--font-text-size')).toBe('18px');
    await key(window, 'Escape');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens and zooms the graph, filters compiled nodes and navigates a node with Enter', async () => {
    await click(label('Graph view', label('Site navigation')));
    expect(one('.graph-page h1').textContent).toBe('Graph view');
    const graph = label('Interactive graph of connected notes');
    expect(graph.querySelectorAll('.graph-node')).toHaveLength(site.notes.length);
    expect(graph.querySelectorAll('line').length).toBeGreaterThan(0);
    await click(label('Zoom in'));
    expect(one('.graph-controls span').textContent).toBe('120%');
    expect(one('g[transform]', graph).getAttribute('transform')).toContain('scale(1.2)');
    await click(label('Zoom out'));
    await click(label('Zoom out'));
    expect(one('.graph-controls span').textContent).toBe('80%');
    await click(label('Reset graph'));
    expect(one('.graph-controls span').textContent).toBe('100%');
    await input(label('Filter graph') as HTMLInputElement, 'Digital gardens');
    expect(graph.querySelectorAll('.graph-node')).toHaveLength(1);
    await input(label('Filter graph') as HTMLInputElement, 'no-such-note');
    expect(one('.graph-empty').textContent).toBe('No matching notes. Try a different search.');
    await click(label('Clear graph search'));
    expect(graph.querySelectorAll('.graph-node')).toHaveLength(site.notes.length);
    await key(label('Open Digital gardens', graph), 'Enter');
    expect(titles()).toEqual(['Digital gardens']);
    expect(window.location.pathname).toBe('/garden/field-notes/digital-gardens');
    expect(container.querySelector('.graph-page')).toBeNull();
  });

  it('filters inline sidebar search by path, tag and heading and supports keyboard navigation', async () => {
    await click(label('Close sidebar'));
    await key(window, 'k', { ctrlKey: true });
    const search = label('Search page or heading...') as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    expect(one('.app-shell').classList.contains('sidebar-hidden')).toBe(false);
    await input(search, 'path:Library tag:reading');
    expect(container.querySelectorAll('a.search-result-file-title')).toHaveLength(6);
    expect([...container.querySelectorAll('a.search-result-file-title')].every(link => link.textContent?.includes('Library'))).toBe(true);
    await input(search, 'path:"Field Notes" tag:garden');
    expect(container.querySelectorAll('a.search-result-file-title')).toHaveLength(1);
    expect(one('.search-result-file-title span').textContent).toBe('Digital gardens');
    await input(search, 'heading:"A link should carry a thought"');
    expect(container.querySelectorAll('a.search-result-file-title')).toHaveLength(1);
    await input(search, 'tag:no-such-tag');
    expect(one('.search-results .empty-hint').textContent).toBe('No results found.');
    await click(label('Clear search'));
    expect(search.value).toBe('');
    expect(container.querySelector('.search-results')).toBeNull();
    await input(search, 'file:"Digital gardens.md"');
    expect(one<HTMLAnchorElement>('.search-result-file-title').pathname).toBe('/garden/field-notes/digital-gardens');
    await key(search, 'Enter');
