// @vitest-environment node
import { readFile, access } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('GitHub README',()=>{
  it('keeps template setup prominent and links only to existing project guides/assets',async()=>{
    const markdown=await readFile('README.md','utf8');
    expect(markdown).toContain('https://github.com/jgx0/lattice/generate');
    expect(markdown).toContain('Use this template → Create a new repository');
    expect(markdown).toContain('git clone https://github.com/YOUR-USERNAME/my-lattice.git');
    expect(markdown).toContain('"vault": "./my-vault"');
    expect(markdown).toContain('### 4. Run');
    const local=[...markdown.matchAll(/\]\(([^)]+)\)/g)].map(match=>match[1]).filter(url=>!url.startsWith('#')&&!/^[a-z]+:\/\//i.test(url));
    for(const url of local)await access(decodeURIComponent(url.split('#')[0]));
    const dom=new JSDOM(markdown);
    for(const image of dom.window.document.querySelectorAll('img[src]'))await access(image.getAttribute('src')!);
    expect(markdown).not.toMatch(/https?:\/\/(?:localhost|127\.0\.0\.1)(?:[/:][^\s]*)?\)/);
    expect(markdown).toContain('is not affiliated with or endorsed by Obsidian');
    expect(markdown).toContain('no blanket open-source license grant');
    dom.window.close();
  });
});
