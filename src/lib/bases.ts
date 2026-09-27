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
