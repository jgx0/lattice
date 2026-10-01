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
