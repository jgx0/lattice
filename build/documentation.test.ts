// @vitest-environment node
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { compileVault } from './compile';

const markdown = new MarkdownIt();
const roots: string[] = [];
const oldEnv = {
  OBSIDIAN_VAULT: process.env.OBSIDIAN_VAULT,
  PUBLISH_CONFIG: process.env.PUBLISH_CONFIG,
};
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  for (const key of ['OBSIDIAN_VAULT', 'PUBLISH_CONFIG'] as const) {
    if (oldEnv[key] === undefined) delete process.env[key];
    else process.env[key] = oldEnv[key];
  }
});
async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'lattice-tutorial-')));
  roots.push(root);
  delete process.env.OBSIDIAN_VAULT;
  delete process.env.PUBLISH_CONFIG;
  const put = async (relative: string, content: string) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  return { root, put };
}
async function examples(file: string) {
  return markdown.parse(await readFile(file, 'utf8'), {}).filter(token => token.type === 'fence');
}

describe('copyable documentation examples', () => {
  it('accepts every complete publish configuration in the setup and appearance guides', async () => {
    const { root, put } = await fixture();
    await put('my-vault/Home.md', 'Welcome to my notes.');
    await put('site-vault/Home.md', 'Welcome to my published notes.');
    const guides = ['README.md', ...['Quick start', 'Configuration', 'Obsidian themes', 'Security and privacy', 'Deployment'].map(name => `vault/About/${name}.md`)];
    let checked = 0;
    for (const guide of guides) {
      for (const token of await examples(guide)) {
        if (token.info.trim() !== 'json' || !token.content.trim().startsWith('{')) continue;
        const value = JSON.parse(token.content);
        if (!value.vault) continue;
        await put('publish.config.json', token.content);
        const config = await loadConfig(root);
        expect(config.vaultPath, guide).toBe(path.resolve(root, value.vault));
        expect(config.settings.title, guide).toBe(value.site.title);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('compiles the tutorial notes, property links, transclusions, and host-relative inline Bases', async () => {
    const { root, put } = await fixture();
    const tokens = await examples('vault/About/Markdown and Bases.md');
    const sample = (needle: string) => {
      const token = tokens.find(candidate => candidate.content.includes(needle));
      expect(token, needle).toBeDefined();
      return token!.content;
    };
    const first = sample('title: My first note');
    const properties = sample('category: "[[Notes/Another note]]"');
    await put('my-vault/Notes/My first note.md', first.replace(/\n---\n/, `\n${properties}---\n`) + '\n' + sample('> [!tip] Start small') + '\n' + sample('name: Notes linking here'));
    await put('my-vault/Notes/Another note.md', sample('title: Another note') + '\n' + sample('## A section to revisit') + '\n' + sample('name: My notes'));
    const quickStart = await examples('vault/About/Quick start.md');
    await put('publish.config.json', quickStart.find(token => token.info === 'json')!.content);
    const { site } = await compileVault(await loadConfig(root));
    expect(site.notes).toHaveLength(2);
    const firstPage = site.notes.find(note => note.path === 'Notes/My first note.md')!;
    const anotherPage = site.notes.find(note => note.path === 'Notes/Another note.md')!;
    expect(firstPage.backlinks).toContain(anotherPage.path);
    expect(anotherPage.backlinks).toContain(firstPage.path);
    for (const note of site.notes) {
      const dom = new JSDOM(note.html);
      expect(dom.window.document.querySelector('.base-error,.embed-missing,.embed-limit,.is-unresolved'), note.path).toBeNull();
      const viewName = note === firstPage ? 'Notes linking here' : 'My notes';
      expect(dom.window.document.querySelectorAll(`.base-view[data-base="${viewName}"] tbody tr`)).toHaveLength(note === firstPage ? 1 : 2);
      dom.window.close();
    }
    expect(firstPage.propertyHtml?.category).toContain('data-note="Notes/Another note.md"');
  });

  it('excludes the private test folder using the configuration tutorial', async () => {
    const { root, put } = await fixture();
    const tokens = await examples('vault/About/Configuration.md');
    await put('publish.config.json', tokens.find(token => token.info === 'json' && token.content.includes('"hiddenPaths"'))!.content);
    await put('my-vault/Home.md', 'Welcome to my notes.');
    await put('my-vault/Notes/First project.md', 'A first project.');
    await put('my-vault/Projects/Next project.md', 'A next project.');
    await put('my-vault/Private/Test.md', 'A harmless private test note.');
    const { site } = await compileVault(await loadConfig(root));
    expect(site.notes.map(note => note.path).sort()).toEqual(['Home.md', 'Notes/First project.md', 'Projects/Next project.md']);
    expect(JSON.stringify(site)).not.toContain('A harmless private test note');
  });
});
