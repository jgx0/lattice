// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledSite, PublishedNote } from "./types";
import { folderStateKey, useFolderState } from "./useFolderState";

function note(path: string, url: string): PublishedNote {
  return {
    path,
    url,
    title: path.split("/").at(-1)!.replace(/\.md$/, ""),
    slug: url,
    folder: path.split("/").slice(0, -1).join("/"),
    content: "",
    body: "",
    properties: {},
    headings: [],
    links: [],
    tags: [],
    words: 0,
    html: "<p>Compiled note</p>",
    previewHtml: "<p>Compiled note</p>",
    outgoing: [],
    backlinks: [],
  };
}
function fixture(): CompiledSite {
  return {
    version: 1,
    name: "Folder fixture",
    settings: {
      title: "Published folders",
      description: "",
      home: "Welcome.md",
      accent: "",
      theme: "light",
      communityTheme: "default",
      customCss: "",
      readable: true,
      showProperties: false,
      showToc: false,
      showBacklinks: false,
      showGraph: false,
      stacked: false,
      navigation: [],
      hiddenPaths: [],
    },
    // Home is deliberately not the first note: the configured home is canonical.
    notes: [
      note("Field Notes/Observation.md", "/garden/field-notes/observation"),
      note("Welcome.md", "/garden/"),
      note("Library/Books/Reading.md", "/garden/library/books/reading"),
      note("Atlas/Map.md", "/garden/atlas/map"),
    ],
    bodyClasses: [],
    themeCss: "",
  };
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

let container: HTMLDivElement;
let root: Root;
let state: ReturnType<typeof useFolderState>;
let frames: { key: string; collapsed: string[] }[];
function Harness({ site }: { site: CompiledSite }) {
  const current = useFolderState(site);
  useLayoutEffect(() => {
    state = current;
    frames.push({
      key: folderStateKey(site),
      collapsed: [...current.collapsed].sort(),
    });
  });
  return null;
}
async function render(site: CompiledSite) {
  await act(async () => root.render(createElement(Harness, { site })));
}
async function remount(site: CompiledSite) {
  await act(async () => root.unmount());
  root = createRoot(container);
  await render(site);
}
async function toggle(path: string) {
  await act(async () => state.toggleFolder(path));
}
function collapsed() {
  return [...state.collapsed].sort();
}

beforeEach(() => {
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
  frames = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useFolderState", () => {
  it("scopes encoded keys to the canonical home URL and path and never cross-saves folds when the scope changes", async () => {
    const site = fixture();
    const key = folderStateKey(site);
    expect(key).toBe("publish-reader-folders:%2Fgarden%2F:Welcome.md");
    const mountedElsewhere: CompiledSite = {
      ...site,
      notes: site.notes.map((item) => ({
        ...item,
        url: item.url.replace("/garden/", "/other/"),
      })),
    };
    const otherHome: CompiledSite = {
      ...site,
      settings: { ...site.settings, home: "Start: here.md" },
      notes: site.notes.map((item) =>
        item.path === "Welcome.md" ? { ...item, path: "Start: here.md" } : item,
      ),
    };
    const mountKey = folderStateKey(mountedElsewhere);
    const homeKey = folderStateKey(otherHome);
    expect(mountKey).toBe("publish-reader-folders:%2Fother%2F:Welcome.md");
    expect(homeKey).toBe(
      "publish-reader-folders:%2Fgarden%2F:Start%3A%20here.md",
    );
    expect(new Set([key, mountKey, homeKey]).size).toBe(3);
    localStorage.setItem(mountKey, '["Library/Books"]');
    const writes = vi.spyOn(localStorage, "setItem");

    await render(site);
    expect(collapsed()).toEqual([]);
    await toggle("Field Notes");
    expect(localStorage.getItem(key)).toBe('["Field Notes"]');
    writes.mockClear();
    const firstFrame = frames.length;
    await render(mountedElsewhere);
    expect(frames[firstFrame]).toEqual({
      key: mountKey,
      collapsed: ["Library/Books"],
    });
    expect(collapsed()).toEqual(["Library/Books"]);
    expect(writes.mock.calls).toEqual([[mountKey, '["Library/Books"]']]);
    expect(localStorage.getItem(key)).toBe('["Field Notes"]');
    await toggle("Library/Books");
    expect(localStorage.getItem(mountKey)).toBe("[]");

    writes.mockClear();
    await render(otherHome);
    expect(collapsed()).toEqual([]);
    expect(writes.mock.calls).toEqual([[homeKey, "[]"]]);
    await toggle("Library");
    expect(localStorage.getItem(homeKey)).toBe('["Library"]');
    await render(site);
    expect(collapsed()).toEqual(["Field Notes"]);
    await remount(mountedElsewhere);
    expect(collapsed()).toEqual([]);
    await remount(otherHome);
    expect(collapsed()).toEqual(["Library"]);
    await remount(site);
    expect(collapsed()).toEqual(["Field Notes"]);
    expect(localStorage.getItem(mountKey)).toBe("[]");
    expect(localStorage.getItem(homeKey)).toBe('["Library"]');
  });

  it("filters invalid stored data and unknown or malicious paths, and keeps session toggles usable when storage throws", async () => {
    const site = fixture();
    const key = folderStateKey(site);
    const cases: { stored: string | null; expected: string[] }[] = [
      { stored: null, expected: [] },
      { stored: "{broken", expected: [] },
      {
        stored: '{"Field Notes":true,"__proto__":{"polluted":true}}',
        expected: [],
      },
      { stored: '"Field Notes"', expected: [] },
      { stored: "null", expected: [] },
      { stored: "42", expected: [] },
      {
        stored: JSON.stringify([
          "Library/Books",
          "Field Notes",
          "Field Notes",
          123,
          false,
          null,
          {},
          ["Library"],
          "",
          "/",
          "..",
          "../Field Notes",
          "Field Notes/../Library",
          "/Field Notes",
          "Field Notes/",
          "Library\\Books",
          "__proto__",
          "constructor",
          "javascript:alert(1)",
          "<script>alert(1)</script>",
          "Renamed folder",
        ]),
        expected: ["Field Notes", "Library/Books"],
      },
    ];
    for (const { stored, expected } of cases) {
      localStorage.clear();
      if (stored !== null) localStorage.setItem(key, stored);
      await remount(site);
      expect(collapsed(), `Stored input: ${stored}`).toEqual(expected);
      expect(localStorage.getItem(key)).toBe(JSON.stringify(expected));
      await toggle("");
      await toggle("../Field Notes");
      await toggle("Unknown");
      expect(collapsed()).toEqual(expected);
      expect(localStorage.getItem(key)).toBe(JSON.stringify(expected));
    }

    for (const [getThrows, setThrows] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      localStorage.clear();
      localStorage.setItem(key, '["Library/Books"]');
      const get = vi.spyOn(localStorage, "getItem");
      const set = vi.spyOn(localStorage, "setItem");
      if (getThrows)
        get.mockImplementation(() => {
          throw new Error("Storage read blocked");
        });
      if (setThrows)
        set.mockImplementation(() => {
          throw new Error("Storage write blocked");
        });
      await remount(site);
      const restored = getThrows ? [] : ["Library/Books"];
      expect(collapsed()).toEqual(restored);
      await toggle("Field Notes");
      expect(collapsed()).toEqual(["Field Notes", ...restored]);
      await toggle("Field Notes");
      expect(collapsed()).toEqual(restored);
      get.mockRestore();
      set.mockRestore();
    }
  });

  it("prunes stale and renamed folders on a same-key snapshot change, opens new folders, and never mutates frozen source data", async () => {
    const site = deepFreeze(fixture());
    const snapshot = JSON.stringify(site);
    const key = folderStateKey(site);
    await render(site);
    await toggle("Library/Books");
    await toggle("Library");
    await toggle("Field Notes");
    await toggle("Atlas");
    expect(localStorage.getItem(key)).toBe(
      '["Atlas","Field Notes","Library","Library/Books"]',
    );
    expect(JSON.stringify(site)).toBe(snapshot);

    const updated = deepFreeze<CompiledSite>({
      ...site,
      settings: {
        ...site.settings,
        navigationFolders: { "Library/Books/Reading.md": "Public/Shelf" },
      },
      notes: [
        ...site.notes.filter((item) => item.folder !== "Field Notes"),
        note("Observations/New.md", "/garden/observations/new"),
      ],
    });
    const updatedSnapshot = JSON.stringify(updated);
    expect(folderStateKey(updated)).toBe(key);
    await render(updated);
    expect(collapsed()).toEqual(["Atlas"]);
    expect(localStorage.getItem(key)).toBe('["Atlas"]');
    await toggle("Field Notes");
    await toggle("Library/Books");
    expect(collapsed()).toEqual(["Atlas"]);
    await toggle("Public/Shelf");
    await toggle("Public");
    expect(collapsed()).toEqual(["Atlas", "Public", "Public/Shelf"]);
    expect(localStorage.getItem(key)).toBe('["Atlas","Public","Public/Shelf"]');
    await remount(updated);
    expect(collapsed()).toEqual(["Atlas", "Public", "Public/Shelf"]);
    await toggle("Public");
    expect(collapsed()).toEqual(["Atlas", "Public/Shelf"]);
    expect(state.collapsed.has("Observations")).toBe(false);
    expect(JSON.stringify(site)).toBe(snapshot);
    expect(JSON.stringify(updated)).toBe(updatedSnapshot);
  });
});
