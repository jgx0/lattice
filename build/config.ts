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
  /** Runtime theme allowlist; omitted discovers installed themes when switching is enabled. */
  themes?: string[];
  /** Omitted means appearance.json's enabledCssSnippets; [] disables snippets. */
  snippets?: string[];
  css: string[];
  bodyClasses: string[];
}

const defaults: SiteSettings = {
  title: 'Notes', description: '', home: '', accent: '', theme: 'system',
  communityTheme: 'default', customCss: '', readable: true, showProperties: true,
  showToc: true, showBacklinks: true, showGraph: true, stacked: false,
  navigation: [], hiddenPaths: [], allowThemeSwitching: false,
};
const stringSettings = ['title', 'description', 'home', 'accent', 'communityTheme', 'customCss'] as const;
const booleanSettings = ['readable', 'showProperties', 'showToc', 'showBacklinks', 'showGraph', 'stacked', 'allowThemeSwitching'] as const;
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

export function normalizeBase(value: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { throw new Error('base contains invalid URL encoding.'); }
  // Bases are URL pathnames, not HTML, authorities, or encoded path separators.
  if (!value.startsWith('/') || value.startsWith('//') || /[\u0000-\u0020\u007f?#\\<>"']/.test(value) ||
    /[\u0000-\u001f\u007f?#\\<>"']/.test(decoded) || /%2f|%5c/i.test(value) ||
    decoded.split('/').some(part => part === '..' || part === '.') || value.includes('//')) {
    throw new Error('base must be a rooted URL pathname without query, fragment, controls, encoded separators, or traversal (for example /notes/).');
  }
  return value.replace(/\/+$/, '') + '/';
}

/** Read configuration only from disk. Relative overrides are resolved from root. */
export async function loadConfig(root = process.cwd()): Promise<BuildConfig> {
  root = await realpath(path.resolve(root));
  const configPath = path.resolve(root, process.env.PUBLISH_CONFIG || 'publish.config.json');
  let raw: Record<string, unknown>;
  try { raw = object(JSON.parse(await readFile(configPath, 'utf8')), 'publish config'); }
  catch (error) { throw new Error(`Cannot load publish configuration ${configPath}: ${error instanceof Error ? error.message : error}`); }
  const allowed = new Set(['vault', 'site', 'theme', 'themes', 'snippets', 'css', 'bodyClasses', 'base']);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) throw new Error(`Unknown publish config field: ${key}`);
  const configRoot = path.dirname(configPath);
  const vault = process.env.OBSIDIAN_VAULT || (raw.vault === undefined ? './vault' : string(raw.vault, 'vault'));
  if (!vault.trim()) throw new Error('vault must not be empty.');
  const vaultPath = await realpath(path.resolve(process.env.OBSIDIAN_VAULT ? root : configRoot, vault));
  if (!(await stat(vaultPath)).isDirectory()) throw new Error(`Vault is not a directory: ${vaultPath}`);
  const site = raw.site === undefined ? {} : object(raw.site, 'site');
  const settings: SiteSettings = { ...defaults, navigation: [], hiddenPaths: [] };
  for (const key of Object.keys(site)) if (!(key in defaults) && key !== 'navigationFolders') throw new Error(`Unknown site setting: ${key}`);
  for (const key of stringSettings) if (site[key] !== undefined) settings[key] = string(site[key], `site.${key}`);
  for (const key of booleanSettings) if (site[key] !== undefined) {
    if (typeof site[key] !== 'boolean') throw new Error(`site.${key} must be a boolean.`);
    settings[key] = site[key];
  }
  if (site.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(string(site.theme, 'site.theme'))) throw new Error('site.theme must be light, dark, or system. Use top-level theme for a community theme name or CSS path.');
    settings.theme = site.theme as SiteSettings['theme'];
  }
  for (const key of ['navigation', 'hiddenPaths'] as const) if (site[key] !== undefined) settings[key] = strings(site[key], `site.${key}`).map(item => vaultRelative(item, `site.${key}`));
  if (site.navigationFolders !== undefined) settings.navigationFolders = Object.fromEntries(Object.entries(object(site.navigationFolders, 'site.navigationFolders')).map(([key, value]) => [vaultRelative(key, 'navigationFolders key'), string(value, `navigationFolders.${key}`)]));
  if (settings.accent && !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(settings.accent)) throw new Error('site.accent must be empty or a #RGB/#RRGGBB color.');
  const base = normalizeBase(raw.base === undefined ? '/' : string(raw.base, 'base'));
  const theme = raw.theme === undefined ? undefined : cssReference(string(raw.theme, 'theme'), configRoot);
  const themes = raw.themes === undefined ? undefined : strings(raw.themes, 'themes').map(value => cssReference(value, configRoot));
  const snippets = raw.snippets === undefined ? undefined : strings(raw.snippets, 'snippets').map(value => cssReference(value, configRoot));
  const css = raw.css === undefined ? [] : strings(raw.css, 'css').map(value => path.resolve(configRoot, value));
  const bodyClasses = raw.bodyClasses === undefined ? [] : strings(raw.bodyClasses, 'bodyClasses');
  if (bodyClasses.some(value => !value || /\s/.test(value))) throw new Error('bodyClasses must contain non-empty individual class names.');
  return { root, vaultPath, configPath, base: base.replace(/\/+$/, '') + '/', settings, theme, themes, snippets, css, bodyClasses };
}
