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
}

function setAttribute(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "gi");
  return tag.replace(pattern, "").replace(/>$/, () => ` ${name}="${escapeHtml(value)}">`);
}

function navigation(site: CompiledSite, current?: PublishedNote): string {
  type Folder = { path: string; label: string; folders: Map<string, Folder>; notes: PublishedNote[] };
  const root: Folder = { path: "", label: "", folders: new Map(), notes: [] };
  for (const note of site.notes) {
    let parent = root;
    for (const segment of (site.settings.navigationFolders?.[note.path] ?? note.folder).split("/").filter(Boolean)) {
      const path = parent.path ? `${parent.path}/${segment}` : segment;
      let folder = parent.folders.get(segment);
      if (!folder) {
        folder = { path, label: segment, folders: new Map(), notes: [] };
        parent.folders.set(segment, folder);
      }
      parent = folder;
    }
    parent.notes.push(note);
  }
  const rank = (path: string) => {
    const index = site.settings.navigation.indexOf(path);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const link = (note: PublishedNote) => `<div class="tree-item nav-file"><a class="tree-item-self nav-file-title note-nav${note.path === current?.path ? " is-active selected" : ""}" href="${escapeHtml(note.url)}"${note.path === current?.path ? ' aria-current="page"' : ""}><span class="tree-item-inner nav-file-title-content">${escapeHtml(note.title)}</span></a></div>`;
  const tree = (folder: Folder): string => {
    const folders = [...folder.folders.values()].sort((a, b) => rank(a.path) - rank(b.path) || a.label.localeCompare(b.label));
    const notes = [...folder.notes].sort((a, b) => rank(a.path) - rank(b.path) || a.title.localeCompare(b.title));
    return folders.map(child => `<details class="tree-item nav-folder" open><summary class="tree-item-self nav-folder-title folder-toggle"><span class="tree-item-icon collapse-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></span><span class="tree-item-inner nav-folder-title-content">${escapeHtml(child.label)}</span></summary><div class="tree-item-children nav-folder-children folder-notes">${tree(child)}</div></details>`).join("") + notes.map(link).join("");
  };
  return tree(root);
}

function initialContent(site: CompiledSite, note?: PublishedNote): string {
  const home = homeNote(site);
  const headings = note?.headings.filter(heading => heading.level > 1 && heading.level < 5) ?? [];
  const backlinks = (note?.backlinks ?? []).map(path => site.notes.find(candidate => candidate.path === path)).filter((candidate): candidate is PublishedNote => !!candidate);
  const toc = site.settings.showToc ? `<section class="toc"><div class="aside-heading">On this page</div><nav aria-label="Table of contents">${headings.map(heading => `<a class="toc-link level-${heading.level}" href="#${escapeHtml(encodeURIComponent(heading.id))}">${escapeHtml(heading.text)}</a>`).join("") || '<p class="empty-hint">No headings on this page.</p>'}</nav></section>` : "";
  const mentions = site.settings.showBacklinks ? `<section class="backlinks"><div class="aside-heading"><span>Linked mentions</span><span class="aside-count">${backlinks.length}</span></div>${backlinks.map(backlink => `<a class="backlink" href="${escapeHtml(backlink.url)}"><span>${escapeHtml(backlink.title)}</span></a>`).join("") || '<p class="empty-hint">No linked mentions.</p>'}</section>` : "";
  const classes = Array.isArray(note?.properties.cssclasses) ? note.properties.cssclasses : typeof note?.properties.cssclasses === "string" ? note.properties.cssclasses.split(/\s+/) : [];
  return `<main id="static-content" class="app-shell published-container">
  <aside class="sidebar site-body-left-column" aria-label="Site navigation"><div class="workspace-leaf-content" data-type="file-explorer"><header class="site-header"><a class="site-name" href="${escapeHtml(home?.url ?? "/")}">${escapeHtml(site.settings.title || site.name)}</a></header><nav class="vault-navigation nav-files-container" aria-label="Notes">${navigation(site, note)}</nav></div></aside>
