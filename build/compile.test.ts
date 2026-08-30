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
  it('rejects invalid settings and unsafe base/hidden paths', async () => {
    const { root, put } = await fixture();
    for (const config of [
      { base: 'https://example.com/' }, { base: '/%2e%2e/' }, { base: '/x?y' },
      { site: { theme: 'Minimal' } }, { site: { showGraph: 'yes' } },
      { site: { hiddenPaths: ['../private'] } }, { site: { accent: 'red; color: blue' } },
    ]) {
      await put('publish.config.json', JSON.stringify({ vault: './vault', ...config }));
      await expect(loadConfig(root)).rejects.toThrow();
    }
  });
});

describe('Node vault compiler', () => {
  it('renders published content, Unicode clean links, previews, and host-relative Bases/transclusion without globals', async () => {
    const { root, put } = await fixture({ base: '/garden/', site: { title: 'Garden', home: 'Welcome.md', hiddenPaths: ['Hidden'] } });
    await put('vault/Welcome.md', '---\ncssclasses: [wide, garden]\n---\n# Welcome\n[[Projects/Host#Part]]\n[[日本語]]\n![[Projects/Host#Part]]\n![[Private]]\n![[Hidden/Secret]]');
    await put('vault/Projects/Host.md', '# Part\nHost text\n\n![[View.base]]\n\n## Inner\nNested\n\n# Excluded\nNot transcluded');
    await put('vault/Projects/Child.md', '---\nproject: Host\n---\n# Child\n[[Welcome]]');
    await put('vault/Projects/View.base', 'filters: "project == this.file.name"\nviews:\n  - type: table\n    order: [file.name, project]');
    await put('vault/日本語.md', '# 日本語\nUnicode');
    await put('vault/Private.md', '---\npublish: false\n---\nSECRET_PRIVATE_BODY');
    await put('vault/Hidden/Secret.md', 'SECRET_HIDDEN_BODY');
    await put('vault/Privacy.md', '---\nprivate: true\n---\nSECRET_PRIVATE_PROPERTY');
    const globals = [globalThis.window, globalThis.document, globalThis.DOMParser];
    const { site, assets, dependencies } = await compileVault(await loadConfig(root));
    expect([globalThis.window, globalThis.document, globalThis.DOMParser]).toEqual(globals);
    const welcome = site.notes.find(note => note.path === 'Welcome.md')!;
    expect(welcome.url).toBe('/garden/');
    expect(welcome.html).toContain('href="/garden/projects/host#part"');
    expect(welcome.html).toContain('data-anchor="part"');
    expect(welcome.html).toContain('href="/garden/%E6%97%A5%E6%9C%AC%E8%AA%9E"');
    expect(welcome.html).toContain('data-note="Projects/Child.md"');
    expect(welcome.html).not.toContain('Not transcluded');
    expect(welcome.previewHtml).toContain('<h1 id="welcome">');
    expect(welcome.outgoing).toEqual(['Projects/Host.md', '日本語.md']);
    expect(welcome.backlinks).toEqual(['Projects/Child.md']);
    expect(JSON.stringify(site)).not.toContain('SECRET_');
    expect(site.notes).toHaveLength(4);
    expect(site.bodyClasses).toEqual(expect.arrayContaining(['wide', 'garden']));
    expect(site.bodyClasses).not.toContain('theme-light');
    expect(site.bodyClasses).not.toContain('theme-dark');
    expect(assets.size).toBe(0);
    expect(dependencies).toContain(path.join(root, 'vault/Projects/View.base'));
    expect(dependencies).toContain(path.join(root, 'vault/.obsidian/appearance.json'));
  });
  it('loads real Obsidian theme CSS, enabled snippets, publish.css and configured CSS in order and copies local URLs', async () => {
    const { root, put } = await fixture({ css: ['./extra.css'], bodyClasses: ['is-published'] });
