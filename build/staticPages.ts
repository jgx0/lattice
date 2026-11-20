import type { CompiledSite, PublishedNote } from "../src/types";
import { appearanceBootstrap } from "./appearanceBootstrap";

const CONTENT_START = "<!--published-content:start-->";
const CONTENT_END = "<!--published-content:end-->";

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function normalizeRoute(value: string): string | undefined {
  try {
    value = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  if (
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    value.split("/").some((part) => part === "." || part === "..")
  )
    return undefined;
  return value.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";
}

type NavigationLink = { start: number; end: number; selected: string };
type Navigation = { html: string; links: Map<string, NavigationLink[]> };
export type PageRenderer = (note?: PublishedNote | null) => string;
type CachedRenderer = { template: string; render: PageRenderer };
type SiteCache = {
  byPath: Map<string, PublishedNote>;
  byUrl: Map<string, PublishedNote>;
  home: PublishedNote | undefined;
  themeCss: string;
  navigation?: Navigation;
  page?: CachedRenderer;
  notFound?: CachedRenderer;
};

// Compiled snapshots are immutable. Weak keys release indexes, navigation and shells
// with their snapshot; at most the last template of each kind is retained per site.
const siteCaches = new WeakMap<CompiledSite, SiteCache>();
function siteCache(site: CompiledSite): SiteCache {
  let cached = siteCaches.get(site);
  if (!cached) {
    const byPath = new Map<string, PublishedNote>(),
      byUrl = new Map<string, PublishedNote>();
    for (const note of site.notes) {
      if (!byPath.has(note.path)) byPath.set(note.path, note);
      const route = normalizeRoute(note.url);
      if (route !== undefined && !byUrl.has(route)) byUrl.set(route, note);
    }
    cached = {
      byPath,
      byUrl,
      home: byPath.get(site.settings.home) ?? site.notes[0],
      // Raw-text elements must not be closed by CSS strings or comments.
      themeCss: site.themeCss.replace(/<\/style/gi, "<\\/style"),
    };
    siteCaches.set(site, cached);
  }
  return cached;
}

/** Match only published URLs; never infer a vault path from a request. */
export function findPublishedNote(
  site: CompiledSite,
  pathname: string,
): PublishedNote | undefined {
  const requested = normalizeRoute(pathname);
  return requested === undefined
    ? undefined
    : siteCache(site).byUrl.get(requested);
}

export function validatePublishedRoutes(
  notes: ReadonlyArray<{ path: string; url: string }>,
  base: string,
): void {
  const routes = new Map<string, string>();
  for (const note of notes) {
    publishedPageFile(note.url, base);
    const route = normalizeRoute(note.url);
    if (route === undefined)
      throw new Error(`Unsafe published route: ${note.url}`);
    const previous = routes.get(route);
    if (previous)
      throw new Error(
        `Published route collision: ${previous} and ${note.path} share ${note.url}`,
      );
    routes.set(route, note.path);
  }
}

export function homeNote(site: CompiledSite): PublishedNote | undefined {
  return siteCache(site).home;
}

/** Convert a public clean URL into a safe, output-relative page filename. */
export function publishedPageFile(url: string, base = "/"): string {
  if (!url.startsWith(base))
    throw new Error(`Published URL is outside the configured base: ${url}`);
  const route = url.slice(base.length).replace(/^\/+|\/+$/g, "");
  let decoded: string;
  try {
    decoded = decodeURIComponent(route);
  } catch {
    throw new Error(`Invalid published URL: ${url}`);
  }
  if (
    /[\\\u0000-\u001f\u007f?#]/.test(decoded) ||
    /%2f|%5c/i.test(route) ||
    (decoded !== "" &&
      decoded.split("/").some((part) => !part || part === "." || part === ".."))
  ) {
    throw new Error(`Unsafe published URL: ${url}`);
  }
  return decoded ? `${decoded}/index.html` : "index.html";
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of tag.matchAll(
    /([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
  )) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
  }
  return result;
}

function setAttribute(tag: string, name: string, value: string): string {
  const pattern = new RegExp(
    `\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "gi",
  );
  return tag
    .replace(pattern, "")
    .replace(/>$/, () => ` ${name}="${escapeHtml(value)}">`);
}

function buildNavigation(site: CompiledSite): Navigation {
  type Folder = {
    path: string;
    label: string;
    folders: Map<string, Folder>;
    notes: PublishedNote[];
  };
  const root: Folder = { path: "", label: "", folders: new Map(), notes: [] };
  for (const note of site.notes) {
    let parent = root;
    for (const segment of (
      site.settings.navigationFolders?.[note.path] ?? note.folder
    )
      .split("/")
      .filter(Boolean)) {
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
  const collapsed = new Set(site.settings.collapsedFolders ?? []);
  const ranks = new Map<string, number>();
  site.settings.navigation.forEach((path, index) => {
    if (!ranks.has(path)) ranks.set(path, index);
  });
  const rank = (path: string) => ranks.get(path) ?? Number.MAX_SAFE_INTEGER;
  const chunks: string[] = [],
    links = new Map<string, NavigationLink[]>();
  let length = 0;
  const append = (html: string) => {
    chunks.push(html);
    length += html.length;
  };
  const tree = (folder: Folder): void => {
    const folders = [...folder.folders.values()].sort(
      (a, b) => rank(a.path) - rank(b.path) || a.label.localeCompare(b.label),
    );
    const notes = [...folder.notes].sort(
      (a, b) => rank(a.path) - rank(b.path) || a.title.localeCompare(b.title),
    );
    for (const child of folders) {
      append(
        `<details class="tree-item nav-folder"${collapsed.has(child.path) ? "" : " open"}><summary class="tree-item-self nav-folder-title folder-toggle"><span class="tree-item-icon collapse-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></span><span class="tree-item-inner nav-folder-title-content">${escapeHtml(child.label)}</span></summary><div class="tree-item-children nav-folder-children folder-notes">`,
      );
      tree(child);
      append("</div></details>");
    }
    for (const note of notes) {
      const start = length;
      const prefix =
        '<div class="tree-item nav-file"><a class="tree-item-self nav-file-title note-nav';
      const href = ` href="${escapeHtml(note.url)}"`;
      const suffix = `><span class="tree-item-inner nav-file-title-content">${escapeHtml(note.title)}</span></a></div>`;
      append(prefix + '"' + href + suffix);
      const offsets = links.get(note.path) ?? [];
      offsets.push({
        start,
        end: length,
        selected:
          prefix +
          ' is-active selected"' +
          href +
          ' aria-current="page"' +
          suffix,
      });
      links.set(note.path, offsets);
    }
  };
  tree(root);
  return { html: chunks.join(""), links };
}

function navigation(site: CompiledSite, current?: PublishedNote): string {
  const cached = siteCache(site);
  const { html, links } = (cached.navigation ??= buildNavigation(site));
  const selected = current && links.get(current.path);
  if (!selected) return html;
  // Replace only the known link spans; never scan or regex the complete tree.
  let result = "",
    previous = 0;
  for (const link of selected) {
    result += html.slice(previous, link.start) + link.selected;
    previous = link.end;
  }
  return result + html.slice(previous);
}

function initialContent(
  site: CompiledSite,
  note?: PublishedNote | null,
): string {
  const cached = siteCache(site);
  const home = cached.home;
  const headings =
    note?.headings.filter(
      (heading) => heading.level > 1 && heading.level < 5,
    ) ?? [];
  const backlinks = (note?.backlinks ?? [])
    .map((path) => cached.byPath.get(path))
    .filter((candidate): candidate is PublishedNote => !!candidate);
  const toc = site.settings.showToc
    ? `<section class="toc"><div class="aside-heading">On this page</div><nav aria-label="Table of contents">${headings.map((heading) => `<a class="toc-link level-${heading.level}" href="#${escapeHtml(encodeURIComponent(heading.id))}">${escapeHtml(heading.text)}</a>`).join("") || '<p class="empty-hint">No headings on this page.</p>'}</nav></section>`
    : "";
  const mentions = site.settings.showBacklinks
    ? `<section class="backlinks"><div class="aside-heading"><span>Linked mentions</span><span class="aside-count">${backlinks.length}</span></div>${backlinks.map((backlink) => `<a class="backlink" href="${escapeHtml(backlink.url)}"><span>${escapeHtml(backlink.title)}</span></a>`).join("") || '<p class="empty-hint">No linked mentions.</p>'}</section>`
    : "";
  const classes = Array.isArray(note?.properties.cssclasses)
    ? note.properties.cssclasses
    : typeof note?.properties.cssclasses === "string"
      ? note.properties.cssclasses.split(/\s+/)
      : [];
  const properties =
    note && site.settings.showProperties
      ? `<details class="metadata-container properties" open><summary class="metadata-properties-heading"><svg class="metadata-collapse-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg><span>Properties</span></summary><div class="metadata-content">${Object.entries(
          note.properties,
        )
          .filter(([key]) => !["title", "cssclasses", "aliases"].includes(key))
          .map(
            ([key, value]) =>
              `<div class="metadata-property"><span class="metadata-property-key"><span class="metadata-property-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16M12 5v14M8 19h8"/></svg></span><span class="metadata-property-key-name">${escapeHtml(key)}</span></span><span class="metadata-property-value">${note.propertyHtml?.[key] ?? escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</span></div>`,
          )
          .join("")}</div></details>`
      : "";
  return `<main id="static-content" class="app-shell published-container">
  <aside class="sidebar site-body-left-column" aria-label="Site navigation"><div class="workspace-leaf-content" data-type="file-explorer"><header class="site-header"><a class="site-name" href="${escapeHtml(home?.url ?? "/")}">${escapeHtml(site.settings.title || site.name)}</a></header><nav class="vault-navigation nav-files-container" aria-label="Notes">${navigation(site, note ?? undefined)}</nav></div></aside>
  <div class="main-shell site-body-center-column"><div class="reading-layout"><div class="reader"><article class="note-page markdown-preview-view${note?.path === home?.path ? " home-page" : ""}${site.settings.readable ? " readable-line-width" : " wide-page"}"><div class="markdown-preview-sizer markdown-preview-section"><header class="page-header"><h1 class="page-header-title">${escapeHtml(note?.title ?? (note === null ? "Page not found" : site.settings.title))}</h1></header><div class="markdown-body markdown-rendered ${escapeHtml(classes.join(" "))}">${note?.html ?? (note === null ? `<p>The requested page is not published or has moved.</p><p><a href="${escapeHtml(home?.url ?? "/")}">Return to the home page</a> or choose a note from the navigation.</p>` : "<p>No published notes.</p>")}</div>${properties}</div></article></div><aside class="right-sidebar site-body-right-column" aria-label="Page information">${note === null ? "" : toc + mentions}</aside></div></div>
</main>`;
}

/** Strip managed content before parsing metadata, so large home/nav/CSS payloads
 * are never scanned again for each emitted note. */
function preparePageRenderer(
  template: string,
  site: CompiledSite,
  missing = false,
): PageRenderer {
  const cached = siteCache(site);
  cached.navigation ??= buildNavigation(site);
  let contentSlot = "\u0000published-content\u0000",
    headSlot = "\u0000published-head\u0000";
  while (template.includes(contentSlot)) contentSlot += "\u0000";
  while (template.includes(headSlot)) headSlot += "\u0000";
  let html: string;
  const start = template.indexOf(CONTENT_START);
  const end =
    start < 0
      ? -1
      : template.indexOf(CONTENT_END, start + CONTENT_START.length);
  if (start >= 0 && end >= 0) {
    html =
      template.slice(0, start) +
      contentSlot +
      template.slice(end + CONTENT_END.length);
  } else {
    const root =
      /(<div\b[^>]*\bid\s*=\s*(?:"root"|'root')[^>]*>)\s*(?:<!--\s*published-content\s*-->)?\s*(<\/div\s*>)/i;
    if (!root.test(template))
      throw new Error(
        'The published index template needs an empty <div id="root"></div>.',
      );
    html = template.replace(
      root,
      (_match, opening: string, closing: string) =>
        opening + contentSlot + closing,
    );
  }
  // A rendered page can become the next shell (Vite build/dev transforms).
  // Remove only our managed bootstrap, never app scripts or unrelated styles.
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) =>
    attributes(tag.slice(0, tag.indexOf(">") + 1)).has(
      "data-published-appearance",
    )
      ? ""
      : tag,
  );
  if (missing) {
    // Do this on the stripped shell too, not on the homepage's managed HTML.
    html = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<link\b[^>]*>/gi, (tag) => {
        const attrs = attributes(tag),
          rel = attrs.get("rel")?.toLowerCase();
        return rel === "modulepreload" ||
          (rel === "preload" && attrs.get("as") === "script")
          ? ""
          : tag;
      });
  }
  const theme = site.settings.theme === "dark" ? "dark" : "light";
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "");
  html = html.replace(/<meta\b[^>]*>/gi, (tag) => {
    const name = attributes(tag).get("name")?.toLowerCase();
    return name === "description" || name === "theme-color" ? "" : tag;
  });
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, (tag) =>
    ["published-theme", "published-appearance-critical"].includes(
      attributes(tag.slice(0, tag.indexOf(">") + 1)).get("id") ?? "",
    )
      ? ""
      : tag,
  );
  const appearance = appearanceBootstrap(site);
  html = html.replace(
    /<head\b[^>]*>/i,
    (tag) =>
      tag +
      appearance.head.replace(
        /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
        (script) => (missing ? "" : script),
      ),
  );
  html = html.replace(/<\/head\s*>/i, () => headSlot);
  html = html.replace(/<html\b[^>]*>/i, (tag) =>
    setAttribute(
      setAttribute(tag, "data-theme", theme),
      "data-community",
      site.settings.communityTheme,
    ),
  );
  html = html.replace(/<body\b[^>]*>/i, (tag) => {
    const existing = attributes(tag);
    const previous = new Set(
      (existing.get("data-published-classes") ?? "").split(/\s+/),
    );
    const classes = (existing.get("class") ?? "")
      .split(/\s+/)
      .filter((value) => value && !previous.has(value));
    const managed = [
      ...new Set([
        ...site.bodyClasses.filter(
          (value) => !["theme-light", "theme-dark"].includes(value),
        ),
        `theme-${theme}`,
      ]),
    ];
    return (
      setAttribute(
        setAttribute(
          setAttribute(
            tag,
            "class",
            [...new Set([...classes, ...managed])].join(" "),
          ),
          "data-published-classes",
          managed.join(" "),
        ),
        "data-theme-preset",
        site.settings.communityTheme === "publish-theme"
          ? "publish"
          : site.settings.communityTheme.toLowerCase() === "minimal"
            ? "minimal"
            : "default",
      ) + (missing ? "" : appearance.body)
    );
  });
  const parts = html.split(new RegExp(`(${contentSlot}|${headSlot})`));
  const headTail = `<style id="published-theme">${cached.themeCss}</style>${missing ? '<meta name="robots" content="noindex">' : appearance.loader}</head>`;
  return (note = cached.home) => {
    const title = `${note === null ? "Page not found" : (note?.title ?? site.settings.title)} · ${site.settings.title || site.name}`;
    const description =
      note === null
        ? ""
        : String(
            note?.properties.description ?? site.settings.description ?? "",
          );
    return parts
      .map((part) =>
        part === contentSlot
          ? `${CONTENT_START}${initialContent(site, note)}${CONTENT_END}`
          : part === headSlot
            ? `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">` +
              headTail
            : part,
      )
      .join("");
  };
}

/** Prepare Vite's script/CSS shell once for all pages of an immutable snapshot. */
export function createPageRenderer(
  template: string,
  site: CompiledSite,
): PageRenderer {
  const cached = siteCache(site);
  if (cached.page?.template === template) return cached.page.render;
  const render = preparePageRenderer(template, site);
  cached.page = { template, render };
  return render;
}

/** Keep Vite's transformed script/CSS shell, replacing only managed page content. */
export function renderPublishedPage(
  template: string,
  site: CompiledSite,
  note: PublishedNote | null | undefined = homeNote(site),
): string {
  return createPageRenderer(template, site)(note);
}

/** The error shell must not mount the SPA, which would replace a missing page with home. */
export function renderNotFoundPage(
  template: string,
  site: CompiledSite,
): string {
  const cached = siteCache(site);
  if (cached.notFound?.template !== template)
    cached.notFound = {
      template,
      render: preparePageRenderer(template, site, true),
    };
  return cached.notFound.render(null);
}

/** Relative Vite base paths break when the same shell is nested under note routes. */
export function absoluteShellReferences(template: string, base = "/"): string {
  return template.replace(
    /\b(src|href)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi,
    (
      match,
      attribute: string,
      double: string | undefined,
      single: string | undefined,
    ) => {
      const quote = double === undefined ? "'" : '"';
      const value = (double ?? single)!;
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return match;
      const resolved = new URL(value, `https://published.invalid${base}`);
      return `${attribute}=${quote}${escapeHtml(resolved.pathname + resolved.search + resolved.hash)}${quote}`;
    },
  );
}
