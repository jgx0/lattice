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
        n.path === current
          ? 220
          : 220 + Math.sin(i * 2.39996) * (60 + Math.sqrt(i) * 25),
    }));
    const indexes = new Map(nodes.map((n, i) => [n.path, i]));
    const activeEdges = edges.flatMap((e) => {
      const i = indexes.get(e.from),
        j = indexes.get(e.to);
      return i === undefined || j === undefined ? [] : [{ i, j }];
    });
    for (
      let iteration = 0;
      iteration < (nodes.length > 100 ? 65 : 160);
      iteration++
    ) {
      const force = nodes.map((n) => ({
        x: (300 - n.x) * 0.003,
        y: (220 - n.y) * 0.003,
      }));
      nodes.forEach((a, i) =>
        nodes.forEach((b, j) => {
          if (i === j) return;
          const dx = a.x - b.x,
            dy = a.y - b.y,
            d = Math.max(15, Math.hypot(dx, dy));
          force[i].x += ((dx / d) * 17000) / (d * d);
          force[i].y += ((dy / d) * 17000) / (d * d);
        }),
      );
      activeEdges.forEach(({ i, j }) => {
        const dx = nodes[j].x - nodes[i].x,
          dy = nodes[j].y - nodes[i].y,
          d = Math.max(1, Math.hypot(dx, dy)),
          strength = (d - 105) * 0.014;
        force[i].x += (dx / d) * strength;
        force[i].y += (dy / d) * strength;
        force[j].x -= (dx / d) * strength;
        force[j].y -= (dy / d) * strength;
      });
      nodes.forEach((n, i) => {
        n.x += Math.max(-8, Math.min(8, force[i].x));
        n.y += Math.max(-8, Math.min(8, force[i].y));
      });
    }
    setPositions(
      Object.fromEntries(nodes.map((n) => [n.path, { x: n.x, y: n.y }])),
    );
  }, [visible, edges, current]);
  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const rect = svg.current!.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) * 600) / rect.width / zoom;
    const dy = ((e.clientY - drag.current.y) * 440) / rect.height / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 1) drag.current.moved = true;
    if (drag.current.path) {
      const p = drag.current.path;
      setPositions((old) => ({
        ...old,
        [p]: { x: old[p].x + dx, y: old[p].y + dy },
      }));
    } else setOffset((old) => ({ x: old.x + dx * zoom, y: old.y + dy * zoom }));
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  }
  const colors = ["#8b73d6", "#66a89d", "#d8ae6a", "#83a1cc", "#be8ba3"];
  const folders = [...new Set(notes.map((n) => n.folder))];
  return (
    <div className={`graph-view ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="graph-toolbar">
          <div className="graph-search">
            <Search size={16} />
            <input
              aria-label="Filter graph"
              placeholder="Find a note in the graph…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                aria-label="Clear graph search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <label className="graph-local">
            <input
              type="checkbox"
              checked={local}
              onChange={(e) => setLocal(e.target.checked)}
            />{" "}
            Current page only
          </label>
        </div>
      )}
      <svg
        ref={svg}
        viewBox="0 0 600 440"
        role="img"
        aria-label={
          compact
            ? "Local connections graph"
            : "Interactive graph of connected notes"
        }
        onPointerMove={move}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d?.path && !d.moved) onNavigate(d.path);
          e.currentTarget.hasPointerCapture(e.pointerId) &&
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            drag.current = { x: e.clientX, y: e.clientY, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onWheel={(e) =>
          setZoom((z) =>
            Math.max(0.4, Math.min(3, z * (e.deltaY > 0 ? 0.92 : 1.08))),
          )
        }
      >
        <defs>
          <pattern
            id={compact ? "mini-grid" : "full-grid"}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".7" fill="currentColor" opacity=".09" />
          </pattern>
        </defs>
        <rect
          width="600"
          height="440"
          fill={`url(#${compact ? "mini-grid" : "full-grid"})`}
          style={{ pointerEvents: "none" }}
        />
        <g
          transform={`translate(${300 + offset.x},${220 + offset.y}) scale(${zoom}) translate(-300,-220)`}
        >
          {edges
            .filter((e) => positions[e.from] && positions[e.to])
            .map((e) => (
              <line
                key={e.from + e.to}
                x1={positions[e.from].x}
                y1={positions[e.from].y}
                x2={positions[e.to].x}
                y2={positions[e.to].y}
                stroke="currentColor"
                strokeWidth={hover === e.from || hover === e.to ? 1.7 : 0.8}
                opacity={
                  hover && hover !== e.from && hover !== e.to ? 0.07 : 0.23
                }
              />
            ))}
          {visible.map((n) => {
            const p = positions[n.path];
            if (!p) return null;
            const active = n.path === current;
            const color = active
              ? "var(--accent)"
              : colors[folders.indexOf(n.folder) % colors.length];
            return (
              <g
                key={n.path}
                transform={`translate(${p.x},${p.y})`}
                className="graph-node"
                role="link"
                tabIndex={0}
                aria-label={`Open ${n.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onNavigate(n.path);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  drag.current = {
                    path: n.path,
                    x: e.clientX,
                    y: e.clientY,
                    moved: false,
                  };
                  svg.current!.setPointerCapture(e.pointerId);
                }}
                onMouseEnter={() => setHover(n.path)}
                onMouseLeave={() => setHover(null)}
              >
                {active && <circle r="17" fill={color} opacity=".1" />}
                <circle
                  r={
                    active
                      ? 7
                      : Math.min(
                          6,
                          3 +
                            edges.filter(
                              (e) => e.from === n.path || e.to === n.path,
                            ).length *
                              0.3,
                        )
                  }
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
                <text
                  y="19"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize={compact ? 12 : 10}
                  opacity={hover && hover !== n.path ? 0.35 : 0.75}
                >
                  {n.title.length > (compact ? 23 : 30)
                    ? n.title.slice(0, compact ? 21 : 28) + "…"
                    : n.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {compact ? (
        onExpand ? (
          <button
            className="graph-expand"
            onClick={onExpand}
            aria-label="Expand graph"
          >
            <Maximize2 size={13} />
          </button>
        ) : null
      ) : (
        <>
          <div className="graph-controls">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
            >
              <Minus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            >
              <Plus size={16} />
            </button>
            <button
              aria-label="Reset graph"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className="graph-legend">
            {folders.map((f, i) => (
              <span key={f}>
                <i style={{ background: colors[i % colors.length] }} />
                {f || "Home"}
              </span>
            ))}
          </div>
          <p className="graph-hint">
            Drag to explore · Scroll to zoom · Select a note to open
          </p>
        </>
      )}
      {!compact && notes.length > 250 && (
        <p className="graph-limit">
          Showing the first 250 matching notes. Use the filter to explore the
          rest.
        </p>
      )}
      {!visible.length && (
        <p className="graph-empty">
          No matching notes. Try a different search.
        </p>
      )}
    </div>
  );
}
