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
