import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import { parseDocument } from 'yaml';

export function createMarkdown(): MarkdownIt {
  // The footnote declarations target markdown-it's CJS types while Bundler resolves ESM types.
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
    .use(footnote as unknown as (md: MarkdownIt) => void);
  // Protect wiki aliases from the table parser before inline parsing; escaped pipes
  // are restored by markdown-it's table rule. Literals inside fences stay untouched.
  md.core.ruler.before('block', 'obsidian_table_aliases', state => {
    let fence = ''; let fenceLength = 0;
    state.src = state.src.split('\n').map(line => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (marker) {
        if (!fence) { fence = marker[1][0]; fenceLength = marker[1].length; }
        else if (marker[1][0] === fence && marker[1].length >= fenceLength) fence = '';
        return line;
      }
      if (fence || !line.replace(/!?\[\[[^\]\n]+\]\]/g, '').includes('|')) return line;
      return line.replace(/!?\[\[[^\]\n]+\]\]/g, match => match.replace(/(?<!\\)\|/g, '\\|'));
    }).join('\n');
  });
  md.core.ruler.after('block', 'obsidian_restore_aliases', state => {
    for (const token of state.tokens) if (token.type === 'inline') {
      token.content = token.content.replace(/!?\[\[[^\]\n]+\]\]/g, match => match.replace(/\\\|/g, '|'));
    }
  });
  md.block.ruler.before('fence', 'obsidian_math_block', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const first = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]).trim();
    const delimiter = first.startsWith('$$') ? '$$' : first.startsWith('\\[') ? '\\[' : '';
    if (!delimiter) return false;
    const close = delimiter === '$$' ? '$$' : '\\]';
    let content = first.slice(2); let line = start;
    if (content.endsWith(close)) content = content.slice(0, -2);
    else {
      const parts = [content]; let found = false;
      while (++line < end) {
        const text = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
        if (text.trimEnd().endsWith(close)) { parts.push(text.trimEnd().slice(0, -2)); found = true; break; }
        parts.push(text);
      }
      if (!found) return false;
      content = parts.join('\n');
    }
    if (!silent) { const token = state.push('obsidian_math_block', '', 0); token.content = content; token.map = [start, line + 1]; }
    state.line = line + 1; return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  return md;
}

export function parseYaml(source: string): unknown {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors[0].message);
  return document.toJS({ maxAliasCount: 50 });
}

export function splitFrontmatter(content: string): { body: string; properties: Record<string, any> } {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(normalized);
  if (!match) return { body: normalized, properties: {} };
  try {
    const value = parseYaml(match[1]);
    const properties = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key)))
      : {};
    return { body: normalized.slice(match[0].length), properties };
  } catch {
    // Invalid metadata remains visible rather than silently losing note content.
    return { body: normalized, properties: {} };
  }
}

/** Obsidian comments are ignored outside literal code spans/fences. */
export function stripComments(source: string): string {
  return source.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[^\n]*|(`+)[\s\S]*?\2|%%[\s\S]*?%%/g,
    match => match.startsWith('%%') ? match.replace(/[^\n]/g, '') : match);
}

export function plainInline(source: string): string {
  return source.replace(/!?\[\[([^\]]+)\]\]/g, (_, target: string) => {
    const [path, alias] = target.split('|');
    return alias ?? path.replace(/^.*\//, '').replace(/\.md(?=#|$)/i, '');
  }).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/[*_~`]/g, '').replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
