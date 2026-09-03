import type { CompiledSite, PublishedNote } from "../src/types";

const CONTENT_START = "<!--published-content:start-->";
const CONTENT_END = "<!--published-content:end-->";

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** Match only published URLs; never infer a vault path from a request. */
export function findPublishedNote(site: CompiledSite, pathname: string): PublishedNote | undefined {
  const normalize = (value: string) => {
    try { value = decodeURIComponent(value); } catch { return undefined; }
    if (value.includes("\\") || value.includes("\0") || value.split("/").some(part => part === "." || part === "..")) return undefined;
    return value.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";
  };
  const requested = normalize(pathname);
  if (requested === undefined) return undefined;
  return site.notes.find(note => normalize(note.url) === requested);
}

export function homeNote(site: CompiledSite): PublishedNote | undefined {
  return site.notes.find(note => note.path === site.settings.home) ?? site.notes[0];
}

/** Convert a public clean URL into a safe, output-relative page filename. */
export function publishedPageFile(url: string, base = "/"): string {
  if (!url.startsWith(base)) throw new Error(`Published URL is outside the configured base: ${url}`);
  const route = url.slice(base.length).replace(/^\/+|\/+$/g, "");
  let decoded: string;
  try { decoded = decodeURIComponent(route); } catch { throw new Error(`Invalid published URL: ${url}`); }
  if (/[\\\0?#]/.test(decoded) || decoded.split("/").some(part => part === "." || part === "..")) {
    throw new Error(`Unsafe published URL: ${url}`);
  }
  return decoded ? `${decoded}/index.html` : "index.html";
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
  }
  return result;
