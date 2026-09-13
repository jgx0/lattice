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
