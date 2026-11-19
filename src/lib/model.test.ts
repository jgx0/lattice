import MarkdownIt from 'markdown-it';
import { describe, expect, it, vi } from 'vitest';
import type { Note, VaultFile } from '../types';
import { buildNotes, getBacklinks, invalidateNoteIndex, resolveLink, resolveNote, searchNotes, slugify } from './model';
import { basename, decodeTarget, dirname, normalizePath, stripExtension } from './utils';
import { extractPropertyLinks, parsePropertyWikilinks } from './propertyLinks';

const noteFile = (path: string, content: string): VaultFile => ({ path, content, kind: 'note' });
const files = [
  noteFile('Welcome.md', '---\ntitle: Garden\naliases: [Start]\ntags: [garden, topic/deep]\n---\n# Welcome\n## **Same** heading\n## Same heading\nSetext\n------\nHello World #inline/tag [[Projects/Alpha#Plan|project]] [Beta](Projects/Beta.md)\n`[[Ignored]]`\n```md\n# Not a heading\n[[Ignored]] #ignored\n```'),
  noteFile('Projects/Alpha.md', '---\nstatus: active\n---\n# Alpha\n## Plan\nhello world [[../Welcome#^intro]]'),
  noteFile('Projects/Beta.md', '# Beta\nHELLO WORLD #garden [[Alpha]]'),
  noteFile('Archive/Alpha.md', '# Other Alpha\narchived'),
  { path: 'assets/image.png', content: '', kind: 'asset' as const },
];
const notes = buildNotes(files);

// Frozen reference implementation: compare indexed lookups against the original
// scan/sort semantics, including distinctions that are easy to normalize away.
function scanResolveNote(target: string, notes: Note[], currentPath?: string): Note | undefined {
  const original = decodeTarget(target.trim().replace(/^!?\[\[|\]\]$/g, '').split('|')[0].split('#')[0]);
  if (!original) return currentPath ? notes.find(note => normalizePath(note.path) === normalizePath(currentPath)) : undefined;
  if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(original)) return undefined;
  const relative = /^\.\.?\//.test(original);
  const rooted = original.startsWith('/');
  const path = normalizePath(original);
  const localPath = normalizePath(`${currentPath ? dirname(currentPath) : ''}/${original}`);
  const key = (value: string) => stripExtension(normalizePath(value)).toLocaleLowerCase();
  const find = (value: string) => notes.find(note => key(note.path) === key(value));
  if (relative) return find(localPath);
  if (rooted) return find(path);
  const exact = find(path);
  if (exact) return exact;
  if (currentPath) {
    const local = find(localPath);
    if (local) return local;
  }
  const name = stripExtension(basename(path)).toLocaleLowerCase();
  const candidates = notes.filter(note => {
    const value = note.properties.aliases ?? note.properties.alias;
    const aliases = (Array.isArray(value) ? value : value == null ? [] : [value])
      .filter((alias): alias is string => typeof alias === 'string');
    return stripExtension(basename(note.path)).toLocaleLowerCase() === name
      || note.slug === path || aliases.some(alias => alias.toLocaleLowerCase() === path.toLocaleLowerCase());
  });
  const folder = currentPath ? dirname(currentPath).split('/') : [];
  const proximity = (note: Note) => {
    const parts = note.folder.split('/');
    let count = 0;
    while (count < folder.length && parts[count] === folder[count]) count++;
    return count;
  };
  return candidates.sort((a, b) => proximity(b) - proximity(a) || a.path.localeCompare(b.path))[0];
}

function scanBacklinks(note: Note, notes: Note[]): Note[] {
  return notes.filter(candidate => candidate.path !== note.path
    && candidate.links.some(link => scanResolveNote(link, notes, candidate.path)?.path === note.path));
}

describe('note model', () => {
  it('parses YAML, ATX and setext headings, inline links and tags but excludes code', () => {
    const welcome = notes[0];
    expect(notes).toHaveLength(4);
    expect(welcome.title).toBe('Garden');
    expect(welcome.body.startsWith('# Welcome')).toBe(true);
    expect(welcome.headings.map(heading => heading.id)).toEqual(['welcome', 'same-heading', 'same-heading-1', 'setext']);
    expect(welcome.links).toEqual(['Projects/Alpha#Plan', 'Projects/Beta.md']);
    expect(welcome.tags).toEqual(['inline/tag', 'garden', 'topic/deep']);
    expect(welcome.words).toBeGreaterThan(5);
  });
  it('does not count Markdown-looking lines inside display math as headings', () => {
    const [note] = buildNotes([noteFile('math.md', '$$\n# not a heading\n$$\n\n## Actual')]);
    expect(note.headings.map(heading => heading.text)).toEqual(['Actual']);
  });
  it('keeps invalid frontmatter visible', () => {
    const [note] = buildNotes([noteFile('bad.md', '---\na: [\n---\nContent')]);
    expect(note.properties).toEqual({});
    expect(note.body).toContain('a: [');
  });
  it('resolves absolute, local, relative, aliases, encoded names and self links', () => {
    expect(resolveNote('Alpha', notes, 'Projects/Beta.md')?.path).toBe('Projects/Alpha.md');
    expect(resolveNote('../Welcome.md', notes, 'Projects/Alpha.md')?.title).toBe('Garden');
    expect(resolveNote('Start', notes)?.path).toBe('Welcome.md');
    expect(resolveNote('/Archive/Alpha.md', notes)?.path).toBe('Archive/Alpha.md');
    expect(resolveNote('#Plan', notes, 'Projects/Alpha.md')?.path).toBe('Projects/Alpha.md');
    expect(resolveNote('https://example.com', notes)).toBeUndefined();
    expect(resolveNote('missing', notes)).toBeUndefined();
  });
  it('uses shared precise heading and block anchors and Note[] backlinks', () => {
    expect(resolveLink('Welcome#Same heading', notes)).toMatchObject({ anchor: 'same-heading', href: '#/welcome?anchor=same-heading' });
    expect(resolveLink('Welcome#same-heading-1', notes).anchor).toBe('same-heading-1');
    expect(resolveLink('Welcome#^intro', notes).anchor).toBe('intro');
    expect(getBacklinks(notes[1], notes).map(note => note.path)).toEqual(['Welcome.md', 'Projects/Beta.md']);
  });
  it('parses each note once while retaining heading, prose and link metadata', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    try {
      const built = buildNotes([
        noteFile('meta.md', '# **Title** ^block\n\nHello *world* [label](Target.md) `code`.\n\n%% hidden [[Missing]] #hidden %%'),
        noteFile('Target.md', '# Target'),
        { path: 'image.png', content: '', kind: 'asset' },
      ]);
      expect(parse).toHaveBeenCalledTimes(2);
      expect(built[0].headings).toEqual([{ level: 1, text: 'Title', id: 'title' }]);
      expect(built[0].links).toEqual(['Target.md']);
      expect(built[0].tags).toEqual([]);
      expect(built[0].words).toBe(6);
    } finally {
      parse.mockRestore();
    }
  });
  it('normalizes Unicode and makes duplicate note slugs unique', () => {
    expect(slugify('  Héllo, 世界!  ')).toBe('héllo-世界');
    const result = buildNotes([noteFile('A!.md', ''), noteFile('A.md', ''), noteFile('A-1.md', '')]);
    expect(new Set(result.map(note => note.slug)).size).toBe(3);
  });
});

describe('property wikilinks', () => {
  it('returns reusable string tokens with aliases, embed flags and original offsets', () => {
    const text = String.raw`Before [[ Folder/Target#Heading | Label ]] and ![[Other#^block\|Shown]] after`;
    const tokens = parsePropertyWikilinks(text);
    expect(tokens.map(({ target, alias, embed }) => ({ target, alias, embed }))).toEqual([
      { target: 'Folder/Target#Heading', alias: 'Label', embed: false },
      { target: 'Other#^block', alias: 'Shown', embed: true },
    ]);
    for (const token of tokens) expect(text.slice(token.start, token.end)).toBe(token.raw);
    expect(parsePropertyWikilinks('[[Plain]]')).toEqual([
      { raw: '[[Plain]]', target: 'Plain', embed: false, start: 0, end: 9 },
    ]);
    expect(parsePropertyWikilinks('[Label](Target.md) [[ ]] [[|Alias]] [[broken] [[Across\nlines]]')).toEqual([]);
    expect(extractPropertyLinks('[[A]] [[A|Alias]] ![[A]] [[A#Heading]] [[A#^block]]')).toEqual([
      'A', 'A#Heading', 'A#^block',
    ]);
  });

  it('traverses arbitrary nested values without coercing scalars, keys or prototypes', () => {
    const inherited = Object.assign(Object.create({ inherited: '[[Ignored]]' }), { own: '[[Own]]' });
    const value = Object.freeze({
      '[[Key]]': Object.freeze(['[[First]]', 42, true, false, null, undefined, 1n, Symbol('[[Symbol]]')]),
      nested: Object.freeze({ items: Object.freeze([['text [[Second|Alias]] and ![[Third#^block]]'], '[[First]]']) }),
      scalar: '[Markdown](Ignored.md)',
      inherited,
      date: new Date(0),
      function: () => '[[Function]]',
    });
    expect(extractPropertyLinks(value)).toEqual(['First', 'Second', 'Third#^block', 'Own']);
    expect(value['[[Key]]'][0]).toBe('[[First]]');
    for (const scalar of [null, undefined, false, 17, 1n, Symbol('[[Symbol]]'), new Date(0)]) {
      expect(extractPropertyLinks(scalar)).toEqual([]);
    }
  });

  it('visits shared objects once and handles cyclic arrays/objects and very deep nesting', () => {
    const read = vi.fn(() => '[[Shared]]');
    const shared = Object.defineProperty({}, 'link', { enumerable: true, get: read });
    const cyclic: Record<string, unknown> = { first: '[[First]]', shared };
    const array: unknown[] = [cyclic, shared, '[[Last]]'];
    cyclic.self = cyclic;
    cyclic.array = array;
    array.push(array);
    expect(extractPropertyLinks(cyclic)).toEqual(['First', 'Shared', 'Last']);
    expect(read).toHaveBeenCalledTimes(1);
    let deep: unknown = '[[Deep]]';
    for (let i = 0; i < 20_000; i++) deep = { nested: [deep] };
    expect(extractPropertyLinks(deep)).toEqual(['Deep']);
  });

  it('adds YAML scalar, flow/block list, nested and embedded links after body links without changing words or properties', () => {
    const body = '# Source\n\nBody [[Inline]] [[Target#Heading|body label]].';
    const content = [
      '---',
      'category: ["[[Category]]", "[[Inline|duplicate]]"]',
      'related: "Text [[Target#Heading|property label]] and [[Other#^block]]"',
      'items:',
      "  - '[[Block List]]'",
      '  - 17',
      '  - false',
      '  - null',
      'nested:',
      '  more:',
      '    - ["![[Embedded|embed label]]", "[[Folder/Encoded%20Note.md#Heading]]"]',
      '    - detail: "[[Third]]"',
      'plain: "[Markdown](NotLinked.md)"',
      'tags: [topic]',
      '---',
      body,
    ].join('\n');
    const [note] = buildNotes([noteFile('Source.md', content)]);
    expect(note.links).toEqual([
      'Inline', 'Target#Heading', 'Category', 'Other#^block', 'Block List', 'Embedded',
      'Folder/Encoded%20Note.md#Heading', 'Third',
    ]);
    expect(note.words).toBe(buildNotes([noteFile('Source.md', body)])[0].words);
    expect(note.body).toBe(body);
    expect(note.content).toBe(content);
    expect(note.properties.category).toEqual(['[[Category]]', '[[Inline|duplicate]]']);
    expect(note.properties.nested.more[0]).toEqual(['![[Embedded|embed label]]', '[[Folder/Encoded%20Note.md#Heading]]']);
    expect(note.tags).toEqual(['topic']);
  });

  it('extracts links from recursive YAML aliases without mutating the property graph', () => {
    const [note] = buildNotes([noteFile('Cycle.md', [
      '---',
      'nested: &nested',
      '  link: "[[Target]]"',
      '  self: *nested',
      'shared: *nested',
      'list: &list',
      '  - "[[Other#^block]]"',
      '  - *list',
      '---',
      'Body',
    ].join('\n'))]);
    expect(note.links).toEqual(['Target', 'Other#^block']);
    expect(note.properties.nested.self).toBe(note.properties.nested);
    expect(note.properties.shared).toBe(note.properties.nested);
    expect(note.properties.list[1]).toBe(note.properties.list);
  });

  it('exposes property-only outgoing edges and backlinks through existing alias/relative/fragment resolution', () => {
    const graph = buildNotes([
      noteFile('Topics/Source.md', [
        '---',
        'category: ["[[../Category]]", "[[Category#Heading|shown]]"]',
        'related: "[[Start#^block]] [[../Category.md]] [[Missing]] [[#Self]]"',
        'nested: {embed: "![[./Nearby]]", encoded: "[[../Encoded%20Note.md]]"}',
        '---',
        '# Self',
      ].join('\n')),
      noteFile('Category.md', '---\naliases: [Start]\n---\n# Heading'),
      noteFile('Topics/Nearby.md', ''),
      noteFile('Encoded Note.md', ''),
    ]);
    const outgoing = new Set(graph[0].links.map(link => resolveNote(link, graph, graph[0].path)?.path).filter(Boolean));
    expect([...outgoing]).toEqual(['Category.md', 'Topics/Source.md', 'Topics/Nearby.md', 'Encoded Note.md']);
    expect(resolveLink(graph[0].links[1], graph, graph[0].path)).toMatchObject({ note: graph[1], anchor: 'heading' });
    expect(resolveLink('Start#^block', graph, graph[0].path)).toMatchObject({ note: graph[1], anchor: 'block' });
    expect(getBacklinks(graph[0], graph)).toEqual([]);
    for (const target of graph.slice(1)) expect(getBacklinks(target, graph)).toEqual([graph[0]]);
    expect(graph.map(note => getBacklinks(note, graph))).toEqual(graph.map(note => scanBacklinks(note, graph)));
  });

  it('keeps link snapshots stable until rebuilt and invalidated after an in-place property edit', () => {
    const graph = buildNotes([
      noteFile('Target.md', ''),
      noteFile('Other.md', ''),
      noteFile('Source.md', '---\ncategory: ["[[Target]]"]\n---'),
    ]);
    expect(getBacklinks(graph[0], graph)).toEqual([graph[2]]);
    graph[2].properties.category = ['[[Other]]'];
    expect(graph[2].links).toEqual(['Target']);
    expect(getBacklinks(graph[0], graph)).toEqual([graph[2]]);
    graph[2].links = extractPropertyLinks(graph[2].properties);
    invalidateNoteIndex(graph);
    expect(getBacklinks(graph[0], graph)).toEqual([]);
    expect(getBacklinks(graph[1], graph)).toEqual([graph[2]]);
  });
});

describe('indexed note resolution', () => {
  const indexed = buildNotes([
    noteFile('Z/Alpha.md', '---\naliases: [Shared, "Fancy Label", "Alias.md", "odd/../alias", 17]\n---\n# Alpha\n[[Alpha]]'),
    noteFile('Projects/Deep/Alpha.md', '---\nalias: Shared\n---\n# Alpha'),
    noteFile('Archive/Alpha.md', '# Alpha'),
    noteFile('Alpha.md', '# Root'),
    noteFile('Projects/Alpha.md', '---\naliases: [Shared]\n---\n# Alpha'),
    noteFile('Projects/Beta.md', '[[Alpha]] [[../Alpha]] [[Shared]] [[#Self]] [[missing]]'),
    noteFile('Fancy Name!.md', '---\ntitle: Display-only Title\nalias: Start\n---\n# Same heading\n## Same heading\n[[Projects/Alpha]]'),
    noteFile('Case/ITEM.MARKDOWN', '# First case'),
    noteFile('case/item.md', '# Second case'),
    noteFile('Suppressed.md', '---\naliases: []\nalias: Suppressed Alias\n---'),
    noteFile('Mix/Name.md', '---\naliases: [shared, " spaced ", "Aliás"]\n---'),
    noteFile('Mix/Alias.md', '---\naliases: [Name]\n---'),
    noteFile('Other/Encoded%Name.md', '# Percent'),
    noteFile('duplicate.md', '# First duplicate'),
    noteFile('duplicate.md', '# Second duplicate'),
  ]);

  it('preserves exact-root-before-local and explicit relative/rooted lookup precedence', () => {
    expect(resolveNote('Alpha', indexed, 'Projects/Beta.md')).toBe(indexed[3]);
    expect(resolveNote('./Alpha.md', indexed, 'Projects/Beta.md')).toBe(indexed[4]);
    expect(resolveNote('../Alpha', indexed, 'Projects/Beta.md')).toBe(indexed[3]);
    expect(resolveNote('/PROJECTS/ALPHA.MARKDOWN', indexed, 'Z/Alpha.md')).toBe(indexed[4]);
    expect(resolveNote('./Shared', indexed, 'Projects/Beta.md')).toBeUndefined();
    expect(resolveNote('/Shared', indexed)).toBeUndefined();
    expect(resolveNote('/fancy-name', indexed)).toBeUndefined();
    expect(resolveNote('Alpha', indexed.filter(note => note.path !== 'Alpha.md'), 'Projects/Beta.md')).toBe(indexed[4]);
  });

  it('preserves alias spelling rules, slug case, Unicode and title non-resolution', () => {
    expect(resolveNote('sHaReD', indexed, 'Projects/Deep/Source.md')).toBe(indexed[1]);
    expect(resolveNote('Fancy%20Label', indexed)).toBe(indexed[0]);
    expect(resolveNote('Alias.md', indexed, 'Z/source.md')).toBe(indexed[0]);
    expect(resolveNote('odd/../alias', indexed)).toBe(indexed[11]);
    expect(resolveNote(' spaced ', indexed)).toBeUndefined();
    expect(resolveNote('Aliás', indexed)).toBe(indexed[10]);
    expect(resolveNote('Suppressed Alias', indexed)).toBeUndefined();
    expect(resolveNote('Display-only Title', indexed)).toBeUndefined();
    expect(resolveNote('fancy-name', indexed)).toBe(indexed[6]);
    expect(resolveNote('FANCY-NAME', indexed)).toBeUndefined();
    expect(resolveNote('[[Fancy%20Name!.md#Same%20heading|label]]', indexed)).toBe(indexed[6]);
    expect(resolveNote('Other/Encoded%25Name.md', indexed)).toBe(indexed[12]);
    expect(resolveNote('Other/Encoded%Name.md', indexed)).toBe(indexed[12]);
  });

  it('chooses ambiguous basenames, slugs and aliases by proximity then lexical order without mutation', () => {
    const noRoot = indexed.filter(note => note.path !== 'Alpha.md');
    Object.freeze(noRoot);
    const before = [...noRoot];
    expect(resolveNote('Missing/Alpha', noRoot)).toBe(indexed[2]);
    expect(resolveNote('Missing/Alpha', noRoot, 'Projects/Deep/More/Source.md')).toBe(indexed[1]);
    expect(resolveNote('Shared', noRoot, 'Projects/Else/Source.md')).toBe(indexed[4]);
    expect(resolveNote('Shared', noRoot, 'projects/Else/Source.md')).toBe(indexed[10]);
    expect(resolveNote('Absent/Name', indexed, 'Mix/Source.md')).toBe(indexed[10]);
    // Alias and basename matches are one candidate set, not priority tiers.
    expect(resolveNote('Name', indexed, 'Mix/Deep/Source.md')).toBe(indexed[11]);
    const sharedSlug = noRoot.map(note => ({ ...note, slug: 'shared', properties: {} }));
    expect(resolveNote('shared', sharedSlug, 'Projects/Deep/More/Source.md')?.path).toBe('Projects/Deep/Alpha.md');
    expect(noRoot).toEqual(before);
  });

  it('preserves first-in-array exact matches and case-sensitive extension-preserving self links', () => {
    expect(resolveNote('CASE/ITEM.md', indexed)).toBe(indexed[7]);
    expect(resolveNote('duplicate', indexed)).toBe(indexed[13]);
    expect(resolveNote('#Section', indexed, 'case/item.md')).toBe(indexed[8]);
    expect(resolveNote('#Section', indexed, 'CASE/ITEM.MARKDOWN')).toBeUndefined();
    expect(resolveNote('#Section', indexed, 'Case/ITEM.md')).toBeUndefined();
    expect(resolveNote('#Section', indexed)).toBeUndefined();
    const tied = indexed.slice(13).map(note => ({ ...note, properties: { aliases: ['tie'] } }));
    expect(resolveNote('tie', tied)).toBe(tied[0]);
  });

  it('matches the original scan for every target and current folder', () => {
    const targets = [
      '', '#Same heading', '#^block', '!', 'Alpha', 'Missing/Alpha', 'Shared', 'sHaReD', 'Start', '17',
      'Fancy Label', 'Alias.md', 'alias', 'odd/../alias', ' spaced ', 'Suppressed Alias', 'Display-only Title',
      'fancy-name', 'FANCY-NAME', 'Name', 'Missing/Name', 'Mix/Alias', 'Aliás', '/Shared', './Shared',
      '../Shared', 'Other/Encoded%Name.md', '[[Fancy%20Name!.md#Same%20heading|label]]',
      '![[Alpha|shown]]', '//host/Alpha', 'https://host/Alpha', 'mailto:Alpha',
      ...indexed.flatMap(note => [note.path, note.path.toUpperCase(), `/${note.path}`, note.slug,
        `./${basename(note.path)}`, `../${basename(note.path)}`, note.path.replace(/\//g, '\\')]),
    ];
    const currentPaths = [undefined, '', 'Missing/Source.md', 'Projects/Deep/More/Source.md', 'projects/Source.md',
      ...indexed.map(note => note.path)];
    for (const collection of [indexed, [...indexed].reverse(), indexed.filter(note => note.path !== 'Alpha.md')]) {
      for (const currentPath of currentPaths) {
        for (const target of targets) {
          expect(resolveNote(target, collection, currentPath), `${target} from ${currentPath}`)
            .toBe(scanResolveNote(target, collection, currentPath));
        }
      }
    }
  });

  it('keeps exported resolveLink anchors and hrefs unchanged', () => {
    expect(resolveLink('![[Fancy%20Name!.md#Same%20heading|label]]', indexed))
      .toEqual({ note: indexed[6], anchor: 'same-heading', href: '#/fancy-name?anchor=same-heading' });
    expect(resolveLink('fancy-name#same-heading-1', indexed).anchor).toBe('same-heading-1');
    expect(resolveLink('[[#^block|self]]', indexed, 'Fancy Name!.md'))
      .toEqual({ note: indexed[6], anchor: 'block', href: '#/fancy-name?anchor=block' });
    expect(resolveLink('missing#Heading', indexed)).toEqual({ note: undefined, anchor: 'heading', href: '#' });
    expect(resolveLink('https://example.com#Heading', indexed)).toEqual({ note: undefined, anchor: 'heading', href: '#' });
  });
});

describe('indexed backlinks and snapshot lifecycle', () => {
  it('matches the original graph for every target, retaining source order and removing duplicate edges/self links', () => {
    const graph = buildNotes([
      noteFile('Z/Source.md', '[[Target]] [[Target#Heading]] [[Start]] [[./Source]] [[missing]] [outside](https://example.com)'),
      noteFile('Target.md', '---\naliases: [Start]\n---\n# Heading\n[[Target]] [[#Heading]] [[Z/Source]]'),
      noteFile('A/Source.md', '[[../Target.md]] [[Start]]'),
      noteFile('Other/Target.md', '[[../Target]] [[./Target]]'),
      noteFile('NoLinks.md', ''),
      noteFile('Target.md', '[[Target]] [[Z/Source]]'),
    ]);
    expect(graph.map(note => getBacklinks(note, graph))).toEqual(graph.map(note => scanBacklinks(note, graph)));
    expect(getBacklinks(graph[1], graph).map(note => note.path)).toEqual(['Z/Source.md', 'A/Source.md', 'Other/Target.md']);
    expect(getBacklinks(graph[0], graph)).toEqual([graph[1], graph[5]]);
    expect(getBacklinks({ ...graph[1] }, graph)).toEqual(scanBacklinks(graph[1], graph));
    expect(getBacklinks({ ...graph[1], path: 'Absent.md' }, graph)).toEqual([]);
  });

  it('builds reverse edges lazily only once and returns independent result arrays', () => {
    const graph = buildNotes([noteFile('Target.md', ''), noteFile('Source.md', '[[Target]]')]);
    const links = vi.fn(() => ['Target', 'Target#Heading']);
    Object.defineProperty(graph[1], 'links', { get: links });
    expect(resolveNote('Target', graph)).toBe(graph[0]);
    expect(links).not.toHaveBeenCalled();
    const first = getBacklinks(graph[0], graph);
    first.reverse();
    first.pop();
    expect(getBacklinks(graph[0], graph)).toEqual([graph[1]]);
    expect(getBacklinks(graph[1], graph)).toEqual([]);
    expect(links).toHaveBeenCalledTimes(1);
    const empty = getBacklinks(graph[1], graph);
    empty.push(graph[0]);
    expect(getBacklinks(graph[1], graph)).toEqual([]);
  });

  it('indexes frozen snapshots once, including highly ambiguous names, without rescanning notes', () => {
    const graph = buildNotes(Array.from({ length: 500 }, (_, i) =>
      noteFile(`Folder${i}/Target.md`, '---\naliases: [Shared]\n---')));
    let pathReads = 0;
    for (const note of graph) {
      const path = note.path;
      Object.defineProperty(note, 'path', { get: () => { pathReads++; return path; } });
      Object.freeze(note.links);
      Object.freeze(note.properties.aliases);
      Object.freeze(note.properties);
      Object.freeze(note);
    }
    Object.freeze(graph);
    expect(resolveNote('Shared', graph, 'Folder321/Deep/Source.md')).toBe(graph[321]);
    const initialReads = pathReads;
    for (let i = 0; i < 200; i++) {
      expect(resolveNote('Shared', graph, 'Folder321/Deep/Source.md')).toBe(graph[321]);
      expect(resolveNote('Missing/Target', graph, 'Folder321/Deep/Source.md')).toBe(graph[321]);
      expect(resolveNote('/Folder321/Target', graph)).toBe(graph[321]);
      expect(resolveNote('Missing', graph)).toBeUndefined();
    }
    expect(pathReads).toBe(initialReads);
  });

  it('uses array identity and explicit invalidation for in-place note/link edits', () => {
    const graph = buildNotes([noteFile('Old.md', '---\naliases: [Old Alias]\n---'), noteFile('Source.md', '[[Old]]')]);
    expect(resolveNote('Old Alias', graph)).toBe(graph[0]);
    expect(getBacklinks(graph[0], graph)).toEqual([graph[1]]);
    graph[0].path = 'Folder/New.md';
    graph[0].folder = 'Folder';
    graph[0].slug = 'new-slug';
    graph[0].properties.aliases = ['New Alias'];
    graph[1].links = ['New Alias'];
    const replacement = [...graph];
    expect(resolveNote('New Alias', replacement)).toBe(graph[0]);
    expect(getBacklinks(graph[0], replacement)).toEqual([graph[1]]);
    invalidateNoteIndex(graph);
    expect(resolveNote('Old Alias', graph)).toBeUndefined();
    expect(resolveNote('New Alias', graph)).toBe(graph[0]);
    expect(resolveNote('new-slug', graph)).toBe(graph[0]);
    expect(getBacklinks(graph[0], graph)).toEqual([graph[1]]);
    graph[1].links = [];
    invalidateNoteIndex(graph);
    expect(getBacklinks(graph[0], graph)).toEqual([]);
  });

  it('automatically rebuilds after length changes and supports explicit same-length reorder invalidation', () => {
    const graph = buildNotes([noteFile('Same.md', ''), noteFile('same.MARKDOWN', '')]);
    expect(resolveNote('same', graph)).toBe(graph[0]);
    const [added] = buildNotes([noteFile('Added.md', '[[Same]]')]);
    graph.push(added);
    expect(resolveNote('Added', graph)).toBe(added);
    expect(getBacklinks(graph[0], graph)).toEqual([added]);
    graph.pop();
    expect(resolveNote('Added', graph)).toBeUndefined();
    expect(getBacklinks(graph[0], graph)).toEqual([]);
    graph.reverse();
    invalidateNoteIndex(graph);
    expect(resolveNote('same', graph)).toBe(graph[0]);
  });
});

describe('search', () => {
  const paths = (query: string) => searchNotes(query, notes).map(note => note.path);
  it('supports implicit AND, negation, quoted phrases, fields and nested OR', () => {
    expect(paths('path:Projects -file:Beta')).toEqual(['Projects/Alpha.md']);
    expect(paths('tag:topic')).toEqual(['Welcome.md']);
    expect(paths('tag:#garden')).toEqual(['Welcome.md', 'Projects/Beta.md']);
    expect(paths('heading:"Same heading"')).toEqual(['Welcome.md']);
    expect(paths('(file:Welcome OR file:Beta) content:"hello world"')).toEqual(['Welcome.md', 'Projects/Beta.md']);
    expect(paths('NOT path:Projects AND archived')).toEqual(['Archive/Alpha.md']);
  });
  it('supports case controls and conventional regexes without throwing on bad patterns', () => {
    expect(paths('match-case:true content:"Hello World"')).toEqual(['Welcome.md']);
    expect(paths('match-case:false content:"Hello World"')).toHaveLength(3);
    expect(paths('heading:/same\\s+heading/i')).toEqual(['Welcome.md']);
    expect(paths('content:/[broken/')).toEqual([]);
    expect(paths('content:/(a+)+$/')).toEqual([]);
    expect(paths('')).toHaveLength(4);
  });
});
