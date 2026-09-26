import { describe, expect, it } from 'vitest';
import { buildNotes } from './model';
import { evaluateExpression, matchesFilters, renderBase } from './bases';

const notes = buildNotes([
  { path: 'Projects/Host.md', kind: 'note', content: '---\nstatus: host\n---\n# Host' },
  { path: 'Projects/Alpha.md', kind: 'note', content: '---\nstatus: active\nscore: 3\nlabels: [one, two]\nproject: Host\n---\n# Alpha' },
  { path: 'Projects/Beta.md', kind: 'note', content: '---\nstatus: active\nscore: 8\nproject: Host\n---\n# Beta' },
  { path: 'Archive/Old.md', kind: 'note', content: '---\nstatus: archived\nscore: 1\n---\n# Old' },
]);
const host = notes[0];
const alpha = notes[1];

describe('safe Base expressions', () => {
  it('distinguishes candidate file from host this.file and supports property access', () => {
    expect(evaluateExpression('file.name == "Alpha" && this.file.name == "Host"', alpha, host)).toBe(true);
    expect(evaluateExpression('file.path.startsWith("Projects/") and project == this.file.name', alpha, host)).toBe(true);
    expect(evaluateExpression('file.inFolder(this.file.folder) && !file.inFolder("Archive")', alpha, host)).toBe(true);
    expect(evaluateExpression('this.file.inFolder("Projects")', notes[3], host)).toBe(true);
    expect(evaluateExpression('note["status"] != "archived" and score >= 3 and score < 4', alpha)).toBe(true);
  });
  it('supports lists, whitelisted methods and formulas with precedence and short circuiting', () => {
    expect(evaluateExpression('labels.contains("two") || false', alpha)).toBe(true);
