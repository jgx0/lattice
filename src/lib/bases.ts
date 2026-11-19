import type { Note } from '../types';
import { parseYaml } from './markdown';
import { resolveNote } from './model';
import { notePathKey } from './noteIndex';
import { renderPropertyValue } from './propertyValue';
import { basename, decodeTarget, dirname, escapeHtml, internalLink, normalizePath } from './utils';

type Value = unknown;
type Node = { type: string; value?: any; left?: Node; right?: Node; args?: Node[] };
type Token = { type: 'number' | 'string' | 'name' | 'symbol' | 'end'; value: string };
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'caller', 'callee']);

function lex(source: string): Token[] {
  if (source.length > 10_000) throw new Error('Expression is too long');
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    if (char === '"' || char === "'") {
      const quote = char; i++;
      let value = ''; let closed = false;
      while (i < source.length) {
        const next = source[i++];
        if (next === quote) { closed = true; break; }
        if (next === '\\' && i < source.length) {
          const escaped = source[i++];
          value += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped] ?? escaped;
        } else value += next;
      }
      if (!closed) throw new Error('Unclosed string');
      tokens.push({ type: 'string', value }); continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(i));
    if (number) { tokens.push({ type: 'number', value: number[0] }); i += number[0].length; continue; }
    const name = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(source.slice(i));
    if (name) { tokens.push({ type: 'name', value: name[0] }); i += name[0].length; continue; }
    const symbol = /^(?:===|!==|==|!=|>=|<=|&&|\|\||[.()[\],!<>+*/%?:-])/.exec(source.slice(i));
    if (!symbol) throw new Error(`Unexpected character ${char}`);
    tokens.push({ type: 'symbol', value: symbol[0] }); i += symbol[0].length;
    if (tokens.length > 2000) throw new Error('Expression is too complex');
  }
  return [...tokens, { type: 'end', value: '' }];
}

function parseExpression(source: string): Node {
  const tokens = lex(source);
  let index = 0; let depth = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (value: string) => { if (take().value !== value) throw new Error(`Expected ${value}`); };
  const precedence: Record<string, number> = { or: 1, '||': 1, and: 2, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '>': 4, '<': 4, '>=': 4, '<=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
  function expression(min = 0): Node {
    if (++depth > 64) throw new Error('Expression nesting is too deep');
    let node: Node;
    const token = take();
    if (token.type !== 'string' && ['!', 'not', '-', '+'].includes(token.value)) node = { type: 'unary', value: token.value, left: expression(7) };
    else if (token.type === 'string') node = { type: 'literal', value: token.value };
    else if (token.type === 'number') node = { type: 'literal', value: Number(token.value) };
    else if (token.value === '(') { node = expression(); expect(')'); }
    else if (token.value === '[') {
      const args: Node[] = [];
      if (peek().value !== ']') do { args.push(expression()); if (peek().value !== ',') break; take(); } while (true);
      expect(']'); node = { type: 'list', args };
    } else if (token.type === 'name') node = { type: 'name', value: token.value };
    else throw new Error('Expected a value');
    while (true) {
      if (peek().value === '.') {
        take(); const property = take();
        if (property.type !== 'name') throw new Error('Expected a property');
        node = { type: 'member', left: node, right: { type: 'literal', value: property.value } };
      } else if (peek().value === '[') {
        take(); const property = expression(); expect(']'); node = { type: 'member', left: node, right: property };
      } else if (peek().value === '(') {
        take(); const args: Node[] = [];
        if (peek().value !== ')') do { args.push(expression()); if (peek().value !== ',') break; take(); } while (true);
        expect(')'); node = { type: 'call', left: node, args };
      } else break;
    }
    while (precedence[peek().value] !== undefined && precedence[peek().value] >= min) {
      const operator = take().value;
      node = { type: 'binary', value: operator, left: node, right: expression(precedence[operator] + 1) };
    }
    if (min === 0 && peek().value === '?') {
      take(); const yes = expression(); expect(':'); node = { type: 'conditional', left: node, args: [yes, expression()] };
    }
    depth--; return node;
  }
  const result = expression();
  if (peek().type !== 'end') throw new Error(`Unexpected token ${peek().value}`);
  return result;
}

const fileValue = Symbol('Base file');
const linkValue = Symbol('Base link');
interface BaseLink { [linkValue]: true; path: string; source: string; display?: string }
function makeLink(path: string, source: string, display?: string): BaseLink {
  return { [linkValue]: true, path, source, ...(display == null ? {} : { display }) };
}
function isLink(value: Value): value is BaseLink {
  return value != null && typeof value === 'object' && (value as BaseLink)[linkValue] === true;
}
function isFile(value: Value): boolean {
  return value != null && typeof value === 'object' && (value as Record<symbol, Value>)[fileValue] === true;
}
function fileInfo(note: Note, context: Context): Record<string, Value> {
  const name = basename(note.path).replace(/\.md$/i, '');
  return { [fileValue]: true, path: note.path, name, basename: name, fullname: basename(note.path), folder: note.folder,
    ext: 'md', extension: 'md', tags: note.tags,
    link: makeLink(note.path, ''), links: note.links.map(path => {
      const target = resolveNote(path, context.notes, note.path);
      return makeLink(target?.path ?? path, target ? '' : note.path);
    }), properties: note.properties, size: note.content.length };
}

interface Context {
  note: Note;
  current: Note;
  notes: Note[];
  formulas: Record<string, string>;
  cache: Map<string, Value>;
  active: Set<string>;
  variables?: Record<string, Value>;
  budget: { remaining: number };
}
function own(object: Value, key: string): Value {
  if (forbidden.has(key)) return undefined;
  if (key === 'length' && (typeof object === 'string' || Array.isArray(object))) return object.length;
  return object != null && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key)
    ? (object as Record<string, Value>)[key] : undefined;
}
function targetPath(value: Value, source: string): { path: string; source: string } | undefined {
  if (typeof value === 'string') return { path: value, source };
  const path = own(value, 'path');
  if (typeof path !== 'string') return undefined;
  return { path, source: isFile(value) ? '' : typeof own(value, 'source') === 'string' ? String(own(value, 'source')) : source };
}
function targetIdentity(value: Value, context: Context, source = context.note.path): string | undefined {
  const target = targetPath(value, source);
  if (!target) return undefined;
  const path = decodeTarget(target.path.trim().replace(/^!?\[\[|\]\]$/g, '').split('|')[0].split('#')[0]);
  if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(path)) return undefined;
  if (!path && (!target.path.includes('#') || !target.source)) return undefined;
  const note = resolveNote(target.path, context.notes, target.source);
  if (note) return notePathKey(note.path);
  // Without a complete vault, explicit relative links still have a stable identity.
  return notePathKey(!path ? target.source : /^\.\.?\//.test(path) ? `${dirname(target.source)}/${path}` : path);
}
function equals(a: Value, b: Value, context?: Context): boolean {
  if (context && (isLink(a) || isFile(a) || isLink(b) || isFile(b))) {
    const left = targetIdentity(a, context);
    return left !== undefined && left === targetIdentity(b, context);
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => equals(value, b[i], context));
  return a === b;
}
function hasLink(file: Value, target: Value, context: Context): boolean {
  const path = own(file, 'path');
  const note = typeof path === 'string' ? resolveNote(path, context.notes) : undefined;
  const identity = targetIdentity(target, context, note?.path ?? context.note.path);
  if (!note || identity === undefined) return false;
  return note.links.some(link => targetIdentity(link, context, note.path) === identity);
}
function hasTag(file: Value, target: Value): boolean {
  if (typeof target !== 'string') return false;
  const tag = target.trim().replace(/^#/, '').toLocaleLowerCase();
  const tags = own(file, 'tags');
  return !!tag && Array.isArray(tags) && tags.some(value => typeof value === 'string'
    && (value.toLocaleLowerCase() === tag || value.toLocaleLowerCase().startsWith(`${tag}/`)));
}
function stringValue(value: Value): string {
  if (isLink(value)) return `[[${value.path}${value.display == null ? '' : `|${value.display}`}]]`;
  if (Array.isArray(value)) return value.map(stringValue).join(', ');
  return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}
function compare(a: Value, b: Value): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}
function formulaValue(name: string, context: Context): Value {
  if (forbidden.has(name)) return undefined;
  if (context.cache.has(name)) return context.cache.get(name);
  if (!Object.prototype.hasOwnProperty.call(context.formulas, name)) return undefined;
  if (context.active.has(name)) throw new Error(`Circular formula: ${name}`);
  context.active.add(name);
  try {
    const value = evaluate(parseExpression(context.formulas[name]), context);
    context.cache.set(name, value); return value;
  } finally { context.active.delete(name); }
}
function evaluate(node: Node, context: Context): Value {
  if (--context.budget.remaining < 0) throw new Error('Expression operation limit exceeded');
  const run = (child: Node) => evaluate(child, context);
  switch (node.type) {
    case 'literal': return node.value;
    case 'list': return node.args!.map(run);
    case 'name': {
      const name = node.value as string;
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (name === 'null' || name === 'undefined') return null;
      if (name === 'file') return fileInfo(context.note, context);
      if (name === 'note') return context.note.properties;
      if (name === 'this') return { ...context.current.properties, file: fileInfo(context.current, context), note: context.current.properties };
      if (name === 'formula') return null; // Resolved specially below, never a JS getter.
      if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, name)) return own(context.variables, name);
      return own(context.note.properties, name);
    }
    case 'member': {
      const key = String(run(node.right!));
      if (node.left?.type === 'name' && node.left.value === 'formula') return formulaValue(key, context);
      return own(run(node.left!), key);
    }
    case 'unary': {
      const value = run(node.left!);
      return node.value === '!' || node.value === 'not' ? !value : node.value === '-' ? -Number(value) : Number(value);
    }
    case 'conditional': return run(node.left!) ? run(node.args![0]) : run(node.args![1]);
    case 'binary': {
      const left = run(node.left!);
      if (node.value === 'and' || node.value === '&&') return Boolean(left) && Boolean(run(node.right!));
      if (node.value === 'or' || node.value === '||') return Boolean(left) || Boolean(run(node.right!));
      const right = run(node.right!);
      switch (node.value) {
        case '==': case '===': return equals(left, right, context);
        case '!=': case '!==': return !equals(left, right, context);
        case '>': return left != null && right != null && compare(left, right) > 0;
        case '<': return left != null && right != null && compare(left, right) < 0;
        case '>=': return left != null && right != null && compare(left, right) >= 0;
        case '<=': return left != null && right != null && compare(left, right) <= 0;
        case '+': return typeof left === 'string' || typeof right === 'string' ? String(left ?? '') + String(right ?? '') : Number(left) + Number(right);
        case '-': return Number(left) - Number(right);
        case '*': return Number(left) * Number(right);
        case '/': return Number(left) / Number(right);
        case '%': return Number(left) % Number(right);
      }
      return undefined;
    }
    case 'call': {
      const callee = node.left!;
      const args = node.args ?? [];
      if (callee.type === 'name') {
        if (callee.value === 'if') return run(args[0]) ? args[1] && run(args[1]) : args[2] && run(args[2]);
        const values = args.map(run);
        switch (callee.value) {
          case 'list': return values;
          case 'length': return typeof values[0] === 'string' || Array.isArray(values[0]) ? values[0].length : 0;
          case 'contains': return contains(values[0], values[1], context);
          case 'link': {
            const target = targetPath(values[0], context.note.path);
            if (!target) throw new Error('link requires a path or Link');
            return makeLink(target.path, target.source, values[1] == null ? undefined : stringValue(values[1]));
          }
          case 'any': return values.flat().some(Boolean);
          case 'all': return values.flat().every(Boolean);
          case 'number': return Number(values[0]);
          case 'string': return String(values[0] ?? '');
          case 'date': { const time = Date.parse(String(values[0])); return Number.isFinite(time) ? time : null; }
          case 'min': return Math.min(...values.flat().map(Number));
          case 'max': return Math.max(...values.flat().map(Number));
          case 'sum': return values.flat().reduce<number>((sum, item) => sum + Number(item), 0);
          case 'round': return Math.round(Number(values[0]));
          case 'abs': return Math.abs(Number(values[0]));
          case 'isEmpty': return values[0] == null || values[0] === '' || Array.isArray(values[0]) && values[0].length === 0;
          default: throw new Error(`Unsupported function: ${callee.value}`);
        }
      }
      if (callee.type !== 'member') throw new Error('Only named functions and supported methods can be called');
      const method = String(run(callee.right!));
      if (forbidden.has(method)) throw new Error('Unsafe method');
      const object = run(callee.left!);
      if ((method === 'map' || method === 'filter') && Array.isArray(object)) {
        if (object.length > 1000) throw new Error('List is too long');
        const operation = (value: Value, index: number) => evaluate(args[0], { ...context, variables: { ...context.variables, value, index } });
        return method === 'map' ? object.map(operation) : object.filter(operation);
      }
      const values = args.map(run);
      if (method === 'inFolder') {
        // Must be the actual file metadata expression, not user-provided data.
        const target = callee.left!;
        const isFile = target.type === 'name' && target.value === 'file'
          || target.type === 'member' && target.left?.type === 'name' && target.left.value === 'this' && run(target.right!) === 'file';
        if (!isFile) throw new Error('inFolder requires file or this.file');
        const folder = normalizePath(String(values[0] ?? ''));
        const path = String(own(object, 'path'));
        return !folder || path.startsWith(`${folder}/`);
      }
      if (method === 'hasLink' || method === 'hasTag') {
        if (!isFile(object)) throw new Error(`${method} requires file or this.file`);
        return method === 'hasLink' ? hasLink(object, values[0], context) : hasTag(object, values[0]);
      }
      switch (method) {
        case 'contains': return contains(object, values[0], context);
        case 'containsAny': return values.flat().some(value => contains(object, value, context));
        case 'containsAll': return values.flat().every(value => contains(object, value, context));
        case 'toString': return stringValue(object);
        case 'startsWith': return typeof object === 'string' && object.startsWith(String(values[0]));
        case 'endsWith': return typeof object === 'string' && object.endsWith(String(values[0]));
        case 'lower': case 'toLowerCase': return typeof object === 'string' ? object.toLowerCase() : undefined;
        case 'upper': case 'toUpperCase': return typeof object === 'string' ? object.toUpperCase() : undefined;
        case 'trim': return typeof object === 'string' ? object.trim() : undefined;
        case 'split': return typeof object === 'string' ? object.split(String(values[0] ?? ',')).slice(0, 1000) : [];
        case 'join': return Array.isArray(object) ? object.map(stringValue).join(String(values[0] ?? ', ')) : undefined;
        case 'unique': return Array.isArray(object) ? object.filter((value, index) => object.findIndex(item => equals(item, value, context)) === index) : [];
        case 'reverse': return Array.isArray(object) ? [...object].reverse() : undefined;
        case 'sort': return Array.isArray(object) ? [...object].sort(compare) : undefined;
        case 'slice': return typeof object === 'string' || Array.isArray(object) ? object.slice(Number(values[0] ?? 0), values[1] == null ? undefined : Number(values[1])) : undefined;
        case 'isEmpty': return object == null || object === '' || Array.isArray(object) && !object.length;
        default: throw new Error(`Unsupported method: ${method}`);
      }
    }
    default: throw new Error('Invalid expression');
  }
}
function contains(container: Value, item: Value, context: Context): boolean {
  return typeof container === 'string' ? container.includes(stringValue(item)) : Array.isArray(container) && container.some(value => equals(value, item, context));
}
function makeContext(note: Note, current: Note, formulas: Record<string, string> = {}, notes?: Note[]): Context {
  // Small standalone evaluations can still resolve the candidate and host aliases.
  return { note, current, notes: notes ?? (note === current ? [note] : [note, current]),
    formulas, cache: new Map(), active: new Set(), budget: { remaining: 20_000 } };
}

/** Extra public helpers are useful for validating a Base without rendering it. Errors are explicit. */
export function evaluateExpression(expression: string, note: Note, currentNote: Note = note, formulas: Record<string, string> = {}, notes?: Note[]): Value {
  return evaluate(parseExpression(expression), makeContext(note, currentNote, formulas, notes));
}
function filterMatches(filter: unknown, context: Context): boolean {
  if (filter == null) return true;
  if (typeof filter === 'boolean') return filter;
  if (typeof filter === 'string') return Boolean(evaluate(parseExpression(filter), context));
  if (Array.isArray(filter)) return filter.every(item => filterMatches(item, context));
  if (typeof filter !== 'object') throw new Error('Invalid Base filter');
  const entries = Object.entries(filter);
  if (!entries.length) return true;
  return entries.every(([operator, value]) => {
    const items = Array.isArray(value) ? value : [value];
    switch (operator) {
      case 'and': return items.every(item => filterMatches(item, context));
      case 'or': return items.some(item => filterMatches(item, context));
      case 'not': return !items.some(item => filterMatches(item, context));
      default: throw new Error(`Unsupported filter group: ${operator}`);
    }
  });
}
export function matchesFilters(filters: unknown, note: Note, currentNote: Note = note, notes?: Note[]): boolean {
  return filterMatches(filters, makeContext(note, currentNote, {}, notes));
}
function fieldValue(field: string, context: Context): Value {
  if (field.startsWith('formula.')) return formulaValue(field.slice(8), context);
  if (field.startsWith('file.')) return own(fileInfo(context.note, context), field.slice(5));
  return own(context.note.properties, field.replace(/^note\./, ''));
}
function propertyValue(value: Value): Value {
  if (isLink(value)) return stringValue(value);
  return Array.isArray(value) ? value.map(propertyValue) : value;
}

export function renderBase(baseContent: string, notes: Note[], currentNote: Note): string {
  try {
    const parsed = parseYaml(baseContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Base must be a YAML mapping');
    const base = parsed as Record<string, any>;
    const formulas = Object.fromEntries(Object.entries(base.formulas ?? {}).filter(([key, value]) => !forbidden.has(key) && typeof value === 'string')) as Record<string, string>;
    const views = Array.isArray(base.views) && base.views.length ? base.views : [{ type: 'table', name: 'Table' }];
    const result = views.map((view: Record<string, any>) => {
      if (!view || typeof view !== 'object') throw new Error('Invalid view');
      const type = view.type ?? 'table';
      if (!['table', 'list', 'cards'].includes(type)) throw new Error(`Unsupported view: ${type}`);
      const name = String(view.name ?? type);
      let rows = notes.map(note => ({ note, context: makeContext(note, currentNote, formulas, notes) }))
        .filter(row => filterMatches(base.filters, row.context) && filterMatches(view.filters, row.context));
      const sort = Array.isArray(view.sort) ? view.sort : view.sort ? [view.sort] : [];
      if (sort.length) rows.sort((a, b) => {
        for (const entry of sort) {
          const field = typeof entry === 'string' ? entry : entry.property ?? entry.field;
          if (typeof field !== 'string') continue;
          const direction = typeof entry === 'object' ? entry.direction ?? entry.order ?? 'ASC' : 'ASC';
          const comparison = compare(fieldValue(field, a.context), fieldValue(field, b.context));
          if (comparison) return /^(?:desc|descending)$/i.test(String(direction)) ? -comparison : comparison;
        }
        return a.note.path.localeCompare(b.note.path);
      });
      if (view.limit != null && Number.isFinite(Number(view.limit))) rows = rows.slice(0, Math.max(0, Math.floor(Number(view.limit))));
      const order = Array.isArray(view.order) ? view.order.filter((item: unknown) => typeof item === 'string') : ['file.name'];
      const fields: string[] = order.length ? order : ['file.name'];
      const label = (field: string) => String(base.properties?.[field]?.displayName ?? field.replace(/^(note|file|formula)\./, ''));
      const cell = (field: string, row: typeof rows[number]) => {
        const value = fieldValue(field, row.context);
        if (field === 'file.name' || field === 'file.path' || field === 'file.basename') {
          return internalLink(row.note.path, row.note.slug, field === 'file.path' ? row.note.path : value);
        }
        return renderPropertyValue(propertyValue(value), notes, row.note.path);
      };
      const heading = `<h3 class="base-view-title">${escapeHtml(name)}</h3>`;
      let html: string;
      if (type === 'table') {
        html = `<div class="base-table-wrapper"><table class="base-table"><thead><tr>${fields.map(field => `<th scope="col">${escapeHtml(label(field))}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${fields.map(field => `<td>${cell(field, row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      } else if (type === 'list') {
        html = `<ul class="base-list">${rows.map(row => `<li>${internalLink(row.note.path, row.note.slug, row.note.title)}${fields.filter(field => !['file.name', 'file.basename'].includes(field)).map(field => `<span class="base-list-property" data-property="${escapeHtml(field)}">${escapeHtml(label(field))}: ${cell(field, row)}</span>`).join('')}</li>`).join('')}</ul>`;
      } else {
        html = `<div class="base-cards">${rows.map(row => `<article class="base-card"><h4>${internalLink(row.note.path, row.note.slug, row.note.title)}</h4><dl>${fields.filter(field => !['file.name', 'file.basename'].includes(field)).map(field => `<dt>${escapeHtml(label(field))}</dt><dd>${cell(field, row)}</dd>`).join('')}</dl></article>`).join('')}</div>`;
      }
      return `<section class="base-view base-view-${type}" data-base="${escapeHtml(name)}">${heading}${html}${!rows.length ? '<p class="base-empty">No matching notes.</p>' : ''}</section>`;
    });
    return result.join('\n');
  } catch (error) {
    return `<div class="base-error" role="status">Unable to render Base: ${escapeHtml(error instanceof Error ? error.message : 'Invalid configuration')}</div>`;
  }
}
