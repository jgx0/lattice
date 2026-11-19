import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { loadConfig, normalizeBase } from "./config";
import { compileVault } from "./compile";
import {
  absoluteShellReferences,
  createPageRenderer,
  findPublishedNote,
  homeNote,
  publishedPageFile,
  renderPublishedPage,
  renderNotFoundPage,
  validatePublishedRoutes,
} from "./staticPages";

export const PUBLISHED_SITE_ID = "virtual:published-site";
const RESOLVED_SITE_ID = "\0" + PUBLISHED_SITE_ID;
const BASE_MANIFEST = "_published-base.json";
type BuildConfig = Awaited<ReturnType<typeof loadConfig>>;
type Snapshot = Awaited<ReturnType<typeof compileVault>>;

export interface VaultPluginOptions {
  root?: string;
  debounceMs?: number;
}

function within(file: string, directory: string): boolean {
  const relative = path.relative(directory, file);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

function assetFile(key: string): string {
  if (!key || key.startsWith("/") || /[\\\0?#]/.test(key) || key.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe published asset path: ${key}`);
  }
  return key;
}

const MIME: Record<string, string> = {
  ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon",
  ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".mp4": "video/mp4", ".webm": "video/webm", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".bmp": "image/bmp", ".flac": "audio/flac", ".mov": "video/quicktime", ".eot": "application/vnd.ms-fontobject",
};

function sendAsset(request: IncomingMessage, response: ServerResponse, asset: Uint8Array, pathname: string): void {
  const etag = `"${createHash('sha256').update(asset).digest('hex')}"`;
  response.setHeader('Content-Type', MIME[path.extname(pathname).toLowerCase()] ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('ETag', etag);
  if (request.headers['if-none-match']?.split(',').some(value => value.trim().replace(/^W\//, '') === etag || value.trim() === '*')) {
    response.statusCode = 304; response.end(); return;
  }
  let start = 0, end = asset.byteLength - 1;
  const range = request.method === 'GET' && (!request.headers['if-range'] || request.headers['if-range'] === etag) ? request.headers.range : undefined;
  // Multiple/unknown ranges are ignored; valid single byte ranges support media seeking.
  if (range && /^bytes=\d*-\d*$/.test(range) && range !== 'bytes=-') {
    const [first, last] = range.slice(6).split('-');
    start = first ? Number(first) : Math.max(0, asset.byteLength - Number(last));
    end = first && last ? Math.min(Number(last), end) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= asset.byteLength || !first && Number(last) === 0) {
      response.statusCode = 416;
      response.setHeader('Content-Range', `bytes */${asset.byteLength}`);
      response.setHeader('Content-Length', 0);
      response.end(); return;
    }
    response.statusCode = 206;
    response.setHeader('Content-Range', `bytes ${start}-${end}/${asset.byteLength}`);
  } else response.statusCode = 200;
  response.setHeader('Content-Length', asset.byteLength === 0 ? 0 : end - start + 1);
  response.end(request.method === 'HEAD' ? undefined : Buffer.from(asset.subarray(start, end + 1)));
}

function sendHtml(request: IncomingMessage, response: ServerResponse, html: string, status = 200): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Length', Buffer.byteLength(html));
  response.end(request.method === 'HEAD' ? undefined : html);
}

/** A build-time vault compiler, with atomic, debounced snapshots in development. */
export function vaultPlugin(options: VaultPluginOptions = {}): Plugin {
  let projectRoot = path.resolve(options.root ?? process.cwd());
  let resolved: ResolvedConfig;
  let configuration: BuildConfig;
  let snapshot: Snapshot | undefined;
  let server: ViteDevServer | undefined;
  let compiling: Promise<void> | undefined;
  let revision = 0;
  let publishedRevision = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let cleanup: (() => void) | undefined;
  const watched = new Set<string>();
  const debounceMs = Math.max(0, options.debounceMs ?? 80);
  let publicFiles: string[] = [];

  async function validateDeploymentInputs(config: BuildConfig): Promise<void> {
    if (!resolved) return;
    const output = await realpath(path.resolve(resolved.root, resolved.build.outDir)).catch(() => path.resolve(resolved.root, resolved.build.outDir));
    if (within(output, config.vaultPath) || within(config.vaultPath, output) || within(config.configPath, output)) {
      throw new Error('Build output overlaps the vault or publish configuration; choose a separate output directory.');
    }
    publicFiles = [];
    if (!resolved.publicDir || !resolved.build.copyPublicDir) return;
    const seen = new Set<string>();
    const visit = async (file: string, relative = ''): Promise<void> => {
      const canonical = await realpath(file);
      if (within(canonical, config.vaultPath) || canonical === config.configPath) throw new Error(`Vite publicDir would expose a vault/config source: ${file}`);
      const info = await stat(canonical);
      if (info.isDirectory()) {
        if (seen.has(canonical)) throw new Error(`Circular or aliased public directory: ${file}`);
        seen.add(canonical);
        for (const entry of await readdir(file)) await visit(path.join(file, entry), relative ? `${relative}/${entry}` : entry);
      } else if (info.isFile()) publicFiles.push(relative);
    };
    try { await visit(resolved.publicDir); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  function registerDependencies(config: BuildConfig, dependencies: string[]) {
    const optionalCss = [config.theme, ...(config.snippets ?? []), ...config.css].filter((file): file is string => !!file && path.isAbsolute(file));
    const files = [config.vaultPath, path.join(config.vaultPath, ".obsidian"), config.configPath, ...optionalCss, ...dependencies];
    for (const file of files) {
      const absolute = path.resolve(file);
      if (!watched.has(absolute)) {
        watched.add(absolute);
        server?.watcher.add(absolute);
      }
    }
  }

  async function compileSnapshot(): Promise<void> {
    if (compiling) return compiling;
    compiling = (async () => {
      while (!disposed && publishedRevision !== revision) {
        const started = revision;
        const config = await loadConfig(projectRoot);
        // Watch roots even when compilation fails, so the next edit can recover.
        registerDependencies(config, []);
        await validateDeploymentInputs(config);
        const candidate = await compileVault(config);
        if (disposed) return;
        for (const key of candidate.assets.keys()) assetFile(key);
        validatePublishedRoutes(candidate.site.notes, config.base);
        registerDependencies(config, candidate.dependencies);
        if (started !== revision) continue;
        configuration = config;
        snapshot = candidate;
        publishedRevision = started;
      }
    })().finally(() => { compiling = undefined; });
    return compiling;
  }

  async function currentSnapshot(): Promise<Snapshot> {
    if (!snapshot) await compileSnapshot();
    if (!snapshot) throw new Error("No published vault snapshot is available.");
    return snapshot;
  }

  function reportError(error: unknown) {
    const failure = error instanceof Error ? error : new Error(String(error));
    resolved.logger.error(`[vault] ${failure.stack ?? failure.message}`);
    server?.ws.send({ type: "error", err: { message: failure.message, stack: failure.stack ?? "", plugin: "published-vault" } });
  }

  async function refresh() {
    try {
      await compileSnapshot();
      if (disposed) return;
      const module = server?.moduleGraph.getModuleById(RESOLVED_SITE_ID);
      if (module) server!.moduleGraph.invalidateModule(module);
      server?.ws.send({ type: "full-reload", path: "*" });
    } catch (error) {
      // Never invalidate or publish partially compiled data on a failed edit.
      reportError(error);
    }
  }

  function changed(file: string) {
    const absolute = path.resolve(file);
    const relevant = configuration && (within(absolute, configuration.vaultPath) || absolute === configuration.configPath ||
      [...watched].some(dependency => dependency !== projectRoot && within(absolute, dependency)));
    if (disposed || !relevant) return;
    revision++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void refresh(); }, debounceMs);
  }

  return {
    name: "published-vault",
    enforce: "pre",
    async config(config, environment) {
      projectRoot = path.resolve(options.root ?? config.root ?? process.cwd());
      if (environment.isPreview) {
        // Only the deployment base is needed to serve an already-built site.
        const outDir = path.resolve(projectRoot, config.build?.outDir ?? "dist");
        try {
          const manifest = JSON.parse(await readFile(path.join(outDir, BASE_MANIFEST), "utf8"));
          if (typeof manifest.base === "string") return { base: normalizeBase(manifest.base), appType: 'mpa' };
        } catch { /* Older outputs can still use an explicitly supplied Vite base. */ }
        return { base: normalizeBase(config.base ?? '/'), appType: 'mpa' };
      }
      configuration = await loadConfig(projectRoot);
      // All note URLs and bundle references use the same absolute deployment base.
      return { base: configuration.base, appType: 'mpa' };
    },
    configResolved(config) { resolved = config; },
    async buildStart() {
      if (!server) { revision++; snapshot = undefined; }
      await compileSnapshot();
      for (const dependency of watched) this.addWatchFile(dependency);
    },
    resolveId(id) { if (id === PUBLISHED_SITE_ID) return RESOLVED_SITE_ID; },
    async load(id) {
      if (id !== RESOLVED_SITE_ID) return;
      const current = await currentSnapshot();
      return `export default ${JSON.stringify(current.site).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")};`;
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, context) {
        const current = await currentSnapshot();
        const requested = (context.originalUrl ?? context.path).split("?")[0];
        const note = context.bundle ? homeNote(current.site) : findPublishedNote(current.site, requested);
        return note ? renderPublishedPage(html, current.site, note) : renderNotFoundPage(html, current.site);
      },
    },
    configureServer(devServer) {
      server = devServer;
      // buildStart may happen before or after server setup (including middleware mode).
      registerDependencies(configuration, [...watched]);
      server.watcher.on("add", changed).on("change", changed).on("unlink", changed).on("addDir", changed).on("unlinkDir", changed);
      cleanup = () => {
        disposed = true;
        if (timer) clearTimeout(timer);
        server?.watcher.off("add", changed).off("change", changed).off("unlink", changed).off("addDir", changed).off("unlinkDir", changed);
      };
      server.httpServer?.once("close", cleanup);
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") return next();
        let pathname = (request.url ?? "/").split("?")[0];
        try { pathname = decodeURIComponent(pathname); }
        catch { response.statusCode = 400; response.end("Invalid URL."); return; }
        if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some(part => part === "." || part === "..")) {
          response.statusCode = 403;
          response.end("Unsafe request path.");
          return;
        }
        try {
          const current = await currentSnapshot();
          const base = decodeURIComponent(configuration.base);
          const unbased = base !== "/" && pathname.startsWith(base) ? "/" + pathname.slice(base.length) : pathname;
          const diskPath = unbased.startsWith("/@fs/") ? path.resolve(unbased.slice("/@fs".length)) : path.resolve(projectRoot, "." + unbased);
          const canonical = await realpath(diskPath).catch(() => diskPath);
          const canonicalConfig = await realpath(configuration.configPath).catch(() => configuration.configPath);
          const publicPath = resolved.publicDir ? await realpath(path.resolve(resolved.publicDir, '.' + unbased)).catch(() => '') : '';
          if (within(diskPath, configuration.vaultPath) || within(canonical, configuration.vaultPath) || canonical === canonicalConfig ||
            publicPath && (within(publicPath, configuration.vaultPath) || publicPath === canonicalConfig)) {
            response.statusCode = 403;
            response.end("Vault and configuration source files are not served. Use published note and asset URLs.");
            return;
          }
          if (pathname.startsWith(base)) {
            const asset = current.assets.get(pathname.slice(base.length));
            if (asset) {
              sendAsset(request, response, asset, pathname);
              return;
            }
          }
          const note = findPublishedNote(current.site, (request.url ?? "/").split("?")[0]);
          if (!note) return next();
          const template = await readFile(path.join(projectRoot, "index.html"), "utf8");
          // transformIndexHtml already renders this matched note in our post hook.
          const html = await server!.transformIndexHtml(request.url ?? "/", template);
          sendHtml(request, response, html);
        } catch (error) { next(error); }
      });
      // Run after Vite's module/static handlers so missing resources cannot become home.
      return () => server!.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        try {
          const current = await currentSnapshot();
          const template = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
          const transformed = await server!.transformIndexHtml(request.url ?? '/', template);
          sendHtml(request, response, renderNotFoundPage(transformed, current.site), 404);
        } catch (error) { next(error); }
      });
    },
    configurePreviewServer(previewServer) {
      // Vite's SPA preview otherwise falls back to the home page for directory routes.
      previewServer.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") return next();
        const pathname = (request.url ?? "/").split("?")[0];
        const base = resolved.base;
        if (!pathname.startsWith(base)) return next();
        let fileName: string;
        try { fileName = publishedPageFile(pathname.replace(/\/index\.html$/, "/"), base); }
        catch { return next(); }
        try {
          const html = await readFile(path.resolve(resolved.root, resolved.build.outDir, fileName), "utf8");
          sendHtml(request, response, html);
        } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') next(); else next(error); }
      });
      return () => previewServer.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        try {
          const html = await readFile(path.resolve(resolved.root, resolved.build.outDir, '404.html'), 'utf8');
          sendHtml(request, response, html, 404);
        } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') next(); else next(error); }
      });
    },
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        const current = await currentSnapshot();
        const index = bundle["index.html"];
        if (!index || index.type !== "asset") this.error("The published build requires Vite's emitted index.html shell.");
        const shell = absoluteShellReferences(typeof index.source === "string" ? index.source : Buffer.from(index.source).toString("utf8"), configuration.base);
        // Reserve all outputs before emitting. Rollup may rename duplicate emitFile names;
        // file/directory conflicts and publicDir overwrites must instead fail visibly.
        const outputs = new Map<string, string>(), directories = new Map<string, string>();
        const reserve = (file: string, owner: string) => {
          assetFile(file);
          const key = file.normalize('NFC').toLowerCase();
          const segments = key.split('/');
          let previous = outputs.get(key) ?? directories.get(key), parent = '';
          for (const segment of segments.slice(0, -1)) {
            parent = parent ? `${parent}/${segment}` : segment;
            previous ??= outputs.get(parent);
          }
          if (previous !== undefined) this.error(`Published output collision: ${owner} (${file}) conflicts with ${previous}`);
          outputs.set(key, owner);
          parent = '';
          for (const segment of segments.slice(0, -1)) {
            parent = parent ? `${parent}/${segment}` : segment;
            if (!directories.has(parent)) directories.set(parent, owner);
          }
        };
        for (const file of Object.keys(bundle)) reserve(file, `bundle ${file}`);
        for (const file of publicFiles) reserve(file, `publicDir ${file}`);
        reserve(BASE_MANIFEST, 'deployment base manifest');
        reserve('404.html', 'missing-page shell');
        for (const key of current.assets.keys()) reserve(key, `vault asset ${key}`);
        const home = homeNote(current.site);
        const pages = current.site.notes.map(note => ({ note, fileName: publishedPageFile(note.url, configuration.base) }));
        for (const { note, fileName } of pages) {
          if (fileName === 'index.html' && note.path === home?.path) continue;
          reserve(fileName, `note ${note.path}`);
        }
        const renderPage = createPageRenderer(shell, current.site);
        index.source = renderPage(home);
        this.emitFile({ type: 'asset', fileName: '404.html', source: renderNotFoundPage(shell, current.site) });
        this.emitFile({ type: "asset", fileName: BASE_MANIFEST, source: JSON.stringify({ version: 1, base: configuration.base }) });
        for (const [key, source] of current.assets) {
          const fileName = assetFile(key);
          if (bundle[fileName]) this.error(`Published asset collides with a build output: ${fileName}`);
          this.emitFile({ type: "asset", fileName, source });
        }
        for (const { note, fileName } of pages) {
          if (fileName === "index.html") continue;
          if (bundle[fileName]) this.error(`Published page collides with a build output: ${fileName}`);
          this.emitFile({ type: "asset", fileName, source: renderPage(note) });
        }
      },
    },
    closeBundle() { if (server) cleanup?.(); },
  };
}

export default vaultPlugin;
