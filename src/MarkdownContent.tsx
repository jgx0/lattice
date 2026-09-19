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
