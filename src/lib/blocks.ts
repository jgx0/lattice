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
