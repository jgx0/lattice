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
                <ChevronRight size={16} />
              </span>
              <span className="tree-item-inner nav-folder-title-content">
                {folder.name}
              </span>
            </button>
            {!collapsed.has(folder.path) && (
              <div className="tree-item-children nav-folder-children">
                {children(folder)}
              </div>
            )}
          </div>
        ))}
        {branch.notes.map((note) => (
          <div className="tree-item nav-file" key={note.path}>
            <a
              className={`tree-item-self nav-file-title ${note.path === current ? "is-active selected" : ""}`}
              href={"url" in note ? String(note.url) : `#/${note.slug}`}
              data-path={note.path}
              aria-current={note.path === current ? "page" : undefined}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onNavigate(note.path);
              }}
            >
              <span className="tree-item-inner nav-file-title-content">
                {note.title}
              </span>
            </a>
          </div>
        ))}
      </>
    );
  }
  return <div className="nav-files-container">{children(tree)}</div>;
}
