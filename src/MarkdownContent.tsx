import { useEffect, useRef } from "react";
export default function MarkdownContent({
  html,
  onClick,
  onMouseOver,
  onMouseOut,
}: {
  html: string;
  onClick: React.MouseEventHandler;
  onMouseOver: React.MouseEventHandler;
  onMouseOut: React.MouseEventHandler;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelectorAll<HTMLTableElement>("table.base-table")
      .forEach((table) => {
        table
          .querySelectorAll<HTMLElement>("thead th")
          .forEach((th, column) => {
            if (th.querySelector(".base-sort")) return;
            const button = document.createElement("button");
            button.className = "base-sort";
            button.type = "button";
            button.textContent = th.textContent + " ↕";
            button.setAttribute("aria-label", `Sort by ${th.textContent}`);
            let ascending = false;
            button.addEventListener("click", () => {
              ascending = !ascending;
              const rows = Array.from(table.tBodies[0].rows);
              rows.sort((a, b) => {
                const av = a.cells[column]?.textContent?.trim() || "",
                  bv = b.cells[column]?.textContent?.trim() || "";
                const diff =
                  av !== "" &&
                  bv !== "" &&
                  Number.isFinite(Number(av)) &&
                  Number.isFinite(Number(bv))
                    ? Number(av) - Number(bv)
                    : av.localeCompare(bv, undefined, { numeric: true });
                return ascending ? diff : -diff;
              });
              rows.forEach((row) => table.tBodies[0].appendChild(row));
              table
                .querySelectorAll("th")
                .forEach((cell) => cell.removeAttribute("aria-sort"));
