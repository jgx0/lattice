import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import type { CompiledSite, Note, PublishedNote, VaultFile } from '../src/types';
import { splitFrontmatter } from '../src/lib/markdown';
import { buildNotes, getBacklinks, resolveLink, resolveNote } from '../src/lib/model';
import { renderMarkdown, renderPreview } from '../src/lib/render';
import { createSanitizers } from '../src/lib/sanitize';
import { decodeTarget } from '../src/lib/utils';
import type { BuildConfig } from './config';

export interface CompileResult {
  site: CompiledSite;
  /** Output-relative filenames; URLs are prefixed with config.base. */
  assets: Map<string, Uint8Array>;
  /** Absolute files and directories, including optional input paths, for watchers. */
  dependencies: string[];
}
const mimeTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject', ico: 'image/x-icon',
};
const extension = (file: string) => path.extname(file).slice(1).toLowerCase();
const inside = (root: string, file: string) => { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
const slash = (file: string) => file.split(path.sep).join('/');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex').slice(0, 20);
const encodePath = (value: string) => value.split('/').map(encodeURIComponent).join('/');
function hidden(file: string, config: BuildConfig): boolean {
  return file.split('/').some(part => part.startsWith('.')) || config.settings.hiddenPaths.some(value => {
    const name = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
    return file === name || file.startsWith(`${name}/`);
  });
}
function decodeData(source: string): { mime: string; bytes: Uint8Array } | undefined {
  const match = /^data:([^;,]+)((?:;[^,]*)?),(.*)$/is.exec(source);
  if (!match) return undefined;
  try {
    return { mime: match[1].toLowerCase(), bytes: /;base64(?:;|$)/i.test(match[2]) ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8') };
  } catch { return undefined; }
}

/** Compile a filesystem vault with an isolated DOM. No network, source-file emission, or global mutations. */
export async function compileVault(config: BuildConfig): Promise<CompileResult> {
  const dependencies = new Set<string>([config.configPath, config.root, config.vaultPath]);
  const assets = new Map<string, Uint8Array>();
  const files: VaultFile[] = [];
  const assetBytes = new Map<string, Uint8Array>();
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const sanitizers = createSanitizers(dom.window);
  const vaultRoot = await realpath(config.vaultPath);
  const safeRead = async (file: string, boundary: string, optional = false): Promise<Buffer | undefined> => {
    dependencies.add(file);
    try {
      const resolved = await realpath(file);
      const realBoundary = await realpath(boundary);
      if (!inside(realBoundary, resolved) || (inside(vaultRoot, file) && !inside(vaultRoot, resolved))) throw new Error(`Path escapes allowed root: ${file}`);
      if (!(await stat(resolved)).isFile()) throw new Error(`Expected a file: ${file}`);
      dependencies.add(resolved);
