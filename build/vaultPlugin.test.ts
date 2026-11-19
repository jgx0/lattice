// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { JSDOM } from "jsdom";
import { build, createServer, preview, type ViteDevServer, type PreviewServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledSite, PublishedNote } from "../src/types";
import { loadConfig, type BuildConfig } from "./config";
import { compileVault } from "./compile";
import { vaultPlugin } from "./vaultPlugin";
import { absoluteShellReferences, createPageRenderer, findPublishedNote, homeNote, publishedPageFile, renderPublishedPage, renderNotFoundPage, validatePublishedRoutes } from "./staticPages";

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

  it('includes compiled clickable property values in static no-JavaScript pages', async () => {
    const {root}=await fixture();
    const {site}=await fakeCompile(await loadConfig(root));
    site.settings.showProperties=true;
    const home=site.notes.find(n=>n.path===site.settings.home)!;
    home.properties.related=['[[Topics/Other|Related topic]]'];
    home.propertyHtml={related:'<a class="internal-link metadata-link" href="/topics/other" data-note="Topics/Other.md" data-anchor="">Related topic</a>'};
    const html=renderPublishedPage(await readFile(path.join(root,'index.html'),'utf8'),site,home);
    const doc=new JSDOM(html).window.document;
    expect(doc.querySelector('.metadata-property-value a')?.textContent).toBe('Related topic');
    expect(doc.querySelector('.metadata-property-value a')?.getAttribute('href')).toBe('/topics/other');
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

  it('renders a semantic, no-app-script missing page with navigation and stylesheet shell', async () => {
    const { root } = await fixture('/project/');
    const { site } = await fakeCompile(await loadConfig(root));
    const template = await readFile(path.join(root, 'index.html'), 'utf8');
    const document = new JSDOM(renderNotFoundPage(template.replace('</head>', '<link rel="stylesheet" href="/project/assets/app.css"><link rel="modulepreload" href="/project/assets/app.js"></head>'), site)).window.document;
    expect(document.title).toBe('Page not found · Fixture site');
    expect(document.querySelector('h1')?.textContent).toBe('Page not found');
    expect(document.querySelector('.markdown-body')?.textContent).not.toContain('Original home');
    expect(document.querySelector('.markdown-body a')?.getAttribute('href')).toBe('/project/');
    expect(document.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
    expect(document.querySelectorAll('script,link[rel=modulepreload]')).toHaveLength(0);
    expect(document.querySelector('link[rel=stylesheet]')).not.toBeNull();
    expect(document.querySelector('.vault-navigation a')).not.toBeNull();
  });

  it('builds navigation and indexes once per immutable site, keeping every page selected independently', async () => {
    const { root } = await fixture();
    const { site } = await fakeCompile(await loadConfig(root));
    site.notes = Array.from({ length: 80 }, (_, index) => note(`Folder ${index % 4}/Note ${index}.md`, `/note-${index}`));
    site.settings.home = site.notes[0].path;
    site.settings.navigation = [...site.notes].reverse().map(note => note.path);
    site.notes[0].backlinks = [site.notes[79].path, 'Missing.md', site.notes[10].path];
    let folderReads = 0, themeReads = 0;
    for (const entry of site.notes) {
      const folder = entry.folder;
      Object.defineProperty(entry, 'folder', { get: () => { folderReads++; return folder; } });
    }
    const themeCss = site.themeCss;
    Object.defineProperty(site, 'themeCss', { get: () => { themeReads++; return themeCss; } });
    const rankSearch = vi.spyOn(site.settings.navigation, 'indexOf');
    const render = createPageRenderer(await readFile(path.join(root, 'index.html'), 'utf8'), site);
    expect(folderReads).toBe(80);
    const arraySearch = vi.spyOn(site.notes, 'find').mockImplementation(() => { throw new Error('Repeated note scan'); });
    for (const current of [site.notes[0], site.notes[79], site.notes[40]]) {
      const document = new JSDOM(render(current)).window.document;
      expect(document.querySelectorAll('.note-nav')).toHaveLength(80);
      expect(document.querySelectorAll('.note-nav.selected')).toHaveLength(1);
      expect(document.querySelector('.note-nav[aria-current=page]')?.getAttribute('href')).toBe(current.url);
      expect(findPublishedNote(site, current.url + '/index.html')).toBe(current);
    }
    const home = new JSDOM(render()).window.document;
    expect([...home.querySelectorAll('.backlink')].map(link => link.getAttribute('href'))).toEqual(['/note-79', '/note-10']);
    expect(homeNote(site)).toBe(site.notes[0]);
    expect(new JSDOM(render(null)).window.document.querySelectorAll('.note-nav.selected')).toHaveLength(0);
    expect(folderReads).toBe(80);
    expect(themeReads).toBe(1);
    expect(rankSearch).not.toHaveBeenCalled();
    expect(arraySearch).not.toHaveBeenCalled();
  });

  it('preserves explicit navigation ranks, folder overrides, and escaped active links at all offsets', async () => {
    const { root } = await fixture();
    const { site } = await fakeCompile(await loadConfig(root));
    const first = note('A.md', '/a?x=1&y="quoted"'), middle = note('B.md', '/b'), last = note('Z.md', '/z');
    first.title = '<First> " & $&';
    middle.title = 'Middle';
    last.title = "Last ' $`";
    site.notes = [last, middle, first];
    site.settings.home = first.path;
    site.settings.navigationFolders = { 'A.md': 'Pinned <&>', 'B.md': 'Pinned <&>', 'Z.md': '' };
    site.settings.navigation = ['B.md', 'A.md', 'B.md'];
    const render = createPageRenderer(await readFile(path.join(root, 'index.html'), 'utf8'), site);
    for (const current of [middle, first, last]) {
      const document = new JSDOM(render(current)).window.document;
      const links = [...document.querySelectorAll('.vault-navigation .note-nav')];
      expect(links.map(link => link.textContent)).toEqual([middle.title, first.title, last.title]);
      expect(document.querySelector('.nav-folder-title-content')?.textContent).toBe('Pinned <&>');
      expect(document.querySelectorAll('.note-nav.selected')).toHaveLength(1);
      expect(document.querySelector('.note-nav.selected')?.getAttribute('href')).toBe(current.url);
      expect(document.querySelectorAll('.vault-navigation script,.vault-navigation [onclick]')).toHaveLength(0);
    }
  });

  it('prepares only the shell, retains transformed assets, and bounds renderer caching to the last template', async () => {
    const { root } = await fixture();
    const { site } = await fakeCompile(await loadConfig(root));
    const template = await readFile(path.join(root, 'index.html'), 'utf8');
    site.notes[1].html += '<title>Discarded content title</title><meta name="description" content="discarded"><style id="published-theme">discarded</style>';
    const renderedHome = renderPublishedPage(template, site, site.notes[1]);
    const render = createPageRenderer(renderedHome, site);
    expect(createPageRenderer(renderedHome, site)).toBe(render);
    const document = new JSDOM(render(site.notes[0])).window.document;
    expect(document.querySelectorAll('title')).toHaveLength(1);
    expect(document.querySelectorAll('#published-theme')).toHaveLength(1);
    expect(document.querySelectorAll('#static-content')).toHaveLength(1);
    expect(document.querySelector('.markdown-body')?.textContent).not.toContain('discarded');
    expect(document.querySelector('script')?.getAttribute('src')).toBe('/main.js');
    const alternate = renderedHome.replace('/main.js', '/changed.js');
    const changed = createPageRenderer(alternate, site);
    expect(changed).not.toBe(render);
    expect(changed(site.notes[0])).toContain('src="/changed.js"');
    expect(createPageRenderer(renderedHome, site)).not.toBe(render);
    // An explicitly retained closure remains usable even after cache eviction.
    expect(render(site.notes[0])).toContain('src="/main.js"');
    const replacement = { ...site, notes: [note('New.md', '/new')], settings: { ...site.settings, home: 'New.md' } };
    expect(homeNote(replacement)?.path).toBe('New.md');
    expect(findPublishedNote(replacement, '/new')?.path).toBe('New.md');
    expect(findPublishedNote(replacement, site.notes[0].url)).toBeUndefined();
    expect(createPageRenderer(template, replacement)()).toContain('New · Fixture site');
  });

  it('keeps canonical route matching safe with indexed encoded URLs and separate snapshots', async () => {
    const { root } = await fixture('/project/');
    const { site } = await fakeCompile(await loadConfig(root));
    const encoded = note('Café.md', '/project/caf%C3%A9');
    site.notes.push(encoded);
    for (const route of ['/project/caf%C3%A9', '/project/café/', '/project/caf%C3%A9/index.html']) {
      expect(findPublishedNote(site, route)).toBe(encoded);
    }
    for (const route of ['/project/%', '/project/%00', '/project/%5c', '/project/%2e%2e/café', '/project/café?x=1']) {
      expect(findPublishedNote(site, route)).toBeUndefined();
    }
    expect(() => validatePublishedRoutes([{ path: 'Encoded.md', url: encoded.url }, { path: 'Decoded.md', url: '/project/café/' }], '/project/')).toThrow('route collision');
  });

  it('rejects templates with no empty root or complete managed-content range', async () => {
    const { root } = await fixture();
    const { site } = await fakeCompile(await loadConfig(root));
    for (const template of ['<html><head></head><body></body></html>', '<div id="root">not empty</div>', '<div id="root"><!--published-content:start-->broken</div>']) {
      expect(() => createPageRenderer(template, site)).toThrow('empty <div id="root"></div>');
    }
  });

  it('rejects canonical route aliases and escapes absolutized shell query attributes', () => {
    expect(() => validatePublishedRoutes([{ path: 'Home.md', url: '/project/' }, { path: 'Alias.md', url: '/project/index.html' }], '/project/')).toThrow('route collision');
    for (const route of ['/project/x%2fy', '/project/x//y', '/project/%00']) expect(() => publishedPageFile(route, '/project/')).toThrow('Unsafe');
    const document = new JSDOM(absoluteShellReferences('<a href="assets/x?a=1&b=2\' onclick=\'evil">x</a>', '/project/')).window.document;
    expect(document.querySelector('a')?.hasAttribute('onclick')).toBe(false);
    expect(document.querySelector('a')?.getAttribute('href')).toContain('/project/assets/x?a=1&b=2');
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
    expect(compiler).toHaveBeenCalledTimes(1);
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
    expect(garden.querySelectorAll("script[src]").length).toBeGreaterThan(0);
    expect(garden.querySelectorAll("link[rel=stylesheet]").length).toBeGreaterThan(0);
    expect([...await readFile(path.join(dist, "_assets", "image.png"))]).toEqual([1, 2, 3]);
    const output = (await readdir(path.join(dist, "assets"))).find(file => file.endsWith(".js"))!;
    expect(await readFile(path.join(dist, "assets", output), "utf8")).toContain("Original home");
    await rm(vault, { recursive: true });
    await rm(configPath);
    const compileCount = compiler.mock.calls.length;
    const server = await preview({ configFile: false, root, plugins: [vaultPlugin()], logLevel: "silent", preview: { host: "127.0.0.1", port: 0 } });
    expect(compiler.mock.calls.length).toBe(compileCount);
    previews.push(server);
    const address = server.httpServer.address();
    if (!address || typeof address === "string") throw new Error("Missing preview address");
    const cleanPage = await fetch(`http://127.0.0.1:${address.port}/project/field-notes/digital-gardens`);
    expect(cleanPage.status).toBe(200);
    expect(await cleanPage.text()).toContain("Digital Gardens · Fixture site");
    const origin = `http://127.0.0.1:${address.port}`;
    for (const route of ['/project/missing-note', '/project/removed/deep/page/', '/project/_assets/missing.png']) {
      const missing = await fetch(origin + route);
      expect(missing.status).toBe(404);
      const document = new JSDOM(await missing.text()).window.document;
      expect(document.querySelector('h1')?.textContent).toBe('Page not found');
      expect(document.querySelectorAll('script')).toHaveLength(0);
      expect(document.querySelector('.markdown-body')?.textContent).not.toContain('Original home');
    }
    const missingHead = await fetch(origin + '/project/missing-note', { method: 'HEAD' });
    expect(missingHead.status).toBe(404);
    expect(await missingHead.text()).toBe('');
    const imageHead = await fetch(origin + '/project/_assets/image.png', { method: 'HEAD' });
    expect(imageHead.headers.get('content-type')).toBe('image/png');
    expect(imageHead.headers.get('content-length')).toBe('3');
    const imageRange = await fetch(origin + '/project/_assets/image.png', { headers: { Range: 'bytes=1-2' } });
    expect(imageRange.status).toBe(206);
    expect([...new Uint8Array(await imageRange.arrayBuffer())]).toEqual([2, 3]);
  }, 15000);

  it('reuses one compiled snapshot across dev transforms and module loads until an edit', async () => {
    const { root } = await fixture('/project/');
    const { server, origin } = await start(root);
    for (const route of ['/project/', '/project/field-notes/digital-gardens', '/project/', '/project/missing']) {
      const response = await fetch(origin + route);
      expect(response.status).toBe(route.endsWith('/missing') ? 404 : 200);
      const document = new JSDOM(await response.text()).window.document;
      expect(document.querySelectorAll('#static-content')).toHaveLength(1);
      expect(document.querySelectorAll('#published-theme')).toHaveLength(1);
    }
    await server.ssrLoadModule('virtual:published-site');
    expect(compiler).toHaveBeenCalledTimes(1);
  });

  it('returns true semantic 404s for missing dev routes and resources without swallowing Vite modules', async () => {
    const { root } = await fixture('/project/');
    const { origin } = await start(root);
    for (const route of ['/project/missing', '/project/removed/deep/page', '/project/_assets/missing.png']) {
      const response = await fetch(origin + route);
      expect(response.status).toBe(404);
      const document = new JSDOM(await response.text()).window.document;
      expect(document.querySelector('h1')?.textContent).toBe('Page not found');
      expect(document.querySelectorAll('script')).toHaveLength(0);
      expect(document.querySelector('.markdown-body')?.textContent).not.toContain('Original home');
    }
    const head = await fetch(origin + '/project/missing', { method: 'HEAD' });
    expect(head.status).toBe(404);
    expect(await head.text()).toBe('');
    expect((await fetch(origin + '/project/@vite/client')).status).toBe(200);
    expect((await fetch(origin + '/project/main.js')).status).toBe(200);
  });

  it('serves published media beneath an explicitly encoded deployment base', async () => {
    const { root } = await fixture('/caf%C3%A9/');
    const { origin } = await start(root);
    const asset = await fetch(origin + '/caf%C3%A9/_assets/image.png');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await asset.arrayBuffer())]).toEqual([1, 2, 3]);
    expect((await fetch(origin + '/caf%C3%A9/')).status).toBe(200);
  });

  it('serves every supported media MIME with correct HEAD, validators and single byte ranges', async () => {
    const { root } = await fixture('/project/');
    compiler.mockImplementation(async config => {
      const result = await fakeCompile(config);
      for (const ext of ['bmp', 'flac', 'mov', 'eot']) result.assets.set(`_assets/media.${ext}`, new Uint8Array([1, 2, 3, 4, 5]));
      return result;
    });
    const { origin } = await start(root);
    for (const [ext, mime] of [['bmp', 'image/bmp'], ['flac', 'audio/flac'], ['mov', 'video/quicktime'], ['eot', 'application/vnd.ms-fontobject']]) {
      const head = await fetch(`${origin}/project/_assets/media.${ext}`, { method: 'HEAD', headers: { Range: 'bytes=1-2' } });
      expect(head.status).toBe(200);
      expect(head.headers.get('content-type')).toBe(mime);
      expect(head.headers.get('content-length')).toBe('5');
      expect(head.headers.get('x-content-type-options')).toBe('nosniff');
      expect(await head.text()).toBe('');
    }
    const url = origin + '/project/_assets/media.mov';
    const all = await fetch(url);
    const etag = all.headers.get('etag')!;
    expect((await fetch(url, { headers: { 'If-None-Match': etag } })).status).toBe(304);
    for (const [range, bytes, contentRange] of [
      ['bytes=1-2', [2, 3], 'bytes 1-2/5'], ['bytes=3-', [4, 5], 'bytes 3-4/5'], ['bytes=-2', [4, 5], 'bytes 3-4/5'],
    ] as const) {
      const response = await fetch(url, { headers: { Range: range } });
      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe(contentRange);
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual(bytes);
    }
    for (const range of ['bytes=9-', 'bytes=3-1', 'bytes=-0']) {
      const response = await fetch(url, { headers: { Range: range } });
      expect(response.status).toBe(416);
      expect(response.headers.get('content-range')).toBe('bytes */5');
    }
    expect((await fetch(url, { headers: { Range: 'bytes=1-2', 'If-Range': '"stale"' } })).status).toBe(200);
  });

  it('blocks configuration and realpath vault aliases while preserving compiled routes', async () => {
    const { root, vault } = await fixture();
    await symlink(vault, path.join(root, 'vault-alias'));
    const { origin } = await start(root);
    for (const route of ['/publish.config.json', '/publish.config.json?raw', '/@fs' + root + '/publish.config.json', '/vault-alias/Home.md?raw']) {
      const response = await fetch(origin + route);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('Original home');
    }
    expect((await fetch(origin + '/')).status).toBe(200);
  });

  it("watches an external vault, serves matched dev pages/assets and atomically recovers from failed edits", async () => {
    const { root, vault, configPath, raw } = await fixture("/project/");
    const { server, origin } = await start(root);
    const send = vi.spyOn(server.ws, "send");
    const get = async (url: string) => (await fetch(origin + url)).text();
    const virtual = async () => (await server.ssrLoadModule("virtual:published-site")).default as CompiledSite;
    const initial = await get("/project/field-notes/digital-gardens");
    expect(initial).toContain("Digital Gardens · Fixture site");
    expect(initial).toContain("/project/@vite/client");
    await writeFile(path.join(vault, "Private.md"), "PRIVATE SOURCE SECRET");
    const sourceResponse = await fetch(origin + "/project/@fs" + vault + "/Private.md");
    expect(sourceResponse.status).toBe(403);
    expect(await sourceResponse.text()).not.toContain("PRIVATE SOURCE SECRET");
    expect(server.config.server.fs.allow).not.toContain(vault);
    expect([...new Uint8Array(await (await fetch(origin + "/project/_assets/image.png")).arrayBuffer())]).toEqual([1, 2, 3]);
    expect((await virtual()).notes.find(candidate => candidate.path === "Home.md")?.body).toBe("Original home");

    await writeFile(path.join(vault, "Home.md"), "Updated home");
    await vi.waitFor(async () => expect(await get("/project/")).toContain("Updated home"), { timeout: 6000 });
    expect(send.mock.calls.some(([message]) => messageType(message) === "full-reload")).toBe(true);
    expect((await virtual()).notes.find(candidate => candidate.path === "Home.md")?.body).toBe("Updated home");

    await writeFile(path.join(vault, "New.md"), "Added note");
    await vi.waitFor(async () => expect((await virtual()).notes.some(candidate => candidate.path === "New.md")).toBe(true), { timeout: 6000 });
    expect(await get("/project/new")).toContain("Added note");
    await rm(path.join(vault, "New.md"));
    await vi.waitFor(async () => expect((await virtual()).notes.some(candidate => candidate.path === "New.md")).toBe(false), { timeout: 6000 });

    await writeFile(path.join(vault, "image.png"), new Uint8Array([4, 5]));
    await writeFile(path.join(vault, ".obsidian", "snippets", "custom.css"), "body { --fixture: changed; }");
    await vi.waitFor(async () => expect(await get("/project/")).toContain("--fixture: changed"), { timeout: 6000 });
    expect([...new Uint8Array(await (await fetch(origin + "/project/_assets/image.png")).arrayBuffer())]).toEqual([4, 5]);
    await writeFile(configPath, JSON.stringify({ ...raw, site: { ...raw.site, title: "Renamed site" } }));
    await vi.waitFor(async () => expect(await get("/project/")).toContain("Home · Renamed site"), { timeout: 6000 });

    send.mockClear();
    await writeFile(path.join(vault, "Home.md"), "BROKEN");
    await vi.waitFor(() => expect(send.mock.calls.some(([message]) => messageType(message) === "error")).toBe(true), { timeout: 6000 });
    expect(send.mock.calls.some(([message]) => messageType(message) === "full-reload")).toBe(false);
    expect(await get("/project/")).toContain("Updated home");
    expect((await virtual()).notes.find(candidate => candidate.path === "Home.md")?.body).toBe("Updated home");
    await writeFile(path.join(vault, "Home.md"), "Recovered home");
    await vi.waitFor(async () => expect(await get("/project/")).toContain("Recovered home"), { timeout: 6000 });
    expect(await get("/project/_assets/%2e%2e/%2e%2e/publish.config.json")).not.toContain('"vault"');
  }, 30000);

  it("blocks raw vault paths even when the vault is inside the Vite project root", async () => {
    const { root, vault, configPath, raw } = await fixture();
    const nestedVault = path.join(root, "vault");
    const { cp } = await import("node:fs/promises");
    await cp(vault, nestedVault, { recursive: true });
    await writeFile(configPath, JSON.stringify({ ...raw, vault: "./vault" }));
    const { origin } = await start(root);
    for (const url of ["/vault/Home.md", "/vault/.obsidian/snippets/custom.css", "/@fs" + nestedVault + "/Home.md?raw"]) {
      const response = await fetch(origin + url);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("Original home");
    }
    expect(await (await fetch(origin + "/")).text()).toContain("Original home");
  });

  it("discards an in-flight stale compilation when a newer edit arrives", async () => {
    const { root, vault } = await fixture();
    const { server, origin } = await start(root);
    await fetch(origin + "/");
    let captured = false;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    compiler.mockImplementation(async config => {
      const result = await fakeCompile(config);
      if (!captured && result.site.notes.find(candidate => candidate.path === "Home.md")?.body === "Intermediate") {
        captured = true;
        await gate;
      }
      return result;
    });
    await writeFile(path.join(vault, "Home.md"), "Intermediate");
    server.watcher.emit("change", path.join(vault, "Home.md"));
    await vi.waitFor(() => expect(captured).toBe(true), { timeout: 6000 });
    expect(await (await fetch(origin + "/")).text()).toContain("Original home");
    await writeFile(path.join(vault, "Home.md"), "Final latest snapshot");
    server.watcher.emit("change", path.join(vault, "Home.md"));
    release();
    await vi.waitFor(async () => expect(await (await fetch(origin + "/")).text()).toContain("Final latest snapshot"), { timeout: 6000 });
    const site = (await server.ssrLoadModule("virtual:published-site")).default as CompiledSite;
    expect(site.notes.find(candidate => candidate.path === "Home.md")?.body).toBe("Final latest snapshot");
  });

  it('rejects publicDir copies of vault/config inputs and overlapping output directories', async () => {
    const { root, vault } = await fixture();
    for (const options of [{ publicDir: vault }, { build: { outDir: vault } }, { build: { outDir: '.' } }]) {
      await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent', ...options })).rejects.toThrow(/expose|overlaps/);
    }
    await mkdir(path.join(root, 'public'));
    await symlink(path.join(root, 'publish.config.json'), path.join(root, 'public', 'leak.json'));
    await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent' })).rejects.toThrow(/expose/);
  });

  it('rejects page/asset/public output and file-directory collisions rather than silently renaming pages', async () => {
    const { root } = await fixture();
    for (const asset of ['field-notes/digital-gardens/index.html', 'field-notes', '404.html']) {
      compiler.mockImplementation(async config => ({ ...(await fakeCompile(config)), assets: new Map([[asset, new Uint8Array([1])]]) }));
      await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent' })).rejects.toThrow('output collision');
    }
    compiler.mockImplementation(async config => {
      const result = await fakeCompile(config);
      result.site.notes.push(note('Alias.md', config.base + 'index.html'));
      return result;
    });
    await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent' })).rejects.toThrow('route collision');
    compiler.mockImplementation(fakeCompile);
    await mkdir(path.join(root, 'public'));
    await writeFile(path.join(root, 'public', '404.html'), 'private override');
    await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent' })).rejects.toThrow('output collision');
  });

  it('rejects normalized and reverse-order output collisions without rejecting sibling directories', async () => {
    const { root } = await fixture();
    for (const keys of [
      ['_assets/FILE.png', '_assets/file.png'],
      ['_assets/caf\u00e9.png', '_assets/cafe\u0301.png'],
      ['_assets/folder/child.png', '_assets/folder'],
      ['_assets/folder', '_assets/folder/child.png'],
    ]) {
      compiler.mockImplementation(async config => ({ ...(await fakeCompile(config)), assets: new Map(keys.map(key => [key, new Uint8Array([1])])) }));
      await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent' })).rejects.toThrow('output collision');
    }
    compiler.mockImplementation(async config => ({ ...(await fakeCompile(config)), assets: new Map([
      ['_assets/folder/a.png', new Uint8Array([1])], ['_assets/folder/b.png', new Uint8Array([2])],
      ['_assets/folder-other/c.png', new Uint8Array([3])],
    ]) }));
    await build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: 'silent' });
    expect([...await readFile(path.join(root, 'dist', '_assets', 'folder', 'b.png'))]).toEqual([2]);
  });

  it("rejects unsafe compiler asset outputs before publishing any bundle", async () => {
    const { root } = await fixture();
    compiler.mockImplementation(async config => ({ ...(await fakeCompile(config)), assets: new Map([["../secret", new Uint8Array([1])]]) }));
    await expect(build({ configFile: false, root, plugins: [vaultPlugin()], logLevel: "silent" })).rejects.toThrow("Unsafe published asset path");
  });
});
