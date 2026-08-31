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
      return await readFile(resolved);
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  };
  const scan = async (directory: string): Promise<void> => {
    dependencies.add(directory);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = slash(path.relative(vaultRoot, absolute));
      // Never follow vault symlinks: prevents cycles, aliases, and accidental outside/private publication.
      if (entry.isSymbolicLink() || hidden(relative, config)) continue;
      if (entry.isDirectory()) { await scan(absolute); continue; }
      if (!entry.isFile()) continue;
      const ext = extension(relative);
      if (!['md', 'markdown', 'base'].includes(ext) && !mimeTypes[ext]) continue;
      const bytes = (await safeRead(absolute, vaultRoot))!;
      if (ext === 'md' || ext === 'markdown') {
        const content = bytes.toString('utf8');
        const { properties } = splitFrontmatter(content);
        if (properties.publish === false || properties.private === true) continue;
        files.push({ path: relative, content, kind: 'note' });
      } else if (ext === 'base') files.push({ path: relative, content: bytes.toString('utf8'), kind: 'base' });
      else {
        assetBytes.set(relative, bytes);
        files.push({ path: relative, content: ext === 'svg' ? bytes.toString('utf8') : '', kind: 'asset', mime: mimeTypes[ext], data: `data:${mimeTypes[ext]};base64,${bytes.toString('base64')}` });
      }
    }
  };
  const emitAsset = (bytes: Uint8Array, source: string, theme = false): string => {
    const ext = extension(source) || 'bin';
    const cleanName = path.basename(source).replace(/[^a-zA-Z0-9._-]/g, '-');
    const key = theme ? `_theme/${hash(bytes)}-${cleanName}` : `_assets/${source.split('/').slice(0, -1).map(segment => segment.replace(/[^\p{L}\p{N}._-]/gu, '-')).filter(Boolean).join('/')}${source.includes('/') ? '/' : ''}${hash(bytes)}.${ext}`;
    assets.set(key, new Uint8Array(bytes));
    return config.base + encodePath(key);
  };
  try {
    await scan(vaultRoot);
    const notes = buildNotes(files);
    if (!notes.length) throw new Error('There are no published Markdown notes in the configured vault.');
    const settings = { ...config.settings, navigation: [...config.settings.navigation], hiddenPaths: [...config.settings.hiddenPaths] };
    const home = settings.home ? resolveNote(settings.home, notes) : notes[0];
    if (!home) throw new Error(`Configured home note is missing or private: ${settings.home}`);
    settings.home = home.path;
    const urls = new Map(notes.map(note => [note.path, note.path === home.path ? config.base : config.base + encodePath(note.slug)]));
    const assetSources = new Map(files.filter(file => file.kind === 'asset').map(file => [file.data!, file.path]));
    for (const file of files) if (file.mime === 'image/svg+xml') {
      assetSources.set(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizers.sanitizeSvg(file.content))}`, file.path);
    }
    const assetByName = (source: string, currentPath: string): string | undefined => {
      const clean = decodeTarget(source.split(/[?#]/)[0]).replace(/\\/g, '/');
      if (clean.includes('\0')) return undefined;
      const local = path.posix.normalize(path.posix.join(path.posix.dirname(currentPath), clean));
      const root = path.posix.normalize(clean.replace(/^\//, ''));
      const candidates = clean.startsWith('/') ? [root] : /^\.\.?\//.test(clean) ? [local] : [local, root];
      return candidates.find(candidate => !candidate.startsWith('../') && assetBytes.has(candidate));
    };
    const markup = (html: string, note: Note): string => {
      const document = new dom.window.DOMParser().parseFromString(html, 'text/html');
