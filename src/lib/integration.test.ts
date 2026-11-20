// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoVault, defaultSettings } from '../demo';
import { buildNotes, resolveNote } from './model';
import { renderMarkdown, renderPreview } from './render';

const notes = buildNotes(demoVault.files);
describe('shared demo integration', () => {
  it('keeps Lattice product-focused with minimal maintainer information and linked documentation', () => {
    const maintainer = notes.find(note => note.path === 'About/Maintainer.md')!;
    expect(maintainer.title).toBe('Maintainer');
    expect(maintainer.body.trim()).toBe('Lattice is maintained by [jgx0](https://github.com/jgx0).\n\nSee [[About/Documentation|Documentation]] for the product guide and [[About/Contributing|Contributing]] for development and contribution guidelines.');
    expect(maintainer.body.match(/https?:\/\/[^)\s]+/g)).toEqual(['https://github.com/jgx0']);
    expect(maintainer.body).not.toMatch(/workplace|occupation|location|email|student|entrepreneur|East Coast|Find me|mailto:/i);
    expect(demoVault.name).toBe('Lattice demo vault');
    expect(defaultSettings.title).toBe('Lattice');
    expect(defaultSettings.description).toBe('Publish connected Obsidian notes with a static, note-native reader.');
    const welcome = notes.find(note => note.path === 'Welcome.md')!;
    expect(welcome.title).toBe('Welcome to Lattice');
    expect(welcome.links).toContain('Features');
    const features = notes.find(note => note.path === 'Features.md')!;
    expect(features.title).toBe('Features');
    expect(features.headings.some(heading => heading.level === 1)).toBe(false);
    expect(features.links).toEqual(expect.arrayContaining(['About/Quick start', 'About/Obsidian themes', 'About/Markdown and Bases', 'About/Deployment', 'About/Security and privacy']));
    expect(welcome.headings.some(heading => heading.id === 'follow-a-thread')).toBe(true);
    expect(welcome.body).toContain('Sample notes are illustrative fixtures');
    expect(welcome.body).not.toMatch(/maintainer|profile|biograph|jgx0|my website|contact details/i);
    const publicFixture = demoVault.files.map(file => `${file.path}\n${file.content}`).join('\n');
    expect(publicFixture).not.toMatch(/\bAlex\b|\bMorgan\b|private notebook, October|Jacob Goldstein|Probix|tryprobix|jacobg\.co|mailto:|me@/i);
    const hub = notes.find(note => note.path === 'About/Documentation.md')!;
    expect(hub.body).not.toMatch(/personal profile|biograph|real identity|About\/Maintainer|About\/Jacob/);
    for (const title of ['Quick start', 'Configuration', 'Obsidian themes', 'Markdown and Bases', 'Deployment', 'Architecture', 'Security and privacy', 'Troubleshooting', 'Contributing']) {
      const page = notes.find(note => note.path === `About/${title}.md`)!;
      expect(page, title).toBeDefined();
      expect(page.title).toBe(title);
      expect(page.headings.some(heading => heading.level === 1), title).toBe(false);
      expect(hub.links).toContain(`About/${title}`);
    }
    const essay = notes.find(note => note.path === 'Essays/Against the finished thought.md')!;
    expect(essay.properties.author).toBeUndefined();
    expect(essay.properties.provenance).toBe('Demo content');
    expect(essay.body).toContain('— Demo note');
    const patternLanguage = notes.find(note => note.path === 'Library/Books/A Pattern Language.md')!;
    expect(patternLanguage.properties.author).toContain('Christopher Alexander');
    expect(patternLanguage.properties.contributors).toContain('Max Jacobson');
  });
  it('keeps the homepage, project overview, docs, and SVG fixture synchronized with the filesystem vault', () => {
    const paths = ['Welcome.md', 'Features.md', 'Projects/Lattice.md', 'Atlas/Maps of meaning.md', 'Assets/Garden diagram.svg',
      ...notes.filter(note => note.path.startsWith('About/')).map(note => note.path)];
    for (const path of paths) {
      const fixture = demoVault.files.find(file => file.path === path)!;
      const source = readFileSync(resolve(process.cwd(), 'vault', path), 'utf8');
      expect(fixture.content.trim(), path).toBe(source.trim());
    }
  });
  it('guides personal sites through the template and contributors through a fork', () => {
    const quickStart = notes.find(note => note.path === 'About/Quick start.md')!;
    expect(quickStart.body).toContain('https://github.com/jgx0/lattice/generate');
    expect(quickStart.body).toContain('Use this template → Create a new repository');
    expect(quickStart.body).toContain('git clone https://github.com/YOUR-USERNAME/my-lattice.git');
    expect(quickStart.body).not.toContain('git clone https://github.com/jgx0/lattice.git');
    expect(quickStart.body).toContain('my-vault/');
    expect(quickStart.body).toContain('.gitignore');
    expect(quickStart.body).toContain('A private GitHub repository does not make the resulting website private');
    const contributing = notes.find(note => note.path === 'About/Contributing.md')!;
    expect(contributing.body).toContain('does **not** create a fork relationship');
    expect(contributing.body).toContain('git clone https://github.com/YOUR-USERNAME/lattice.git');
    expect(contributing.body).toContain('compare across forks');
    expect(contributing.body).toContain('git add vault/About/Troubleshooting.md src/demo.ts');
  });
  it('documents deployment from the reader\'s repository or a local build', () => {
    const deployment = notes.find(note => note.path === 'About/Deployment.md')!;
    expect(deployment.headings.map(heading => heading.text)).toEqual(expect.arrayContaining(['Cloudflare Pages', 'Git integration', 'CLI upload', 'Vercel', 'Deploy under a subdirectory']));
    for (const setting of ['wrangler.jsonc', 'name: "lattice"', 'pages_build_output_dir: "./dist"', 'compatibility_date',
      'NODE_VERSION=22', 'NPM_CONFIG_INCLUDE=dev', 'npm ci --include=dev', 'npm run build',
      'npx wrangler pages project create my-lattice', 'npx wrangler pages deploy dist --project-name=my-lattice',
      'vercel.json', 'framework: null', 'cleanUrls: true', 'outputDirectory: "dist"',
      'installCommand: "npm ci --include=dev"', 'buildCommand: "npm run build"', 'public/_headers', 'base: "/"']) {
      expect(deployment.body, setting).toContain(setting);
    }
    expect(deployment.body).toContain('YOUR-USERNAME/my-lattice');
    expect(deployment.body).toContain('https://vercel.com/new');
    expect(deployment.body).not.toContain('repository-url=');
    expect(deployment.body).toContain('your own template-created repository');
    expect(deployment.body).toContain('"vault": "./site-vault"');
    expect(deployment.body).toContain('if your vault is ignored by Git or lives outside the project, build locally');
    expect(deployment.body).toContain('Authentication and confirmation are still required');
    expect(deployment.body).toContain('no hosting account or live deployment is provisioned');
    expect(deployment.body).toContain('Revisit host routing and the path patterns');
    expect(deployment.body).toContain('Disable workflow');
    expect(deployment.body).toContain('some tests expect the demo');
    expect(deployment.body).toContain('Press **Ctrl+C** to stop preview');
  });
  it('renders every note/preview with no broken note links, section embeds or Base errors', () => {
    expect(notes.length).toBeGreaterThanOrEqual(20);
    for (const note of notes) {
      const html = renderMarkdown(note, notes, demoVault.files);
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.querySelector('.embed-missing,.embed-limit,.base-error,.is-unresolved'), note.path).toBeNull();
      for (const heading of note.headings) expect(document.getElementById(heading.id), `${note.path}#${heading.id}`).not.toBeNull();
      expect(renderPreview(note, notes, demoVault.files)).toBeTypeOf('string');
      for (const target of note.links) {
        if (!/\.(?:svg|wav|mp4|base)(?:#|$)/i.test(target)) expect(resolveNote(target, notes, note.path), `${note.path}: ${target}`).toBeDefined();
      }
    }
  });
  it('renders host-relative reading/related Bases and sanitized offline SVG/audio/video', () => {
    const reading = notes.find(note => note.path === 'Library/The reading room.md')!;
    const related = notes.find(note => note.path === 'Field Notes/Digital gardens.md')!;
    const readingDocument = new DOMParser().parseFromString(renderMarkdown(reading, notes, demoVault.files), 'text/html');
    const relatedDocument = new DOMParser().parseFromString(renderMarkdown(related, notes, demoVault.files), 'text/html');
    expect(readingDocument.querySelectorAll('.base-embed tbody tr')).toHaveLength(5);
    expect(relatedDocument.querySelectorAll('.base-embed tbody tr')).toHaveLength(4);
    expect(relatedDocument.querySelector('.base-embed [data-note="Field Notes/Digital gardens.md"]')).toBeNull();
    const guide = notes.find(note => note.path === 'About/Markdown and Bases.md')!;
    const guideDocument = new DOMParser().parseFromString(renderMarkdown(guide, notes, demoVault.files), 'text/html');
    expect(guideDocument.querySelectorAll('.base-view[data-base="Demo bookshelf"] tbody tr')).toHaveLength(5);
    const media = notes.find(note => note.path === 'Atlas/Media cabinet.md')!;
    const mediaDocument = new DOMParser().parseFromString(renderMarkdown(media, notes, demoVault.files), 'text/html');
    expect(mediaDocument.querySelector('img[src^="data:image/svg+xml"]')).not.toBeNull();
    expect(mediaDocument.querySelector('audio[controls][src^="data:audio/"]')).not.toBeNull();
    expect(mediaDocument.querySelector('video[controls][src^="data:video/"]')).not.toBeNull();
    expect(mediaDocument.querySelector('iframe[srcdoc]')).toBeNull();
  });
});
