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
