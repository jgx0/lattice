import type Token from 'markdown-it/lib/token.mjs';

/** Locate block references without matching fenced code or arbitrary text occurrences. */
export function findBlockRange(tokens: Token[], id: string): [number, number] | undefined {
  const ancestors: Token[] = [];
  for (const token of tokens) {
    if (token.nesting === 1) ancestors.push(token);
    if (token.type === 'inline' && token.map) {
      const marker = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/.exec(token.content);
      const last = token.children?.at(-1);
      if (marker?.[1] === id && last?.type === 'text' && last.content.endsWith(`^${id}`)) {
        if (token.content.trim() === `^${id}`) {
          const previous = tokens.filter(item => item.map && item.block && item.map[1] <= token.map![0]);
          previous.sort((a, b) => b.map![1] - a.map![1] || a.map![0] - b.map![0]);
          return previous[0]?.map ? [previous[0].map[0], token.map[1]] : undefined;
        }
        const container = ancestors.find(item => ['bullet_list_open', 'ordered_list_open', 'blockquote_open', 'table_open'].includes(item.type));
        return container?.map ?? token.map;
      }
    }
    if (token.nesting === -1) ancestors.pop();
  }
  return undefined;
}
