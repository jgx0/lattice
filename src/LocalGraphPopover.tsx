import { useEffect, useRef } from "react";
import { GitFork, X } from "lucide-react";
import GraphView from "./GraphView";
import type { PublishedNote } from "./types";

type Props = {
  notes: PublishedNote[];
  current: string;
  onNavigate: (path: string) => void;
  onGlobal: () => void;
  onClose: () => void;
};
export default function LocalGraphPopover({
  notes,
  current,
  onNavigate,
  onGlobal,
  onClose,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const targets = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,[tabindex="0"]',
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
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="graph-popover-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className="popover local-graph-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Local graph"
      >
        <header className="graph-popover-header">
          <h2>Local graph</h2>
          <div>
            <button
              className="clickable-icon"
              aria-label="Open global graph"
              title="Global graph"
              onClick={onGlobal}
            >
              <GitFork size={16} />
            </button>
            <button
              className="clickable-icon"
              aria-label="Close local graph"
              title="Close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <GraphView
          notes={notes}
          current={current}
          compact
          onNavigate={(path) => {
            onNavigate(path);
            onClose();
          }}
        />
      </section>
    </div>
  );
}
