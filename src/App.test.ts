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
