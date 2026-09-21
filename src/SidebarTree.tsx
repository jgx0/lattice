import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { Note, SiteSettings } from "./types";

type Branch = { path: string; name: string; children: Branch[]; notes: Note[] };
type Props = {
  notes: Note[];
  settings: SiteSettings;
  current: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
  onOrder?: (order: string[]) => void;
};
export default function SidebarTree({
  notes,
  settings,
  current,
  collapsed,
  onToggle,
  onNavigate,
}: Props) {
  const tree = useMemo(() => {
    const root: Branch = { path: "", name: "", children: [], notes: [] };
    const folders = new Map<string, Branch>([["", root]]);
    for (const note of notes) {
      let branch = root;
      let path = "";
      for (const name of (
        settings.navigationFolders?.[note.path] ?? note.folder
      )
        .split("/")
        .filter(Boolean)) {
        path = path ? `${path}/${name}` : name;
        let child = folders.get(path);
        if (!child) {
          child = { path, name, children: [], notes: [] };
          folders.set(path, child);
          branch.children.push(child);
        }
        branch = child;
      }
      branch.notes.push(note);
    }
    const rank = (path: string) => {
      const i = settings.navigation.indexOf(path);
      return i < 0 ? Infinity : i;
    };
    const sort = (branch: Branch) => {
      branch.children.sort(
        (a, b) => rank(a.path) - rank(b.path) || a.name.localeCompare(b.name),
      );
      branch.notes.sort(
        (a, b) => rank(a.path) - rank(b.path) || a.title.localeCompare(b.title),
      );
      branch.children.forEach(sort);
    };
    sort(root);
    return root;
  }, [notes, settings.navigation, settings.navigationFolders]);
  function children(branch: Branch): React.ReactNode {
    return (
      <>
        {branch.children.map((folder) => (
          <div
            className={`tree-item nav-folder ${collapsed.has(folder.path) ? "is-collapsed" : ""}`}
            key={folder.path}
          >
            <button
              className="tree-item-self nav-folder-title"
              aria-expanded={!collapsed.has(folder.path)}
              onClick={() => onToggle(folder.path)}
            >
              <span className="tree-item-icon collapse-icon">
