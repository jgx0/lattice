// @vitest-environment node
import { readFile, access } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('GitHub README',()=>{
  it('keeps clone setup prominent and links only to existing project guides/assets',async()=>{
    const markdown=await readFile('README.md','utf8');
    expect(markdown).toContain('git clone https://github.com/jgx0/lattice.git');
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
