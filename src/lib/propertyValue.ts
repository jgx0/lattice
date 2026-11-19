import type { Note } from "../types";
import { resolveLink } from "./model";
import { parsePropertyWikilinks } from "./propertyLinks";
import { escapeHtml } from "./utils";

export type PropertyHref = (note: Note, anchor: string) => string;

/** Property values are text and links, never Markdown HTML or transclusions. */
export function renderPropertyValue(
  value: unknown,
  notes: Note[],
  currentPath?: string,
  href?: PropertyHref,
): string {
  const ancestors = new Set<object>();
  function render(item: unknown, depth: number): string {
    if (item == null) return "";
    if (typeof item === "string") {
      let html = "",
        end = 0;
      for (const match of parsePropertyWikilinks(item)) {
        html += escapeHtml(item.slice(end, match.start));
        const target = match.target;
        const label =
          match.alias ??
          target.replace(/\.md(?=#|$)/i, "").replace(/^.*\//, "");
        const link = resolveLink(target, notes, currentPath);
        if (link.note) {
          const url = href ? href(link.note, link.anchor) : link.href;
          html += `<a class="internal-link metadata-link" data-note="${escapeHtml(link.note.path)}" data-anchor="${escapeHtml(link.anchor)}" href="${escapeHtml(url)}">${escapeHtml(label || link.note.title)}</a>`;
        } else
          html += `<span class="internal-link is-unresolved metadata-link" aria-disabled="true">${escapeHtml(label || target)}</span>`;
        end = match.end;
      }
      return html + escapeHtml(item.slice(end));
    }
    if (typeof item !== "object") return escapeHtml(item);
    if (depth >= 32 || ancestors.has(item)) return escapeHtml("[…]");
    ancestors.add(item);
    try {
      if (Array.isArray(item))
        return item.map((child) => render(child, depth + 1)).join(", ");
      return Object.entries(item)
        .map(
          ([key, child]) => `${escapeHtml(key)}: ${render(child, depth + 1)}`,
        )
        .join("; ");
    } finally {
      ancestors.delete(item);
    }
  }
  return render(value, 0);
}
