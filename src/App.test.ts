// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { folderStateKey } from "./useFolderState";
import { demoVault, defaultSettings } from "./demo";
import { buildNotes, getBacklinks, resolveNote } from "./lib/model";
import { renderMarkdown, renderPreview } from "./lib/render";
import { renderPropertyValue } from "./lib/propertyValue";
import type { CompiledSite, Vault } from "./types";

// Compile test input once, outside App: the reader receives no vault/storage mocks.
function compileFixture(vault: Vault): CompiledSite {
  const notes = buildNotes(vault.files);
  const settings = {
    ...defaultSettings,
    title: "Notes",
    showProperties: false,
    hiddenPaths: [],
  };
  const urls = new Map(
    notes.map((note) => [
      note.path,
      note.path === settings.home ? "/garden/" : `/garden/${note.slug}`,
    ]),
  );
  function markup(html: string) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll<HTMLAnchorElement>("a[data-note]").forEach((link) => {
      const url = urls.get(link.dataset.note!);
      if (url)
        link.setAttribute(
          "href",
          url +
            (link.dataset.anchor
              ? `#${encodeURIComponent(link.dataset.anchor)}`
              : ""),
        );
    });
    return doc.body.innerHTML;
  }
  return {
    version: 1,
    name: vault.name,
    settings,
    notes: notes.map((note) => ({
      ...note,
      url: urls.get(note.path)!,
      html: markup(renderMarkdown(note, notes, vault.files)),
      previewHtml: markup(renderPreview(note, notes, vault.files)),
      propertyHtml: Object.fromEntries(
        Object.entries(note.properties).map(([key, value]) => [
          key,
          renderPropertyValue(
            value,
            notes,
            note.path,
            (target, anchor) =>
              urls.get(target.path)! +
              (anchor ? "#" + encodeURIComponent(anchor) : ""),
          ),
        ]),
      ),
      outgoing: [
        ...new Set(
          note.links
            .map((link) => resolveNote(link, notes, note.path)?.path)
            .filter((path): path is string => !!path),
        ),
      ],
      backlinks: getBacklinks(note, notes).map((source) => source.path),
    })),
    bodyClasses: ["theme-light", "garden-reader"],
    themeCss:
      "body.theme-light{--background-primary:#faf8f4}body.theme-dark{--background-primary:#171717}body.garden-reader{--font-text-size:18px}",
  };
}
const site = compileFixture(demoVault);
const themePreferenceKey = "publish-reader-community-theme";
const commonThemeCss = ".snippet{color:rgb(12, 34, 56)}";
const minimalThemeCss =
  "body{--community-theme:minimal}.snippet{color:rgb(200, 0, 0)}";
const thingsThemeCss =
  "body{--community-theme:things}.snippet{color:rgb(0, 0, 200)}";
const publishThemeCss =
  "body{--community-theme:publish}.snippet{color:rgb(120, 90, 180)}";
const catalogSite: CompiledSite = {
  ...site,
  settings: { ...site.settings, allowThemeSwitching: true },
  defaultTheme: "default",
  themes: [
    { id: "default", name: "Default", cssUrl: "" },
    {
      id: "publish-theme",
      name: "Publish",
      cssUrl: "/_theme/publish-theme.css",
    },
    { id: "minimal", name: "Minimal", cssUrl: "/_theme/minimal.css" },
    { id: "things", name: "Things", cssUrl: "/_theme/things.css" },
  ],
  themeCss: `${site.themeCss}\n.default-only{color:rgb(99, 88, 77)}\n${commonThemeCss}`,
  themeOverridesCss: commonThemeCss,
};
const safeSite = compileFixture({
  name: "Safety fixture",
  files: [
    {
      path: "Welcome.md",
      kind: "note",
      content:
        '---\ntitle: Safe note\n---\n<strong>Readable content</strong>\n\n<img src="x" onerror="alert(1)"><script>alert(1)</script>\n<a href="javascript:alert(1)" onclick="alert(1)">Unsafe link</a>\n<iframe src="data:text/html;base64,AAAA" srcdoc="bad"></iframe>\n\n[[Other|Safe internal link]]',
    },
    { path: "Other.md", kind: "note", content: "A safe destination." },
  ],
});
let container: HTMLDivElement;
let root: Root;
let systemDark: boolean;
const mediaListeners = new Set<() => void>();
const originalTitle = document.title;
const originalBodyClass = document.body.className;
const originalTheme = document.documentElement.getAttribute("data-theme");
const originalCommunity =
  document.documentElement.getAttribute("data-community");
const originalThemeName = document.body.getAttribute("data-theme-name");
const shims = [
  [HTMLElement.prototype, "scrollTo"],
  [HTMLElement.prototype, "scrollIntoView"],
  [URL, "createObjectURL"],
  [URL, "revokeObjectURL"],
] as const;
const descriptors = shims.map(([target, key]) =>
  Object.getOwnPropertyDescriptor(target, key),
);

function one<T extends Element = HTMLElement>(
  selector: string,
  scope: ParentNode = container,
): T {
  const element = scope.querySelector<T>(selector);
  expect(element, `Expected ${selector}`).not.toBeNull();
  return element!;
}
function label(text: string, scope: ParentNode = container): HTMLElement {
  return one(`[aria-label="${text}"]`, scope);
}
function sidebarControl(text: string, controls: string, expanded: boolean) {
  const toolbar = one(".topbar");
  const button = one<HTMLButtonElement>(
    `button[aria-label="${text}"]`,
    toolbar,
  );
  expect(button.getAttribute("aria-expanded")).toBe(String(expanded));
  expect(button.getAttribute("aria-controls")).toBe(controls);
  expect(
    toolbar.querySelectorAll(`button[aria-controls="${controls}"]`),
  ).toHaveLength(1);
  return button;
}
function nav(title: string): HTMLAnchorElement {
  const matches = [
    ...container.querySelectorAll<HTMLAnchorElement>("a.nav-file-title"),
  ].filter((link) => link.textContent === title);
  expect(matches, `Expected one sidebar link titled ${title}`).toHaveLength(1);
  return matches[0];
}
function folderButton(
  text: string,
  scope: ParentNode = one(".vault-navigation"),
): HTMLButtonElement {
  const matches = [
    ...scope.querySelectorAll<HTMLButtonElement>("button.nav-folder-title"),
  ].filter((button) => button.textContent === text);
  expect(matches, `Expected one folder button titled ${text}`).toHaveLength(1);
  return matches[0];
}
function titles() {
  return [...container.querySelectorAll(".note-header h1")].map(
    (element) => element.textContent,
  );
}
function compiled(path: string) {
  return site.notes.find((note) => note.path === path)!;
}
function prefs() {
  return JSON.parse(localStorage.getItem("publish-reader-preferences")!);
}
function quickSwitcher() {
  return one('[role="dialog"][aria-label="Quick switcher"]');
}
function quickOptions() {
  return [
    ...label("Matching files", quickSwitcher()).querySelectorAll<HTMLElement>(
      '[role="option"]',
    ),
  ];
}
function quickPaths() {
  return quickOptions().map(
    (option) => one(".suggestion-note", option).textContent,
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
type TestInitialAppearance = {
  mode: "light" | "dark";
  id: string;
  selectedId: string;
  defaultId: string;
  catalog: string;
  defaultCss: string;
  css: string;
  pending: boolean;
  ready: Promise<TestInitialAppearance>;
  cancel: () => void;
};
const bootstrapStyles = new Set<HTMLStyleElement>();
async function installAppearance(
  inputSite = catalogSite,
  values: Partial<TestInitialAppearance> = {},
  media: string | null = null,
) {
  await act(async () => root.unmount());
  vi.clearAllTimers();
  root = createRoot(container);
  const ready = deferred<TestInitialAppearance>();
  const css = inputSite.themeCss.replace(/<\/style/gi, "<\\/style");
  const state: TestInitialAppearance = {
    mode: "light",
    id: inputSite.defaultTheme ?? "default",
    selectedId: "minimal",
    defaultId: inputSite.defaultTheme ?? "default",
    catalog: JSON.stringify(
      inputSite.settings.allowThemeSwitching ? (inputSite.themes ?? []) : [],
    ),
    defaultCss: css,
    css,
    pending: true,
    ready: ready.promise,
    cancel: vi.fn(),
    ...values,
  };
  const staticTheme = document.createElement("style");
  staticTheme.id = "published-theme";
  staticTheme.textContent = state.css;
  if (media !== null) staticTheme.setAttribute("media", media);
  document.head.appendChild(staticTheme);
  bootstrapStyles.add(staticTheme);
  document.documentElement.dataset.theme = state.mode;
  document.documentElement.dataset.community = state.id;
  document.body.classList.toggle("theme-dark", state.mode === "dark");
  document.body.classList.toggle("theme-light", state.mode === "light");
  document.body.dataset.themeName = state.id;
  vi.stubGlobal("__latticeAppearance", state);
  return { state, ready, staticTheme };
}
function themeResponse(css: string, status = 200) {
  return new Response(css, { status });
}
async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}
function picker() {
  return one<HTMLSelectElement>('select[aria-label="Obsidian theme"]');
}
function expectPublishedTheme(id: string, css: string) {
  expect(one("style[data-publish-theme]").textContent).toBe(css);
  expect(document.documentElement.dataset.community).toBe(id);
  expect(document.body.dataset.themeName).toBe(id);
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}
async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await advance(100);
}
async function key(
  target: EventTarget,
  value: string,
  options: KeyboardEventInit = {},
) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
        ...options,
      }),
    );
  });
  await advance(100);
}
async function input(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  // Bypass React's value tracker to simulate a native user edit.
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
    element,
    value,
  );
  await act(async () => {
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function mount(inputSite = site) {
  await act(async () => {
    root.render(createElement(App, { site: inputSite }));
  });
}
async function remount(inputSite = site, url = "/garden/") {
  await act(async () => {
    root.unmount();
  });
  vi.clearAllTimers();
  window.history.replaceState(null, "", url);
  root = createRoot(container);
  await mount(inputSite);
  await advance(100);
}

beforeEach(async () => {
  vi.useFakeTimers();
  systemDark = false;
  mediaListeners.clear();
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(String(key));
    },
    setItem: (key, value) => {
      values.set(String(key), String(value));
    },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 900);
  // These tests only need escaping for quoted attribute selectors.
  vi.stubGlobal("CSS", {
    ...globalThis.CSS,
    escape: (value: string) =>
      value.replace(
        /[^a-zA-Z0-9_-]/g,
        (character) => `\\${character.codePointAt(0)!.toString(16)} `,
      ),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return systemDark;
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        mediaListeners.add(listener);
      }),
      removeEventListener: vi.fn((_event: string, listener: () => void) => {
        mediaListeners.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
    },
  );
  shims.forEach(([target, name]) =>
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: vi.fn(
        name === "createObjectURL" ? () => "blob:test" : () => undefined,
      ),
    }),
  );
  window.history.replaceState(null, "", "/garden/");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await mount();
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  bootstrapStyles.forEach((style) => style.remove());
  bootstrapStyles.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  shims.forEach(([target, name], index) => {
    if (descriptors[index])
      Object.defineProperty(target, name, descriptors[index]!);
    else Reflect.deleteProperty(target, name);
  });
  document.title = originalTitle;
  document.body.className = originalBodyClass;
  if (originalTheme === null)
    document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", originalTheme);
  if (originalCommunity === null)
    document.documentElement.removeAttribute("data-community");
  else
    document.documentElement.setAttribute("data-community", originalCommunity);
  if (originalThemeName === null)
    document.body.removeAttribute("data-theme-name");
  else document.body.setAttribute("data-theme-name", originalThemeName);
});

describe("compiled-site reader", () => {
  describe("persisted navigation folders", () => {
    it("restores collapsed and expanded folders on nested-route reloads without depending on the route or display title", async () => {
      const key = folderStateKey(site);
      expect(folderButton("Field Notes").getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(localStorage.getItem(key)).toBe("[]");
      await click(folderButton("Field Notes"));
      expect(folderButton("Field Notes").getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(
        one(".vault-navigation").querySelector(
          '[data-path="Field Notes/Digital gardens.md"]',
        ),
      ).toBeNull();
      expect(localStorage.getItem(key)).toBe('["Field Notes"]');

      const renamedSite: CompiledSite = {
        ...site,
        name: "Renamed vault",
        settings: { ...site.settings, title: "Renamed site" },
      };
      await remount(
        renamedSite,
        compiled("Field Notes/Digital gardens.md").url,
      );
      expect(titles()).toEqual(["Digital gardens"]);
      expect(one(".site-name").textContent).toBe("Renamed site");
      expect(folderStateKey(renamedSite)).toBe(key);
      expect(folderButton("Field Notes").getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(
        folderButton("Field Notes").parentElement!.classList.contains(
          "is-collapsed",
        ),
      ).toBe(true);

      await click(folderButton("Field Notes"));
      expect(nav("Digital gardens").getAttribute("aria-current")).toBe("page");
      expect(localStorage.getItem(key)).toBe("[]");
      await click(nav("Attention is a material"));
      expect(folderStateKey(renamedSite)).toBe(key);
      await remount(
        renamedSite,
        compiled("Field Notes/Attention is a material.md").url,
      );
      expect(titles()).toEqual(["Attention is a material"]);
      expect(folderButton("Field Notes").getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(nav("Digital gardens")).toBeDefined();
      expect(localStorage.getItem(key)).toBe("[]");
    });

    it("keeps a nested folder collapsed when its parent is collapsed, reloaded, and expanded", async () => {
      const library = folderButton("Library").parentElement!;
      await click(folderButton("Books", library));
      expect(folderButton("Books", library).getAttribute("aria-expanded")).toBe(
        "false",
      );
      await click(folderButton("Library"));
      expect(localStorage.getItem(folderStateKey(site))).toBe(
        '["Library","Library/Books"]',
      );

      await remount(site, compiled("Library/Books/How to Do Nothing.md").url);
      expect(titles()).toEqual(["How to Do Nothing"]);
      expect(folderButton("Library").getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(
        folderButton("Library").parentElement!.querySelector(
          ".nav-folder-children",
        ),
      ).toBeNull();
      await click(folderButton("Library"));
      const books = folderButton(
        "Books",
        folderButton("Library").parentElement!,
      );
      expect(books.getAttribute("aria-expanded")).toBe("false");
      expect(
        books.parentElement!.querySelector(".nav-folder-children"),
      ).toBeNull();
      expect(localStorage.getItem(folderStateKey(site))).toBe(
        '["Library/Books"]',
      );
      await click(books);
      expect(nav("How to Do Nothing").getAttribute("aria-current")).toBe(
        "page",
      );
      expect(localStorage.getItem(folderStateKey(site))).toBe("[]");
    });

    it("persists assigned public navigation paths rather than the notes' source folders", async () => {
      const input = compileFixture({
        name: "Public navigation",
        files: [
          { path: "Welcome.md", kind: "note", content: "Home" },
          {
            path: "Private/Research/Note.md",
            kind: "note",
            content: "Published note",
          },
          {
            path: "Other/Note.md",
            kind: "note",
            content: "Another published note",
          },
        ],
      });
      input.settings.navigationFolders = {
        "Private/Research/Note.md": "Public/Shelf",
        "Other/Note.md": "Other public/Shelf",
      };
      const key = folderStateKey(input);
      localStorage.setItem(key, '["Private","Private/Research"]');
      await remount(input);
      expect(localStorage.getItem(key)).toBe("[]");
      const publicFolder = folderButton("Public").parentElement!;
      expect(
        folderButton("Shelf", publicFolder).getAttribute("aria-expanded"),
      ).toBe("true");
      await click(folderButton("Shelf", publicFolder));
      expect(localStorage.getItem(key)).toBe('["Public/Shelf"]');
      await remount(
        input,
        input.notes.find((note) => note.path === "Private/Research/Note.md")!
          .url,
      );
      expect(folderButton("Public").getAttribute("aria-expanded")).toBe("true");
      const shelf = folderButton(
        "Shelf",
        folderButton("Public").parentElement!,
      );
      expect(shelf.getAttribute("aria-expanded")).toBe("false");
      expect(shelf.parentElement!.querySelector(".nav-file-title")).toBeNull();
      expect(
        folderButton(
          "Shelf",
          folderButton("Other public").parentElement!,
        ).getAttribute("aria-expanded"),
      ).toBe("true");
      expect(
        input.notes.find((note) => note.path === "Private/Research/Note.md")!
          .folder,
      ).toBe("Private/Research");
      await click(shelf);
      expect(
        one(
          '[data-path="Private/Research/Note.md"]',
          one(".vault-navigation"),
        ).getAttribute("aria-current"),
      ).toBe("page");
      await remount(input);
      expect(
        folderButton(
          "Shelf",
          folderButton("Public").parentElement!,
        ).getAttribute("aria-expanded"),
      ).toBe("true");
      expect(localStorage.getItem(key)).toBe("[]");
    });
  });

  it("expands styled properties after Markdown by default, preserves safe wikilinks and keeps a reader's fold on rerender", async () => {
    const input = compileFixture({
      name: "Properties",
      files: [
        {
          path: "Welcome.md",
          kind: "note",
          content:
            '---\ntitle: Property home\naliases: [Home]\ncssclasses: [property-note]\ncategory: ["[[Topics/Target#Details|Related category]]"]\nunsafe: \'<img src=x onerror=alert(1)> [[javascript:alert(1)|Unknown]]\'\nfallback: "<script>alert(1)</script>"\n---\nHome',
        },
        {
          path: "Topics/Target.md",
          kind: "note",
          content: "## Details\nDestination",
        },
      ],
    });
    input.settings.showProperties = true;
    delete input.notes.find((note) => note.path === "Welcome.md")!.propertyHtml!
      .fallback;
    await remount(input);
    const properties = one<HTMLDetailsElement>(
      "details.metadata-container.properties",
    );
    const sizer = one(".note-page .markdown-preview-sizer");
    const markdown = one(".markdown-body", sizer);
    expect(properties.parentElement).toBe(sizer);
    expect([...sizer.children]).toEqual([
      one(".note-header", sizer),
      markdown,
      properties,
    ]);
    expect(markdown.nextElementSibling).toBe(properties);
    expect(
      markdown.compareDocumentPosition(properties) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(properties.open).toBe(true);
    expect(properties.hasAttribute("open")).toBe(true);
    const summary = one("summary.metadata-properties-heading", properties);
    expect(summary.textContent).toBe("Properties");
    expect(summary.parentElement).toBe(properties);
    expect(one("svg", summary).classList.contains("lucide-chevron-right")).toBe(
      true,
    );
    expect(
      [...properties.querySelectorAll(".metadata-property-key-name")].map(
        (key) => key.textContent,
      ),
    ).toEqual(["category", "unsafe", "fallback"]);
    for (const row of properties.querySelectorAll(".metadata-property")) {
      const icon = one(
        '.metadata-property-key .metadata-property-icon[aria-hidden="true"]',
        row,
      );
      expect(icon.querySelector("svg")).not.toBeNull();
    }
    const values = properties.querySelectorAll(".metadata-property-value");
    expect(values[1].textContent).toBe("<img src=x onerror=alert(1)> Unknown");
    expect(
      one('.is-unresolved[aria-disabled="true"]', values[1]).textContent,
    ).toBe("Unknown");
    expect(values[2].textContent).toBe("<script>alert(1)</script>");
    expect(
      properties.querySelector(
        "script, img, iframe, [onerror], [onclick], [srcdoc]",
      ),
    ).toBeNull();
    expect(properties.querySelector('a[href^="javascript:"]')).toBeNull();
    const link = one<HTMLAnchorElement>(
      ".metadata-property-value a",
      properties,
    );
    expect(link.textContent).toBe("Related category");
    expect(link.getAttribute("href")).toBe("/garden/topics/target#details");
    expect(link.dataset.note).toBe("Topics/Target.md");
    expect(link.dataset.anchor).toBe("details");
    await click(summary);
    expect(properties.open).toBe(false);
    await click(label("Toggle color theme"));
    await click(sidebarControl("Fold left sidebar", "site-navigation", true));
    expect(one("details.metadata-container")).toBe(properties);
    expect(properties.open).toBe(false);
    expect(one(".metadata-property-value a", properties)).toBe(link);
    await click(summary);
    expect(properties.open).toBe(true);
    await click(link);
    expect(titles()).toEqual(["Target"]);
    expect(window.location.pathname).toBe("/garden/topics/target");
    expect(window.location.hash).toBe("#details");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });
  it("renders plain demo content without authoring scaffolding and preserves compiled sanitization", async () => {
    expect(titles()).toEqual(["Welcome to Lattice"]);
    expect(one(".note-header").textContent).toBe("Welcome to Lattice");
    expect(one(".markdown-body").innerHTML).toBe(compiled("Welcome.md").html);
    const tip=one('[data-callout="tip"]');
    expect(tip.textContent).toContain('Find any note in a few keystrokes');
    expect(tip.textContent).toContain('Command+K');
    expect(tip.compareDocumentPosition(one('.markdown-body h2')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(one(".site-header").textContent).toBe("Notes");
    expect(
      container.querySelector(
        '.note-meta, .note-eyebrow, .garden-paths, .note-footer, .site-brand, footer, input[type="file"]',
      ),
    ).toBeNull();
    expect(
      nav("Digital gardens").querySelector("svg, .tree-item-icon"),
    ).toBeNull();
    expect(prefs()).toEqual({});
    // Lattice/author text in authored Markdown is fine; App must not inject it.
    await remount(safeSite);
    expect(titles()).toEqual(["Safe note"]);
    const body = one(".markdown-body");
    expect(one("strong", body).textContent).toBe("Readable content");
    expect(
      body.querySelector("script, iframe, [onerror], [onclick], [srcdoc]"),
    ).toBeNull();
    expect(body.innerHTML).not.toMatch(/javascript:|data:text\/html/);
    await click(one('a[data-note="Other.md"]', body));
    expect(titles()).toEqual(["Other"]);
    expect(window.location.pathname).toBe("/garden/other");
  });

  it("follows actual sidebar/internal URLs, scrolls anchors and restores a pathname on popstate", async () => {
    expect(nav("Digital gardens").getAttribute("href")).toBe(
      "/garden/field-notes/digital-gardens",
    );
    await click(nav("Digital gardens"));
    expect(titles()).toEqual(["Digital gardens"]);
    expect(nav("Digital gardens").getAttribute("aria-current")).toBe("page");
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    expect(history.state).toEqual({ note: "Field Notes/Digital gardens.md" });
    const link = one<HTMLAnchorElement>(
      'a.internal-link[data-note="Field Notes/Attention is a material.md"]',
      one(".markdown-body"),
    );
    expect(link.pathname).toBe("/garden/field-notes/attention-is-a-material");
    await click(link);
    expect(titles()).toEqual(["Attention is a material"]);
    expect(document.title).toBe("Attention is a material - Notes");
    expect(window.location.pathname).toBe(link.pathname);
    await act(async () => {
      history.replaceState(
        { note: "Field Notes/Digital gardens.md" },
        "",
        "/garden/field-notes/digital-gardens",
      );
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: history.state }),
      );
    });
    await advance(100);
    expect(titles()).toEqual(["Digital gardens"]);
    expect(nav("Digital gardens").getAttribute("aria-current")).toBe("page");
    await remount(site, "/garden/field-notes/digital-gardens");
    expect(titles()).toEqual(["Digital gardens"]);
    await click(one(".site-name"));
    await click(
      one(
        'a[data-note="Field Notes/Digital gardens.md"][data-anchor="a-link-should-carry-a-thought"]',
        one(".markdown-body"),
      ),
    );
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    expect(window.location.hash).toBe("#a-link-should-carry-a-thought");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(one(".toc-link.current").textContent).toBe(
      "A link should carry a thought",
    );
  });

  it("initializes the correct note at static index.html aliases for nested and home routes", async () => {
    const rootSite: CompiledSite = {
      ...site,
      notes: site.notes.map((note) => ({
        ...note,
        url: note.url.replace(/^\/garden/, ""),
        html: note.html.replaceAll("/garden/", "/"),
        previewHtml: note.previewHtml.replaceAll("/garden/", "/"),
      })),
    };
    await remount(rootSite, "/library/the-reading-room/index.html");
    expect(titles()).toEqual(["The reading room"]);
    expect(document.title).toBe("The reading room - Notes");
    expect(one(".note-page").getAttribute("data-note-path")).toBe(
      "Library/The reading room.md",
    );
    expect(nav("The reading room").getAttribute("aria-current")).toBe("page");
    expect(
      one<HTMLTableElement>("table.base-table").tBodies[0].rows,
    ).toHaveLength(5);
    expect(label("Sort by Book").textContent).toContain("Book");
    expect(window.location.pathname).toBe(
      "/library/the-reading-room/index.html",
    );
    await remount(rootSite, "/index.html");
    const home = compiled(site.settings.home);
    expect(titles()).toEqual([home.title]);
    expect(document.title).toBe(`${home.title} - ${site.settings.title}`);
    expect(one(".note-page").getAttribute("data-note-path")).toBe(home.path);
    expect(nav(home.title).getAttribute("aria-current")).toBe("page");
    expect(window.location.pathname).toBe("/index.html");
  });

  it("builds stacked panes and closes the active pane without reopening it or leaving a stale URL", async () => {
    await click(label("Toggle stacked pages"));
    await click(nav("Digital gardens"));
    expect(container.querySelectorAll(".stack-pane")).toHaveLength(2);
    await click(nav("Walking as research"));
    expect(titles()).toEqual([
      "Welcome to Lattice",
      "Digital gardens",
      "Walking as research",
    ]);
    expect(container.querySelectorAll(".stack-pane")).toHaveLength(3);
    await click(label("Close pane Walking as research"));
    expect(titles()).toEqual(["Welcome to Lattice", "Digital gardens"]);
    expect(container.querySelectorAll(".stack-pane")).toHaveLength(2);
    expect(nav("Digital gardens").getAttribute("aria-current")).toBe("page");
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    expect(window.location.hash).toBe("");
    expect(history.state).toEqual({ note: "Field Notes/Digital gardens.md" });
    await advance(1000);
    expect(
      container.querySelector('[aria-label="Close pane Walking as research"]'),
    ).toBeNull();
    await click(label("Close pane Digital gardens"));
    expect(titles()).toEqual(["Welcome to Lattice"]);
    expect(container.querySelectorAll(".stack-pane")).toHaveLength(0);
    expect(window.location.pathname).toBe("/garden/");
    await click(nav("Digital gardens"));
    await click(label("Close pane Welcome to Lattice"));
    expect(titles()).toEqual(["Digital gardens"]);
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    await click(label("Toggle stacked pages"));
    expect(titles()).toEqual(["Digital gardens"]);
  });

  it("ignores stale build settings and invalid preferences while honoring a valid boolean", async () => {
    localStorage.setItem(
      "publish-reader-preferences",
      JSON.stringify({
        title: "Untrusted title",
        home: "Field Notes/Digital gardens.md",
        theme: "invalid-theme",
        readable: false,
        showToc: "false",
        showProperties: 1,
        stacked: "true",
        quickSwitcher: "false",
      }),
    );
    await remount();
    const home = compiled(site.settings.home);
    expect(titles()).toEqual([home.title]);
    expect(one(".site-name").textContent).toBe(site.settings.title);
    expect(one(".site-name").getAttribute("href")).toBe(home.url);
    expect(document.title).toBe(`${home.title} - ${site.settings.title}`);
    expect(document.documentElement.dataset.theme).toBe(site.settings.theme);
    expect(document.body.classList.contains("theme-light")).toBe(true);
    expect(document.body.classList.contains("theme-dark")).toBe(false);
    expect(one(".note-page").classList.contains("is-readable-line-width")).toBe(
      false,
    );
    expect(container.querySelector(".toc")).not.toBeNull();
    expect(container.querySelector(".properties")).toBeNull();
    expect(one(".app-shell").classList.contains("stack-mode")).toBe(false);
    expect(prefs()).toEqual({ readable: false });
    await click(nav("Digital gardens"));
    await click(one(".site-name"));
    expect(titles()).toEqual([home.title]);
    expect(window.location.pathname).toBe(home.url);
    expect(site.settings).toMatchObject({
      title: "Notes",
      home: home.path,
      readable: true,
    });
  });

  it("focuses settings, wraps Tab in both directions and restores focus when closed", async () => {
    const trigger = label("Reader settings", label("Site navigation"));
    // DOM dispatch does not perform the browser's native click-to-focus action.
    await act(async () => {
      trigger.focus();
    });
    await click(trigger);
    const dialog = one('[role="dialog"][aria-label="Reader settings"]');
    const first = label("Close settings", dialog);
    const last = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), select:not([disabled]), a[href], input:not([disabled])",
      ),
    ].at(-1)!;
    expect(document.activeElement).toBe(first);
    await key(first, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);
    await key(last, "Tab");
    expect(document.activeElement).toBe(first);
    await click(first);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    expect(document.activeElement).toBe(
      label("Close settings", one('[role="dialog"]')),
    );
    await key(document.activeElement!, "Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("saves reader-only preferences, applies theme CSS/body classes and follows system color changes", async () => {
    expect(one("style[data-publish-theme]").textContent).toBe(site.themeCss);
    expect(document.body.classList.contains("garden-reader")).toBe(true);
    expect(document.body.classList.contains("publish")).toBe(true);
    expect(
      getComputedStyle(document.body).getPropertyValue("--background-primary"),
    ).toBe("#faf8f4");
    await click(label("Toggle color theme"));
    expect(document.body.classList.contains("theme-dark")).toBe(true);
    expect(document.body.classList.contains("theme-light")).toBe(false);
    expect(
      getComputedStyle(document.body).getPropertyValue("--background-primary"),
    ).toBe("#171717");
    await click(label("Reader settings"));
    const dialog = label(
      "Reader settings",
      one('[role="dialog"]').parentElement!,
    );
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(
      dialog.querySelector('input, textarea, input[type="file"]'),
    ).toBeNull();
    expect(dialog.textContent).not.toMatch(
      /Homepage|Site name|Upload|Export|Author/,
    );
    for (const name of [
      "Readable line length",
      "Table of contents",
      "Properties",
    ])
      await click(label(name, dialog));
    expect(one(".note-page").classList.contains("is-readable-line-width")).toBe(
      false,
    );
    expect(container.querySelector(".toc")).toBeNull();
    expect(container.querySelector(".properties")).not.toBeNull();
    expect(prefs()).toEqual({
      theme: "dark",
      readable: false,
      showToc: false,
      showProperties: true,
    });
    await click(label("Close settings", dialog));
    await remount();
    expect(document.body.classList.contains("theme-dark")).toBe(true);
    expect(container.querySelector(".toc")).toBeNull();
    expect(one(".note-page").classList.contains("is-readable-line-width")).toBe(
      false,
    );
    expect(site.settings).toMatchObject({
      theme: "light",
      readable: true,
      showToc: true,
      showProperties: false,
    });
    await click(label("Reader settings"));
    await input(one<HTMLSelectElement>("#color-mode"), "system");
    expect(document.body.classList.contains("theme-light")).toBe(true);
    await act(async () => {
      systemDark = true;
      mediaListeners.forEach((listener) => listener());
    });
    expect(document.body.classList.contains("theme-dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      getComputedStyle(document.body).getPropertyValue("--font-text-size"),
    ).toBe("18px");
    await key(window, "Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("marks Publish and Minimal presets and keeps their alignment fixes in source CSS", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      themeResponse(
        url === "/_theme/publish-theme.css" ? publishThemeCss : minimalThemeCss,
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const builtInSite: CompiledSite = {
      ...catalogSite,
      settings: {
        ...catalogSite.settings,
        communityTheme: "publish-theme",
      },
      defaultTheme: "publish-theme",
      themeCss: publishThemeCss,
    };
    await remount(builtInSite);
    expect(document.body.dataset.themePreset).toBe("publish");
    await click(label("Reader settings"));
    expect([...picker().options].map((option) => option.textContent)).toEqual([
      "Default",
      "Publish",
      "Minimal",
      "Things",
    ]);
    await input(picker(), "minimal");
    expect(document.body.dataset.themePreset).toBe("minimal");
    const [publishCss, appCss] = await Promise.all([
      readFile(
        path.join(process.cwd(), "src/themes/publish-theme.css"),
        "utf8",
      ),
      readFile(path.join(process.cwd(), "src/styles.css"), "utf8"),
    ]);
    expect(publishCss).toMatch(/--h1-size:\s*2\.6em/);
    expect(publishCss).toMatch(/--file-line-width:\s*700px/);
    expect(publishCss).toContain(".outline-item.level-2");
    expect(appCss).toMatch(
      /body\[data-theme-preset=["']?minimal["']?\][^{]*\.markdown-preview-sizer\s*\{[^}]*padding:\s*0\s*!important[^}]*width:\s*100%\s*!important/s,
    );
    expect(appCss).toMatch(
      /body\[data-theme-preset=["']?minimal["']?\][^{]*\.markdown-body\s*\{[^}]*max-width:\s*none\s*!important/s,
    );
    expect(
      appCss.match(/\.main-shell\s*>\s*\.reader\s*\{[^}]*overflow-y:\s*auto/g),
    ).toHaveLength(1);
  });

  describe("published theme picker and reader status", () => {
    it("hides the picker when switching is disabled or no catalog is supplied, ignoring a stale selection", async () => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      vi.stubGlobal("fetch", fetch);
      localStorage.setItem(themePreferenceKey, "minimal");
      localStorage.setItem(
        "publish-reader-preferences",
        JSON.stringify({ allowThemeSwitching: true }),
      );
      for (const inputSite of [
        {
          ...catalogSite,
          settings: { ...catalogSite.settings, allowThemeSwitching: false },
        },
        { ...catalogSite, themes: undefined },
      ]) {
        await remount(inputSite);
        await click(label("Reader settings"));
        expect(
          container.querySelector('[aria-label="Obsidian theme"]'),
        ).toBeNull();
        expect(
          container.querySelector('[role="status"], [role="alert"]'),
        ).toBeNull();
        expectPublishedTheme("default", catalogSite.themeCss);
        expect(localStorage.getItem(themePreferenceKey)).toBe("minimal");
        expect(prefs()).toEqual({});
      }
      expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps the original CSS until the response body succeeds, preserves overrides across navigation and caches each URL", async () => {
      const request = deferred<Response>();
      const body = deferred<string>();
      const response = themeResponse("");
      response.text = vi.fn(() => body.promise);
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockReturnValueOnce(request.promise)
        .mockResolvedValueOnce(themeResponse(thingsThemeCss));
      vi.stubGlobal("fetch", fetch);
      await remount(catalogSite);
      await click(label("Reader settings"));
      const select = picker();
      expect(
        [...select.options].map((option) => [option.value, option.textContent]),
      ).toEqual([
        ["default", "Default"],
        ["publish-theme", "Publish"],
        ["minimal", "Minimal"],
        ["things", "Things"],
      ]);
      expect(select.value).toBe("default");
      expect(select.getAttribute("aria-busy")).toBe("false");
      expect(fetch).not.toHaveBeenCalled();
      await input(select, "minimal");
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/_theme/minimal.css", {
        signal: expect.any(AbortSignal),
      });
      expect(select.value).toBe("minimal");
      expect(select.getAttribute("aria-busy")).toBe("true");
      expect(one('[role="status"]').textContent).toMatch(/loading theme/i);
      expectPublishedTheme("default", catalogSite.themeCss);
      expect(localStorage.getItem(themePreferenceKey)).toBeNull();
      await settle(() => request.resolve(response));
      expect(response.text).toHaveBeenCalledOnce();
      expectPublishedTheme("default", catalogSite.themeCss);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      await settle(() => body.resolve(minimalThemeCss));
      const minimalCss = `${minimalThemeCss}\n${commonThemeCss}`;
      expectPublishedTheme("minimal", minimalCss);
      expect(select.getAttribute("aria-busy")).toBe("false");
      expect(
        container.querySelector('[role="status"], [role="alert"]'),
      ).toBeNull();
      expect(localStorage.getItem(themePreferenceKey)).toBe("minimal");
      const snippet = document.createElement("div");
      snippet.className = "snippet";
      container.appendChild(snippet);
      expect(getComputedStyle(snippet).color).toBe("rgb(12, 34, 56)");
      await click(label("Close settings"));
      await click(nav("Digital gardens"));
      expect(titles()).toEqual(["Digital gardens"]);
      expectPublishedTheme("minimal", minimalCss);
      expect(fetch).toHaveBeenCalledOnce();
      await click(label("Reader settings"));
      expect(picker().value).toBe("minimal");
      await input(picker(), "default");
      expectPublishedTheme("default", catalogSite.themeCss);
      expect(localStorage.getItem(themePreferenceKey)).toBe("default");
      await input(picker(), "minimal");
      expectPublishedTheme("minimal", minimalCss);
      await input(picker(), "things");
      const thingsCss = `${thingsThemeCss}\n${commonThemeCss}`;
      expectPublishedTheme("things", thingsCss);
      expect(getComputedStyle(snippet).color).toBe("rgb(12, 34, 56)");
      await input(picker(), "default");
      await input(picker(), "things");
      expectPublishedTheme("things", thingsCss);
      await input(picker(), "minimal");
      expectPublishedTheme("minimal", minimalCss);
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        "/_theme/minimal.css",
        "/_theme/things.css",
      ]);
      expect(prefs()).toEqual({});
    });

    it("announces HTTP, network and response-body failures without replacing CSS or the saved theme, and allows retry", async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(themeResponse(minimalThemeCss));
      vi.stubGlobal("fetch", fetch);
      await remount(catalogSite);
      await click(label("Reader settings"));
      await input(picker(), "minimal");
      const minimalCss = `${minimalThemeCss}\n${commonThemeCss}`;
      for (const failure of ["http", "network", "body"]) {
        const request = deferred<Response>();
        fetch.mockReturnValueOnce(request.promise);
        await input(picker(), "things");
        expect(container.querySelector('[role="alert"]')).toBeNull();
        expect(one('[role="status"]').textContent).toMatch(/loading/i);
        expectPublishedTheme("minimal", minimalCss);
        await settle(() => {
          if (failure === "network") request.reject(new TypeError("Offline"));
          else if (failure === "http") request.resolve(themeResponse("", 503));
          else {
            const response = themeResponse("");
            response.text = () => Promise.reject(new Error("Interrupted body"));
            request.resolve(response);
          }
        });
        expect(one('[role="alert"]').textContent).toMatch(
          /could not load Things.*current theme has been kept/i,
        );
        expect(container.querySelector('[role="status"]')).toBeNull();
        expect(picker().getAttribute("aria-busy")).toBe("false");
        expect(picker().value).toBe("minimal");
        expectPublishedTheme("minimal", minimalCss);
        expect(localStorage.getItem(themePreferenceKey)).toBe("minimal");
      }
      fetch.mockResolvedValueOnce(themeResponse(thingsThemeCss));
      await input(picker(), "things");
      expectPublishedTheme("things", `${thingsThemeCss}\n${commonThemeCss}`);
      expect(localStorage.getItem(themePreferenceKey)).toBe("things");
      expect(
        container.querySelector('[role="status"], [role="alert"]'),
      ).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(5);
    });

    it("aborts rapid selections and never lets an older response, error or cached body overwrite the latest choice", async () => {
      const oldRequest = deferred<Response>();
      const oldBody = deferred<string>();
      const middleRequest = deferred<Response>();
      const latestRequest = deferred<Response>();
      const oldResponse = themeResponse("");
      oldResponse.text = () => oldBody.promise;
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(middleRequest.promise)
        .mockReturnValueOnce(latestRequest.promise);
      vi.stubGlobal("fetch", fetch);
      await remount(catalogSite);
      await click(label("Reader settings"));
      await input(picker(), "minimal");
      await settle(() => oldRequest.resolve(oldResponse));
      const firstSignal = fetch.mock.calls[0][1]!.signal!;
      await input(picker(), "things");
      const middleSignal = fetch.mock.calls[1][1]!.signal!;
      expect(firstSignal.aborted).toBe(true);
      await input(picker(), "minimal");
      const latestSignal = fetch.mock.calls[2][1]!.signal!;
      expect(middleSignal.aborted).toBe(true);
      expect(latestSignal.aborted).toBe(false);
      expectPublishedTheme("default", catalogSite.themeCss);
      await settle(() => latestRequest.resolve(themeResponse(minimalThemeCss)));
      const latestCss = `${minimalThemeCss}\n${commonThemeCss}`;
      expectPublishedTheme("minimal", latestCss);
      // These mocks deliberately ignore abort so revision checks must protect state.
      await settle(() =>
        middleRequest.reject(new Error("Late network failure")),
      );
      await settle(() => oldBody.resolve("body{--community-theme:outdated}"));
      expectPublishedTheme("minimal", latestCss);
      expect(picker().value).toBe("minimal");
      expect(picker().getAttribute("aria-busy")).toBe("false");
      expect(
        container.querySelector('[role="status"], [role="alert"]'),
      ).toBeNull();
      expect(localStorage.getItem(themePreferenceKey)).toBe("minimal");
      await input(picker(), "default");
      expectPublishedTheme("default", catalogSite.themeCss);
      await input(picker(), "minimal");
      expectPublishedTheme("minimal", latestCss);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("automatically loads a valid stored selection on reload and ignores invalid or default stored IDs", async () => {
      const request = deferred<Response>();
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockReturnValueOnce(request.promise)
        .mockResolvedValueOnce(themeResponse(thingsThemeCss));
      vi.stubGlobal("fetch", fetch);
      localStorage.setItem(themePreferenceKey, "things");
      await remount(catalogSite);
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/_theme/things.css", {
        signal: expect.any(AbortSignal),
      });
      expectPublishedTheme("default", catalogSite.themeCss);
      await click(label("Reader settings"));
      expect(picker().value).toBe("things");
      expect(picker().getAttribute("aria-busy")).toBe("true");
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      await settle(() => request.resolve(themeResponse(thingsThemeCss)));
      const css = `${thingsThemeCss}\n${commonThemeCss}`;
      expectPublishedTheme("things", css);
      expect(localStorage.getItem(themePreferenceKey)).toBe("things");
      await remount(catalogSite);
      expectPublishedTheme("things", css);
      expect(fetch).toHaveBeenCalledTimes(2);
      await click(label("Reader settings"));
      expect(picker().value).toBe("things");
      for (const saved of ["removed-theme", "null", "", "default"]) {
        localStorage.setItem(themePreferenceKey, saved);
        await remount(catalogSite);
        await click(label("Reader settings"));
        expect(picker().value).toBe("default");
        expect(picker().getAttribute("aria-busy")).toBe("false");
        expectPublishedTheme("default", catalogSite.themeCss);
        expect(
          container.querySelector('[role="status"], [role="alert"]'),
        ).toBeNull();
        expect(localStorage.getItem(themePreferenceKey)).toBe(saved);
      }
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("disables the static head stylesheet while mounted and restores its exact no-JS media baseline on unmount", async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async () => themeResponse(minimalThemeCss));
      vi.stubGlobal("fetch", fetch);
      for (const media of [null, "screen"]) {
        localStorage.removeItem(themePreferenceKey);
        const staticTheme = document.createElement("style");
        staticTheme.id = "published-theme";
        staticTheme.textContent = catalogSite.themeCss;
        if (media !== null) staticTheme.setAttribute("media", media);
        document.head.appendChild(staticTheme);
        try {
          await remount(catalogSite);
          expect(staticTheme.getAttribute("media")).toBe("not all");
          expectPublishedTheme("default", catalogSite.themeCss);
          await click(label("Reader settings"));
          await input(picker(), "minimal");
          expectPublishedTheme(
            "minimal",
            `${minimalThemeCss}\n${commonThemeCss}`,
          );
          expect(staticTheme.getAttribute("media")).toBe("not all");
          expect(one("style[data-publish-theme]").textContent).not.toContain(
            ".default-only",
          );
          expect(staticTheme.textContent).toBe(catalogSite.themeCss);
          await act(async () => {
            root.unmount();
          });
          root = createRoot(container);
          expect(
            container.querySelector("style[data-publish-theme]"),
          ).toBeNull();
          expect(staticTheme.getAttribute("media")).toBe(media);
          expect(staticTheme.textContent).toBe(catalogSite.themeCss);
        } finally {
          staticTheme.remove();
        }
      }
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    describe("appearance bootstrap handoff", () => {
      it.each([null, "screen"])(
        "keeps the static stylesheet active while ready is pending, then copies exact CSS before disabling its %s media baseline",
        async (media) => {
          const fetch = vi.fn<typeof globalThis.fetch>();
          vi.stubGlobal("fetch", fetch);
          localStorage.setItem(themePreferenceKey, "minimal");
          const { state, ready, staticTheme } = await installAppearance(
            catalogSite,
            {},
            media,
          );
          const handoffCopies: (string | null | undefined)[] = [];
          const setAttribute = staticTheme.setAttribute.bind(staticTheme);
          const mediaWrites = vi
            .spyOn(staticTheme, "setAttribute")
            .mockImplementation((name, value) => {
              if (name === "media" && value === "not all")
                handoffCopies.push(
                  container.querySelector("style[data-publish-theme]")
                    ?.textContent,
                );
              setAttribute(name, value);
            });
          try {
            await mount(catalogSite);
            const owned = one<HTMLStyleElement>("style[data-publish-theme]");
            expect(owned.getAttribute("media")).toBe("not all");
            expect(staticTheme.getAttribute("media")).toBe(media);
            expect(staticTheme.textContent).toBe(state.defaultCss);
            expect(handoffCopies).toEqual([]);
            await click(label("Reader settings"));
            expect(picker().value).toBe("minimal");
            expect(picker().getAttribute("aria-busy")).toBe("true");
            expect(one('[role="status"]').textContent).toMatch(
              /loading theme/i,
            );
            await advance(500);
            expect(staticTheme.getAttribute("media")).toBe(media);
            expect(owned.getAttribute("media")).toBe("not all");
            expect(fetch).not.toHaveBeenCalled();
            expect(state.cancel).not.toHaveBeenCalled();
            // The head loader updates its own style before resolving ready.
            // Preserve bytes, including overrides and trailing whitespace.
            const css = `\n${minimalThemeCss}\n${commonThemeCss}\n  `;
            await settle(() => {
              state.id = state.selectedId = "minimal";
              state.css = css;
              state.pending = false;
              staticTheme.textContent = css;
              ready.resolve(state);
            });
            expectPublishedTheme("minimal", css);
            expect(owned.getAttribute("media")).toBeNull();
            expect(staticTheme.getAttribute("media")).toBe("not all");
            expect(staticTheme.textContent).toBe(css);
            expect(handoffCopies.length).toBeGreaterThan(0);
            expect(handoffCopies.every((copy) => copy === css)).toBe(true);
            expect(picker().getAttribute("aria-busy")).toBe("false");
            expect(
              container.querySelector('[role="status"], [role="alert"]'),
            ).toBeNull();
            expect(localStorage.getItem(themePreferenceKey)).toBe("minimal");
            expect(fetch).not.toHaveBeenCalled();
            await click(label("Close settings"));
            await click(nav("Digital gardens"));
            expectPublishedTheme("minimal", css);
            await act(async () => root.unmount());
            root = createRoot(container);
            expect(
              container.querySelector("style[data-publish-theme]"),
            ).toBeNull();
            expect(staticTheme.getAttribute("media")).toBe(media);
            expect(staticTheme.textContent).toBe(css);
          } finally {
            mediaWrites.mockRestore();
          }
        },
      );

      it("uses an already-ready bootstrap theme on the first React commit without repainting the compiled default", async () => {
        const fetch = vi.fn<typeof globalThis.fetch>();
        vi.stubGlobal("fetch", fetch);
        localStorage.setItem(themePreferenceKey, "minimal");
        const css = `\n${minimalThemeCss}\n${commonThemeCss}\n`;
        const { state, ready, staticTheme } = await installAppearance(
          catalogSite,
          { id: "minimal", selectedId: "minimal", css, pending: false },
        );
        ready.resolve(state);
        const commits: { css: string | null; community: string | undefined }[] =
          [];
        function FirstCommit() {
          useLayoutEffect(() => {
            commits.push({
              css: one("style[data-publish-theme]").textContent,
              community: document.documentElement.dataset.community,
            });
          }, []);
          return null;
        }
        await act(async () => {
          root.render(
            createElement("div", null, [
              createElement(App, { key: "app", site: catalogSite }),
              createElement(FirstCommit, { key: "probe" }),
            ]),
          );
        });
        expect(commits).toEqual([{ css, community: "minimal" }]);
        expectPublishedTheme("minimal", css);
        expect(
          one("style[data-publish-theme]").getAttribute("media"),
        ).toBeNull();
        expect(staticTheme.getAttribute("media")).toBe("not all");
        expect(staticTheme.textContent).toBe(css);
        await click(label("Reader settings"));
        expect(picker().value).toBe("minimal");
        expect(picker().getAttribute("aria-busy")).toBe("false");
        expect(fetch).not.toHaveBeenCalled();
        expect(state.cancel).not.toHaveBeenCalled();
      });

      it.each(["default", "things"])(
        "cancels pending bootstrap when choosing %s and ignores its late ready result",
        async (id) => {
          const request = deferred<Response>();
          const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockReturnValue(request.promise);
          vi.stubGlobal("fetch", fetch);
          localStorage.setItem(themePreferenceKey, "minimal");
          const { state, ready, staticTheme } = await installAppearance();
          await mount(catalogSite);
          await click(label("Reader settings"));
          await input(picker(), id);
          expect(state.cancel).toHaveBeenCalledOnce();
          if (id === "things") {
            expect(fetch).toHaveBeenCalledExactlyOnceWith(
              "/_theme/things.css",
              {
                signal: expect.any(AbortSignal),
              },
            );
            await settle(() => request.resolve(themeResponse(thingsThemeCss)));
          } else expect(fetch).not.toHaveBeenCalled();
          const css =
            id === "default"
              ? catalogSite.themeCss
              : `${thingsThemeCss}\n${commonThemeCss}`;
          expectPublishedTheme(id, css);
          expect(staticTheme.getAttribute("media")).toBe("not all");
          // Deliberately ignore cancel in this promise mock: React must also
          // reject a stale completion instead of trusting abort alone.
          await settle(() => {
            state.id = state.selectedId = "minimal";
            state.css = `${minimalThemeCss}\n${commonThemeCss}`;
            state.pending = false;
            ready.resolve(state);
          });
          expectPublishedTheme(id, css);
          expect(picker().value).toBe(id);
          expect(picker().getAttribute("aria-busy")).toBe("false");
          expect(localStorage.getItem(themePreferenceKey)).toBe(id);
          expect(staticTheme.textContent).toBe(catalogSite.themeCss);
          expect(
            container.querySelector('[role="status"], [role="alert"]'),
          ).toBeNull();
        },
      );

      it("preserves saved dark mode from before startup on the first commit without any light-mode DOM write", async () => {
        localStorage.setItem(
          "publish-reader-preferences",
          JSON.stringify({ theme: "dark" }),
        );
        const { state, ready, staticTheme } = await installAppearance(
          catalogSite,
          { mode: "dark" },
        );
        const firstCommits: {
          theme: string | undefined;
          pressed: string | null;
        }[] = [];
        function FirstCommit() {
          useLayoutEffect(() => {
            firstCommits.push({
              theme: document.documentElement.dataset.theme,
              pressed: label("Toggle color theme").getAttribute("aria-pressed"),
            });
          }, []);
          return null;
        }
        const classWrites = vi.spyOn(document.body.classList, "toggle");
        const themeWrites: MutationRecord[] = [];
        const observer = new MutationObserver((records) =>
          themeWrites.push(...records),
        );
        observer.observe(document.documentElement, {
          attributes: true,
          attributeOldValue: true,
          attributeFilter: ["data-theme"],
        });
        try {
          await act(async () => {
            root.render(
              createElement("div", null, [
                createElement(App, { key: "app", site: catalogSite }),
                createElement(FirstCommit, { key: "probe" }),
              ]),
            );
          });
          expect(firstCommits).toEqual([{ theme: "dark", pressed: "true" }]);
          expect(document.body.classList.contains("theme-dark")).toBe(true);
          expect(document.body.classList.contains("theme-light")).toBe(false);
          await settle(() => {
            state.pending = false;
            state.id = state.selectedId = "minimal";
            state.css = `${minimalThemeCss}\n${commonThemeCss}`;
            staticTheme.textContent = state.css;
            ready.resolve(state);
          });
          themeWrites.push(...observer.takeRecords());
          expect(document.documentElement.dataset.theme).toBe("dark");
          expect(
            themeWrites.every((record) => record.oldValue === "dark"),
          ).toBe(true);
          expect(classWrites).not.toHaveBeenCalledWith("theme-light", true);
          expect(classWrites).not.toHaveBeenCalledWith("theme-dark", false);
          expect(prefs()).toEqual({ theme: "dark" });
          expectPublishedTheme("minimal", state.css);
        } finally {
          observer.disconnect();
          classWrites.mockRestore();
        }
      });

      it.each([
        ["null", null],
        ["array", []],
        ["invalid mode", { mode: "system" }],
        ["unknown active ID", { id: "removed-theme" }],
        ["unknown pending ID", { selectedId: "removed-theme" }],
        ["mismatched default ID", { defaultId: "things" }],
        ["mismatched catalog", { catalog: "[]" }],
        ["mismatched compiled CSS", { defaultCss: "body{--stale:1}" }],
        ["non-string CSS", { css: null }],
        ["non-boolean pending", { pending: "true" }],
        ["missing ready", { ready: null }],
        ["invalid ready", { ready: {} }],
        ["invalid cancel", { cancel: false }],
      ])("ignores a malformed bootstrap global (%s)", async (_name, value) => {
        const fetch = vi.fn<typeof globalThis.fetch>();
        vi.stubGlobal("fetch", fetch);
        const { state, ready, staticTheme } = await installAppearance();
        vi.stubGlobal(
          "__latticeAppearance",
          value === null || Array.isArray(value)
            ? value
            : { ...state, ...value },
        );
        await mount(catalogSite);
        expectPublishedTheme("default", catalogSite.themeCss);
        expect(staticTheme.getAttribute("media")).toBe("not all");
        expect(
          one("style[data-publish-theme]").getAttribute("media"),
        ).toBeNull();
        await click(label("Reader settings"));
        expect(picker().value).toBe("default");
        expect(picker().getAttribute("aria-busy")).toBe("false");
        await settle(() => {
          state.id = "minimal";
          state.css = minimalThemeCss;
          state.pending = false;
          ready.resolve(state);
        });
        expectPublishedTheme("default", catalogSite.themeCss);
        expect(state.cancel).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
      });

      it.each([null, "screen"])(
        "restores the %s static baseline on unmount before a replacement is ready and ignores late readiness",
        async (media) => {
          const { state, ready, staticTheme } = await installAppearance(
            catalogSite,
            {},
            media,
          );
          await mount(catalogSite);
          expect(staticTheme.getAttribute("media")).toBe(media);
          expect(one("style[data-publish-theme]").getAttribute("media")).toBe(
            "not all",
          );
          await act(async () => root.unmount());
          root = createRoot(container);
          await advance(0); // Includes the real-unmount cancellation microtask.
          expect(state.cancel).toHaveBeenCalledOnce();
          expect(
            container.querySelector("style[data-publish-theme]"),
          ).toBeNull();
          expect(staticTheme.getAttribute("media")).toBe(media);
          const community = document.documentElement.dataset.community;
          await settle(() => {
            state.id = "minimal";
            state.css = minimalThemeCss;
            state.pending = false;
            ready.resolve(state);
          });
          expect(staticTheme.getAttribute("media")).toBe(media);
          expect(staticTheme.textContent).toBe(catalogSite.themeCss);
          expect(
            container.querySelector("style[data-publish-theme]"),
          ).toBeNull();
          expect(document.documentElement.dataset.community).toBe(community);
        },
      );
    });

    it("keeps stacked-page icon status in sync with the settings switch through reload, independently of theme and color scheme, without disrupting focus trapping", async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url) =>
          themeResponse(
            url === "/_theme/minimal.css" ? minimalThemeCss : thingsThemeCss,
          ),
        );
      vi.stubGlobal("fetch", fetch);
      await remount(catalogSite);
      const trigger = label("Reader settings", label("Site navigation"));
      await act(async () => trigger.focus());
      await click(trigger);
      const dialog = one('[role="dialog"][aria-label="Reader settings"]');
      const first = label("Close settings", dialog);
      const last = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), select:not([disabled]), a[href], input:not([disabled])",
        ),
      ].at(-1)!;
      const expectStacked = (enabled: boolean) => {
        const icon = label("Toggle stacked pages");
        const value = String(enabled);
        expect(icon.getAttribute("aria-pressed")).toBe(value);
        expect(icon.getAttribute("data-enabled")).toBe(value);
        expect(icon.getAttribute("title")).toBe(
          `Stacked pages: ${enabled ? "on" : "off"}`,
        );
        expect(icon.classList.contains("is-active")).toBe(enabled);
        expect(
          label("Stacked pages", one('[role="dialog"]')).getAttribute(
            "aria-checked",
          ),
        ).toBe(value);
        expect(one(".app-shell").classList.contains("stack-mode")).toBe(
          enabled,
        );
      };
      expectStacked(false);
      expect(document.activeElement).toBe(first);
      await key(first, "Tab", { shiftKey: true });
      expect(document.activeElement).toBe(last);
      await key(last, "Tab");
      expect(document.activeElement).toBe(first);
      await act(async () => picker().focus());
      await input(picker(), "minimal");
      expect(document.activeElement).toBe(picker());
      await input(one<HTMLSelectElement>("#color-mode"), "dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.body.classList.contains("theme-dark")).toBe(true);
      expect(label("Toggle color theme").getAttribute("aria-pressed")).toBe(
        "true",
      );
      expectPublishedTheme("minimal", `${minimalThemeCss}\n${commonThemeCss}`);
      await input(picker(), "things");
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(prefs()).toEqual({ theme: "dark" });
      await input(one<HTMLSelectElement>("#color-mode"), "system");
      expect(document.body.classList.contains("theme-light")).toBe(true);
      await act(async () => {
        systemDark = true;
        mediaListeners.forEach((listener) => listener());
      });
      expect(document.documentElement.dataset.theme).toBe("dark");
      expectPublishedTheme("things", `${thingsThemeCss}\n${commonThemeCss}`);
      expect(picker().value).toBe("things");
      expect(fetch).toHaveBeenCalledTimes(2);
      await click(label("Stacked pages", dialog));
      expectStacked(true);
      expect(prefs()).toEqual({ theme: "system", stacked: true });
      await key(picker(), "Escape");
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      await click(nav("Digital gardens"));
      expect(container.querySelectorAll(".stack-pane")).toHaveLength(2);
      expectPublishedTheme("things", `${thingsThemeCss}\n${commonThemeCss}`);
      await click(label("Reader settings"));
      await click(label("Toggle stacked pages"));
      expectStacked(false);
      expect(container.querySelectorAll(".stack-pane")).toHaveLength(0);
      await click(label("Toggle stacked pages"));
      expectStacked(true);
      await remount(catalogSite);
      await click(label("Reader settings"));
      expectStacked(true);
      expect(prefs()).toEqual({ theme: "system", stacked: true });
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(picker().value).toBe("things");
      expectPublishedTheme("things", `${thingsThemeCss}\n${commonThemeCss}`);
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  it("opens and zooms the graph, filters compiled nodes and navigates a node with Enter", async () => {
    await click(label("Graph view", label("Site navigation")));
    expect(one(".graph-page h1").textContent).toBe("Graph view");
    const graph = label("Interactive graph of connected notes");
    expect(graph.querySelectorAll(".graph-node")).toHaveLength(
      site.notes.length,
    );
    expect(graph.querySelectorAll("line").length).toBeGreaterThan(0);
    await click(label("Zoom in"));
    expect(one(".graph-controls span").textContent).toBe("120%");
    expect(one("g[transform]", graph).getAttribute("transform")).toContain(
      "scale(1.2)",
    );
    await click(label("Zoom out"));
    await click(label("Zoom out"));
    expect(one(".graph-controls span").textContent).toBe("80%");
    await click(label("Reset graph"));
    expect(one(".graph-controls span").textContent).toBe("100%");
    await input(label("Filter graph") as HTMLInputElement, "Digital gardens");
    expect(graph.querySelectorAll(".graph-node")).toHaveLength(1);
    await input(label("Filter graph") as HTMLInputElement, "no-such-note");
    expect(one(".graph-empty").textContent).toBe(
      "No matching notes. Try a different search.",
    );
    await click(label("Clear graph search"));
    expect(graph.querySelectorAll(".graph-node")).toHaveLength(
      site.notes.length,
    );
    await key(label("Open Digital gardens", graph), "Enter");
    expect(titles()).toEqual(["Digital gardens"]);
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    expect(container.querySelector(".graph-page")).toBeNull();
  });

  it("keeps local graph controls compact, opens an accessible popover, and navigates a node with Enter", async () => {
    await remount(
      site,
      "/garden/field-notes/digital-gardens#a-link-should-carry-a-thought",
    );
    const reader = one("main.reader#main-content");
    const information = one("#page-information", reader);
    const page = one(".reader-page-content .note-page", reader);
    expect([...container.querySelectorAll("main")]).toEqual([reader]);
    expect([...reader.children]).toEqual([
      one(".reader-page-content", reader),
      information,
    ]);
    expect(information.querySelector(".global-graph-button")).toBeNull();
    for (const name of ["Expand graph", "Global Graph"]) {
      const button = label(name, information);
      expect(button.classList.contains("clickable-icon")).toBe(true);
      expect(button.textContent).toBe("");
      expect(one("svg", button).getAttribute("width")).toBe("16");
    }
    const sidebarGraph = one(".graph-view.compact", information);
    expect(
      sidebarGraph.querySelector(
        ".graph-toolbar, .graph-controls, .graph-legend",
      ),
    ).toBeNull();
    const trigger = label("Expand graph", information);
    const url = window.location.href;
    await act(async () => trigger.focus());
    await click(trigger);
    const overlay = one(".graph-popover-overlay");
    const dialog = one('[role="dialog"][aria-label="Local graph"]', overlay);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(label("Open global graph", dialog));
    expect(one(".graph-view", dialog).classList.contains("compact")).toBe(true);
    expect(
      dialog.querySelector(".graph-toolbar, .graph-controls, .graph-legend"),
    ).toBeNull();
    expect(one(".reader-page-content .note-page")).toBe(page);
    expect(window.location.href).toBe(url);
    const patterns = [...container.querySelectorAll(".graph-view svg pattern")];
    expect(patterns).toHaveLength(2);
    expect(patterns.every((pattern) => !!pattern.id)).toBe(true);
    expect(new Set(patterns.map((pattern) => pattern.id)).size).toBe(2);
    for (const pattern of patterns) {
      expect(one("rect", pattern.closest("svg")!).getAttribute("fill")).toBe(
        `url(#${pattern.id})`,
      );
    }
    for (const graph of [sidebarGraph, one(".graph-view.compact", dialog)]) {
      const svg = one("svg", graph);
      const transform = one("g[transform]", svg);
      const before = transform.getAttribute("transform");
      const event = new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        expect(svg.dispatchEvent(event)).toBe(true);
      });
      expect(event.defaultPrevented).toBe(false);
      expect(transform.getAttribute("transform")).toBe(before);
    }
    await key(label("Open Attention is a material", dialog), "Enter");
    expect(container.querySelector(".graph-popover-overlay")).toBeNull();
    expect(titles()).toEqual(["Attention is a material"]);
    expect(window.location.pathname).toBe(
      compiled("Field Notes/Attention is a material.md").url,
    );
  });

  it("closes the local graph only from its backdrop, close control, or Escape and restores trigger focus", async () => {
    const trigger = label("Expand graph", one("#page-information"));
    const url = window.location.href;
    await act(async () => trigger.focus());
    await click(trigger);
    let overlay = one(".graph-popover-overlay");
    let dialog = one('[role="dialog"][aria-label="Local graph"]', overlay);
    await act(async () => {
      dialog.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(one('[role="dialog"][aria-label="Local graph"]')).toBe(dialog);
    await act(async () => {
      overlay.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(container.querySelector(".graph-popover-overlay")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(window.location.href).toBe(url);
    await click(trigger);
    dialog = one('[role="dialog"][aria-label="Local graph"]');
    await click(label("Close local graph", dialog));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    dialog = one('[role="dialog"][aria-label="Local graph"]');
    await key(label("Open global graph", dialog), "Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(window.location.href).toBe(url);
  });

  it("preserves full graph search and zoom controls", async () => {
    await click(label("Graph view", label("Site navigation")));
    const graphPage = one(".reader-page-content .graph-page");
    const graph = one(".graph-view", graphPage);
    expect(graph.classList.contains("compact")).toBe(false);
    expect(label("Filter graph", graph)).toBeDefined();
    expect(label("Zoom in", graph)).toBeDefined();
    expect(label("Reset graph", graph)).toBeDefined();
    expect(one(".graph-controls span", graph).textContent).toBe("100%");
  });

  describe("Quick switcher", () => {
    it("defaults on for older compiled settings and exposes wrapping keyboard selection through combobox/listbox ARIA", async () => {
      const { quickSwitcher: _quickSwitcher, ...legacySettings } =
        site.settings;
      const current = compiled("Field Notes/Digital gardens.md");
      await remount({ ...site, settings: legacySettings }, current.url);
      await key(window, "k", { ctrlKey: true });
      const dialog = quickSwitcher();
      const search = label("Find a file", dialog) as HTMLInputElement;
      const list = label("Matching files", dialog);
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(search.getAttribute("role")).toBe("combobox");
      expect(search.getAttribute("aria-autocomplete")).toBe("list");
      expect(search.getAttribute("aria-expanded")).toBe("true");
      expect(list.getAttribute("role")).toBe("listbox");
      expect(search.getAttribute("aria-controls")).toBe(list.id);
      expect(document.activeElement).toBe(search);
      expect(search.value).toBe("");
      expect(quickPaths()[0]).toBe(current.path.replace(/\.md$/, ""));
      expect(one(".suggestion-current", quickOptions()[0]).textContent).toBe(
        "Current",
      );
      expect(prefs()).toEqual({});
      const expectSelected = (index: number) => {
        const options = quickOptions();
        expect(
          options.filter(
            (option) => option.getAttribute("aria-selected") === "true",
          ),
        ).toEqual([options[index]]);
        expect(
          options.filter((option) => option.classList.contains("is-selected")),
        ).toEqual([options[index]]);
        expect(search.getAttribute("aria-activedescendant")).toBe(
          options[index].id,
        );
        expect(
          options.every((option) => option.id && option.parentElement === list),
        ).toBe(true);
        expect(new Set(options.map((option) => option.id)).size).toBe(
          options.length,
        );
        expect(document.activeElement).toBe(search);
      };
      expectSelected(0);
      await key(search, "ArrowUp");
      expectSelected(quickOptions().length - 1);
      await key(search, "ArrowDown");
      expectSelected(0);
      await key(search, "ArrowDown");
      expectSelected(1);
      await key(search, "ArrowUp");
      expectSelected(0);
      await key(search, "ArrowDown");
      await input(search, "Digital gardens");
      expect(quickOptions()).toHaveLength(1);
      expectSelected(0);
      await key(search, "ArrowDown");
      await key(search, "ArrowUp");
      expectSelected(0);
      const url = window.location.href;
      await input(search, "no-such-file-anywhere");
      expect(quickOptions()).toHaveLength(0);
      expect(one('[role="status"]', dialog).textContent).toBe(
        "No files found.",
      );
      expect(search.hasAttribute("aria-activedescendant")).toBe(false);
      for (const value of ["ArrowUp", "ArrowDown", "Enter"])
        await key(search, value);
      expect(quickSwitcher()).toBe(dialog);
      expect(window.location.href).toBe(url);
      await input(search, "");
      expectSelected(0);
      const nextPath = one(".suggestion-note", quickOptions()[1]).textContent;
      const nextNote = site.notes.find(
        (note) => note.path.replace(/\.(?:md|markdown)$/i, "") === nextPath,
      )!;
      await key(search, "ArrowDown");
      expectSelected(1);
      await key(search, "Enter");
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(titles()).toEqual([nextNote.title]);
      expect(window.location.pathname).toBe(nextNote.url);
      expect(history.state).toEqual({ note: nextNote.path });
    });

    it("matches title, filename, path and string/array aliases across terms, excludes body metadata, and distinguishes duplicate filenames safely", async () => {
      const rawTitle =
        '<img src="x" onerror="alert(1)"> & <script>alert(2)</script>';
      const searchSite = compileFixture({
        name: "Quick switcher search fixture",
        files: [
          {
            path: "Welcome.md",
            kind: "note",
            content:
              "---\ntitle: Start\ntags: [TagOnly]\ncategory: PropertyOnly\n---\n# HeadingOnly\n\nNebulousBody",
          },
          {
            path: "Projects/Shared.md",
            kind: "note",
            content:
              "---\ntitle: Project dossier\naliases: [Road map, launch guide, 42, true]\n---\nProject body.",
          },
          {
            path: "Archive/Shared.md",
            kind: "note",
            content:
              "---\ntitle: Archive dossier\naliases: Archived handbook\n---\nArchive body.",
          },
          {
            path: "Projects/Coded-name.md",
            kind: "note",
            content:
              "---\ntitle: Display label\nalias: Notebook\n---\nCoded body.",
          },
          {
            path: "Projects/Résumé.markdown",
            kind: "note",
            content: "---\ntitle: Curriculum\n---\nCareer body.",
          },
          {
            path: "Projects/Markup.md",
            kind: "note",
            content: `---\ntitle: ${JSON.stringify(rawTitle)}\n---\nSafe body.`,
          },
        ],
      });
      await remount(searchSite);
      await key(window, "k", { metaKey: true });
      const search = label("Find a file", quickSwitcher()) as HTMLInputElement;
      const cases: [string, string[]][] = [
        ["  PROjects \t launch  map  ", ["Projects/Shared"]],
        ["ARCHIVED handbook", ["Archive/Shared"]],
        ["notebook", ["Projects/Coded-name"]],
        ["display LABEL", ["Projects/Coded-name"]],
        ["coded-name", ["Projects/Coded-name"]],
        ["projects/coded-name.md", ["Projects/Coded-name"]],
        ["résumé.markdown", ["Projects/Résumé"]],
        ["shared", ["Projects/Shared", "Archive/Shared"]],
      ];
      for (const [query, expected] of cases) {
        await input(search, query);
        expect(quickPaths(), query).toEqual(expected);
      }
      for (const query of [
        "NebulousBody",
        "HeadingOnly",
        "TagOnly",
        "PropertyOnly",
        "42",
        "true",
        "launch absent-term",
      ]) {
        await input(search, query);
        expect(quickOptions(), query).toHaveLength(0);
        expect(one('[role="status"]', quickSwitcher()).textContent).toBe(
          "No files found.",
        );
      }
      await input(search, "markup");
      expect(quickOptions()).toHaveLength(1);
      expect(one(".suggestion-title", quickOptions()[0]).textContent).toBe(
        rawTitle,
      );
      expect(
        quickSwitcher().querySelector("img, script, [onerror]"),
      ).toBeNull();
      await input(search, "shared");
      const archive = quickOptions()[1];
      expect(one(".suggestion-title", archive).textContent).toBe(
        "Archive dossier",
      );
      await click(archive);
      const destination = searchSite.notes.find(
        (note) => note.path === "Archive/Shared.md",
      )!;
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(one(".note-page").getAttribute("data-note-path")).toBe(
        destination.path,
      );
      expect(window.location.pathname).toBe(destination.url);
      expect(history.state).toEqual({ note: destination.path });
    });

    it("ranks exact titles, filenames and aliases before prefixes and other matches, limits rows to 60 and keeps a late current file first", async () => {
      const rankingVault: Vault = {
        name: "Quick switcher ranking fixture",
        files: [
          { path: "Welcome.md", kind: "note", content: "Home." },
          {
            path: "Notebook folder/Context.md",
            kind: "note",
            content: "Path-only match.",
          },
          {
            path: "References/On notebooks.md",
            kind: "note",
            content: "Name contains the query.",
          },
          {
            path: "References/Notebook plans.md",
            kind: "note",
            content: "Name starts with the query.",
          },
          {
            path: "References/Notebook.md",
            kind: "note",
            content: "---\ntitle: Exact filename\n---\nFilename match.",
          },
          {
            path: "References/Alias.md",
            kind: "note",
            content:
              "---\ntitle: Alias match\naliases: [Notebook]\n---\nAlias match.",
          },
          {
            path: "References/Title.md",
            kind: "note",
            content: "---\ntitle: Notebook\n---\nTitle match.",
          },
        ],
      };
      await remount(compileFixture(rankingVault));
      await key(window, "k", { ctrlKey: true });
      await input(
        label("Find a file", quickSwitcher()) as HTMLInputElement,
        " notebook ",
      );
      const exact = [
        "References/Notebook",
        "References/Alias",
        "References/Title",
      ];
      expect(quickPaths()).toEqual([
        ...exact,
        "References/Notebook plans",
        "References/On notebooks",
        "Notebook folder/Context",
      ]);
      const largeSite = compileFixture({
        ...rankingVault,
        files: [
          ...rankingVault.files,
          ...Array.from({ length: 65 }, (_, index) => ({
            path: `Bulk/Entry ${index}.md`,
            kind: "note" as const,
            content: `---\ntitle: Notebook ${index}\n---\nEntry body.`,
          })),
        ],
      });
      const current = largeSite.notes.at(-1)!;
      await remount(largeSite, current.url);
      await key(window, "k", { metaKey: true });
      expect(quickOptions()).toHaveLength(60);
      expect(quickPaths()[0]).toBe("Bulk/Entry 64");
      expect(one(".suggestion-current", quickOptions()[0]).textContent).toBe(
        "Current",
      );
      expect(quickPaths()[1]).toBe("Welcome");
      await input(
        label("Find a file", quickSwitcher()) as HTMLInputElement,
        "notebook",
      );
      expect(quickOptions()).toHaveLength(60);
      expect(quickPaths().slice(0, 4)).toEqual([
        ...exact,
        "References/Notebook plans",
      ]);
      expect(quickPaths()).not.toContain("Notebook folder/Context");
      expect(quickPaths()).not.toContain("References/On notebooks");
    });

    it("opens Enter selections on clean compiled routes, leaves graph view and clears sidebar search while preserving stacking and truncating existing panes", async () => {
      await remount(site, "/garden/?stale=1#old-heading");
      const sidebarSearch = label(
        "Search page or heading...",
      ) as HTMLInputElement;
      await input(sidebarSearch, "tag:welcome");
      await click(label("Graph view", label("Site navigation")));
      const open = async (query: string) => {
        await key(window, "k", { ctrlKey: true });
        const search = label(
          "Find a file",
          quickSwitcher(),
        ) as HTMLInputElement;
        await input(search, query);
        expect(quickOptions()).toHaveLength(1);
        await key(search, "Enter");
        expect(container.querySelector('[role="dialog"]')).toBeNull();
      };
      const digital = compiled("Field Notes/Digital gardens.md");
      const walking = compiled("Field Notes/Walking as research.md");
      await open("Digital gardens");
      expect(titles()).toEqual([digital.title]);
      expect(container.querySelector(".graph-page")).toBeNull();
      expect(container.querySelectorAll(".stack-pane")).toHaveLength(0);
      expect(sidebarSearch.value).toBe("");
      expect(container.querySelector(".search-results")).toBeNull();
      expect(window.location.pathname).toBe(digital.url);
      expect(window.location.search).toBe("");
      expect(window.location.hash).toBe("");
      expect(history.state).toEqual({ note: digital.path });
      expect(nav(digital.title).getAttribute("aria-current")).toBe("page");
      await click(label("Toggle stacked pages"));
      await open("Walking as research");
      expect(titles()).toEqual([digital.title, walking.title]);
      expect(container.querySelectorAll(".stack-pane")).toHaveLength(2);
      expect(window.location.pathname).toBe(walking.url);
      expect(history.state).toEqual({ note: walking.path });
      await open("Digital gardens");
      expect(titles()).toEqual([digital.title]);
      expect(container.querySelectorAll(".stack-pane")).toHaveLength(0);
      expect(window.location.pathname).toBe(digital.url);
      expect(prefs()).toEqual({ stacked: true });
      await advance(1000);
      expect(titles()).toEqual([digital.title]);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it("traps focus between the input and Close button, closes only on Escape/backdrop/Close and restores the previously focused element", async () => {
      const previous = label("Search page or heading...") as HTMLInputElement;
      await input(previous, "Digital gardens");
      await act(async () => previous.focus());
      const url = window.location.href;
      await key(previous, "k", { ctrlKey: true });
      const dialog = quickSwitcher();
      const search = label("Find a file", dialog);
      const close = label("Close quick switcher", dialog);
      expect(document.activeElement).toBe(search);
      expect([
        ...dialog.querySelectorAll(
          "input, button, a[href], select, textarea, [tabindex]",
        ),
      ]).toEqual([search, close]);
      await key(search, "Tab", { shiftKey: true });
      expect(document.activeElement).toBe(close);
      await key(close, "Tab");
      expect(document.activeElement).toBe(search);
      await act(async () => {
        dialog.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(quickSwitcher()).toBe(dialog);
      await key(search, "Escape");
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(previous);
      expect(previous.value).toBe("Digital gardens");
      expect(window.location.href).toBe(url);
      await key(previous, "k", { metaKey: true });
      await act(async () => {
        quickSwitcher().parentElement!.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true }),
        );
      });
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(previous);
      expect(window.location.href).toBe(url);
      await key(previous, "k", { ctrlKey: true });
      await click(label("Close quick switcher", quickSwitcher()));
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(previous);
      expect(previous.value).toBe("Digital gardens");
    });

    it("persists disabling and re-enabling in reader preferences, restores sidebar-search shortcuts when disabled and overrides the site's default on reload", async () => {
      expect(prefs()).toEqual({});
      await click(label("Reader settings", label("Site navigation")));
      let dialog = one('[role="dialog"][aria-label="Reader settings"]');
      expect(label("Quick switcher", dialog).getAttribute("role")).toBe(
        "switch",
      );
      expect(label("Quick switcher", dialog).getAttribute("aria-checked")).toBe(
        "true",
      );
      await click(label("Quick switcher", dialog));
      expect(label("Quick switcher", dialog).getAttribute("aria-checked")).toBe(
        "false",
      );
      expect(prefs()).toEqual({ quickSwitcher: false });
      await remount();
      await click(label("Reader settings", label("Site navigation")));
      dialog = one('[role="dialog"][aria-label="Reader settings"]');
      expect(label("Quick switcher", dialog).getAttribute("aria-checked")).toBe(
        "false",
      );
      await click(label("Close settings", dialog));
      await click(label("Close sidebar"));
      const sidebarSearch = label("Search page or heading...");
      for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
        await key(window, "k", modifiers);
        expect(document.activeElement).toBe(sidebarSearch);
        expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(
          false,
        );
        expect(container.querySelector('[role="dialog"]')).toBeNull();
      }
      await click(label("Reader settings", label("Site navigation")));
      dialog = one('[role="dialog"][aria-label="Reader settings"]');
      await click(label("Quick switcher", dialog));
      expect(label("Quick switcher", dialog).getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(prefs()).toEqual({ quickSwitcher: true });
      const disabledSite = {
        ...site,
        settings: { ...site.settings, quickSwitcher: false },
      };
      await remount(disabledSite);
      await click(label("Reader settings", label("Site navigation")));
      dialog = one('[role="dialog"][aria-label="Reader settings"]');
      expect(label("Quick switcher", dialog).getAttribute("aria-checked")).toBe(
        "true",
      );
      await click(label("Close settings", dialog));
      await key(window, "k", { metaKey: true });
      expect(document.activeElement).toBe(
        label("Find a file", quickSwitcher()),
      );
      expect(prefs()).toEqual({ quickSwitcher: true });
      expect(disabledSite.settings.quickSwitcher).toBe(false);
    });

    it("toggles once for Ctrl/Cmd K from the focused input, rejects extra modifiers and composing shortcuts, and ignores auto-repeat", async () => {
      const previous = label("Reader settings", label("Site navigation"));
      await act(async () => previous.focus());
      for (const modifiers of [
        {},
        { ctrlKey: true, altKey: true },
        { metaKey: true, altKey: true },
        { ctrlKey: true, shiftKey: true },
        { metaKey: true, shiftKey: true },
        { ctrlKey: true, isComposing: true },
        { metaKey: true, isComposing: true },
      ]) {
        await key(previous, "k", modifiers);
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(document.activeElement).toBe(previous);
      }
      await key(previous, "k", { ctrlKey: true });
      const dialog = quickSwitcher();
      const search = label("Find a file", dialog) as HTMLInputElement;
      await input(search, "Digital gardens");
      for (const modifiers of [
        { ctrlKey: true, isComposing: true },
        { metaKey: true, shiftKey: true },
        { ctrlKey: true, repeat: true },
        { metaKey: true, repeat: true },
      ]) {
        await key(search, "k", modifiers);
        expect(quickSwitcher()).toBe(dialog);
        expect(search.value).toBe("Digital gardens");
      }
      await key(search, "K", { metaKey: true });
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(previous);
      await key(previous, "K", { metaKey: true });
      expect(
        (label("Find a file", quickSwitcher()) as HTMLInputElement).value,
      ).toBe("");
      await key(label("Find a file", quickSwitcher()), "k", { ctrlKey: true });
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(previous);
    });
  });

  it("filters inline sidebar search by path, tag and heading and supports keyboard navigation", async () => {
    localStorage.setItem(
      "publish-reader-preferences",
      JSON.stringify({ quickSwitcher: false }),
    );
    await remount();
    await click(label("Close sidebar"));
    await key(window, "k", { ctrlKey: true });
    const search = label("Search page or heading...") as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(false);
    await input(search, "path:Library tag:reading");
    expect(
      container.querySelectorAll("a.search-result-file-title"),
    ).toHaveLength(6);
    expect(
      [...container.querySelectorAll("a.search-result-file-title")].every(
        (link) => link.textContent?.includes("Library"),
      ),
    ).toBe(true);
    await input(search, 'path:"Field Notes" tag:garden');
    expect(
      container.querySelectorAll("a.search-result-file-title"),
    ).toHaveLength(1);
    expect(one(".search-result-file-title span").textContent).toBe(
      "Digital gardens",
    );
    await input(search, 'heading:"A link should carry a thought"');
    expect(
      container.querySelectorAll("a.search-result-file-title"),
    ).toHaveLength(1);
    await input(search, "tag:no-such-tag");
    expect(one(".search-results .empty-hint").textContent).toBe(
      "No results found.",
    );
    await click(label("Clear search"));
    expect(search.value).toBe("");
    expect(container.querySelector(".search-results")).toBeNull();
    await input(search, 'file:"Digital gardens.md"');
    expect(one<HTMLAnchorElement>(".search-result-file-title").pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    await key(search, "Enter");
    expect(search.value).toBe("");
    expect(titles()).toEqual(["Digital gardens"]);
    expect(nav("Digital gardens").getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders this.file-scoped Bases and sorts book rows alphabetically and numerically", async () => {
    await click(nav("Digital gardens"));
    const nearby = one<HTMLTableElement>("table.base-table");
    expect(
      [...nearby.tBodies[0].rows].map((row) => row.cells[0].textContent),
    ).toEqual(
      expect.arrayContaining([
        "Attention is a material",
        "Small bets & long horizons",
        "Walking as research",
        "The useful edge",
      ]),
    );
    expect(nearby.tBodies[0].rows).toHaveLength(4);
    expect(
      nearby.querySelector('a[data-note="Field Notes/Digital gardens.md"]'),
    ).toBeNull();
    await click(nav("The reading room"));
    const table = one<HTMLTableElement>("table.base-table");
    const cells = (column: number) =>
      [...table.tBodies[0].rows].map((row) =>
        row.cells[column].textContent!.trim(),
      );
    expect(table.tBodies[0].rows).toHaveLength(5);
    const books = [
      "A Pattern Language",
      "Braiding Sweetgrass",
      "How to Do Nothing",
      "The Art of Noticing",
      "The Practice of Everyday Life",
    ];
    await click(label("Sort by Book", table));
    expect(cells(0)).toEqual(books);
    expect(table.tHead!.rows[0].cells[0].getAttribute("aria-sort")).toBe(
      "ascending",
    );
    await click(label("Sort by Book", table));
    expect(cells(0)).toEqual([...books].reverse());
    expect(table.tHead!.rows[0].cells[0].getAttribute("aria-sort")).toBe(
      "descending",
    );
    await click(label("Sort by Published", table));
    expect(cells(4).map(Number)).toEqual([1977, 1984, 2013, 2019, 2019]);
    expect(table.tHead!.rows[0].cells[0].hasAttribute("aria-sort")).toBe(false);
    await click(label("Sort by Published", table));
    expect(cells(4).map(Number)).toEqual([2019, 2019, 2013, 1984, 1977]);
  });

  it("delays tooltip previews, cancels dismissal while hovered and opens a compiled preview link", async () => {
    const link = one(
      'a[data-note="Field Notes/Digital gardens.md"]',
      one(".markdown-body"),
    );
    await act(async () => {
      link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    await advance(399);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    await advance(1);
    const tooltip = one('[role="tooltip"]');
    expect(one(".preview-title", tooltip).textContent).toBe("Digital gardens");
    expect(one(".preview-body", tooltip).innerHTML).toBe(
      compiled("Field Notes/Digital gardens.md").previewHtml,
    );
    expect(titles()).toEqual(["Welcome to Lattice"]);
    await act(async () => {
      link.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    await advance(179);
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    await advance(1);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => {
      link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    await advance(400);
    await act(async () => {
      const preview = one('[role="tooltip"]');
      link.dispatchEvent(
        new MouseEvent("mouseout", { bubbles: true, relatedTarget: preview }),
      );
      preview.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, relatedTarget: link }),
      );
    });
    await advance(180);
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    await click(one(".preview-title a", one('[role="tooltip"]')));
    expect(titles()).toEqual(["Digital gardens"]);
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("folds the left sidebar from the header or top-left toolbar and reopens it without losing navigation", async () => {
    const toggle = sidebarControl("Fold left sidebar", "site-navigation", true);
    expect(
      toggle.parentElement?.classList.contains("view-header-title-container"),
    ).toBe(true);
    expect(toggle.parentElement?.firstElementChild).toBe(toggle);
    const navigation = one("#site-navigation");
    const destination = nav("Digital gardens");
    const controls = one(".reader-controls", navigation);
    expect(
      [...controls.querySelectorAll("button")].map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Graph view",
      "Toggle stacked pages",
      "Toggle color theme",
      "Reader settings",
    ]);
    for (const icon of controls.querySelectorAll("button svg")) {
      expect(icon.getAttribute("width")).toBe("16");
      expect(icon.getAttribute("height")).toBe("16");
    }
    await click(label("Close sidebar", navigation));
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
    const reopen = sidebarControl("Open sidebar", "site-navigation", false);
    expect(reopen).toBe(toggle);
    await click(reopen);
    expect(sidebarControl("Fold left sidebar", "site-navigation", true)).toBe(
      toggle,
    );
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(false);
    expect(one("#site-navigation")).toBe(navigation);
    expect(nav("Digital gardens")).toBe(destination);
    await click(toggle);
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
    await click(sidebarControl("Open sidebar", "site-navigation", false));
    await click(destination);
    expect(titles()).toEqual(["Digital gardens"]);
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
  });

  it("folds and reopens page information while retaining section state, outline anchors and backlink routes", async () => {
    await click(nav("Digital gardens"));
    const information = one<HTMLElement>("#page-information");
    const reader = one("main.reader#main-content");
    const content = one(".reader-page-content", reader);
    expect(content.parentElement).toBe(reader);
    expect(information.parentElement).toBe(reader);
    expect([...reader.children]).toEqual([content, information]);
    expect(one(".note-page", content).dataset.notePath).toBe(
      "Field Notes/Digital gardens.md",
    );
    expect(
      content.querySelector(".right-sidebar, .toc, .backlinks"),
    ).toBeNull();
    expect(reader.textContent).toContain("On this page");
    expect(reader.textContent).toContain("Linked mentions");
    expect(information.hidden).toBe(false);
    expect(information.getAttribute("aria-label")).toBe("Page information");
    const toggle = sidebarControl(
      "Fold right sidebar",
      "page-information",
      true,
    );
    expect(toggle.disabled).toBe(false);
    const outline = one<HTMLAnchorElement>(
      '.toc-link[href="#a-link-should-carry-a-thought"]',
      information,
    );
    const backlink = one<HTMLAnchorElement>("a.backlink", information);
    const backlinkTarget = site.notes.find(
      (note) => note.url === backlink.getAttribute("href"),
    )!;
    expect(backlinkTarget).toBeDefined();
    const graphSection = one(".local-graph .section-toggle", information);
    const outlineSection = one(".toc .section-toggle", information);
    const backlinksSection = one(".backlinks .section-toggle", information);
    await click(graphSection);
    expect(graphSection.getAttribute("aria-expanded")).toBe("false");
    expect(
      graphSection.parentElement?.parentElement?.querySelector(
        '[aria-label="Local connections graph"]',
      ),
    ).toBeNull();
    await click(toggle);
    expect(information.hidden).toBe(true);
    expect(one(".app-shell").classList.contains("right-sidebar-hidden")).toBe(
      true,
    );
    expect(
      container.querySelector('[aria-label="Dismiss page information"]'),
    ).toBeNull();
    await click(label("Toggle color theme"));
    const reopen = sidebarControl(
      "Open right sidebar",
      "page-information",
      false,
    );
    expect(reopen).toBe(toggle);
    await click(reopen);
    expect(one("#page-information")).toBe(information);
    expect(information.hidden).toBe(false);
    expect(one(".app-shell").classList.contains("right-sidebar-hidden")).toBe(
      false,
    );
    expect(sidebarControl("Fold right sidebar", "page-information", true)).toBe(
      toggle,
    );
    expect(one(".local-graph .section-toggle", information)).toBe(graphSection);
    expect(graphSection.getAttribute("aria-expanded")).toBe("false");
    expect(outlineSection.getAttribute("aria-expanded")).toBe("true");
    expect(backlinksSection.getAttribute("aria-expanded")).toBe("true");
    expect(
      one('.toc-link[href="#a-link-should-carry-a-thought"]', information),
    ).toBe(outline);
    expect(one("a.backlink", information)).toBe(backlink);
    await click(outline);
    expect(one(".toc-link.current", information)).toBe(outline);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    await click(backlink);
    expect(titles()).toEqual([backlinkTarget.title]);
    expect(window.location.pathname).toBe(backlinkTarget.url);
  });

  it("disables page information in graph and multi-pane views and restores its fold state on return", async () => {
    await click(sidebarControl("Fold right sidebar", "page-information", true));
    await click(label("Graph view", label("Site navigation")));
    expect(container.querySelector("#page-information")).toBeNull();
    expect(
      sidebarControl("Open right sidebar", "page-information", false).disabled,
    ).toBe(true);
    await click(nav("Digital gardens"));
    expect(
      sidebarControl("Open right sidebar", "page-information", false).disabled,
    ).toBe(false);
    expect(one<HTMLElement>("#page-information").hidden).toBe(true);
    await click(
      sidebarControl("Open right sidebar", "page-information", false),
    );
    await click(label("Toggle stacked pages"));
    expect(
      sidebarControl("Fold right sidebar", "page-information", true).disabled,
    ).toBe(false);
    await click(nav("Walking as research"));
    expect(container.querySelectorAll(".stack-pane")).toHaveLength(2);
    expect(container.querySelector("#page-information")).toBeNull();
    expect(
      sidebarControl("Open right sidebar", "page-information", false).disabled,
    ).toBe(true);
    await click(label("Close pane Walking as research"));
    expect(
      sidebarControl("Fold right sidebar", "page-information", true).disabled,
    ).toBe(false);
    expect(one<HTMLElement>("#page-information").hidden).toBe(false);
  });

  it.each([375, 1100, 1101])(
    "initializes page information from the %i-pixel viewport and retains an explicit fold on rerender",
    async (width) => {
      vi.stubGlobal("innerWidth", width);
      await remount();
      const expanded = width > 1100;
      const information = one<HTMLElement>("#page-information");
      expect(information.hidden).toBe(!expanded);
      expect(
        sidebarControl(
          expanded ? "Fold right sidebar" : "Open right sidebar",
          "page-information",
          expanded,
        ).disabled,
      ).toBe(false);
      if (expanded)
        await click(
          sidebarControl("Fold right sidebar", "page-information", true),
        );
      await mount();
      expect(information.hidden).toBe(true);
      expect(
        sidebarControl("Open right sidebar", "page-information", false)
          .disabled,
      ).toBe(false);
      await click(
        sidebarControl("Open right sidebar", "page-information", false),
      );
      expect(information.hidden).toBe(false);
      sidebarControl("Fold right sidebar", "page-information", true);
    },
  );

  it.each([375, 1100])(
    "keeps navigation and page information mutually exclusive at %i pixels and dismisses the right overlay",
    async (width) => {
      vi.stubGlobal("innerWidth", width);
      await remount();
      const information = one<HTMLElement>("#page-information");
      expect(information.hidden).toBe(true);
      expect(
        container.querySelector('[aria-label="Dismiss page information"]'),
      ).toBeNull();
      if (width <= 760)
        await click(sidebarControl("Open sidebar", "site-navigation", false));
      sidebarControl("Fold left sidebar", "site-navigation", true);
      await click(
        sidebarControl("Open right sidebar", "page-information", false),
      );
      expect(information.hidden).toBe(false);
      expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
      expect(
        container.querySelector('[aria-label="Dismiss navigation"]'),
      ).toBeNull();
      sidebarControl("Open sidebar", "site-navigation", false);
      await click(label("Dismiss page information"));
      expect(information.hidden).toBe(true);
      expect(
        container.querySelector('[aria-label="Dismiss page information"]'),
      ).toBeNull();
      sidebarControl("Open right sidebar", "page-information", false);
      await click(
        sidebarControl("Open right sidebar", "page-information", false),
      );
      await click(sidebarControl("Open sidebar", "site-navigation", false));
      expect(information.hidden).toBe(true);
      expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(
        false,
      );
      expect(
        container.querySelector('[aria-label="Dismiss page information"]'),
      ).toBeNull();
      sidebarControl("Fold left sidebar", "site-navigation", true);
      sidebarControl("Open right sidebar", "page-information", false);
    },
  );

  it("starts with navigation hidden at mobile width and closes it after following a link", async () => {
    vi.stubGlobal("innerWidth", 375);
    await remount();
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
    expect(container.querySelector(".mobile-scrim")).toBeNull();
    await click(label("Open sidebar"));
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(false);
    await click(nav("Digital gardens"));
    expect(titles()).toEqual(["Digital gardens"]);
    expect(window.location.pathname).toBe(
      "/garden/field-notes/digital-gardens",
    );
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
    expect(container.querySelector(".mobile-scrim")).toBeNull();
    await click(sidebarControl("Open sidebar", "site-navigation", false));
    await click(label("Dismiss navigation"));
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
  });
});
