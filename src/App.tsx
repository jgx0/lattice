import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitFork,
  ArrowUpRight,
  Layers2,
  Maximize2,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Type,
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
import GraphPopover from "./GraphPopover";
import QuickSwitcher from "./QuickSwitcher";
import { usePublishedTheme } from "./usePublishedTheme";
import { useFolderState } from "./useFolderState";

function normalizeRoute(value: string) {
  const trim = (path: string) =>
    path.replace(/\/index\.html\/?$/, "/").replace(/\/+$/, "") || "/";
  try {
    return trim(decodeURIComponent(value));
  } catch {
    return trim(value);
  }
}
function readPreferences() {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("publish-reader-preferences") || "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const values = parsed as Record<string, unknown>;
    const preferences: Partial<SiteSettings> = {};
    if (["light", "dark", "system"].includes(String(values.theme)))
      preferences.theme = values.theme as SiteSettings["theme"];
    for (const key of [
      "readable",
      "showProperties",
      "showToc",
      "showGraph",
      "showBacklinks",
      "stacked",
      "quickSwitcher",
    ] as const) {
      if (typeof values[key] === "boolean") preferences[key] = values[key];
    }
    return preferences;
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
  const appearance = usePublishedTheme(site);
  const [preferences, setPreferences] = useState(readPreferences);
  const settings = useMemo(
    () => ({ quickSwitcher: true, ...site.settings, ...preferences }),
    [site.settings, preferences],
  );
  const [path, setPath] = useState(() => initialNote(site)?.path || "");
  const [panes, setPanes] = useState<string[]>(() => [
    initialNote(site)?.path || "",
  ]);
  const [sidebar, setSidebar] = useState(() => innerWidth > 760);
  const [rightSidebar, setRightSidebar] = useState(() => innerWidth > 1100);
  function toggleLeftSidebar() {
    setSidebar(!sidebar);
    if (!sidebar && innerWidth <= 1100) setRightSidebar(false);
  }
  function toggleRightSidebar() {
    setRightSidebar(!rightSidebar);
    if (!rightSidebar && innerWidth <= 1100) setSidebar(false);
  }
  const { collapsed, toggleFolder } = useFolderState(site);
  const [query, setQuery] = useState("");
  const [graphScope, setGraphScope] = useState<"local" | "vault" | null>(null);
  const closeGraph = useCallback(() => setGraphScope(null), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const closeQuickSwitcher = useCallback(() => setQuickSwitcherOpen(false), []);
  const [darkMode, setDarkMode] = useState(
    () =>
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches),
  );
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
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    settingsDialog = useRef<HTMLElement>(null);
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
      setDarkMode(dark);
    };
    document.body.classList.add("publish");
    const bodyClasses = site.bodyClasses.filter(
      (c) => !["theme-light", "theme-dark"].includes(c),
    );
    bodyClasses.forEach((c) => document.body.classList.add(c));
    apply();
    media.addEventListener("change", apply);
    document.title = `${current?.title || site.name} - ${settings.title}`;
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
  ]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        !e.isComposing &&
        !e.repeat &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setGraphScope(null);
        if (settings.quickSwitcher) {
          setSettingsOpen(false);
          setHover(null);
          if (timer.current) clearTimeout(timer.current);
          setQuickSwitcherOpen((open) => !open);
        } else {
          setSidebar(true);
          if (innerWidth <= 1100) setRightSidebar(false);
          setTimeout(() => searchInput.current?.focus(), 0);
        }
        return;
      }
      if (e.key === "Escape") {
        setQuickSwitcherOpen(false);
        setSettingsOpen(false);
        setHover(null);
        if (query) setQuery("");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [query, settings.quickSwitcher]);
  useEffect(() => {
    if (!settingsOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    settingsDialog.current
      ?.querySelector<HTMLElement>("button, select")
      ?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = Array.from(
        settingsDialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), select:not([disabled]), a[href], input:not([disabled])",
        ) || [],
      );
      const first = targets[0],
        last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      previouslyFocused?.focus();
    };
  }, [settingsOpen]);
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
      setGraphScope(null);
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
        setGraphScope(null);
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
    if (!reader.current) return;
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
  }, [current, panes]);
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
  function showGraph(scope: "local" | "vault" = "vault") {
    setSettingsOpen(false);
    setQuickSwitcherOpen(false);
    setHover(null);
    if (timer.current) clearTimeout(timer.current);
    setGraphScope(scope);
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
  const pageInformationAvailable = !(settings.stacked && panes.length > 1);
  const rightSidebarVisible = rightSidebar && pageInformationAvailable;
  function propertyIcon(key: string, value: unknown) {
    if (key === "tags" || key === "tag") return <Hash size={15} />;
    if (typeof value === "boolean") return <CheckSquare size={15} />;
    if (typeof value === "number") return <Hash size={15} />;
    if (
      /date|created|modified|updated/i.test(key) ||
      (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))
    )
      return <Calendar size={15} />;
    if (Array.isArray(value)) return <List size={15} />;
    return <Type size={15} />;
  }
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
          <MarkdownContent
            html={note.html}
            onClick={contentClick}
            onMouseOver={hoverLink}
            onMouseOut={leaveHover}
          />
          {settings.showProperties &&
            Object.keys(note.properties).some(
              (k) => !["title", "cssclasses", "aliases"].includes(k),
            ) && (
              <details
                className="metadata-container properties"
                open
                onClick={contentClick}
                onMouseOver={hoverLink}
                onMouseOut={leaveHover}
              >
                <summary className="metadata-properties-heading">
                  <ChevronRight size={14} />
                  <span>Properties</span>
                </summary>
                <div className="metadata-content">
                  {Object.entries(note.properties)
                    .filter(
                      ([k]) => !["title", "cssclasses", "aliases"].includes(k),
                    )
                    .map(([k, v]) => (
                      <div className="metadata-property" key={k}>
                        <span className="metadata-property-key">
                          <span
                            className="metadata-property-icon"
                            aria-hidden="true"
                          >
                            {propertyIcon(k, v)}
                          </span>
                          <span className="metadata-property-key-name">
                            {k}
                          </span>
                        </span>
                        {note.propertyHtml?.[k] !== undefined ? (
                          <span
                            className="metadata-property-value"
                            dangerouslySetInnerHTML={{
                              __html: note.propertyHtml[k],
                            }}
                          />
                        ) : (
                          <span className="metadata-property-value">
                            {Array.isArray(v) ? v.join(", ") : String(v ?? "")}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </details>
            )}
        </div>
      </article>
    );
  }
  return (
    <div
      className={`published-container publish-container workspace app-shell ${sidebar ? "" : "sidebar-hidden"} ${rightSidebarVisible ? "" : "right-sidebar-hidden"} ${settings.stacked ? "stack-mode" : ""}`}
    >
      <style data-publish-theme>{appearance.themeCss}</style>
      {sidebar && (
        <div
          className="mobile-scrim"
          aria-label="Dismiss navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      {rightSidebarVisible && (
        <div
          className="right-sidebar-scrim"
          aria-label="Dismiss page information"
          onClick={() => setRightSidebar(false)}
        />
      )}
      <aside
        id="site-navigation"
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
                  onToggle={toggleFolder}
                  onNavigate={navigate}
                />
              )}
            </nav>
            <div className="nav-buttons-container reader-controls">
              <button
                className="clickable-icon"
                aria-label="Graph view"
                title="Graph view"
                onClick={() => showGraph()}
              >
                <GitBranch size={16} />
              </button>
              <button
                className={`clickable-icon ${settings.stacked ? "is-active" : ""}`}
                aria-label="Toggle stacked pages"
                aria-pressed={settings.stacked}
                data-enabled={settings.stacked}
                title={`Stacked pages: ${settings.stacked ? "on" : "off"}`}
                onClick={() => change("stacked", !settings.stacked)}
              >
                <Layers2 size={16} />
              </button>
              <button
                className="clickable-icon"
                aria-label="Toggle color theme"
                aria-pressed={darkMode}
                title={`Color scheme: ${settings.theme}`}
                onClick={() =>
                  change(
                    "theme",
                    document.body.classList.contains("theme-dark")
                      ? "light"
                      : "dark",
                  )
                }
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                className="clickable-icon"
                aria-label="Reader settings"
                title="Reader settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="site-body-center-column main-shell">
        <div className="view-header topbar">
          <div className="view-header-title-container">
            <button
              className="clickable-icon sidebar-toggle left-sidebar-toggle"
              aria-label={sidebar ? "Fold left sidebar" : "Open sidebar"}
              title={sidebar ? "Fold left sidebar" : "Open left sidebar"}
              aria-expanded={sidebar}
              aria-controls="site-navigation"
              onClick={toggleLeftSidebar}
            >
              {sidebar ? (
                <PanelLeftClose size={17} />
              ) : (
                <PanelLeftOpen size={17} />
              )}
            </button>
            <div className="view-header-title">{current.title}</div>
          </div>
          <div className="view-actions">
            <button
              className="clickable-icon sidebar-toggle right-sidebar-toggle"
              aria-label={
                rightSidebarVisible
                  ? "Fold right sidebar"
                  : "Open right sidebar"
              }
              title={
                rightSidebarVisible
                  ? "Fold right sidebar"
                  : "Open right sidebar"
              }
              aria-expanded={rightSidebarVisible}
              aria-controls="page-information"
              disabled={!pageInformationAvailable}
              onClick={toggleRightSidebar}
            >
              {rightSidebarVisible ? (
                <PanelRightClose size={17} />
              ) : (
                <PanelRightOpen size={17} />
              )}
            </button>
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
          <div className="reader-page-content">
            {settings.stacked && panes.length > 1 ? (
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
          </div>
          {pageInformationAvailable && (
            <aside
              id="page-information"
              className="site-body-right-column right-sidebar workspace-split mod-right-split"
              aria-label="Page information"
              hidden={!rightSidebarVisible}
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
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      Interactive graph
                    </button>
                  </div>
                  {rightSections.graph && (
                    <>
                      <div className="local-graph-shell">
                        <GraphView
                          notes={notes}
                          current={current.path}
                          compact
                          onNavigate={navigate}
                        />
                        <div className="graph-icon-actions">
                          <button
                            className="clickable-icon graph-icon graph-expand"
                            aria-label="Expand graph"
                            title="Expand local graph"
                            onClick={() => showGraph("local")}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                          <button
                            className="clickable-icon graph-icon graph-global"
                            aria-label="Global Graph"
                            title="Global graph"
                            onClick={() => showGraph()}
                          >
                            <GitFork size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}
              {settings.showToc && (
                <section className="outline-view-container toc">
                  <div className="aside-heading">
                    <button
                      className="section-toggle"
                      onClick={() =>
                        setRightSections((s) => ({ ...s, outline: !s.outline }))
                      }
                      aria-expanded={rightSections.outline}
                    >
                      {rightSections.outline ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      On this page
                    </button>
                  </div>
                  {rightSections.outline && (
                    <nav className="outline" aria-label="Table of contents">
                      {headingItems.map((h, i) => (
                        <a
                          className={`tree-item-self outline-item toc-link level-${h.level} ${activeHeading === h.id ? "is-active current" : ""}`}
                          key={`${h.id}-${i}`}
                          href={`#${encodeURIComponent(h.id)}`}
                          onClick={(e) => {
                            e.preventDefault();
                            scrollTo(current, h.id);
                          }}
                        >
                          <span className="tree-item-inner">{h.text}</span>
                        </a>
                      ))}
                    </nav>
                  )}
                </section>
              )}
              {settings.showBacklinks && backlinks.length > 0 && (
                <section className="backlinks backlinks-pane">
                  <div className="aside-heading">
                    <button
                      className="section-toggle"
                      onClick={() =>
                        setRightSections((s) => ({
                          ...s,
                          backlinks: !s.backlinks,
                        }))
                      }
                      aria-expanded={rightSections.backlinks}
                    >
                      {rightSections.backlinks ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      Linked mentions{" "}
                      <span className="backlink-count">{backlinks.length}</span>
                    </button>
                  </div>
                  {rightSections.backlinks &&
                    backlinks.map((n) => (
                      <a
                        className="backlink tree-item-self"
                        key={n.path}
                        href={n.url}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) return;
                          e.preventDefault();
                          navigate(n.path);
                        }}
                      >
                        {n.title}
                      </a>
                    ))}
                </section>
              )}
            </aside>
          )}
        </main>
      </div>
      {quickSwitcherOpen && settings.quickSwitcher && (
        <QuickSwitcher
          notes={notes}
          current={current.path}
          onNavigate={navigate}
          onClose={closeQuickSwitcher}
        />
      )}
      {graphScope && (
        <GraphPopover
          notes={notes}
          current={current.path}
          scope={graphScope}
          onScopeChange={setGraphScope}
          onNavigate={navigate}
          onClose={closeGraph}
        />
      )}
      {hover && (
        <div
          className="popover hover-popover hover-preview"
          role="tooltip"
          style={{ left: hover.x, top: hover.y }}
          onMouseEnter={() => {
            if (timer.current) clearTimeout(timer.current);
          }}
          onMouseLeave={leaveHover}
        >
          <div className="markdown-embed is-loaded">
            <div className="markdown-embed-content">
              <div className="markdown-preview-view markdown-rendered">
                <h1 className="preview-title">
                  <a
                    href={hover.note.url}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(hover.note.path);
                    }}
                  >
                    {hover.note.title}
                  </a>
                </h1>
                <div
                  className="markdown-body preview-body"
                  dangerouslySetInnerHTML={{ __html: hover.note.previewHtml }}
                  onClick={contentClick}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div
          className="modal-container modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="modal"
            ref={settingsDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Reader settings"
          >
            <div className="modal-header">
              <h2>Reader settings</h2>
              <button
                className="clickable-icon"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-content settings-content">
              <div className="setting-row">
                <label htmlFor="color-mode">Color scheme</label>
                <select
                  id="color-mode"
                  value={settings.theme}
                  onChange={(e) =>
                    change("theme", e.target.value as SiteSettings["theme"])
                  }
                >
                  <option value="system">Adapt to system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              {settings.allowThemeSwitching &&
                appearance.choices.length > 0 && (
                  <div className="setting-row theme-setting">
                    <div className="setting-item-info">
                      <label htmlFor="community-theme">Obsidian theme</label>
                      <p className="setting-item-description">
                        Choose from the themes this site includes.
                      </p>
                    </div>
                    <select
                      id="community-theme"
                      aria-label="Obsidian theme"
                      value={appearance.pendingId ?? appearance.selectedId}
                      aria-busy={appearance.pendingId !== null}
                      onChange={(event) =>
                        void appearance.selectTheme(event.target.value)
                      }
                    >
                      {appearance.choices.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              {appearance.pendingId && (
                <p className="theme-status" role="status">
                  Loading theme…
                </p>
              )}
              {appearance.error && (
                <p className="theme-error" role="alert">
                  {appearance.error}
                </p>
              )}
              {[
                { key: "readable", label: "Readable line length" },
                { key: "showProperties", label: "Properties" },
                { key: "showToc", label: "Table of contents" },
                { key: "showGraph", label: "Interactive graph" },
                { key: "showBacklinks", label: "Backlinks" },
                { key: "stacked", label: "Stacked pages" },
                { key: "quickSwitcher", label: "Quick switcher" },
              ].map((item) => (
                <div className="setting-row" key={item.key}>
                  <span>{item.label}</span>
                  <button
                    className={`checkbox-container toggle ${settings[item.key as keyof SiteSettings] ? "is-enabled on" : ""}`}
                    role="switch"
                    aria-checked={!!settings[item.key as keyof SiteSettings]}
                    aria-label={item.label}
                    onClick={() =>
                      change(
                        item.key as keyof SiteSettings,
                        !settings[item.key as keyof SiteSettings],
                      )
                    }
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
