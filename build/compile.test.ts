// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  stat,
  mkdir,
  writeFile,
  rm,
  symlink,
  realpath,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config";
import { compileVault } from "./compile";

const publishThemePath = fileURLToPath(
  new URL("../src/themes/publish-theme.css", import.meta.url),
);
const publishChoice = {
  id: "publish-theme",
  name: "Publish",
  cssUrl: expect.stringMatching(
    /^\/(?:garden\/)?_theme\/[a-f0-9]{20}-theme-publish\.css$/,
  ),
};
const roots: string[] = [];
const oldEnv = {
  OBSIDIAN_VAULT: process.env.OBSIDIAN_VAULT,
  PUBLISH_CONFIG: process.env.PUBLISH_CONFIG,
};
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
  for (const key of ["OBSIDIAN_VAULT", "PUBLISH_CONFIG"] as const) {
    if (oldEnv[key] === undefined) delete process.env[key];
    else process.env[key] = oldEnv[key];
  }
});
async function fixture(config: Record<string, unknown> = {}) {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "publish-compile-")),
  );
  roots.push(root);
  delete process.env.OBSIDIAN_VAULT;
  delete process.env.PUBLISH_CONFIG;
  const put = async (relative: string, content: string | Uint8Array) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  };
  await put("vault/Welcome.md", "# Welcome");
  await put(
    "publish.config.json",
    JSON.stringify({
      vault: "./vault",
      site: { title: "Garden", home: "Welcome.md" },
      ...config,
    }),
  );
  return { root, put };
}

describe("filesystem build configuration", () => {
  it("resolves roots, settings, CSS paths, and environment overrides without creating a vault", async () => {
    const { root, put } = await fixture({
      base: "/garden",
      css: ["./extra.css"],
      snippets: [],
      bodyClasses: ["custom"],
    });
    const config = await loadConfig(root);
    expect(config.vaultPath).toBe(path.join(root, "vault"));
    expect(config.base).toBe("/garden/");
    expect(config.css).toEqual([path.join(root, "extra.css")]);
    expect(config.settings.accent).toBe("");
    expect(config.settings.allowThemeSwitching).toBe(false);
    expect(config.themes).toBeUndefined();
    await put("second/Another.md", "# Another");
    await put(
      "custom.json",
      JSON.stringify({ vault: "missing", site: { title: "Override" } }),
    );
    process.env.PUBLISH_CONFIG = "./custom.json";
    process.env.OBSIDIAN_VAULT = "./second";
    const override = await loadConfig(root);
    expect(override.configPath).toBe(path.join(root, "custom.json"));
    expect(override.vaultPath).toBe(path.join(root, "second"));
    expect(override.settings.title).toBe("Override");
  });
  it("validates theme allowlists even when disabled and resolves CSS paths beside the config", async () => {
    const { root, put } = await fixture();
    await put("config/vault/Welcome.md", "# Welcome");
    await put(
      "config/publish.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        theme: "publish-theme",
        themes: ["publish-theme", "Minimal", "./custom/theme.css"],
      }),
    );
    process.env.PUBLISH_CONFIG = "./config/publish.json";
    const config = await loadConfig(root);
    expect(config.settings.allowThemeSwitching).toBe(true);
    expect(config.theme).toBe("publish-theme");
    expect(config.themes).toEqual([
      "publish-theme",
      "Minimal",
      path.join(root, "config/custom/theme.css"),
    ]);
    for (const themes of ["Minimal", [false], ["bad\0name"]]) {
      await put(
        "config/publish.json",
        JSON.stringify({
          vault: "./vault",
          site: { allowThemeSwitching: false },
          themes,
        }),
      );
      await expect(loadConfig(root)).rejects.toThrow(/themes/);
    }
  });
  it("rejects invalid settings and unsafe base/hidden paths", async () => {
    const { root, put } = await fixture();
    for (const config of [
      { base: "https://example.com/" },
      { base: "/%2e%2e/" },
      { base: "/x?y" },
      { base: "/%2f%2fevil/" },
      { base: "/%00/" },
      { base: "/%0a/" },
      { base: "/a\\u0001b/" },
      { base: "/a//b/" },
      { base: '/quote"/' },
      { base: "/%3cscript%3e/" },
      { site: { theme: "Minimal" } },
      { site: { showGraph: "yes" } },
      { site: { allowThemeSwitching: "yes" } },
      { site: { hiddenPaths: ["../private"] } },
      { site: { accent: "red; color: blue" } },
    ]) {
      await put(
        "publish.config.json",
        JSON.stringify({ vault: "./vault", ...config }),
      );
      await expect(loadConfig(root)).rejects.toThrow();
    }
  });
});

describe("Node vault compiler", () => {
  it("compiles inline Bases with real filesystem modification times and public link filtering", async () => {
    const { root, put } = await fixture({ base: "/garden/" });
    await put(
      "vault/Welcome.md",
      "```base\nviews:\n  - type: table\n    name: Topic\n    filters: file.links.contains(this.file)\n    order: [file.name]\n    sort: [{property: file.mtime, direction: DESC}]\n```",
    );
    const older = await put(
      "vault/Older.md",
      '---\ncategory: "[[Welcome]]"\n---\nOlder',
    );
    const newer = await put("vault/Newer.md", "[[Welcome]]");
    await put("vault/Private.md", "---\nprivate: true\n---\n[[Welcome]]");
    await utimes(older, new Date(100000), new Date(100000));
    await utimes(newer, new Date(200000), new Date(200000));
    const { site } = await compileVault(await loadConfig(root));
    const home = site.notes.find((n) => n.path === "Welcome.md")!;
    expect(home.html).toContain('class="base-embed base-inline"');
    expect(home.html.indexOf('data-note="Newer.md"')).toBeLessThan(
      home.html.indexOf('data-note="Older.md"'),
    );
    expect(home.html).toContain('href="/garden/newer"');
    expect(home.html).not.toContain("Private.md");
    expect(site.notes.find((n) => n.path === "Newer.md")?.mtime).toBe(200000);
  });
  it("renders published content, Unicode clean links, previews, and host-relative Bases/transclusion without globals", async () => {
    const { root, put } = await fixture({
      base: "/garden/",
      site: { title: "Garden", home: "Welcome.md", hiddenPaths: ["Hidden"] },
    });
    await put(
      "vault/Welcome.md",
      "---\ncssclasses: [wide, garden]\n---\n# Welcome\n[[Projects/Host#Part]]\n[[日本語]]\n![[Projects/Host#Part]]\n![[Private]]\n![[Hidden/Secret]]",
    );
    await put(
      "vault/Projects/Host.md",
      "# Part\nHost text\n\n![[View.base]]\n\n## Inner\nNested\n\n# Excluded\nNot transcluded",
    );
    await put(
      "vault/Projects/Child.md",
      "---\nproject: Host\n---\n# Child\n[[Welcome]]",
    );
    await put(
      "vault/Projects/View.base",
      'filters: "project == this.file.name"\nviews:\n  - type: table\n    order: [file.name, project]',
    );
    await put("vault/日本語.md", "# 日本語\nUnicode");
    await put(
      "vault/Private.md",
      "---\npublish: false\n---\nSECRET_PRIVATE_BODY",
    );
    await put("vault/Hidden/Secret.md", "SECRET_HIDDEN_BODY");
    await put(
      "vault/Privacy.md",
      "---\nprivate: true\n---\nSECRET_PRIVATE_PROPERTY",
    );
    const globals = [
      globalThis.window,
      globalThis.document,
      globalThis.DOMParser,
    ];
    const { site, assets, dependencies } = await compileVault(
      await loadConfig(root),
    );
    expect([
      globalThis.window,
      globalThis.document,
      globalThis.DOMParser,
    ]).toEqual(globals);
    const welcome = site.notes.find((note) => note.path === "Welcome.md")!;
    expect(welcome.url).toBe("/garden/");
    expect(welcome.html).toContain('href="/garden/projects/host#part"');
    expect(welcome.html).toContain('data-anchor="part"');
    expect(welcome.html).toContain(
      'href="/garden/%E6%97%A5%E6%9C%AC%E8%AA%9E"',
    );
    expect(welcome.html).toContain('data-note="Projects/Child.md"');
    expect(welcome.html).not.toContain("Not transcluded");
    expect(welcome.previewHtml).toContain('<h1 id="welcome">');
    expect(welcome.outgoing).toEqual(["Projects/Host.md", "日本語.md"]);
    expect(welcome.backlinks).toEqual(["Projects/Child.md"]);
    expect(JSON.stringify(site)).not.toContain("SECRET_");
    expect(site.notes).toHaveLength(4);
    expect(site.bodyClasses).toEqual(
      expect.arrayContaining(["wide", "garden"]),
    );
    expect(site.bodyClasses).not.toContain("theme-light");
    expect(site.bodyClasses).not.toContain("theme-dark");
    expect(assets.size).toBe(0);
    expect(dependencies).toContain(path.join(root, "vault/Projects/View.base"));
    expect(dependencies).toContain(
      path.join(root, "vault/.obsidian/appearance.json"),
    );
  });
  it("compiles property-only links into metadata, backlinks, graphs, and host-relative Bases", async () => {
    const { root, put } = await fixture({
      base: "/garden/",
      site: { title: "Garden", home: "Welcome.md", hiddenPaths: ["Hidden"] },
    });
    await put(
      "vault/Welcome.md",
      '---\nrelated: ["[[Topics/Category#Details|Category details]]", "[[Hidden/Private]]"]\n---\n# Welcome',
    );
    await put(
      "vault/Topics/Category.md",
      "# Category\n\n## Details\n\n![[Related.base]]",
    );
    await put(
      "vault/Topics/Related.base",
      'filters: "file.hasLink(this.file)"\nviews:\n  - type: table\n    order: [file.name, note.related]',
    );
    await put("vault/Hidden/Private.md", "SECRET_PRIVATE_PROPERTY_TARGET");
    const { site } = await compileVault(await loadConfig(root));
    const welcome = site.notes.find((note) => note.path === "Welcome.md")!;
    const category = site.notes.find(
      (note) => note.path === "Topics/Category.md",
    )!;
    expect(welcome.outgoing).toEqual(["Topics/Category.md"]);
    expect(category.backlinks).toEqual(["Welcome.md"]);
    expect(welcome.propertyHtml?.related).toContain(
      'href="/garden/topics/category#details"',
    );
    expect(welcome.propertyHtml?.related).toContain("Category details");
    expect(welcome.propertyHtml?.related).not.toContain(
      'data-note="Hidden/Private.md"',
    );
    expect(category.html).not.toContain("base-error");
    expect(category.html).toContain('data-note="Welcome.md"');
    expect(category.html).toContain('href="/garden/topics/category#details"');
    expect(JSON.stringify(site)).not.toContain(
      "SECRET_PRIVATE_PROPERTY_TARGET",
    );
  });
  it("keeps repeated builds deterministic and privacy decisions fresh across asset rewrites", async () => {
    const { root, put } = await fixture();
    await put(
      "vault/Welcome.md",
      "# Welcome\n\n![[shared.svg]]\n![[shared.svg]]\n[[Linked]]",
    );
    await put("vault/Linked.md", "# Linked\n\n[[Welcome]]\n![[shared.svg]]");
    await put(
      "vault/shared.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"><script>SECRET_UNSAFE_SCRIPT</script><rect width="10" height="10"/></svg>',
    );
    const first = await compileVault(await loadConfig(root));
    const second = await compileVault(await loadConfig(root));
    expect(second.site).toEqual(first.site);
    expect([...second.assets]).toEqual([...first.assets]);
    expect(first.assets.size).toBe(1);
    expect(Buffer.from([...first.assets.values()][0]).toString()).not.toContain(
      "SECRET_UNSAFE_SCRIPT",
    );
    await put(
      "vault/Linked.md",
      "---\nprivate: true\n---\nSECRET_NEWLY_PRIVATE",
    );
    const privateBuild = await compileVault(await loadConfig(root));
    expect(privateBuild.site.notes).toHaveLength(1);
    expect(privateBuild.site.notes[0].backlinks).toEqual([]);
    expect(JSON.stringify(privateBuild.site)).not.toContain(
      "SECRET_NEWLY_PRIVATE",
    );
  });
  it("loads real Obsidian theme CSS, enabled snippets, publish.css and configured CSS in order and copies local URLs", async () => {
    const { root, put } = await fixture({
      css: ["./extra.css"],
      bodyClasses: ["is-published"],
    });
    const original =
      '/* actual installed theme; url(missing-comment.png) */\n.theme-dark { --background-primary: #171717; }\n.label::after{content:"url(missing-string.png)"}\n.card{background:url("images/bg.png?v=1#x")}\n.remote{background:url(https://example.com/bg.png)}\n@import "https://example.com/trusted.css";';
    await put(
      "vault/.obsidian/appearance.json",
      JSON.stringify({
        cssTheme: "Installed",
        enabledCssSnippets: ["custom"],
        accentColor: "#123456",
        baseFontSize: 18,
        textFontFamily: "Inter",
        monospaceFontFamily: "JetBrains Mono",
        theme: "obsidian",
      }),
    );
    const themePath = await put(
      "vault/.obsidian/themes/Installed/theme.css",
      original,
    );
    await put(
      "vault/.obsidian/themes/Installed/images/bg.png",
      new Uint8Array([1, 2, 3]),
    );
    await put("vault/.obsidian/snippets/custom.css", ".snippet{color:red}");
    await put("vault/publish.css", ".publish{color:green}");
    await put("extra.css", ".extra{color:blue}");
    const { site, assets, dependencies } = await compileVault(
      await loadConfig(root),
    );
    expect(site.themeCss).toContain(
      ".theme-dark { --background-primary: #171717; }",
    );
    expect(site.themeCss).toContain(
      "/* actual installed theme; url(missing-comment.png) */",
    );
    expect(site.themeCss).toContain('content:"url(missing-string.png)"');
    expect(site.themeCss).toMatch(/url\("\/_theme\/[a-f0-9]+-bg.png\?v=1#x"\)/);
    expect(site.themeCss).toContain("url(https://example.com/bg.png)");
    expect(site.themeCss).toContain(
      '@import "https://example.com/trusted.css";',
    );
    expect(site.themeCss.indexOf(".snippet")).toBeLessThan(
      site.themeCss.indexOf(".publish"),
    );
    expect(site.themeCss.indexOf(".publish")).toBeLessThan(
      site.themeCss.indexOf(".extra"),
    );
    expect(site.themeCss).toContain("--font-text-size:18px");
    expect(site.themeCss).toContain('--font-text:"Inter"');
    expect(site.settings.accent).toBe("#123456");
    expect(site.settings.theme).toBe("system");
    expect(site.bodyClasses).toEqual(["is-published"]);
    expect(dependencies).toContain(themePath);
    expect([...assets.keys()]).toHaveLength(1);
    expect([...assets.values()][0]).toEqual(new Uint8Array([1, 2, 3]));
    expect([...assets.keys()].join(" ")).not.toContain(".obsidian");
  });
  it.each([undefined, false])(
    "selects the tool's reserved Publish CSS without a runtime catalog when switching is %s",
    async (allowThemeSwitching) => {
      const { root, put } = await fixture({
        theme: "publish-theme",
        themes: ["publish-theme", "Missing"],
        snippets: [],
        site: { allowThemeSwitching, hiddenPaths: ["Hidden"] },
      });
      const css = await readFile(publishThemePath, "utf8");
      const impostor = await put(
        "src/themes/publish-theme.css",
        "SECRET_FIXTURE_THEME",
      );
      const vaultImpostor = await put(
        "vault/.obsidian/themes/publish-theme/theme.css",
        'SECRET_VAULT_THEME{background:url("missing.png")}',
      );
      await put(
        "vault/.obsidian/appearance.json",
        JSON.stringify({ cssTheme: "Missing" }),
      );
      const welcome = await put(
        "vault/Welcome.md",
        "# Welcome\n\nPublic prose",
      );
      await utimes(welcome, new Date(100000), new Date(200000));
      const metadata = await stat(welcome);
      await put("vault/Private.md", "---\nprivate: true\n---\nSECRET_PRIVATE");
      await put("vault/Hidden/Secret.md", "SECRET_HIDDEN");
      const result = await compileVault(await loadConfig(root));
      expect(result.site.themeCss).toBe(css);
      expect(result.site.settings.communityTheme).toBe("publish-theme");
      expect(result.site.settings.allowThemeSwitching).toBe(false);
      expect(result.site.notes).toHaveLength(1);
      expect(result.site.notes[0]).toMatchObject({
        mtime: 200000,
        ctime: metadata.birthtimeMs || metadata.ctimeMs,
        content: "",
      });
      for (const key of ["themes", "defaultTheme", "themeOverridesCss"])
        expect(result.site).not.toHaveProperty(key);
      expect(result.assets.size).toBe(0);
      expect(result.dependencies).toContain(publishThemePath);
      expect(result.dependencies).not.toContain(impostor);
      expect(result.dependencies).not.toContain(vaultImpostor);
      expect(JSON.stringify(result.site)).not.toContain("SECRET_");
      expect(JSON.stringify(result.site)).not.toContain(root);
      expect(JSON.stringify(result.site)).not.toContain(publishThemePath);
    },
  );

  it.each(
    [undefined, [], ["publish-theme", "publish-theme", "default"]].map(
      (themes) => ({ themes }),
    ),
  )(
    "always catalogs Publish with a stable selection and common overrides for allowlist %j",
    async ({ themes }) => {
      const { root, put } = await fixture({
        base: "/garden/",
        theme: "publish-theme",
        themes,
        snippets: ["common"],
        css: ["./extra.css"],
        site: { allowThemeSwitching: true, customCss: ".custom{color:orange}" },
      });
      const builtInCss = await readFile(publishThemePath, "utf8");
      const minimalCss =
        '/* Installed Minimal stays verbatim. */\n.inline-title{font-size:var(--inline-title-size)}\n.markdown-preview-view{font-size:var(--font-text-size)}\n.label::after{content:"url(missing.png)"}';
      const minimalFile = await put(
        "vault/.obsidian/themes/Minimal/theme.css",
        minimalCss,
      );
      const reservedFile = await put(
        "vault/.obsidian/themes/publish-theme/theme.css",
        'SECRET_RESERVED_THEME{background:url("missing.png")}',
      );
      await put("vault/.obsidian/snippets/common.css", ".snippet{color:black}");
      await put("vault/publish.css", ".publish{color:green}");
      await put("extra.css", ".extra{color:pink}");
      const result = await compileVault(await loadConfig(root));
      expect(result.site.themes?.slice(0, 2)).toEqual([
        { id: "default", name: "Default (Obsidian)", cssUrl: "" },
        publishChoice,
      ]);
      expect(result.site.defaultTheme).toBe("publish-theme");
      expect(result.site.settings.communityTheme).toBe("publish-theme");
      expect(
        result.site.themes?.filter(({ id }) => id === "publish-theme"),
      ).toHaveLength(1);
      const publish = result.site.themes![1];
      expect(result.site.themes?.map(({ name }) => name)).toEqual(
        themes === undefined
          ? ["Default (Obsidian)", "Publish", "Minimal"]
          : ["Default (Obsidian)", "Publish"],
      );
      const cssFor = (url: string) =>
        Buffer.from(
          result.assets.get(decodeURIComponent(url.slice("/garden/".length)))!,
        ).toString();
      expect(cssFor(publish.cssUrl)).toBe(builtInCss);
      const common =
        ".snippet{color:black}\n.publish{color:green}\n.extra{color:pink}\n.custom{color:orange}";
      expect(result.site.themeOverridesCss).toBe(common);
      expect(result.site.themeCss).toBe(`${builtInCss}\n${common}`);
      expect(result.dependencies).toContain(publishThemePath);
      expect(result.dependencies).toContain(path.dirname(publishThemePath));
      expect(result.dependencies).not.toContain(reservedFile);
      expect(result.assets.size).toBe(themes === undefined ? 2 : 1);
      if (themes === undefined) {
        const minimal = result.site.themes![2];
        expect(minimal.id).toMatch(/^minimal-[a-f0-9]{20}$/);
        expect(cssFor(minimal.cssUrl)).toBe(minimalCss);
        expect(result.dependencies).toContain(minimalFile);
      } else {
        expect(result.dependencies).not.toContain(minimalFile);
      }
      const output =
        JSON.stringify(result.site) + [...result.assets.keys()].join("\n");
      expect(output).not.toContain(root);
      expect(output).not.toContain(publishThemePath);
      expect(output).not.toContain(".obsidian");
      expect(output).not.toContain("SECRET_");
      const { root: otherRoot } = await fixture({
        base: "/garden/",
        theme: "publish-theme",
        themes: [],
        snippets: [],
        site: { allowThemeSwitching: true },
      });
      const moved = await compileVault(await loadConfig(otherRoot));
      expect(moved.site.defaultTheme).toBe("publish-theme");
      expect(moved.site.themes![1]).toEqual(publish);
    },
  );

  it("reserves only the exact built-in name without bypassing other theme boundary checks", async () => {
    const { root, put } = await fixture({
      theme: "publish-theme",
      themes: ["publish-theme"],
      snippets: [],
      site: { allowThemeSwitching: true },
    });
    const outside = await put("external/theme.css", "SECRET_SYMLINK_THEME");
    const themesRoot = path.join(root, "vault/.obsidian/themes");
    await mkdir(themesRoot, { recursive: true });
    await symlink(
      path.dirname(outside),
      path.join(themesRoot, "publish-theme"),
    );
    const builtIn = await compileVault(await loadConfig(root));
    expect(builtIn.site.themes).toEqual([
      { id: "default", name: "Default (Obsidian)", cssUrl: "" },
      publishChoice,
    ]);
    expect(builtIn.dependencies).not.toContain(outside);
    const config = await loadConfig(root);
    for (const reference of [
      "../publish-theme",
      "publish-theme/alias",
      "publish-theme\\alias",
      "..",
    ]) {
      await expect(
        compileVault({ ...config, themes: [reference] }),
      ).rejects.toThrow(/Invalid Obsidian theme name/);
    }
    await expect(
      compileVault({ ...config, themes: ["Publish-theme"] }),
    ).rejects.toThrow(/Unsupported or unavailable theme/);
    await symlink(
      path.dirname(outside),
      path.join(themesRoot, "publish-theme-alias"),
    );
    await expect(
      compileVault({ ...config, themes: [outside, "publish-theme-alias"] }),
    ).rejects.toThrow(/Path escapes allowed root/);
    await expect(
      compileVault({
        ...config,
        theme: "publish-theme",
        themes: [path.join(themesRoot, "publish-theme/theme.css")],
      }),
    ).rejects.toThrow(/Path escapes allowed root/);
  });

  it("emits runtime themes as separate CSS assets and keeps common overrides out of the catalog", async () => {
    const { root, put } = await fixture({
      base: "/garden/",
      site: { allowThemeSwitching: true, customCss: ".custom{color:orange}" },
      css: ["./extra.css"],
    });
    await put(
      "vault/.obsidian/appearance.json",
      JSON.stringify({
        cssTheme: "First",
        enabledCssSnippets: ["common"],
        accentColor: "#123456",
        baseFontSize: 18,
        textFontFamily: "Inter",
      }),
    );
    const firstCss = '.first{color:red;background:url("image.png?v=2#icon")}';
    const firstFile = await put(
      "vault/.obsidian/themes/First/theme.css",
      firstCss,
    );
    const imageFile = await put(
      "vault/.obsidian/themes/First/image.png",
      new Uint8Array([1, 2, 3]),
    );
    const secondFile = await put(
      "vault/.obsidian/themes/Second/theme.css",
      '.second{color:blue}\n@import "parts/detail.css" screen;',
    );
    const importedFile = await put(
      "vault/.obsidian/themes/Second/parts/detail.css",
      ".detail{color:purple}",
    );
    await put(
      "vault/.obsidian/themes/First/manifest.json",
      '{"author":"SECRET_METADATA"}',
    );
    await put("vault/.obsidian/themes/First/LICENSE", "SECRET_LICENSE");
    await put("vault/.obsidian/snippets/common.css", ".snippet{color:black}");
    await put("vault/publish.css", ".publish{color:green}");
    await put("extra.css", ".extra{color:pink}");
    const globals = [
      globalThis.window,
      globalThis.document,
      globalThis.DOMParser,
    ];
    const result = await compileVault(await loadConfig(root));
    const { site, assets, dependencies } = result;
    expect([
      globalThis.window,
      globalThis.document,
      globalThis.DOMParser,
    ]).toEqual(globals);
    expect(site.themes?.map(({ name }) => name)).toEqual([
      "Default (Obsidian)",
      "Publish",
      "First",
      "Second",
    ]);
    expect(site.themes?.[0]).toEqual({
      id: "default",
      name: "Default (Obsidian)",
      cssUrl: "",
    });
    const first = site.themes!.find(({ name }) => name === "First")!;
    const second = site.themes!.find(({ name }) => name === "Second")!;
    expect(site.defaultTheme).toBe(first.id);
    expect(site.settings.communityTheme).toBe("First");
    const cssFor = (url: string) =>
      Buffer.from(
        assets.get(decodeURIComponent(url.slice("/garden/".length)))!,
      ).toString();
    const firstAsset = cssFor(first.cssUrl);
    const secondAsset = cssFor(second.cssUrl);
    expect(first.cssUrl).toMatch(
      /^\/garden\/_theme\/[a-f0-9]+-theme-first.css$/,
    );
    expect(second.cssUrl).toMatch(
      /^\/garden\/_theme\/[a-f0-9]+-theme-second.css$/,
    );
    expect(firstAsset).toMatch(
      /url\("\/garden\/_theme\/[a-f0-9]+-image.png\?v=2#icon"\)/,
    );
    expect(secondAsset).toMatch(
      /@import url\("\/garden\/_theme\/[a-f0-9]+-detail.css"\) screen;/,
    );
    expect(firstAsset).not.toContain(".second");
    expect(secondAsset).not.toContain(".first");
    const common =
      '.snippet{color:black}\n.publish{color:green}\n.extra{color:pink}\nbody{--accent:#123456;--interactive-accent:#123456;--text-accent:#123456;--font-text-size:18px;--font-text:"Inter"}\n.custom{color:orange}';
    expect(site.themeOverridesCss).toBe(common);
    expect(site.themeCss).toBe(`${firstAsset}\n${common}`);
    expect(firstAsset).not.toContain(".snippet");
    expect(secondAsset).not.toContain(".snippet");
    expect(Object.keys(first).sort()).toEqual(["cssUrl", "id", "name"]);
    expect(JSON.stringify(site.themes)).not.toContain(root);
    expect(JSON.stringify(site.themes)).not.toContain(".obsidian");
    expect([...assets.keys()]).toHaveLength(5);
    expect(
      [...assets.values()]
        .map((bytes) => Buffer.from(bytes).toString())
        .join("\n"),
    ).not.toContain("SECRET_");
    expect(dependencies).toEqual(
      expect.arrayContaining([
        path.join(root, "vault/.obsidian/themes"),
        firstFile,
        secondFile,
        imageFile,
        importedFile,
        path.dirname(firstFile),
        path.dirname(secondFile),
      ]),
    );
    const repeated = await compileVault(await loadConfig(root));
    expect(repeated.site).toEqual(site);
    expect([...repeated.assets]).toEqual([...assets]);
  });

  it("does not read or emit alternate themes when switching is false or omitted", async () => {
    const { root, put } = await fixture({ theme: "Selected", snippets: [] });
    const selectedCss = ".selected{color:red}";
    await put("vault/.obsidian/themes/Selected/theme.css", selectedCss);
    const unsafeFile = await put(
      "vault/.obsidian/themes/Unsafe/theme.css",
      '.unsafe{background:url("../../../../../outside.png")}',
    );
    const missingFile = path.join(root, "missing/theme.css");
    const initial = await compileVault(await loadConfig(root));
    for (const allowThemeSwitching of [undefined, false]) {
      await put(
        "publish.config.json",
        JSON.stringify({
          vault: "./vault",
          theme: "Selected",
          snippets: [],
          site: { title: "Garden", home: "Welcome.md", allowThemeSwitching },
          themes: ["Unknown", "./missing/theme.css", "Unsafe"],
        }),
      );
      const result = await compileVault(await loadConfig(root));
      expect(result.site).toEqual(initial.site);
      expect(result.site.themeCss).toBe(selectedCss);
      expect(result.site.settings.allowThemeSwitching).toBe(false);
      for (const key of ["themes", "defaultTheme", "themeOverridesCss"])
        expect(result.site).not.toHaveProperty(key);
      expect([...result.assets]).toEqual([...initial.assets]);
      expect(result.assets.size).toBe(0);
      expect(result.dependencies).not.toContain(unsafeFile);
      expect(result.dependencies).not.toContain(missingFile);
      expect(result.dependencies).not.toContain(
        path.join(root, "vault/.obsidian/themes"),
      );
    }
  });

  it("honors allowlists, deduplicates theme references, and always retains the selected theme", async () => {
    const { root, put } = await fixture({
      site: { allowThemeSwitching: true },
      theme: "Selected",
      snippets: [],
      themes: [
        "Other",
        "Other",
        "./vault/.obsidian/themes/Other/theme.css",
        "default",
      ],
    });
    await put(
      "vault/.obsidian/appearance.json",
      JSON.stringify({ cssTheme: "Ignored" }),
    );
    await put(
      "vault/.obsidian/themes/Selected/theme.css",
      ".selected{color:red}",
    );
    await put("vault/.obsidian/themes/Other/theme.css", ".other{color:blue}");
    const ignored = await put(
      "vault/.obsidian/themes/Ignored/theme.css",
      "SHOULD_NOT_BE_READ",
    );
    const first = await compileVault(await loadConfig(root));
    expect(first.site.themes?.map(({ name }) => name)).toEqual([
      "Default (Obsidian)",
      "Publish",
      "Other",
      "Selected",
    ]);
    expect(first.site.defaultTheme).toBe(
      first.site.themes!.find(({ name }) => name === "Selected")!.id,
    );
    expect(first.dependencies).not.toContain(ignored);
    await put(
      "publish.config.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        theme: "Selected",
        snippets: [],
        themes: [],
      }),
    );
    const restricted = await compileVault(await loadConfig(root));
    expect(restricted.site.themes?.map(({ name }) => name)).toEqual([
      "Default (Obsidian)",
      "Publish",
      "Selected",
    ]);
    expect(restricted.site.defaultTheme).toBe(first.site.defaultTheme);
    expect(restricted.site.themeCss).toBe(first.site.themeCss);
    expect(restricted.assets.size).toBe(2);
    await put(
      "publish.config.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        theme: "default",
        snippets: [],
        themes: [],
      }),
    );
    const onlyDefault = await compileVault(await loadConfig(root));
    expect(onlyDefault.site.themes).toEqual([
      { id: "default", name: "Default (Obsidian)", cssUrl: "" },
      publishChoice,
    ]);
    expect(onlyDefault.site.defaultTheme).toBe("default");
    expect(onlyDefault.site.themeCss).toBe("");
    expect(onlyDefault.site.themeOverridesCss).toBe("");
    expect(onlyDefault.assets.size).toBe(1);
  });

  it("supports external CSS allowlists with stable private IDs and colliding display names", async () => {
    const { root, put } = await fixture({
      site: { allowThemeSwitching: true },
      theme: "./one/Same/theme.css",
      snippets: [],
      themes: [
        "./two/Same/theme.css",
        "./one/Same/theme.css",
        "Same",
        "A B",
        "A-B",
      ],
    });
    await put("one/Same/theme.css", '.one{background:url("image.png")}');
    await put("one/Same/image.png", new Uint8Array([9, 8]));
    await put("two/Same/theme.css", ".two{color:blue}");
    await put(
      "vault/.obsidian/themes/Same/theme.css",
      ".installed{color:green}",
    );
    await put("vault/.obsidian/themes/A B/theme.css", ".spaced{color:red}");
    await put("vault/.obsidian/themes/A-B/theme.css", ".hyphen{color:pink}");
    const result = await compileVault(await loadConfig(root));
    expect(result.site.themes).toHaveLength(7);
    expect(new Set(result.site.themes!.map(({ id }) => id)).size).toBe(7);
    expect(
      result.site.themes!.filter(({ name }) => name === "Same"),
    ).toHaveLength(3);
    expect(result.site.settings.communityTheme).toBe("Same");
    expect(
      result.site.themes!.find(({ id }) => id === result.site.defaultTheme)
        ?.name,
    ).toBe("Same");
    expect(JSON.stringify(result.site.themes)).not.toContain(root);
    expect([...result.assets.keys()].join("\n")).not.toContain("one/");
    await put(
      "publish.config.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        theme: "./one/Same/theme.css",
        snippets: [],
        themes: [
          "A-B",
          "Same",
          "./one/Same/theme.css",
          "A B",
          "./two/Same/theme.css",
        ],
      }),
    );
    expect((await compileVault(await loadConfig(root))).site.themes).toEqual(
      result.site.themes,
    );
    // Choosing the same installed file by CSS path or by name yields the same ID.
    await put(
      "publish.config.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        theme: "Same",
        snippets: [],
        themes: [],
      }),
    );
    const byName = await compileVault(await loadConfig(root));
    await put(
      "publish.config.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        theme: "./vault/.obsidian/themes/Same/theme.css",
        snippets: [],
        themes: [],
      }),
    );
    expect((await compileVault(await loadConfig(root))).site.defaultTheme).toBe(
      byName.site.defaultTheme,
    );
  });

  it("discovers only plain installed theme files and watches additions and removals", async () => {
    const { root, put } = await fixture({
      site: { allowThemeSwitching: true },
      snippets: [],
    });
    const visible = await put(
      "vault/.obsidian/themes/Visible/theme.css",
      ".visible{color:red}",
    );
    const dotFile = await put(
      "vault/.obsidian/themes/.Hidden/theme.css",
      "SECRET_DOT_THEME",
    );
    const outside = await put("outside/theme.css", "SECRET_SYMLINK_THEME");
    const themesRoot = path.join(root, "vault/.obsidian/themes");
    await symlink(path.dirname(outside), path.join(themesRoot, "Linked"));
    await mkdir(path.join(themesRoot, "LinkedFile"));
    await symlink(outside, path.join(themesRoot, "LinkedFile/theme.css"));
    await put(
      "vault/.obsidian/themes/NotTheme/manifest.json",
      "SECRET_METADATA",
    );
    const first = await compileVault(await loadConfig(root));
    expect(first.site.themes?.map(({ name }) => name)).toEqual([
      "Default (Obsidian)",
      "Publish",
      "Visible",
    ]);
    expect(first.site.defaultTheme).toBe("default");
    expect(first.site.themeCss).toBe("");
    expect(first.dependencies).toContain(themesRoot);
    expect(first.dependencies).toContain(path.join(themesRoot, "NotTheme"));
    expect(first.dependencies).toContain(
      path.join(themesRoot, "NotTheme/theme.css"),
    );
    expect(first.dependencies).not.toContain(dotFile);
    expect(first.dependencies).not.toContain(outside);
    const firstId = first.site.themes!.find(
      ({ name }) => name === "Visible",
    )!.id;
    await put("vault/.obsidian/themes/Added/theme.css", ".added{color:blue}");
    const added = await compileVault(await loadConfig(root));
    expect(added.site.themes?.map(({ name }) => name)).toEqual([
      "Default (Obsidian)",
      "Publish",
      "Added",
      "Visible",
    ]);
    expect(added.site.themes!.find(({ name }) => name === "Visible")?.id).toBe(
      firstId,
    );
    await rm(visible);
    const removed = await compileVault(await loadConfig(root));
    expect(removed.site.themes?.map(({ name }) => name)).toEqual([
      "Default (Obsidian)",
      "Publish",
      "Added",
    ]);
    expect(removed.dependencies).toContain(visible);
    expect(
      [...removed.assets.values()]
        .map((bytes) => Buffer.from(bytes).toString())
        .join("\n"),
    ).not.toContain("SECRET_");
  });

  it("does not follow a symlinked theme discovery root and accepts a missing root", async () => {
    const { root, put } = await fixture({
      site: { allowThemeSwitching: true },
      snippets: [],
    });
    const missing = await compileVault(await loadConfig(root));
    expect(missing.site.themes).toEqual([
      { id: "default", name: "Default (Obsidian)", cssUrl: "" },
      publishChoice,
    ]);
    expect(missing.dependencies).toContain(
      path.join(root, "vault/.obsidian/themes"),
    );
    const outside = await put("outside/Themed/theme.css", "SECRET_LINKED_ROOT");
    await mkdir(path.join(root, "vault/.obsidian"));
    await symlink(
      path.dirname(path.dirname(outside)),
      path.join(root, "vault/.obsidian/themes"),
    );
    const linked = await compileVault(await loadConfig(root));
    expect(linked.site.themes).toEqual(missing.site.themes);
    expect([...linked.assets]).toEqual([...missing.assets]);
    expect(linked.assets.size).toBe(1);
  });

  it("fails clearly for unknown enabled themes and rejects escaping or hidden alternate CSS assets", async () => {
    const { root, put } = await fixture({
      site: { allowThemeSwitching: true },
      themes: ["Unknown"],
      snippets: [],
    });
    await expect(compileVault(await loadConfig(root))).rejects.toThrow(
      /Unsupported or unavailable theme "Unknown"/,
    );
    await put("outside.png", new Uint8Array([1]));
    await put("vault/Hidden/image.png", new Uint8Array([2]));
    await put(
      "vault/.obsidian/themes/Unsafe/theme.css",
      '.unsafe{background:url("../../../../outside.png")}',
    );
    await put(
      "vault/.obsidian/themes/Hidden/theme.css",
      '.hidden{background:url("../../../Hidden/image.png")}',
    );
    for (const theme of ["Unsafe", "Hidden"]) {
      await put(
        "publish.config.json",
        JSON.stringify({
          vault: "./vault",
          site: { allowThemeSwitching: true, hiddenPaths: ["Hidden"] },
          themes: [theme],
          snippets: [],
        }),
      );
      await expect(compileVault(await loadConfig(root))).rejects.toThrow(
        /Path escapes allowed root|hidden vault asset/,
      );
    }
    const external = await put("external/theme.css", ".external{color:red}");
    await symlink(
      path.dirname(external),
      path.join(root, "vault/.obsidian/themes/Alias"),
    );
    await put(
      "publish.config.json",
      JSON.stringify({
        vault: "./vault",
        site: { allowThemeSwitching: true },
        themes: ["./external/theme.css", "Alias"],
        snippets: [],
      }),
    );
    await expect(compileVault(await loadConfig(root))).rejects.toThrow(
      /Path escapes allowed root/,
    );
  });

  it("emits local data media and raw HTML relative assets, sanitizing SVGs and resolving transcluded media origins", async () => {
    const { root, put } = await fixture();
    await put(
      "vault/Welcome.md",
      '# Welcome\n![[media/pic.png]]\n![[media/doc.pdf#page=2]]\n![[media/icon.svg]]\n<img src="media/raw.png" onerror="bad()">\n\n![[Nested/Other]]',
    );
    await put("vault/Nested/Other.md", '<img src="./local.png">');
    await put("vault/media/pic.png", new Uint8Array([1, 2, 3]));
    await put("vault/media/raw.png", new Uint8Array([4, 5, 6]));
    await put("vault/Nested/local.png", new Uint8Array([7, 8, 9]));
    await put("vault/media/doc.pdf", "%PDF-1.4\nminimal");
    await put(
      "vault/media/icon.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"><script>EVIL</script><rect width="10" height="10"/></svg>',
    );
    await put("vault/media/unreferenced.png", new Uint8Array([10, 11, 12]));
    const { site, assets } = await compileVault(await loadConfig(root));
    const html = site.notes.find((note) => note.path === "Welcome.md")!.html;
    expect(html).toContain("/_assets/media/");
    expect(html).toContain("/_assets/Nested/");
    expect(html).toContain('sandbox=""');
    expect(html).toContain('data-page="2"');
    expect(html).not.toContain("data:");
    expect(html).not.toContain("onerror");
    expect(
      [...assets.values()]
        .map((value) => Buffer.from(value).toString())
        .join("\n"),
    ).not.toContain("EVIL");
    expect(assets.size).toBe(5);
    expect(
      [...assets.keys()].some((key) => /\.md$|\.base$|\.css$/.test(key)),
    ).toBe(false);
  });
  it("supports explicit local theme overrides and fails visibly for unsupported themes or escaping CSS URLs", async () => {
    const { root, put } = await fixture({
      theme: "./my-theme/theme.css",
      snippets: [],
    });
    await put("my-theme/theme.css", "/* override */body{color:hotpink}");
    await put(
      "vault/.obsidian/appearance.json",
      JSON.stringify({ cssTheme: "Missing", enabledCssSnippets: ["Missing"] }),
    );
    expect(
      (await compileVault(await loadConfig(root))).site.themeCss,
    ).toContain("/* override */");
    await put(
      "publish.config.json",
      JSON.stringify({ vault: "./vault", theme: "default", snippets: [] }),
    );
    expect((await compileVault(await loadConfig(root))).site.themeCss).toBe("");
    await put(
      "publish.config.json",
      JSON.stringify({ vault: "./vault", theme: "Missing" }),
    );
    await expect(compileVault(await loadConfig(root))).rejects.toThrow(
      /Unsupported or unavailable theme/,
    );
    await put(
      "vault/.obsidian/themes/Unsafe/theme.css",
      '.x{background:url("../../../../../outside.png")}',
    );
    await put("outside.png", new Uint8Array([1]));
    await put(
      "publish.config.json",
      JSON.stringify({ vault: "./vault", theme: "Unsafe", snippets: [] }),
    );
    await expect(compileVault(await loadConfig(root))).rejects.toThrow();
  });
  it("collects recursive local CSS imports, preserves qualifiers and remote imports, and rejects cycles", async () => {
    const { root, put } = await fixture({ theme: "Imports", snippets: [] });
    await put(
      "vault/.obsidian/themes/Imports/theme.css",
      '@import "parts/one.css" layer(theme) supports(display:grid) screen;\n@import url("https://example.com/remote.css") print;\nbody{color:red}',
    );
    const imported = await put(
      "vault/.obsidian/themes/Imports/parts/one.css",
      '@import url("./two.css");\n.one{background:url("../images/pic.png")}',
    );
    await put(
      "vault/.obsidian/themes/Imports/parts/two.css",
      ".two{color:blue}",
    );
    await put(
      "vault/.obsidian/themes/Imports/images/pic.png",
      new Uint8Array([1, 2]),
    );
    const result = await compileVault(await loadConfig(root));
    expect(result.site.themeCss).toMatch(
      /@import url\("\/_theme\/[a-f0-9]+-one.css"\) layer\(theme\) supports\(display:grid\) screen;/,
    );
    expect(result.site.themeCss).toContain(
      '@import url("https://example.com/remote.css") print;',
    );
    const sheets = [...result.assets].filter(([key]) => key.endsWith(".css"));
    expect(sheets).toHaveLength(2);
    const one = Buffer.from(
      sheets.find(([key]) => key.endsWith("-one.css"))![1],
    ).toString();
    expect(one).toMatch(/@import url\("\/_theme\/[a-f0-9]+-two.css"\);/);
    expect(one).toMatch(/url\("\/_theme\/[a-f0-9]+-pic.png"\)/);
    expect(result.dependencies).toContain(imported);
    await put(
      "vault/.obsidian/themes/Imports/parts/two.css",
      '@import "../theme.css";',
    );
    await expect(compileVault(await loadConfig(root))).rejects.toThrow(
      /Circular CSS import/,
    );
  });

  it("omits source Markdown and invisible Obsidian comments from public reader/search payloads", async () => {
    const { root, put } = await fixture();
    await put(
      "vault/Welcome.md",
      '---\nlabel: "Public %%metadata%%"\n---\n# Welcome\nPublic prose %%SECRET_COMMENT_TOKEN%% retained.\n\n%%\nSECRET_MULTILINE_TOKEN\n%%\n\n`%% literal inline %%`\n\n```text\n%% literal fenced %%\n```',
    );
    const { site } = await compileVault(await loadConfig(root));
    expect(JSON.stringify(site)).not.toContain("SECRET_COMMENT_TOKEN");
    expect(JSON.stringify(site)).not.toContain("SECRET_MULTILINE_TOKEN");
    const welcome = site.notes[0];
    expect(welcome.content).toBe("");
    expect(welcome.body).toContain("Public prose");
    expect(welcome.body).toContain("%% literal inline %%");
    expect(welcome.body).toContain("%% literal fenced %%");
    expect(welcome.properties.label).toBe("Public %%metadata%%");
    expect(welcome.html).toContain("literal fenced");
    expect(welcome.previewHtml).toContain("Public prose");
  });

  it("fails closed on malformed/unterminated publication metadata and ambiguous privacy flags", async () => {
    const { root, put } = await fixture();
    for (const frontmatter of [
      "private: true\nbroken: [",
      "publish: false\nprivate: true\nprivate: false",
      'private: "true"',
      'publish: "false"',
      "- private: true",
    ]) {
      await put(
        "vault/Secret.md",
        `---\n${frontmatter}\n---\nSECRET_PRIVATE_BODY`,
      );
      await expect(compileVault(await loadConfig(root))).rejects.toThrow(
        /Invalid publication frontmatter in Secret.md/,
      );
    }
    await put("vault/Secret.md", "---\nprivate: true\nSECRET_PRIVATE_BODY");
    await expect(compileVault(await loadConfig(root))).rejects.toThrow(
      /Unterminated frontmatter/,
    );
    await put(
      "vault/Secret.md",
      "---\nprivate: true\n---\nSECRET_PRIVATE_BODY",
    );
    await put("vault/Empty.md", "---\n---\n# Empty metadata");
    expect(
      (await compileVault(await loadConfig(root))).site.notes.some(
        (note) => note.path === "Empty.md",
      ),
    ).toBe(true);
    expect(
      JSON.stringify((await compileVault(await loadConfig(root))).site),
    ).not.toContain("SECRET_PRIVATE_BODY");
  });

  it("never follows vault symlinks or emits hidden assets and fails for a private home", async () => {
    const { root, put } = await fixture({
      site: { title: "Safe", home: "Welcome.md", hiddenPaths: ["Hidden"] },
    });
    const outside = await put("outside/Leak.md", "SECRET_SYMLINK");
    await symlink(outside, path.join(root, "vault/Leak.md"));
    await symlink(path.join(root, "vault"), path.join(root, "vault/Cycle"));
    await put("vault/Hidden/pic.png", new Uint8Array([1]));
    await put("vault/Welcome.md", '![[Leak]]\n<img src="Hidden/pic.png">');
    const result = await compileVault(await loadConfig(root));
    expect(JSON.stringify(result.site)).not.toContain("SECRET_SYMLINK");
    expect(result.assets.size).toBe(0);
    await put("vault/Welcome.md", "---\npublish: false\n---\nPRIVATE_HOME");
    await put("vault/Visible.md", "# Visible");
    await expect(compileVault(await loadConfig(root))).rejects.toThrow(
      /home note is missing or private/,
    );
  });
});
