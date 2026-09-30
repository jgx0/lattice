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
