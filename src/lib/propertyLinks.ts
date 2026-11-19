export interface PropertyWikilink {
  raw: string;
  target: string;
  alias?: string;
  embed: boolean;
  start: number;
  end: number;
}

/** Parse only wikilinks, retaining offsets for rendering the surrounding text. */
export function parsePropertyWikilinks(value: string): PropertyWikilink[] {
  const links: PropertyWikilink[] = [];
  for (const match of value.matchAll(/(!?)\[\[([^\[\]\r\n]+)\]\]/g)) {
    // Obsidian also uses escaped alias pipes (notably in copied table links).
    const content = match[2].replace(/\\\|/g, '|');
    const separator = content.indexOf('|');
    const target = (separator < 0 ? content : content.slice(0, separator)).trim();
    if (!target) continue;
    links.push({
      raw: match[0], target,
      ...(separator < 0 ? {} : { alias: content.slice(separator + 1).trim() }),
      embed: match[1] === '!', start: match.index!, end: match.index! + match[0].length,
    });
  }
  return links;
}

/**
 * Extract unique targets from property values in first-occurrence order.
 * Only strings are parsed; object keys and non-string scalars are not links.
 * Iteration avoids recursion limits, and YAML alias cycles/shared objects are
 * visited once. Neither the values nor their displayed strings are changed.
 */
export function extractPropertyLinks(value: unknown): string[] {
  const targets = new Set<string>();
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (typeof current === 'string') {
      for (const link of parsePropertyWikilinks(current)) targets.add(link.target);
    } else if (current !== null && typeof current === 'object' && !seen.has(current)) {
      seen.add(current);
      const children = Array.isArray(current) ? current : Object.values(current);
      for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
    }
  }
  return [...targets];
}
