import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { loadConfig } from "./config";
import { compileVault } from "./compile";
import {
  absoluteShellReferences,
  findPublishedNote,
  homeNote,
  publishedPageFile,
  renderPublishedPage,
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
};

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
        const candidate = await compileVault(config);
        if (disposed) return;
        for (const key of candidate.assets.keys()) assetFile(key);
        for (const note of candidate.site.notes) publishedPageFile(note.url, config.base);
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
          if (typeof manifest.base === "string" && manifest.base.startsWith("/") && !manifest.base.startsWith("//") && !/[\\\0?#]/.test(manifest.base)) {
            return { base: manifest.base };
          }
        } catch { /* Older outputs can still use an explicitly supplied Vite base. */ }
        return;
      }
      configuration = await loadConfig(projectRoot);
      // All note URLs and bundle references use the same absolute deployment base.
      return { base: configuration.base };
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
        const note = findPublishedNote(current.site, requested) ?? homeNote(current.site);
        return renderPublishedPage(html, current.site, note);
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
          const base = configuration.base;
          const unbased = base !== "/" && pathname.startsWith(base) ? "/" + pathname.slice(base.length) : pathname;
          const diskPath = unbased.startsWith("/@fs/") ? path.resolve(unbased.slice("/@fs".length)) : path.resolve(projectRoot, "." + unbased);
          if (within(diskPath, configuration.vaultPath)) {
            response.statusCode = 403;
            response.end("Vault source files are not served. Use published note and asset URLs.");
            return;
          }
          if (pathname.startsWith(base)) {
            const asset = current.assets.get(pathname.slice(base.length));
            if (asset) {
              response.statusCode = 200;
              response.setHeader("Content-Type", MIME[path.extname(pathname).toLowerCase()] ?? "application/octet-stream");
              response.setHeader("Content-Length", asset.byteLength);
              response.setHeader("Cache-Control", "no-cache");
              response.setHeader("X-Content-Type-Options", "nosniff");
              response.end(request.method === "HEAD" ? undefined : Buffer.from(asset));
              return;
            }
          }
          const note = findPublishedNote(current.site, (request.url ?? "/").split("?")[0]);
          if (!note) return next();
          const template = await readFile(path.join(projectRoot, "index.html"), "utf8");
