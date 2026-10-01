// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { demoVault } from '../demo';
import { buildNotes, resolveNote } from './model';
import { renderMarkdown, renderPreview } from './render';

const notes = buildNotes(demoVault.files);
describe('shared demo integration', () => {
  it('renders every note/preview with no broken note links, section embeds or Base errors', () => {
    expect(notes.length).toBeGreaterThanOrEqual(20);
    for (const note of notes) {
      const html = renderMarkdown(note, notes, demoVault.files);
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.querySelector('.embed-missing,.embed-limit,.base-error,.is-unresolved'), note.path).toBeNull();
      for (const heading of note.headings) expect(document.getElementById(heading.id), `${note.path}#${heading.id}`).not.toBeNull();
      expect(renderPreview(note, notes, demoVault.files)).toBeTypeOf('string');
      for (const target of note.links) {
        if (!/\.(?:svg|wav|mp4|base)(?:#|$)/i.test(target)) expect(resolveNote(target, notes, note.path), `${note.path}: ${target}`).toBeDefined();
      }
    }
  });
  it('renders host-relative reading/related Bases and sanitized offline SVG/audio/video', () => {
    const reading = notes.find(note => note.path === 'Library/The reading room.md')!;
    const related = notes.find(note => note.path === 'Field Notes/Digital gardens.md')!;
    const readingDocument = new DOMParser().parseFromString(renderMarkdown(reading, notes, demoVault.files), 'text/html');
    const relatedDocument = new DOMParser().parseFromString(renderMarkdown(related, notes, demoVault.files), 'text/html');
    expect(readingDocument.querySelectorAll('.base-embed tbody tr')).toHaveLength(5);
    expect(relatedDocument.querySelectorAll('.base-embed tbody tr')).toHaveLength(4);
    expect(relatedDocument.querySelector('.base-embed [data-note="Field Notes/Digital gardens.md"]')).toBeNull();
    const media = notes.find(note => note.path === 'Atlas/Media cabinet.md')!;
    const mediaDocument = new DOMParser().parseFromString(renderMarkdown(media, notes, demoVault.files), 'text/html');
    expect(mediaDocument.querySelector('img[src^="data:image/svg+xml"]')).not.toBeNull();
    expect(mediaDocument.querySelector('audio[controls][src^="data:audio/"]')).not.toBeNull();
    expect(mediaDocument.querySelector('video[controls][src^="data:video/"]')).not.toBeNull();
    expect(mediaDocument.querySelector('iframe[srcdoc]')).toBeNull();
  });
});
