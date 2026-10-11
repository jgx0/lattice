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
      caseSensitive = !/false$/i.test(token.value); return false;
    }
    return true;
  });
  if (!tokens.length) return notes.slice();
  type Predicate = (note: Note) => boolean;
  let position = 0;
  function term(value: string): Predicate {
    const fieldMatch = /^(path|file|tag|heading|content):([\s\S]*)$/i.exec(value);
    const field = fieldMatch?.[1].toLowerCase() ?? '';
    let needle = fieldMatch?.[2] ?? value;
    if (/^(["'])[\s\S]*\1$/.test(needle)) needle = needle.slice(1, -1).replace(/\\(["'\\])/g, '$1');
    const regexMatch = /^\/([\s\S]*)\/([imsu]*)$/.exec(needle);
    let regex: RegExp | undefined;
    if (regexMatch) {
      // Reject common exponential regex shapes; cap searched input as a second safeguard.
      if (regexMatch[1].length > 256 || /\([^)]*[+*][^)]*\)[+*{]|\\[1-9]/.test(regexMatch[1])) return () => false;
      try { regex = new RegExp(regexMatch[1], [...new Set(`${regexMatch[2]}${caseSensitive ? '' : 'i'}`)].join('')); }
      catch { return () => false; }
    }
    const normalized = caseSensitive ? needle : needle.toLocaleLowerCase();
    const matches = (text: string) => regex ? regex.test(text.slice(0, 100_000))
      : (caseSensitive ? text : text.toLocaleLowerCase()).includes(normalized);
    return note => {
      switch (field) {
        case 'path': return matches(note.path);
        case 'file': return matches(basename(note.path));
        case 'heading': return note.headings.some(heading => matches(heading.text));
        case 'content': return matches(note.body);
        case 'tag': {
          const tag = normalized.replace(/^#/, '');
          return note.tags.some(item => regex ? matches(item) : (caseSensitive ? item : item.toLocaleLowerCase()) === tag
            || (caseSensitive ? item : item.toLocaleLowerCase()).startsWith(`${tag}/`));
        }
        default: return matches(`${note.title}\n${note.path}\n${note.body}`);
