// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { JSDOM } from "jsdom";
import { build, createServer, preview, type ViteDevServer, type PreviewServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledSite, PublishedNote } from "../src/types";
import { loadConfig, type BuildConfig } from "./config";
import { compileVault } from "./compile";
import { vaultPlugin } from "./vaultPlugin";
import { absoluteShellReferences, findPublishedNote, publishedPageFile, renderPublishedPage } from "./staticPages";

vi.mock("./compile", () => ({ compileVault: vi.fn() }));
const compiler = vi.mocked(compileVault);
const temporary: string[] = [];
const servers: ViteDevServer[] = [];
const previews: PreviewServer[] = [];
function messageType(value: unknown): string | undefined {
  return value && typeof value === "object" && "type" in value ? String(value.type) : undefined;
}

function note(pathname: string, url: string, body = "Note body"): PublishedNote {
  const title = pathname.split("/").pop()!.replace(/\.md$/, "");
  return {
    path: pathname, url, title, slug: url.replace(/^\//, ""), folder: pathname.split("/").slice(0, -1).join("/"),
    content: body, body, properties: {}, headings: [{ level: 2, text: "Details", id: "details" }], links: [], tags: [], words: 2,
    html: `<h2 id="details">Details</h2><p>${body}</p>`, previewHtml: `<p>${body}</p>`, outgoing: [], backlinks: [],
  };
}

async function fakeCompile(config: BuildConfig) {
  const entries = await readdir(config.vaultPath, { recursive: true });
  const notes: PublishedNote[] = [];
  for (const entry of entries.filter(entry => entry.endsWith(".md")).sort()) {
    const body = await readFile(path.join(config.vaultPath, entry), "utf8");
    if (body.includes("BROKEN")) throw new Error("Invalid fixture note");
    const route = entry.replace(/\.md$/, "").toLowerCase().replace(/ /g, "-");
    notes.push(note(entry, config.base + (entry === config.settings.home ? "" : route), body));
  }
  const asset = await readFile(path.join(config.vaultPath, "image.png"));
  const cssFile = path.join(config.vaultPath, ".obsidian", "snippets", "custom.css");
  const css = await readFile(cssFile, "utf8");
  const home = notes.find(candidate => candidate.path === config.settings.home);
  if (home) home.backlinks = notes.filter(candidate => candidate !== home).map(candidate => candidate.path);
  const site: CompiledSite = { version: 1, name: "Fixture", settings: config.settings, notes, themeCss: css, bodyClasses: config.bodyClasses };
  return { site, assets: new Map([["_assets/image.png", new Uint8Array(asset)]]), dependencies: [config.vaultPath, config.configPath, cssFile] };
}

async function fixture(base = "/") {
  const container = await realpath(await mkdtemp(path.join(tmpdir(), "publish-plugin-")));
  temporary.push(container);
  const root = path.join(container, "project"), vault = path.join(container, "external-vault");
  await mkdir(root);
  await mkdir(path.join(vault, "Field Notes"), { recursive: true });
  await mkdir(path.join(vault, ".obsidian", "snippets"), { recursive: true });
  await writeFile(path.join(vault, "Home.md"), "Original home");
  await writeFile(path.join(vault, "Field Notes", "Digital Gardens.md"), 'A real garden <img src="' + base + '_assets/image.png" alt="Garden">');
  await writeFile(path.join(vault, "image.png"), new Uint8Array([1, 2, 3]));
  await writeFile(path.join(vault, ".obsidian", "snippets", "custom.css"), "body { --fixture: original; }");
  const configPath = path.join(root, "publish.config.json");
  const raw = { vault, base, bodyClasses: ["publish", "custom-theme"], site: { title: "Fixture site", description: "Garden description", home: "Home.md", theme: "dark" } };
  await writeFile(configPath, JSON.stringify(raw));
  await writeFile(path.join(root, "index.html"), '<!doctype html><html lang="en"><head><meta name="description" content="Old"><title>Old</title></head><body class="existing"><div id="root"></div><script type="module" src="/main.js"></script></body></html>');
  await writeFile(path.join(root, "main.js"), 'import site from "virtual:published-site"; import "./styles.css"; globalThis.publishedSite = site;');
  await writeFile(path.join(root, "styles.css"), ".note-page { color: #333; }");
  return { root, vault, configPath, raw };
}

async function start(root: string) {
  const server = await createServer({
    configFile: false, root, plugins: [vaultPlugin({ debounceMs: 35 })], logLevel: "silent",
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { host: "127.0.0.1", port: 0, watch: { usePolling: true, interval: 20 } },
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

beforeEach(() => {
  vi.stubEnv("PUBLISH_CONFIG", "");
  vi.stubEnv("OBSIDIAN_VAULT", "");
  compiler.mockReset();
  compiler.mockImplementation(fakeCompile);
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(previews.splice(0).map(server => new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))));
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("semantic published pages", () => {
  it("renders real note HTML, nested navigation, TOC, backlinks and theme without branding", async () => {
    const { root } = await fixture();
    const compiled = await fakeCompile(await loadConfig(root));
    const template = await readFile(path.join(root, "index.html"), "utf8");
    const document = new JSDOM(renderPublishedPage(template, compiled.site)).window.document;
    expect(document.title).toBe("Home · Fixture site");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Garden description");
    expect(document.querySelector("#root #static-content .note-page p")?.textContent).toBe("Original home");
    expect(document.querySelector('.nav-folder .note-nav[href="/field-notes/digital-gardens"]')).not.toBeNull();
    expect(document.querySelector('.toc a[href="#details"]')?.textContent).toBe("Details");
    expect(document.querySelector('.backlinks a[href="/field-notes/digital-gardens"]')).not.toBeNull();
    expect(document.body.classList.contains("custom-theme")).toBe(true);
    expect(document.body.classList.contains("existing")).toBe(true);
    expect(document.body.classList.contains("theme-dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelectorAll(".note-meta,.powered,.brand-symbol")).toHaveLength(0);
    expect(document.querySelector("script[type=module]")?.getAttribute("src")).toBe("/main.js");
  });

  it("replaces prior page metadata and content safely without duplicating styles", async () => {
    const { root } = await fixture();
    const { site } = await fakeCompile(await loadConfig(root));
    site.themeCss = 'a::after { content: "$& </STYLE><script>bad()</script>"; }';
    const target = site.notes[0];
    target.title = '<Title> "$&"';
    target.properties.description = 'Quoted "description" <test>';
    const first = renderPublishedPage(await readFile(path.join(root, "index.html"), "utf8"), site, site.notes[1]);
    const document = new JSDOM(renderPublishedPage(first, site, target)).window.document;
    expect(document.title).toBe('<Title> "$&" · Fixture site');
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe('Quoted "description" <test>');
    expect(document.querySelectorAll("#static-content")).toHaveLength(1);
    expect(document.querySelectorAll("#published-theme")).toHaveLength(1);
    expect(document.querySelector("#published-theme")?.textContent).toContain('$& <\\/style>');
    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(document.querySelector(".page-header-title")?.textContent).toBe(target.title);
  });

  it("matches only actual routes and maps safe clean URLs under a deployment base", async () => {
    const { root } = await fixture("/project/");
    const { site } = await fakeCompile(await loadConfig(root));
    expect(findPublishedNote(site, "/project/field-notes/digital-gardens/")?.title).toBe("Digital Gardens");
    expect(findPublishedNote(site, "/project/field-notes/digital-gardens/index.html")?.title).toBe("Digital Gardens");
    expect(findPublishedNote(site, "/project/Field%20Notes/Digital%20Gardens.md")).toBeUndefined();
    expect(findPublishedNote(site, "/project/%2e%2e/Home.md")).toBeUndefined();
    expect(publishedPageFile("/project/field-notes/digital-gardens", "/project/")).toBe("field-notes/digital-gardens/index.html");
    expect(publishedPageFile("/project/", "/project/")).toBe("index.html");
    expect(publishedPageFile("/project/caf%C3%A9", "/project/")).toBe("café/index.html");
    expect(() => publishedPageFile("/project/%2e%2e/secret", "/project/")).toThrow("Unsafe");
    expect(() => publishedPageFile("/other/path", "/project/")).toThrow("outside");
    expect(absoluteShellReferences('<script src="./assets/app.js?v=1"></script><link href="assets/app.css"><a href="#details">', "/project/")).toBe('<script src="/project/assets/app.js?v=1"></script><link href="/project/assets/app.css"><a href="#details">');
  });
});

describe("Vite vault integration", () => {
  it("emits semantic clean-route pages with actual bundled JS/CSS and binary assets, including preview", async () => {
    const { root, vault, configPath } = await fixture("/project/");
    await build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: "silent", build: { minify: false } });
    const dist = path.join(root, "dist");
    const homeHtml = await readFile(path.join(dist, "index.html"), "utf8");
    const gardenHtml = await readFile(path.join(dist, "field-notes", "digital-gardens", "index.html"), "utf8");
    const garden = new JSDOM(gardenHtml).window.document;
    expect(homeHtml).toContain("Original home");
    expect(garden.querySelector(".page-header-title")?.textContent).toBe("Digital Gardens");
    expect(garden.querySelector(".markdown-body p")?.textContent).toContain("A real garden");
    expect(garden.querySelector('img')?.getAttribute("src")).toBe("/project/_assets/image.png");
    for (const element of garden.querySelectorAll("script[src],link[rel=stylesheet]")) {
      const url = element.getAttribute("src") ?? element.getAttribute("href")!;
      expect(url).toMatch(/^\/project\/assets\//);
      expect((await readFile(path.join(dist, url.slice("/project/".length)))).length).toBeGreaterThan(0);
    }
