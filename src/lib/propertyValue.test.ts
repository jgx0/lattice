// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildNotes } from "./model";
import { renderPropertyValue } from "./propertyValue";
import type { VaultFile } from "../types";
const files: VaultFile[] = [
  { path: "Groups/Host.md", kind: "note", content: "# Host\n" },
  {
    path: "Groups/Target.md",
    kind: "note",
    content: "---\naliases: [Friendly]\n---\n## Details\nTarget\n",
  },
];
const notes = buildNotes(files);
describe("property link rendering", () => {
  it("renders text, list and nested wikilinks with aliases and precise anchors", () => {
    const html = renderPropertyValue(
      {
        category: ["[[Target]]", "[[Friendly#Details|More]]"],
        details: "See [[./Target#^block|Block]]",
      },
      notes,
      "Groups/Host.md",
      (n, a) => `/notes/${n.slug}${a ? "#" + a : ""}`,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(
      [...doc.querySelectorAll("a")].map((a) => [
        a.textContent,
        a.getAttribute("href"),
        a.dataset.note,
        a.dataset.anchor,
      ]),
    ).toEqual([
      ["Target", "/notes/groups/target", "Groups/Target.md", ""],
      ["More", "/notes/groups/target#details", "Groups/Target.md", "details"],
      ["Block", "/notes/groups/target#block", "Groups/Target.md", "block"],
    ]);
  });
  it("escapes HTML and unresolved targets, without embedding notes or unsafe URLs", () => {
    const html = renderPropertyValue(
      "<script>alert(1)</script> ![[Target|<img onerror=1>]] [[javascript:alert(1)|Unknown]]",
      notes,
      "Groups/Host.md",
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("script,img,iframe,[onerror]")).toBeNull();
    expect(doc.querySelectorAll("a")).toHaveLength(1);
    expect(doc.querySelector("a")?.textContent).toBe("<img onerror=1>");
    expect(doc.querySelector(".is-unresolved")?.textContent).toBe("Unknown");
  });
  it("bounds cyclic metadata and leaves non-string values as text", () => {
    const recursive: { value: unknown } = { value: null };
    recursive.value = recursive;
    expect(renderPropertyValue(recursive, notes)).toContain("[…]");
    expect(renderPropertyValue([false, 42, null], notes)).toBe("false, 42, ");
  });
});
