import { useEffect, useRef } from "react";
import { GitFork, X } from "lucide-react";
import GraphView from "./GraphView";
import type { PublishedNote } from "./types";

type Props = {
  notes: PublishedNote[];
  current: string;
  scope: "local" | "vault";
  onScopeChange: (scope: "local" | "vault") => void;
  onNavigate: (path: string) => void;
  onClose: () => void;
};
export default function GraphPopover({
  notes,
  current,
  scope,
  onScopeChange,
  onNavigate,
  onClose,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const siblings = Array.from(
      panel.current?.parentElement?.parentElement?.children ?? [],
    ).filter((element) => element !== panel.current?.parentElement);
    const inert = siblings.map((element) => element.hasAttribute("inert"));
    siblings.forEach((element) => element.setAttribute("inert", ""));
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const targets = Array.from(
          panel.current?.querySelectorAll<HTMLElement | SVGElement>(
            'button:not([disabled]),input:not([disabled]),[tabindex="0"]',
          ) ?? [],
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
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      siblings.forEach((element, index) => {
        if (!inert[index]) element.removeAttribute("inert");
      });
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onClose]);
  const title = scope === "local" ? "Local graph" : "Vault graph";
  return (
    <div
      className="graph-popover-overlay modal-container"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className={`modal popover graph-popover ${scope === "local" ? "local-graph-popover" : "vault-graph-popover"}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="graph-popover-header modal-title">
          <h2>{title}</h2>
          <div>
            <button
              className="clickable-icon"
              aria-label={
                scope === "local" ? "Open global graph" : "Open local graph"
              }
              title={scope === "local" ? "Vault graph" : "Local graph"}
              onClick={() =>
                onScopeChange(scope === "local" ? "vault" : "local")
              }
            >
              <GitFork size={16} />
            </button>
            <button
              className="clickable-icon"
              aria-label={`Close ${title.toLowerCase()}`}
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
          scope={scope}
          onScopeChange={onScopeChange}
          onNavigate={(path) => {
            onClose();
            onNavigate(path);
          }}
        />
      </section>
    </div>
  );
}
