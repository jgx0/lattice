import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { SiteSettings } from '../src/types';

export interface BuildConfig {
  root: string;
  vaultPath: string;
  configPath: string;
  base: string;
  settings: SiteSettings;
  /** Obsidian theme name, or an absolute CSS file path. */
  theme?: string;
  /** Omitted means appearance.json's enabledCssSnippets; [] disables snippets. */
  snippets?: string[];
  css: string[];
  bodyClasses: string[];
}

const defaults: SiteSettings = {
  title: 'Notes', description: '', home: '', accent: '', theme: 'system',
  communityTheme: 'default', customCss: '', readable: true, showProperties: true,
  showToc: true, showBacklinks: true, showGraph: true, stacked: false,
  navigation: [], hiddenPaths: [],
};
const stringSettings = ['title', 'description', 'home', 'accent', 'communityTheme', 'customCss'] as const;
const booleanSettings = ['readable', 'showProperties', 'showToc', 'showBacklinks', 'showGraph', 'stacked'] as const;
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error(`${label} must be a string without NUL bytes.`);
  return value;
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings.`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}
function vaultRelative(value: string, label: string): string {
  const clean = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (clean.startsWith('/') || clean.split('/').some(part => part === '..') || !clean) throw new Error(`${label} must be a non-empty vault-relative path without '..'.`);
  return clean;
}
function cssReference(value: string, root: string): string {
  return /(?:[/\\]|\.css$)/i.test(value) ? path.resolve(root, value) : value;
}

/** Read configuration only from disk. Relative overrides are resolved from root. */
export async function loadConfig(root = process.cwd()): Promise<BuildConfig> {
  root = await realpath(path.resolve(root));
  const configPath = path.resolve(root, process.env.PUBLISH_CONFIG || 'publish.config.json');
  let raw: Record<string, unknown>;
  try { raw = object(JSON.parse(await readFile(configPath, 'utf8')), 'publish config'); }
  catch (error) { throw new Error(`Cannot load publish configuration ${configPath}: ${error instanceof Error ? error.message : error}`); }
  const allowed = new Set(['vault', 'site', 'theme', 'snippets', 'css', 'bodyClasses', 'base']);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) throw new Error(`Unknown publish config field: ${key}`);
  const configRoot = path.dirname(configPath);
  const vault = process.env.OBSIDIAN_VAULT || (raw.vault === undefined ? './vault' : string(raw.vault, 'vault'));
