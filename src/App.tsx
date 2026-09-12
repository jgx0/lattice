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
