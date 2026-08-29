// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from './config';
import { compileVault } from './compile';

const roots: string[] = [];
const oldEnv = { OBSIDIAN_VAULT: process.env.OBSIDIAN_VAULT, PUBLISH_CONFIG: process.env.PUBLISH_CONFIG };
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  for (const key of ['OBSIDIAN_VAULT', 'PUBLISH_CONFIG'] as const) {
    if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
  }
});
async function fixture(config: Record<string, unknown> = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'publish-compile-')));
  roots.push(root);
  delete process.env.OBSIDIAN_VAULT; delete process.env.PUBLISH_CONFIG;
  const put = async (relative: string, content: string | Uint8Array) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  };
  await put('vault/Welcome.md', '# Welcome');
  await put('publish.config.json', JSON.stringify({ vault: './vault', site: { title: 'Garden', home: 'Welcome.md' }, ...config }));
  return { root, put };
}

describe('filesystem build configuration', () => {
  it('resolves roots, settings, CSS paths, and environment overrides without creating a vault', async () => {
    const { root, put } = await fixture({ base: '/garden', css: ['./extra.css'], snippets: [], bodyClasses: ['custom'] });
    const config = await loadConfig(root);
    expect(config.vaultPath).toBe(path.join(root, 'vault'));
    expect(config.base).toBe('/garden/');
    expect(config.css).toEqual([path.join(root, 'extra.css')]);
    expect(config.settings.accent).toBe('');
    await put('second/Another.md', '# Another');
    await put('custom.json', JSON.stringify({ vault: 'missing', site: { title: 'Override' } }));
    process.env.PUBLISH_CONFIG = './custom.json'; process.env.OBSIDIAN_VAULT = './second';
    const override = await loadConfig(root);
    expect(override.configPath).toBe(path.join(root, 'custom.json'));
    expect(override.vaultPath).toBe(path.join(root, 'second'));
    expect(override.settings.title).toBe('Override');
  });
