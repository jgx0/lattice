import type { Note } from '../types';
import { parseYaml } from './markdown';
import { basename, escapeHtml, internalLink, normalizePath } from './utils';

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

function fileInfo(note: Note): Record<string, Value> {
  const name = basename(note.path).replace(/\.md$/i, '');
  return { path: note.path, name, basename: name, fullname: basename(note.path), folder: note.folder,
    ext: 'md', extension: 'md', tags: note.tags, links: note.links, properties: note.properties, size: note.content.length };
}

interface Context {
  note: Note;
  current: Note;
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
function equals(a: Value, b: Value): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => equals(value, b[i]));
  return a === b;
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
      if (name === 'file') return fileInfo(context.note);
      if (name === 'note') return context.note.properties;
      if (name === 'this') return { ...context.current.properties, file: fileInfo(context.current), note: context.current.properties };
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
        case '==': case '===': return equals(left, right);
        case '!=': case '!==': return !equals(left, right);
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
          case 'contains': return contains(values[0], values[1]);
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
      switch (method) {
        case 'contains': return contains(object, values[0]);
        case 'containsAny': return values.flat().some(value => contains(object, value));
        case 'containsAll': return values.flat().every(value => contains(object, value));
        case 'startsWith': return typeof object === 'string' && object.startsWith(String(values[0]));
        case 'endsWith': return typeof object === 'string' && object.endsWith(String(values[0]));
        case 'lower': case 'toLowerCase': return typeof object === 'string' ? object.toLowerCase() : undefined;
        case 'upper': case 'toUpperCase': return typeof object === 'string' ? object.toUpperCase() : undefined;
        case 'trim': return typeof object === 'string' ? object.trim() : undefined;
        case 'split': return typeof object === 'string' ? object.split(String(values[0] ?? ',')).slice(0, 1000) : [];
        case 'join': return Array.isArray(object) ? object.map(value => String(value ?? '')).join(String(values[0] ?? ', ')) : undefined;
        case 'unique': return Array.isArray(object) ? object.filter((value, index) => object.findIndex(item => equals(item, value)) === index) : [];
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
function contains(container: Value, item: Value): boolean {
  return typeof container === 'string' ? container.includes(String(item)) : Array.isArray(container) && container.some(value => equals(value, item));
}
function makeContext(note: Note, current: Note, formulas: Record<string, string> = {}): Context {
  return { note, current, formulas, cache: new Map(), active: new Set(), budget: { remaining: 20_000 } };
}

/** Extra public helpers are useful for validating a Base without rendering it. Errors are explicit. */
export function evaluateExpression(expression: string, note: Note, currentNote: Note = note, formulas: Record<string, string> = {}): Value {
  return evaluate(parseExpression(expression), makeContext(note, currentNote, formulas));
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
