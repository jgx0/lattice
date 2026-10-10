import type { Note } from '../types';
import { basename } from './utils';

type SearchToken = { kind: 'term' | 'and' | 'or' | 'not' | '(' | ')'; value: string };
function tokenizeSearch(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  let i = 0;
  while (i < query.length) {
    if (/\s/.test(query[i])) { i++; continue; }
    if ('()'.includes(query[i])) { tokens.push({ kind: query[i] as '(' | ')', value: query[i++] }); continue; }
    if (query[i] === '-' || query[i] === '!') { tokens.push({ kind: 'not', value: query[i++] }); continue; }
    let value = '';
    let quote = '';
    let regex = false;
    while (i < query.length) {
      const char = query[i];
      if (char === '\\' && i + 1 < query.length && (quote || regex)) { value += char + query[i + 1]; i += 2; continue; }
      if (quote) { value += char; i++; if (char === quote) quote = ''; continue; }
      if (regex) { value += char; i++; if (char === '/') regex = false; continue; }
      if (char === '"' || char === "'") { quote = char; value += char; i++; continue; }
      if (char === '/' && (!value || value.endsWith(':'))) { regex = true; value += char; i++; continue; }
      if (/\s/.test(char) || char === '(' || char === ')') break;
      value += char; i++;
    }
    if (value) tokens.push({ kind: /^(AND|OR|NOT)$/.test(value) ? value.toLowerCase() as 'and' | 'or' | 'not' : 'term', value });
    else i++;
  }
  return tokens;
}

/** AND is implicit; OR, NOT/- and parentheses are supported. Invalid regexes match nothing. */
export function searchNotes(query: string, notes: Note[]): Note[] {
  let caseSensitive = false;
  const tokens = tokenizeSearch(query).filter(token => {
    if (token.kind === 'term' && /^match-case:(?:true|false)?$/i.test(token.value)) {
