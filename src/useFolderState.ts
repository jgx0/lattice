import { useEffect, useMemo, useState } from "react";
import type { CompiledSite } from "./types";

export function folderStateKey(site: CompiledSite): string {
  const home =
    site.notes.find((note) => note.path === site.settings.home) ??
    site.notes[0];
  return `publish-reader-folders:${encodeURIComponent(home?.url ?? "/")}:${encodeURIComponent(home?.path ?? "")}`;
}

function readCollapsed(key: string, folders: ReadonlySet<string>): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(stored)) return new Set();
    return new Set(
      stored.filter(
        (path): path is string => typeof path === "string" && folders.has(path),
      ),
    );
  } catch {
    return new Set();
  }
}

export function useFolderState(site: CompiledSite) {
  const key = folderStateKey(site);
  const folders = useMemo(() => {
    const names = new Set<string>();
    for (const note of site.notes) {
      let path = "";
      for (const segment of (
        site.settings.navigationFolders?.[note.path] ?? note.folder
      )
        .split("/")
        .filter(Boolean)) {
        path = path ? `${path}/${segment}` : segment;
        names.add(path);
      }
    }
    return names;
  }, [site.notes, site.settings.navigationFolders]);
  const [state, setState] = useState(() => ({
    key,
    collapsed: readCollapsed(key, folders),
  }));
  const collapsed = useMemo(
    () =>
      state.key === key
        ? new Set([...state.collapsed].filter((path) => folders.has(path)))
        : readCollapsed(key, folders),
    [state, key, folders],
  );

  useEffect(() => {
    if (state.key !== key) {
      setState({ key, collapsed });
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify([...collapsed].sort()));
    } catch {}
  }, [key, collapsed, state.key]);

  function toggleFolder(path: string) {
    if (!folders.has(path)) return;
    setState((previous) => {
      const next = new Set(
        previous.key === key ? previous.collapsed : collapsed,
      );
      next.has(path) ? next.delete(path) : next.add(path);
      return { key, collapsed: next };
    });
  }
  return { collapsed, toggleFolder };
}
