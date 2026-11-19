// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
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
const catalogSite: CompiledSite = {
  ...site,
  settings: { ...site.settings, allowThemeSwitching: true },
  defaultTheme: "default",
  themes: [
    { id: "default", name: "Default", cssUrl: "" },
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
function nav(title: string): HTMLAnchorElement {
  const matches = [
    ...container.querySelectorAll<HTMLAnchorElement>("a.nav-file-title"),
  ].filter((link) => link.textContent === title);
  expect(matches, `Expected one sidebar link titled ${title}`).toHaveLength(1);
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
  it("opens property wikilinks with clean routes and heading anchors", async () => {
    const input = compileFixture({
      name: "Properties",
      files: [
        {
          path: "Welcome.md",
          kind: "note",
          content:
            '---\ncategory: ["[[Topics/Target#Details|Related category]]"]\n---\nHome',
        },
        {
          path: "Topics/Target.md",
          kind: "note",
          content: "## Details\nDestination",
        },
      ],
    });
    input.settings.showProperties = true;
    await remount(input);
    const link = one<HTMLAnchorElement>(".metadata-property-value a");
    expect(link.textContent).toBe("Related category");
    expect(link.getAttribute("href")).toBe("/garden/topics/target#details");
    expect(link.dataset.note).toBe("Topics/Target.md");
    expect(link.dataset.anchor).toBe("details");
    await click(link);
    expect(titles()).toEqual(["Target"]);
    expect(window.location.pathname).toBe("/garden/topics/target");
    expect(window.location.hash).toBe("#details");
  });
  it("renders plain demo content without authoring scaffolding and preserves compiled sanitization", async () => {
    expect(titles()).toEqual(["Welcome to Lattice"]);
    expect(one(".note-header").textContent).toBe("Welcome to Lattice");
    expect(one(".markdown-body").innerHTML).toBe(compiled("Welcome.md").html);
    expect(one('[data-callout="tip"]').textContent).toContain(
      "There is no correct route",
    );
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
    const last = label("Stacked pages", dialog);
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
      const last = label("Stacked pages", dialog);
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
      await click(last);
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

  it("filters inline sidebar search by path, tag and heading and supports keyboard navigation", async () => {
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
    await click(label("Open navigation"));
    await click(label("Dismiss navigation"));
    expect(one(".app-shell").classList.contains("sidebar-hidden")).toBe(true);
  });
});
