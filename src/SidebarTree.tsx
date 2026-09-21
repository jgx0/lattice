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
