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
    expect(evaluateExpression('list(1, 2, 3).map(value * 2).filter(value > 2).join("-")', alpha)).toBe('4-6');
    expect(evaluateExpression('[1, 2, 2].unique().length', alpha)).toBe(2);
    expect(evaluateExpression('true || unsupported()', alpha)).toBe(true);
    expect(evaluateExpression('if(score > 1, "yes", unsupported())', alpha)).toBe('yes');
    expect(evaluateExpression('formula.total == 7', alpha, host, { total: 'score * 2 + 1' })).toBe(true);
    expect(evaluateExpression('false ? 1 : 2 + 3 * 4', alpha)).toBe(14);
  });
  it('supports nested YAML filters; not groups exclude every listed match', () => {
    expect(matchesFilters({ and: ['status == "active"', { or: ['score > 5', 'labels.contains("one")'] }] }, alpha)).toBe(true);
    expect(matchesFilters({ not: ['status == "archived"', 'score < 4'] }, alpha)).toBe(false);
    expect(matchesFilters({ not: ['status == "archived"', 'score < 4'] }, notes[2])).toBe(true);
  });
  it('rejects code execution, prototype access, unsupported calls and circular formulas', () => {
    expect(() => evaluateExpression('globalThis.alert(1)', alpha)).toThrow();
    expect(() => evaluateExpression('file.constructor.constructor("return 1")()', alpha)).toThrow();
    expect(evaluateExpression('note.__proto__', alpha)).toBeUndefined();
    expect(() => evaluateExpression('status = "x"', alpha)).toThrow();
    expect(() => evaluateExpression('formula.a', alpha, host, { a: 'formula.b', b: 'formula.a' })).toThrow(/Circular/);
    expect(() => evaluateExpression('('.repeat(100) + '1' + ')'.repeat(100), alpha)).toThrow();
  });
});

describe('Base views', () => {
  it('applies global and view filters, formula sorting, order and limit', () => {
