import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import type { PublishedNote } from "./types";

type Props = {
  notes: PublishedNote[];
  current: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
};
export default function QuickSwitcher({
  notes,
  current,
  onNavigate,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    panel = useRef<HTMLElement>(null);
  const id = useId().replace(/:/g, "");
  const listId = `quick-switcher-results-${id}`;
  const results = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return notes
      .map((note, index) => {
        const name =
          note.path
            .replace(/\.(?:md|markdown)$/i, "")
            .split("/")
            .pop() || note.title;
        const aliases = note.properties.aliases ?? note.properties.alias;
        const names = [
          note.title,
          name,
          ...(Array.isArray(aliases)
            ? aliases
            : typeof aliases === "string"
              ? [aliases]
              : []),
        ]
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.toLocaleLowerCase());
        const path = note.path.toLocaleLowerCase();
        if (
          !terms.every(
            (term) =>
              path.includes(term) || names.some((name) => name.includes(term)),
          )
        )
          return null;
        const exact = query.trim().toLocaleLowerCase();
        const rank = !terms.length
          ? note.path === current
            ? 0
            : 1
          : names.includes(exact)
            ? 0
            : names.some((name) => name.startsWith(exact))
              ? 1
              : names.some((name) => name.includes(exact))
                ? 2
                : 3;
        return { note, rank, index };
      })
      .filter(
        (
          entry,
        ): entry is { note: PublishedNote; rank: number; index: number } =>
          !!entry,
      )
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, 60)
      .map((entry) => entry.note);
  }, [query, notes, current]);
  const active = Math.min(selected, Math.max(0, results.length - 1));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          "input,button:not([disabled])",
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
    };
    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>(`[data-result-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  function open(note: PublishedNote) {
    onNavigate(note.path);
    onClose();
  }
  return (
    <div
      className="modal-container quick-switcher-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className="modal prompt quick-switcher-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelected(results.length ? (active + 1) % results.length : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelected(
              results.length
                ? (active - 1 + results.length) % results.length
                : 0,
            );
          } else if (event.key === "Enter" && event.target === input.current) {
            event.preventDefault();
            if (results[active]) open(results[active]);
          }
        }}
      >
        <div className="prompt-input-container">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            className="prompt-input"
            aria-label="Find a file"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              results.length ? `${listId}-${active}` : undefined
            }
            placeholder="Type a file name…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
          />
          <button
            className="clickable-icon prompt-close"
            aria-label="Close quick switcher"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div
          className="prompt-results"
          role="listbox"
          aria-label="Matching files"
          id={listId}
        >
          {results.map((note, index) => (
            <div
              key={note.path}
              id={`${listId}-${index}`}
              className={`suggestion-item mod-complex ${index === active ? "is-selected" : ""}`}
              role="option"
              aria-selected={index === active}
              data-result-index={index}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => open(note)}
            >
              <div className="suggestion-icon">
                <FileText size={16} />
              </div>
              <div className="suggestion-content">
                <div className="suggestion-title">{note.title}</div>
                <div className="suggestion-note">
                  {note.path.replace(/\.(?:md|markdown)$/i, "")}
                </div>
              </div>
              {note.path === current && (
                <span className="suggestion-current">Current</span>
              )}
            </div>
          ))}
          {!results.length && (
            <div className="prompt-empty" role="status">
              No files found.
            </div>
          )}
        </div>
        <div className="prompt-instructions">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to navigate
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>esc</kbd> to dismiss
          </span>
        </div>
      </section>
    </div>
  );
}
