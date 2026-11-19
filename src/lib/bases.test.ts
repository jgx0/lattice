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

// Synthetic graph only: never copy test content from a user's vault.
const graph = buildNotes([
  { path: 'Projects/Host.md', kind: 'note', content: '---\naliases: [Parent]\ntags: [work/project]\n---\n# Overview\n[[Tasks/Source]]' },
  { path: 'Projects/Tasks/Source.md', kind: 'note', content: '---\nrelated: "[[Parent#Overview|Property label]]"\n---\n# Source\n[[../../Projects/Host.md#Overview|Display label]]' },
  { path: 'Archive/Host.md', kind: 'note', content: '# Other host' },
  { path: 'Archive/Source.md', kind: 'note', content: '# Other source\n[[./Host#Section]]' },
  { path: 'Projects/Inbound.md', kind: 'note', content: '# Inbound\n[[Host]]' },
  { path: 'Projects/Unlinked.md', kind: 'note', content: '# Unlinked' },
  { path: 'Projects/Self.md', kind: 'note', content: '# Self\n[[#Self]]' },
  { path: 'Projects/PropertyOnly.md', kind: 'note', content: '---\nrelated: ["[[Parent#Overview|Property label]]"]\n---\n# Property only' },
]);
const graphHost = graph[0];
const source = graph[1];

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
  it('supports outgoing hasLink with native file/Link targets and normalized strings', () => {
    for (const target of ['this.file', 'this.file.link', 'link(this.file.path)', 'link(this.file.path, "Label")', '"[[Projects/Host.MD#Overview|Label]]"', '"Parent"', '"../Host.md#Overview"']) {
      expect(evaluateExpression(`file.hasLink(${target})`, source, graphHost, {}, graph)).toBe(true);
    }
    expect(evaluateExpression('file.hasLink(this.file)', source, graphHost)).toBe(true);
    expect(evaluateExpression('file.hasLink("Archive/Host")', source, graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('file.hasLink("Host")', graph[3], graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.hasLink(this.file)', graph[3], graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('file.hasLink("Projects/Inbound")', graphHost, graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('this.file.hasLink(file)', source, graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.hasLink(null)', source, graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('file.hasLink("https://example.test/Host")', source, graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('file.hasLink(this.file)', graphHost, graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('file.hasLink(this.file.link)', graph[6], graph[6], {}, graph)).toBe(true);
    expect(evaluateExpression('file.hasLink(link(this.file.path))', graph[6], graph[6], {}, graph)).toBe(true);
  });
  it('compares file.links and property wikilinks to this.file/Link without confusing duplicate names', () => {
    expect(evaluateExpression('file.links.contains(this.file)', source, graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.links.contains(this.file.link)', source, graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.links.contains("Parent")', source, graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.links.contains(this.file)', graph[3], graphHost, {}, graph)).toBe(false);
    expect(evaluateExpression('related.contains(this.file.link)', graph[7], graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.hasLink(this.file)', graph[7], graphHost, {}, graph)).toBe(true);
    expect(matchesFilters('file.hasLink(this.file)', source, graphHost, graph)).toBe(true);
    expect(evaluateExpression('this.file.link == link("Parent#Overview|Label")', source, graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.links.unique().length', source, graphHost, {}, graph)).toBe(1);
  });
  it('matches unresolved explicit paths in standalone evaluations without a vault-wide scan', () => {
    const standalone = { ...source, links: ['../Missing.md#Heading'] };
    expect(evaluateExpression('file.hasLink("Projects/Missing")', standalone)).toBe(true);
    expect(evaluateExpression('file.hasLink("Archive/Missing")', standalone)).toBe(false);
    expect(() => evaluateExpression('file.hasLink({})', standalone)).toThrow();
  });
  it('supports observed native tag and safe string conversion methods', () => {
    for (const tag of ['work', '#work', '#work/project']) {
      expect(evaluateExpression(`file.hasTag("${tag}")`, graphHost, graphHost, {}, graph)).toBe(true);
    }
    expect(evaluateExpression('this.file.hasTag("#work")', source, graphHost, {}, graph)).toBe(true);
    expect(evaluateExpression('file.hasTag("wor") || file.hasTag(1)', graphHost)).toBe(false);
    expect(evaluateExpression('status.toString().contains("active")', alpha)).toBe(true);
    expect(evaluateExpression('labels.toString()', alpha)).toBe('one, two');
    expect(evaluateExpression('score.toString()', alpha)).toBe('3');
    expect(evaluateExpression('missing.toString()', alpha)).toBe('');
    expect(evaluateExpression('this.file.link.toString()', source, graphHost, {}, graph)).toBe('[[Projects/Host.md]]');
  });
  it('rejects code execution, prototype access, unsupported calls and circular formulas', () => {
    expect(() => evaluateExpression('globalThis.alert(1)', alpha)).toThrow();
    expect(() => evaluateExpression('file.constructor.constructor("return 1")()', alpha)).toThrow();
    expect(evaluateExpression('note.__proto__', alpha)).toBeUndefined();
    expect(() => evaluateExpression('status = "x"', alpha)).toThrow();
    expect(() => evaluateExpression('note.hasLink(this.file)', source, graphHost)).toThrow(/requires file/);
    expect(() => evaluateExpression('note.hasTag("work")', source)).toThrow(/requires file/);
    expect(() => evaluateExpression('file.hasBacklink(this.file)', source, graphHost)).toThrow(/Unsupported method/);
    expect(() => evaluateExpression('file.asLink()', source)).toThrow(/Unsupported method/);
    expect(() => evaluateExpression('formula.a', alpha, host, { a: 'formula.b', b: 'formula.a' })).toThrow(/Circular/);
    expect(() => evaluateExpression('('.repeat(100) + '1' + ')'.repeat(100), alpha)).toThrow();
  });
});

describe('Base views', () => {
  it('applies global and view filters, formula sorting, order and limit', () => {
    const html = renderBase(`filters:\n  and:\n    - 'file.inFolder("Projects")'\n    - 'project == this.file.name'\nformulas:\n  doubled: 'score * 2'\nproperties:\n  formula.doubled:\n    displayName: Doubled score\nviews:\n  - type: table\n    name: Active projects\n    filters: 'status == "active"'\n    order: [file.name, formula.doubled]\n    sort:\n      - property: formula.doubled\n        direction: DESC\n    limit: 1`, notes, host);
    expect(html).toContain('data-base="Active projects"');
    expect(html).toContain('Doubled score');
    expect(html).toContain('data-note="Projects/Beta.md"');
    expect(html).toContain('<td>16</td>');
    expect(html).not.toContain('data-note="Projects/Alpha.md"');
  });
  it('renders list/cards with internal rows and escapes untrusted property values', () => {
    const modified = { ...alpha, properties: { ...alpha.properties, status: '<img src=x onerror=alert(1)>' } };
    for (const type of ['list', 'cards']) {
      const html = renderBase(`views:\n  - type: ${type}\n    name: Test\n    order: [file.name, status]`, [modified], host);
      expect(html).toContain(`class="base-${type}"`);
      expect(html).toContain('class="internal-link"');
      expect(html).toContain('&lt;img');
      expect(html).not.toContain('<img');
    }
  });
  it('renders outgoing-link rows with full graph context and links in property/formula cells', () => {
    const html = renderBase('filters: "file.hasLink(this.file)"\nformulas:\n  parent: "this.file.link"\nviews:\n  - type: table\n    order: [file.name, related, formula.parent]', graph, graphHost);
    expect(html).not.toContain('base-error');
    expect(html).toContain('data-note="Projects/Tasks/Source.md"');
    expect(html).toContain('data-note="Projects/PropertyOnly.md"');
    expect(html).not.toContain('data-note="Archive/Source.md"');
    expect(html).not.toContain('data-note="Projects/Unlinked.md"');
    expect(html).toContain('class="internal-link metadata-link"');
    expect(html).toContain('data-note="Projects/Host.md" data-anchor="overview"');
    expect(html).toContain('>Property label</a>');
    const native = renderBase('filters: "file.links.contains(this.file)"\nviews: [{type: list}]', graph, graphHost);
    expect(native).toContain('data-note="Projects/Tasks/Source.md"');
    expect(native).not.toContain('data-note="Archive/Source.md"');
  });
  it('fails visibly on bad YAML, unsupported view or expression without leaking executable HTML', () => {
    expect(renderBase('views: [', notes, host)).toContain('base-error');
    expect(renderBase('views: [{type: unknown}]', notes, host)).toContain('Unsupported view');
    expect(renderBase('filters: "file.bad()"', notes, host)).toContain('Unsupported method');
    expect(renderBase('filters: "false"', notes, host)).toContain('No matching notes.');
  });
});
