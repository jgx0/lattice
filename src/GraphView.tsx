import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import type { PublishedNote } from "./types";

type Props = {
  notes: PublishedNote[];
  current?: string;
  onNavigate: (path: string) => void;
  compact?: boolean;
  onExpand?: () => void;
};
export default function GraphView({
  notes,
  current,
  onNavigate,
  compact = false,
  onExpand,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [local, setLocal] = useState(compact);
  const drag = useRef<{
    path?: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const edges = useMemo(() => {
    const seen = new Set<string>();
    return notes.flatMap((n) =>
      n.outgoing
        .map((path) => {
          const target = notes.find((note) => note.path === path);
          if (!target || target.path === n.path) return null;
          const key = [n.path, target.path].sort().join("|");
          if (seen.has(key)) return null;
          seen.add(key);
          return { from: n.path, to: target.path };
        })
        .filter(Boolean),
    ) as { from: string; to: string }[];
  }, [notes]);
  const visible = useMemo(() => {
    const neighbors = new Set([current]);
    edges.forEach((e) => {
      if (e.from === current) neighbors.add(e.to);
      if (e.to === current) neighbors.add(e.from);
    });
    return notes
      .filter(
        (n) =>
          (!local || neighbors.has(n.path)) &&
          (!query ||
            `${n.title} ${n.folder}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      )
      .slice(0, 250);
  }, [notes, edges, current, local, query]);
  useEffect(() => {
    const nodes = visible.map((n, i) => ({
      path: n.path,
      x:
        n.path === current
          ? 300
          : 300 + Math.cos(i * 2.39996) * (60 + Math.sqrt(i) * 29),
      y:
