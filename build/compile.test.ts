// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig } from "./config";
import { compileVault } from "./compile";

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
