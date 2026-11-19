// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import type { CompiledSite } from "../src/types";
import { appearanceBootstrap } from "./appearanceBootstrap";
import { renderPublishedPage, renderNotFoundPage } from "./staticPages";
import { loadConfig } from "./config";
import { compileVault } from "./compile";

describe("reader appearance defaults", () => {
  it("starts the demo in Default Obsidian while keeping Publish selectable", async () => {
    const config = await loadConfig();
    expect(config.theme).toBe("default");
    const { site } = await compileVault(config);
    expect(site.defaultTheme).toBe("default");
    expect(site.settings.communityTheme).toBe("default");
    expect(site.themes?.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["default", "publish-theme"]),
    );
  });
  it("separates the Publish title from its top bar and hides only navigation scrollbar tracks", async () => {
    const publish = await readFile("src/themes/publish-theme.css", "utf8");
    const styles = await readFile("src/styles.css", "utf8");
    expect(publish).toMatch(
      /body \.app-shell \.note-page\s*\{\s*padding:\s*56px 48px 96px;/,
    );
    expect(styles).toMatch(
      /\.app-shell \.sidebar \.vault-navigation,[\s\S]*?scrollbar-width:\s*none\s*!important/,
    );
    expect(styles).toContain(
      ".app-shell .sidebar .vault-navigation::-webkit-scrollbar",
    );
    expect(styles).toMatch(
      /\.main-shell\s*>\s*\.reader\s*\{[^}]*overflow-y:\s*auto/,
    );
  });
});

const appearanceSite: CompiledSite = {
  version: 1,
  name: "Appearance",
  notes: [],
  bodyClasses: ["publish", "theme-dark"],
  settings: {
    title: "Appearance",
    description: "",
    home: "",
    accent: "",
    theme: "system",
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
    allowThemeSwitching: true,
  },
  themeCss: "body{--default-only:1;color:rgb(1,2,3)}",
  defaultTheme: "default",
  themeOverridesCss: "body{--shared-override:1}",
  themes: [
    { id: "default", name: "Default", cssUrl: "" },
    {
      id: "minimal",
      name: "Minimal",
      cssUrl: "/project/_theme/abc-minimal.css",
    },
  ],
};
const appearanceShell =
  '<!doctype html><html><head><link rel="stylesheet" href="/assets/baseline.css"><title>Old</title></head><body><div id="root"></div></body></html>';
type BootstrapState = {
  mode: string;
  id: string;
  selectedId: string;
  css: string;
  pending: boolean;
  ready: Promise<BootstrapState>;
  cancel: () => void;
};
function startup(
  options: {
    site?: CompiledSite;
    prefs?: string;
    saved?: string;
    dark?: boolean;
    fetch?: typeof fetch;
    blockedStorage?: boolean;
    timer?: (callback: () => void, delay: number) => number;
  } = {},
) {
  const dom = new JSDOM(
    renderPublishedPage(appearanceShell, options.site ?? appearanceSite),
    {
      url: "https://published.test/project/",
      runScripts: "dangerously",
      beforeParse(window) {
        Object.defineProperty(window, "matchMedia", {
          value: () => ({ matches: !!options.dark }),
        });
        window.fetch =
          options.fetch ??
          vi.fn().mockRejectedValue(new Error("Unexpected request"));
        if (options.blockedStorage)
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new Error("Blocked");
            },
          });
        else {
          if (options.prefs !== undefined)
            window.localStorage.setItem(
              "publish-reader-preferences",
              options.prefs,
            );
          if (options.saved !== undefined)
            window.localStorage.setItem(
              "publish-reader-community-theme",
              options.saved,
            );
        }
        if (options.timer)
          window.setTimeout = options.timer as typeof window.setTimeout;
      },
    },
  );
  const state = (
    dom.window as unknown as { __latticeAppearance: BootstrapState }
  ).__latticeAppearance;
  return { dom, document: dom.window.document, state };
}

describe("first-paint appearance bootstrap", () => {
  it("chooses saved or system color mode before body content and removes opposite static mode classes", async () => {
    for (const [prefs, dark, expected] of [
      [undefined, true, "dark"],
      [undefined, false, "light"],
      ['{"theme":"light"}', true, "light"],
      ['{"theme":"dark"}', false, "dark"],
      ['{"theme":"system"}', true, "dark"],
    ] as const) {
      const { dom, document, state } = startup({ prefs, dark });
      expect(document.documentElement.dataset.theme).toBe(expected);
      expect(document.body.classList.contains(`theme-${expected}`)).toBe(true);
      expect(
        document.body.classList.contains(
          `theme-${expected === "dark" ? "light" : "dark"}`,
        ),
      ).toBe(false);
      expect(document.head.firstElementChild?.id).toBe(
        "published-appearance-critical",
      );
      expect(
        document.body.firstElementChild?.getAttribute(
          "data-published-appearance",
        ),
      ).toBe("body");
      expect(
        document.head
          .querySelector('[data-published-appearance="head"]')
          ?.nextElementSibling?.getAttribute("rel"),
      ).toBe("stylesheet");
      await state.ready;
      dom.window.close();
    }
  });

  it("ignores malformed/unsafe preferences and blocked storage, never using stored URLs or CSS", async () => {
    for (const prefs of [
      "{",
      "null",
      "[]",
      '{"theme":"url(evil)"}',
      '{"theme":{"toString":"dark"}}',
    ]) {
      const request = vi.fn();
      const { dom, document, state } = startup({
        prefs,
        saved: "https://evil.test/style.css",
        dark: true,
        fetch: request,
      });
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(
        document.documentElement.dataset.appearancePending,
      ).toBeUndefined();
      expect(request).not.toHaveBeenCalled();
      await state.ready;
      dom.window.close();
    }
    const { dom, state } = startup({ blockedStorage: true, dark: true });
    expect(state.mode).toBe("dark");
    await state.ready;
    dom.window.close();
  });

  it("gates a saved alternate until its whole CSS body and overrides replace the default", async () => {
    let resolveBody!: (css: string) => void;
    const body = new Promise<string>((resolve) => {
      resolveBody = resolve;
    });
    const request = vi.fn().mockResolvedValue({ ok: true, text: () => body });
    const { dom, document, state } = startup({
      saved: "minimal",
      fetch: request,
      dark: true,
    });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/project/_theme/abc-minimal.css",
      { signal: expect.any(dom.window.AbortSignal) },
    );
    expect(state.pending).toBe(true);
    expect(state.id).toBe("default");
    expect(document.documentElement.dataset.appearancePending).toBe("true");
    expect(document.querySelector("#published-theme")?.textContent).toBe(
      appearanceSite.themeCss,
    );
    document.documentElement.dataset.theme = "light";
    resolveBody("body{--minimal-only:1}");
    await state.ready;
    expect(state.id).toBe("minimal");
    expect(state.css).toBe(
      `body{--minimal-only:1}\n${appearanceSite.themeOverridesCss}`,
    );
    expect(document.querySelector("#published-theme")?.textContent).toBe(
      state.css,
    );
    expect(state.css).not.toContain("--default-only");
    expect(document.documentElement.dataset.appearancePending).toBeUndefined();
    expect(document.documentElement.dataset.community).toBe("minimal");
    expect(document.body.dataset.themePreset).toBe("minimal");
    expect(document.body.classList.contains("theme-light")).toBe(true);
    expect(document.querySelectorAll("#published-theme")).toHaveLength(1);
    dom.window.close();
  });

  it("keeps the default on request, HTTP, or body errors and always reveals semantic content", async () => {
    for (const request of [
      vi.fn().mockRejectedValue(new Error("Offline")),
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          text: () => Promise.resolve("Bad CSS"),
        }),
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          text: () => Promise.reject(new Error("Interrupted")),
        }),
    ]) {
      const { dom, document, state } = startup({
        saved: "minimal",
        fetch: request,
      });
      await state.ready;
      expect(state.pending).toBe(false);
      expect(state.id).toBe("default");
      expect(document.querySelector("#published-theme")?.textContent).toBe(
        appearanceSite.themeCss,
      );
      expect(
        document.documentElement.dataset.appearancePending,
      ).toBeUndefined();
      expect(document.body.dataset.themeName).toBe("default");
      dom.window.close();
    }
  });

  it("bounds hiding to four seconds and ignores late CSS after timeout or handoff cancellation", async () => {
    for (const cancel of [false, true]) {
      let deadline!: () => void,
        delay = 0,
        resolveBody!: (css: string) => void;
      const body = new Promise<string>((resolve) => {
        resolveBody = resolve;
      });
      const request = vi.fn().mockResolvedValue({ ok: true, text: () => body });
      const { dom, document, state } = startup({
        saved: "minimal",
        fetch: request,
        timer(callback, ms) {
          deadline = callback;
          delay = ms;
          return 1;
        },
      });
      expect(delay).toBe(4000);
      if (cancel) state.cancel();
      else deadline();
      await state.ready;
      expect(
        document.documentElement.dataset.appearancePending,
      ).toBeUndefined();
      expect(request.mock.calls[0][1].signal.aborted).toBe(true);
      resolveBody("body{--late-css:1}");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(document.querySelector("#published-theme")?.textContent).toBe(
        appearanceSite.themeCss,
      );
      expect(state.id).toBe("default");
      dom.window.close();
    }
  });

  it("honors switching opt-out and rejects remote, traversal and malformed catalog URLs", async () => {
    for (const cssUrl of [
      "https://evil.test/a.css",
      "//evil.test/_theme/a.css",
      "/project/../_theme/a.css",
      "/project/%2e%2e/_theme/a.css",
      "/project/_theme/a.css?evil",
      "/project/_theme/%broken.css",
      "/project/_theme/a.js",
    ]) {
      const request = vi.fn();
      const site = {
        ...appearanceSite,
        themes: [{ id: "minimal", name: "Minimal", cssUrl }],
      };
      const { dom, state } = startup({
        site,
        saved: "minimal",
        fetch: request,
      });
      await state.ready;
      expect(request).not.toHaveBeenCalled();
      expect(state.id).toBe("default");
      dom.window.close();
    }
    const request = vi.fn();
    const site = {
      ...appearanceSite,
      settings: { ...appearanceSite.settings, allowThemeSwitching: false },
    };
    const { dom, state } = startup({ site, saved: "minimal", fetch: request });
    await state.ready;
    expect(request).not.toHaveBeenCalled();
    dom.window.close();
  });

  it("keeps no-JS pages visible with the same CSS and 404s script-free even from rendered shells", () => {
    const html = renderPublishedPage(appearanceShell, appearanceSite);
    const document = new JSDOM(html).window.document;
    expect(document.documentElement.dataset.appearancePending).toBeUndefined();
    expect(document.querySelector("#static-content")).not.toBeNull();
    expect(document.querySelector("#published-theme")?.textContent).toBe(
      appearanceSite.themeCss,
    );
    expect(
      document.querySelector('link[rel="stylesheet"]')?.getAttribute("href"),
    ).toBe("/assets/baseline.css");
    const missing = new JSDOM(renderNotFoundPage(html, appearanceSite)).window
      .document;
    expect(missing.querySelectorAll("script")).toHaveLength(0);
    expect(missing.documentElement.dataset.appearancePending).toBeUndefined();
    expect(missing.querySelector("h1")?.textContent).toBe("Page not found");
    expect(
      missing.querySelectorAll(
        "#published-appearance-critical,#published-theme",
      ),
    ).toHaveLength(2);
  });

  it("caches scripts per immutable snapshot and deduplicates managed bootstrap without raw-text injection", () => {
    expect(appearanceBootstrap(appearanceSite)).toBe(
      appearanceBootstrap(appearanceSite),
    );
    const unsafe = {
      ...appearanceSite,
      themeOverridesCss: '</script><script id="injected">bad()</script>',
      themes: [
        ...appearanceSite.themes!,
        {
          id: '</script><script id="injected">',
          name: "Unsafe",
          cssUrl: "/project/_theme/safe.css",
        },
      ],
    };
    const first = renderPublishedPage(appearanceShell, unsafe);
    const doc = new JSDOM(renderPublishedPage(first, unsafe)).window.document;
    expect(
      doc.querySelectorAll("script[data-published-appearance]"),
    ).toHaveLength(3);
    expect(
      doc.querySelectorAll("#published-appearance-critical,#published-theme"),
    ).toHaveLength(2);
    expect(doc.querySelector("#injected")).toBeNull();
    expect(appearanceBootstrap({ ...appearanceSite })).not.toBe(
      appearanceBootstrap(appearanceSite),
    );
  });
});
