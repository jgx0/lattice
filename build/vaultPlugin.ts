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
