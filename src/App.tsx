import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Layers2,
  Maximize2,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import type { CompiledSite, PublishedNote, SiteSettings } from "./types";
import { searchNotes } from "./lib/search";
import SidebarTree from "./SidebarTree";
import MarkdownContent from "./MarkdownContent";
import GraphView from "./GraphView";

function normalizeRoute(value: string) {
  try {
    return decodeURIComponent(value).replace(/\/+$/, "") || "/";
  } catch {
    return value.replace(/\/+$/, "") || "/";
  }
}
function readPreferences() {
  try {
    return JSON.parse(
      localStorage.getItem("publish-reader-preferences") || "{}",
    ) as Partial<SiteSettings>;
  } catch {
    return {};
  }
}
function initialNote(site: CompiledSite) {
  const route = normalizeRoute(location.pathname);
  return (
    site.notes.find((note) => normalizeRoute(note.url) === route) ||
    site.notes.find((note) => note.path === site.settings.home) ||
    site.notes[0]
  );
}

export default function App({ site }: { site: CompiledSite }) {
  const { notes } = site;
  const [preferences, setPreferences] = useState(readPreferences);
  const settings = useMemo(
    () => ({ ...site.settings, ...preferences }),
    [site.settings, preferences],
  );
  const [path, setPath] = useState(() => initialNote(site)?.path || "");
  const [panes, setPanes] = useState<string[]>(() => [
    initialNote(site)?.path || "",
  ]);
  const [sidebar, setSidebar] = useState(() => innerWidth > 760);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<"note" | "graph">("note");
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hover, setHover] = useState<{
    note: PublishedNote;
    x: number;
    y: number;
  } | null>(null);
  const [activeHeading, setActiveHeading] = useState("");
  const [rightSections, setRightSections] = useState({
    graph: true,
    outline: true,
    backlinks: true,
  });
  const reader = useRef<HTMLDivElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = notes.find((note) => note.path === path) || initialNote(site);
  const searchResults = useMemo(
    () => searchNotes(query, notes),
    [query, notes],
  );
  const navRef = useRef<
    (path: string, anchor?: string, push?: boolean) => void
  >(() => {});

  useEffect(() => {
    try {
      localStorage.setItem(
        "publish-reader-preferences",
        JSON.stringify(preferences),
      );
    } catch {}
  }, [preferences]);
  useEffect(() => {
    if (!notes.some((n) => n.path === path)) {
      const n = initialNote(site);
      if (n) {
        setPath(n.path);
        setPanes([n.path]);
      }
    }
  }, [site, path, notes]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        settings.theme === "dark" ||
        (settings.theme === "system" && media.matches);
      document.body.classList.toggle("theme-dark", dark);
      document.body.classList.toggle("theme-light", !dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    document.body.classList.add("publish");
    const bodyClasses = site.bodyClasses.filter(
      (c) => !["theme-light", "theme-dark"].includes(c),
    );
    bodyClasses.forEach((c) => document.body.classList.add(c));
    apply();
    media.addEventListener("change", apply);
    document.title = `${view === "graph" ? "Graph view" : current?.title || site.name} - ${settings.title}`;
    return () => {
      media.removeEventListener("change", apply);
      bodyClasses.forEach((c) => document.body.classList.remove(c));
    };
  }, [
    settings.theme,
    settings.title,
    current?.title,
    site.bodyClasses,
    site.name,
    view,
  ]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebar(true);
        searchInput.current?.focus();
      }
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setHover(null);
        if (query) setQuery("");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [query]);
  const scrollTo = useCallback(
    (note: PublishedNote, anchor = "") => {
      setTimeout(() => {
        const pane = reader.current?.querySelector<HTMLElement>(
          `[data-note-path="${CSS.escape(note.path)}"]`,
        );
        if (anchor) {
          const target = pane?.querySelector<HTMLElement>(
            `[id="${CSS.escape(anchor.replace(/^\^/, ""))}"]`,
          );
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (settings.stacked) {
          pane?.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "end",
          });
        } else reader.current?.scrollTo({ top: 0 });
        setActiveHeading(anchor);
      }, 30);
    },
    [settings.stacked],
  );
  const navigate = useCallback(
    (target: string, anchor = "", push = true) => {
      const note = notes.find(
        (n) => n.path === target || n.url === target || n.slug === target,
      );
      if (!note) return;
      setView("note");
      setHover(null);
      setPath(note.path);
      setQuery("");
      setPanes((old) =>
        settings.stacked
          ? (old.includes(note.path)
              ? old.slice(0, old.indexOf(note.path) + 1)
              : [...old, note.path]
            ).slice(-8)
          : [note.path],
      );
      if (push)
        history.pushState(
          { note: note.path },
          "",
          `${note.url}${anchor ? "#" + encodeURIComponent(anchor) : ""}`,
        );
      if (innerWidth <= 760) setSidebar(false);
      scrollTo(note, anchor);
    },
    [notes, settings.stacked, scrollTo],
  );
  navRef.current = navigate;
  useEffect(() => {
    const sync = () => {
      const note = initialNote(site);
      if (note) {
        setPath(note.path);
        setPanes([note.path]);
        setView("note");
        let anchor = location.hash.slice(1);
        try {
          anchor = decodeURIComponent(anchor);
        } catch {}
        scrollTo(note, anchor);
      }
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    if (location.hash)
      scrollTo(initialNote(site), decodeURIComponent(location.hash.slice(1)));
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [site, scrollTo]);
  useEffect(() => {
    if (!reader.current || view !== "note") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActiveHeading(entry.target.id);
      },
      { root: reader.current, rootMargin: "-10% 0px -75% 0px" },
    );
    reader.current
      .querySelectorAll("h1[id],h2[id],h3[id]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [current, view, panes]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function contentClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (a.dataset.note) {
      e.preventDefault();
      navigate(
        a.dataset.note,
        a.dataset.anchor || decodeURIComponent(a.hash.slice(1)),
      );
    } else if (a.getAttribute("href")?.startsWith("#")) {
      e.preventDefault();
      const pane = a.closest<HTMLElement>("[data-note-path]");
      pane
        ?.querySelector<HTMLElement>(
          `[id="${CSS.escape(decodeURIComponent(a.hash.slice(1)))}"]`,
        )
        ?.scrollIntoView({ behavior: "smooth" });
      setActiveHeading(decodeURIComponent(a.hash.slice(1)));
    }
  }
  function hoverLink(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[data-note]",
    );
    if (!a) return;
    const note = notes.find((n) => n.path === a.dataset.note);
    if (!note) return;
    if (timer.current) clearTimeout(timer.current);
    const box = a.getBoundingClientRect();
    timer.current = setTimeout(
      () =>
        setHover({
          note,
          x: Math.max(12, Math.min(innerWidth - 370, box.left)),
          y: Math.max(12, Math.min(innerHeight - 330, box.bottom + 8)),
        }),
      400,
    );
  }
  function leaveHover() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(null), 180);
  }
  function change<K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) {
    setPreferences((old) => ({ ...old, [key]: value }));
    if (key === "stacked") setPanes(current ? [current.path] : []);
  }
  function closePane(p: string) {
    const next = panes.filter((n) => n !== p);
    if (!next.length) return;
    setPanes(next);
    if (path === p) {
      const note = notes.find((n) => n.path === next[next.length - 1]);
      if (note) {
        setPath(note.path);
        history.replaceState({ note: note.path }, "", note.url);
      }
    }
  }
  function showGraph() {
    setView("graph");
    setHover(null);
    if (innerWidth <= 760) setSidebar(false);
  }
  if (!current)
    return (
      <main>
        <h1>No published notes</h1>
      </main>
    );
  const backlinks = current.backlinks
    .map((p) => notes.find((n) => n.path === p))
    .filter((n): n is PublishedNote => !!n);
  const headingItems = current.headings.filter((h) => h.level < 5);
  function notePage(note: PublishedNote) {
    const classes = note.properties.cssclasses;
    const cssclasses = (
      Array.isArray(classes)
        ? classes
        : typeof classes === "string"
          ? classes.split(/\s+/)
          : []
    )
      .filter((c) => typeof c === "string")
      .join(" ");
    return (
      <article
        className={`note-page markdown-preview-view markdown-rendered ${settings.readable ? "is-readable-line-width readable-line-width" : ""} ${cssclasses}`}
        data-note-path={note.path}
        data-type="markdown"
      >
        <div className="markdown-preview-sizer markdown-preview-section">
          <header className="page-header note-header">
            <h1 className="page-header-title inline-title">{note.title}</h1>
          </header>
          {settings.showProperties &&
            Object.keys(note.properties).some(
              (k) => !["title", "cssclasses", "aliases"].includes(k),
            ) && (
              <details className="metadata-container properties">
                <summary>Properties</summary>
                <div className="metadata-content">
                  {Object.entries(note.properties)
                    .filter(
                      ([k]) => !["title", "cssclasses", "aliases"].includes(k),
                    )
                    .map(([k, v]) => (
                      <div className="metadata-property" key={k}>
                        <span className="metadata-property-key">{k}</span>
                        <span className="metadata-property-value">
                          {Array.isArray(v) ? v.join(", ") : String(v ?? "")}
                        </span>
                      </div>
                    ))}
                </div>
              </details>
            )}
          <MarkdownContent
            html={note.html}
            onClick={contentClick}
            onMouseOver={hoverLink}
            onMouseOut={leaveHover}
          />
        </div>
      </article>
    );
  }
  return (
    <div
      className={`published-container publish-container workspace app-shell ${sidebar ? "" : "sidebar-hidden"} ${settings.stacked ? "stack-mode" : ""}`}
    >
      <style data-publish-theme>{site.themeCss}</style>
      {sidebar && (
        <div
          className="mobile-scrim"
          aria-label="Dismiss navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        className="site-body-left-column sidebar workspace-split mod-left-split"
        aria-label="Site navigation"
      >
        <div className="workspace-leaf">
          <div className="workspace-leaf-content" data-type="file-explorer">
            <header className="site-header">
              <a
                className="site-name"
                href={
                  notes.find((n) => n.path === settings.home)?.url ||
                  notes[0].url
                }
                onClick={(e) => {
                  e.preventDefault();
                  navigate(settings.home);
                }}
              >
                {settings.title}
              </a>
              <button
                className="clickable-icon sidebar-collapse"
                aria-label="Close sidebar"
                onClick={() => setSidebar(false)}
              >
                <PanelLeftClose size={18} />
              </button>
            </header>
            <div className="search-view-container">
              <div className="search-input-container">
                <Search size={16} />
                <input
                  ref={searchInput}
                  className="search-bar"
                  type="search"
                  placeholder="Search page or heading..."
                  aria-label="Search page or heading..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchResults[0])
                      navigate(searchResults[0].path);
                  }}
                />
                {query && (
                  <button
                    className="clickable-icon"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <nav className="vault-navigation" aria-label="Files">
              {query ? (
                <div className="search-results search-result-container">
                  {searchResults.map((n) => (
                    <a
                      className="search-result-file-title"
                      key={n.path}
                      href={(n as PublishedNote).url}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) return;
                        e.preventDefault();
                        navigate(n.path);
                      }}
                    >
                      <span>{n.title}</span>
                      <small>{n.folder}</small>
                    </a>
                  ))}
                  {!searchResults.length && (
                    <p className="empty-hint">No results found.</p>
                  )}
                </div>
              ) : (
                <SidebarTree
                  notes={notes}
                  settings={settings}
                  current={current.path}
                  collapsed={collapsed}
                  onToggle={(folder) =>
                    setCollapsed((old) => {
                      const next = new Set(old);
                      next.has(folder) ? next.delete(folder) : next.add(folder);
                      return next;
                    })
                  }
                  onNavigate={navigate}
                />
              )}
            </nav>
            <div className="nav-buttons-container reader-controls">
              <button
                className="clickable-icon"
                aria-label="Graph view"
                title="Graph view"
                onClick={showGraph}
              >
                <GitBranch size={18} />
              </button>
              <button
                className={`clickable-icon ${settings.stacked ? "is-active" : ""}`}
                aria-label="Toggle stacked pages"
                title="Stacked pages"
                onClick={() => change("stacked", !settings.stacked)}
              >
                <Layers2 size={18} />
              </button>
              <button
                className="clickable-icon"
                aria-label="Toggle color theme"
                title="Color theme"
                onClick={() =>
                  change(
                    "theme",
                    document.body.classList.contains("theme-dark")
                      ? "light"
                      : "dark",
                  )
                }
              >
                {settings.theme === "dark" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </button>
              <button
                className="clickable-icon"
                aria-label="Reader settings"
                title="Reader settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="site-body-center-column main-shell">
        <div className="view-header topbar">
          <div className="view-header-title-container">
            <button
              className="clickable-icon mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={20} />
            </button>
            {!sidebar && (
              <button
                className="clickable-icon desktop-menu"
                aria-label="Open sidebar"
                onClick={() => setSidebar(true)}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="view-header-title">
              {view === "graph" ? "Graph view" : current.title}
            </div>
          </div>
          <div className="view-actions">
            <button
              className="clickable-icon"
              aria-label="Close page"
              onClick={() => {
                if (panes.length > 1) closePane(current.path);
                else navigate(settings.home);
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <main
          className={`reader ${settings.stacked ? "stacked-reader" : ""}`}
          ref={reader}
          id="main-content"
        >
          {view === "graph" ? (
            <section className="graph-page">
              <h1>Graph view</h1>
              <GraphView
                notes={notes}
                current={current.path}
                onNavigate={navigate}
              />
            </section>
          ) : settings.stacked && panes.length > 1 ? (
            <div className="page-stack">
              {panes.map((p) => {
                const n = notes.find((note) => note.path === p);
                return (
                  n && (
                    <div className="stack-pane workspace-leaf" key={p}>
                      <div className="stack-pane-bar view-header">
                        <span className="view-header-title">{n.title}</span>
                        <button
                          className="clickable-icon"
                          aria-label={`Close pane ${n.title}`}
                          onClick={() => closePane(p)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {notePage(n)}
                    </div>
                  )
                );
              })}
            </div>
          ) : (
            notePage(current)
          )}
        </main>
      </div>
      {view === "note" && !(settings.stacked && panes.length > 1) && (
        <aside
          className="site-body-right-column right-sidebar workspace-split mod-right-split"
          aria-label="Page information"
        >
          {settings.showGraph && (
            <section className="graph-view-container local-graph">
              <div className="aside-heading">
                <button
                  className="section-toggle"
                  onClick={() =>
                    setRightSections((s) => ({ ...s, graph: !s.graph }))
                  }
                  aria-expanded={rightSections.graph}
                >
                  {rightSections.graph ? (
                    <ChevronDown size={14} />
