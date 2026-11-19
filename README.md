<h1 align="center">Lattice</h1>
<p align="center"><strong>Publish connected notes. Keep your Obsidian theme. Own the output.</strong></p>
<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#real-obsidian-themes">Themes</a> ·
  <a href="#production-deployment">Deployment</a> ·
  <a href="vault/About/Documentation.md">Documentation</a> ·
  <a href="https://github.com/jgx0/lattice">GitHub</a>
</p>

Lattice is a filesystem-driven alternative to Obsidian Publish. It compiles Markdown, properties, wikilinks, transclusions, Bases, and theme assets **at build time**. The public browser only handles reading, navigation, previews, graphs, table sorting, and reader preferences.

No vault uploads. No browser-side site builds. No subscription or injected page branding.

## At a glance

|                       |                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------- |
| **Connected reading** | Hover previews, backlinks, heading outlines, local/global graphs, stacked pages.             |
| **Obsidian syntax**   | Wikilinks, aliases, heading/block references, note embeds, callouts, tasks, math, footnotes. |
| **Real themes**       | Original theme CSS, enabled snippets, `publish.css`, fonts and local CSS imports.            |
| **Static publishing** | Individual HTML pages, separate attachments, clean URLs, no-JavaScript content.              |
| **Local workflow**    | Watch the vault during development; deploy only `dist/`.                                     |

## Quick start

**Clone the repo, copy in your vault, tell Lattice where it is, and run. That's it.** Your notes stay Markdown; there is no upload or conversion step.

You'll need Git and **Node.js 22.12 or newer** installed. Node includes npm.

### 1. Clone and install

Open a terminal:

```sh
git clone https://github.com/jgx0/lattice.git
cd lattice
npm ci
```

Run the rest of the commands from this `lattice` folder.

### 2. Put your vault in the project folder

Copy your Obsidian vault into the `lattice` folder using your file manager. In this example, the copied folder is called **`my-vault`**:

```text
lattice/
├── my-vault/               ← your notes and attachments
│   ├── .obsidian/          ← include this for your theme and snippets
│   └── Home.md
├── publish.config.json
└── package.json
```

Leave the included `vault/` demo folder alone. Your own vault goes in a separate folder. Copy the whole vault, including its hidden `.obsidian` folder if you want its theme.

### 3. Point Lattice at your vault

Open **`publish.config.json`** and replace its contents with:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes"
  }
}
```

Change `my-vault` to your folder's name. This is enough to start: Lattice uses sensible defaults and picks a note for the homepage. You can choose a specific homepage later with `site.home`.

### 4. Run

```sh
npm run dev
```

Open **http://localhost:5173**, or the address printed in the terminal. **You're ready to go.** Save a change to a note in your vault and Lattice rebuilds and refreshes the page. Keep the terminal running; press **Ctrl+C** to stop it.

Prefer not to copy your vault? Put its full folder path in `vault` instead. Lattice reads your source notes without moving or rewriting them.

**Just trying it out?** After step 1, run `npm run dev` without changing the config to open the included demo.

**Before pushing or publishing:** keep a personal vault out of Git (add `my-vault/` to `.gitignore`) and review what should be public. Local setup does not publish anything online. See [Security and privacy](vault/About/Security%20and%20privacy.md).

For a longer walkthrough and common setup errors, see [Quick start](vault/About/Quick%20start.md). When you're ready to go online, use the [deployment guide](#production-deployment).

## Optional configuration

The small config above is all you need to start. You can add these settings later to choose a homepage, hide folders, or adjust the reader. For example:

```json
{
  "vault": "/absolute/path/to/Your Vault",
  "base": "/",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "theme": "system",
    "readable": true,
    "showProperties": false,
    "showToc": true,
    "showGraph": true,
    "showBacklinks": true,
    "stacked": false,
    "navigation": ["Notes", "Projects"],
    "hiddenPaths": ["Private", "Templates"]
  }
}
```

Any note can be the homepage. Other notes receive sanitized, URL-encoded slugs. Use a rooted `base`, such as `/notes/`, for subdirectory deployments.

Environment overrides:

```sh
OBSIDIAN_VAULT="/path/to/Your Vault" npm run dev
PUBLISH_CONFIG="/path/to/publish.config.json" npm run build
```

`site.navigation` orders folders and full note paths. `site.navigationFolders` remaps a note's public folder without moving its source:

```json
{
  "site": {
    "navigationFolders": {
      "Research/Methods.md": "Guides/Research"
    }
  }
}
```

See [Configuration](vault/About/Configuration.md) for the full guide.

## Real Obsidian themes

Lattice reads your vault's `.obsidian/appearance.json`:

- `cssTheme` selects `.obsidian/themes/<theme>/theme.css`.
- `enabledCssSnippets` selects `.obsidian/snippets/<snippet>.css`.
- Configured accent, text size, and font preferences are applied.
- The vault's `publish.css` and additional configured CSS are included.

The demo includes the original **Minimal** theme with its license. Set `cssTheme` to `"Minimal"` to try it; the default demo uses the Obsidian-style baseline. You can also override the theme at build time:

```json
{
  "vault": "/path/to/Your Vault",
  "theme": "Minimal",
  "snippets": ["typography", "tables"],
  "css": ["./site-overrides.css"],
  "bodyClasses": ["minimal-style-default", "minimal-tabs-style-default"],
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "theme": "system"
  }
}
```

Top-level `theme` names the community theme or CSS path; `site.theme` selects light, dark, or system mode. Use `theme: "default"` to ignore the vault theme, or `snippets: []` to ignore enabled snippets.

**Let readers change themes without rebuilding:** set `site.allowThemeSwitching` to `true`. Reader settings then offers Default (Obsidian) and installed vault themes. Add a top-level `themes` list to offer only selected themes:

```json
{
  "vault": "./vault",
  "themes": ["Minimal"],
  "site": { "allowThemeSwitching": true }
}
```

The demo enables this picker. Other sites keep it disabled by default. Theme CSS is loaded locally only when selected; common snippets and site overrides stay applied, and choices are saved per browser. A failed load keeps the current theme.

Theme CSS is not replaced with an imitation. The reader uses Obsidian workspace/file-tree/Markdown/callout/popover classes and native CSS variables. Local imports, fonts, and images are collected and rewritten to emitted assets. Remote CSS resources remain remote.

**Compatibility boundary:** Electron/editor-only features, plugin controls, and Style Settings plugin execution cannot run on a static reader. Matching reading styles and native variables work; use `bodyClasses`, snippets, or `publish.css` for theme-specific settings.

See [Obsidian themes](vault/About/Obsidian%20themes.md).

## Markdown, media, and Bases

Supported reading features include internal links and aliases; heading/block anchors; note, heading and block transclusions; YAML properties; collapsible callouts; read-only tasks; footnotes; highlighting; code; and bundled KaTeX LaTeX output. Images, audio, video, inline PDFs, and sanitized HTML/HTTP(S) iframes are supported. Playback depends on browser/codec support.

Wikilinks in YAML properties are links too: scalar values, lists, and nested metadata contribute to backlinks and graphs, and appear as clickable links in the properties panel and Base cells. Aliases and heading/block targets work there as they do in note text.

Bases supports table/list/cards views, properties, configured filters/formulas, sorting and limits. Embedded `this.file` references use the **host note**, including `this.file.properties`. `file.hasLink(...)` and `file.links.contains(this.file)` include property links; `file.hasTag(...)` and safe `toString()` calls are supported. Column headers are sortable in the reader.

This is a **bounded, no-eval compatibility subset**, not all of Obsidian's evolving Bases runtime. Unsupported expressions fail visibly. Plugin execution, Dataview, Canvas editing, Sync, collaboration, hosted accounts, and password-protected hosting are not included.

See [Markdown and Bases](vault/About/Markdown%20and%20Bases.md).

## Production deployment

<p>
  <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages"><img src="docs/assets/cloudflare-pages-button.svg" alt="Set up Cloudflare Pages" height="40" /></a>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjgx0%2Flattice"><img src="docs/assets/vercel-button.svg" alt="Deploy with Vercel" height="40" /></a>
</p>

The Vercel button opens the clone-and-deploy flow for [jgx0/lattice](https://github.com/jgx0/lattice). The Cloudflare button opens Pages setup; select `jgx0/lattice` or your fork. Both require your own account and confirmation. Opening either button does not deploy the site automatically.

```sh
npm ci
npm run check
```

Deploy **only `dist/`**. The builder needs development dependencies; the static site needs no Node runtime, source vault, configuration, or `.obsidian` directory.

- **Netlify:** [`netlify.toml`](netlify.toml) supplies the build/output settings and conservative response headers. Connect the repository yourself; nothing is automatically deployed.
- **Cloudflare Pages:** [`wrangler.jsonc`](wrangler.jsonc) configures the static `dist/` output; [`public/_headers`](public/_headers) adds response headers and hashed-asset caching.
- **Vercel:** [`vercel.json`](vercel.json) selects a static build, installs build dependencies, and publishes `dist/` without an SPA fallback.
- **GitHub Pages:** set `base` to your repository subpath before building, then publish `dist/` using your own Pages deployment workflow. Do not add an SPA rewrite to `index.html`.
- **Self-hosting:** use a static web server with directory-index resolution and a real 404 fallback. Serve HTML with revalidation, and content-hashed assets with long cache lifetimes. Use HTTPS.

### Cloudflare Pages

Use **Workers & Pages → Create → Pages → Connect to Git** and select [`jgx0/lattice`](https://github.com/jgx0/lattice) or your fork. Configure:

| Setting                | Value                                       |
| ---------------------- | ------------------------------------------- |
| Framework preset       | None                                        |
| Build command          | `npm run build`                             |
| Build output directory | `dist`                                      |
| Environment            | `NODE_VERSION=22`, `NPM_CONFIG_INCLUDE=dev` |

The included `wrangler.jsonc` names the Pages project `lattice` and sets `pages_build_output_dir` to `./dist`. Change the project name to one available in your account. The compatibility date is pinned; this static deployment does not require Pages Functions. Review the provider's [Wrangler configuration guidance](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) when moving dashboard settings into the file.

For an already-built site, you can also deploy manually with Wrangler:

```sh
npm ci --include=dev
npm run build
npx wrangler pages project create lattice
npx wrangler pages deploy dist --project-name=lattice
```

Create the project only once; omit that step for an existing Pages project. These commands authenticate with Cloudflare and publish the output when **you** run them. `public/_headers` is copied to `dist/` for Pages. The emitted top-level `404.html` disables a blanket SPA fallback and provides the missing-page document.

### Vercel

Use the Vercel button above, or **Add New → Project → Import Git Repository** and select [`jgx0/lattice`](https://github.com/jgx0/lattice) or your fork. The included `vercel.json` configures:

| Setting          | Value                     |
| ---------------- | ------------------------- |
| Framework preset | Other (`framework: null`) |
| Install command  | `npm ci --include=dev`    |
| Build command    | `npm run build`           |
| Output directory | `dist`                    |

Choose Node.js 22 or newer in the project's settings. `cleanUrls` enables extensionless HTML URLs; generated note-directory indexes remain the route source. There is deliberately **no** catch-all rewrite to `index.html`, so missing pages remain missing. Header rules cover security defaults and content-hashed assets.

You can deploy through the Vercel CLI after pushing or preparing the project:

```sh
npx vercel
npx vercel --prod
```

The first command creates a preview deployment; the second publishes to production. Both require your own authentication and explicit execution. See the provider's [project configuration reference](https://vercel.com/docs/project-configuration/vercel-json).

Provider configuration and cache-header paths assume the default `base: "/"`. Review base paths and headers if hosting under a subdirectory; do not turn the site into an SPA to work around a wrong base.

Each note is a semantic HTML document under its clean URL. Content, navigation, outlines and backlinks exist before JavaScript. Attachments are separate files. The generated `404.html` is an error page, not a redirect to the homepage; configure your host to return **HTTP 404**, not a soft-404/200 response.

Check at least a nested note URL, a heading anchor, an attachment, and a missing URL on the deployed host. Review output for private information. There is no authentication layer: a published site is public.

See [Deployment](vault/About/Deployment.md) and [Security and privacy](vault/About/Security%20and%20privacy.md).

## Project documentation

The documentation lives **inside the demo vault** and is published through the same pipeline as notes:

- [Documentation](vault/About/Documentation.md) — start here.
- [Quick start](vault/About/Quick%20start.md).
- [Configuration](vault/About/Configuration.md).
- [Obsidian themes](vault/About/Obsidian%20themes.md).
- [Markdown and Bases](vault/About/Markdown%20and%20Bases.md).
- [Deployment](vault/About/Deployment.md).
- [Architecture](vault/About/Architecture.md).
- [Security and privacy](vault/About/Security%20and%20privacy.md).
- [Troubleshooting](vault/About/Troubleshooting.md).
- [Contributing](vault/About/Contributing.md).

## Large vaults and build performance

Large vaults no longer repeat a whole-vault scan for every backlink. Lattice builds lookup indexes and the backlink graph once, reuses parsed Markdown for pages and previews, rewrites URLs in the already-sanitized DOM, and prepares the navigation and HTML shell once per build. These optimizations do not skip sanitization or privacy filtering.

A repeatable synthetic benchmark is included:

```sh
npm run benchmark:build -- --notes 1000
```

It creates temporary notes with six links each, headings, tasks, occasional transclusions, and Bases, then reports compilation time, HTML-generation time, and memory. It deletes its temporary vault afterward; your own vault is not modified.

On the development machine, the 300-note benchmark improved from **161 seconds to 2.5 seconds**. The optimized 1,000-note and 3,000-note runs took about **7.6 seconds** and **27.6 seconds** respectively. These measure vault compilation and HTML generation, not the complete Vite bundle or disk-write time; actual results depend on your notes, media, and hardware.

Each static page still includes the full file navigation so it works without JavaScript. That means output size grows quickly with very large vaults: the 3,000-note benchmark generated roughly 1.6 GiB of HTML and used about 939 MiB of process memory. Exclude folders you do not intend to publish rather than building an entire private archive. The live server still recompiles the vault after an edit so transclusions, Bases, and privacy changes stay consistent.

## Safety and verification

Private notes are filtered before rendering, so they cannot enter embeds, Bases rows, previews, search or graph data. Invalid publication metadata fails the build rather than silently publishing a private note. Vault symlinks are skipped, source/output boundaries are checked, and raw vault/config access is blocked by the live server.

The reader receives public note text and properties as part of its search data. Non-literal Obsidian `%% comments %%` are removed and the original raw note file is not included. Literal comments inside code remain visible. Hiding properties in the UI does **not** make those properties private; exclude the note or remove sensitive metadata before publishing.

HTML is sanitized in an isolated DOM. Scripts, event handlers, dangerous URLs and raw `srcdoc` are removed. Frames are sandboxed. Themes and snippets are **trusted author CSS**—only install sources you trust. This is defense in depth, not a security certification or access-control system.

```sh
npm run typecheck
npm test
npm run build
npm audit
```

The included [CI workflow](.github/workflows/verify.yml) verifies tests and build on Node 22 and 24. It does **not** deploy or publish anything. Build/rendering, real-theme assets, privacy rules, static routes, watcher recovery, and reader behavior have regression tests.

## Contributing

Keep changes small and include regressions for rendering, privacy, URLs, or themes. [Report issues](https://github.com/jgx0/lattice/issues) or [submit a pull request](https://github.com/jgx0/lattice/pulls) to `jgx0/lattice`. Run `npm run check` before submitting. Third-party theme licenses remain with their assets. This repository currently makes no blanket open-source license grant for project code; do not infer one from the bundled Minimal theme license.

## Credits

Lattice is independent and is not affiliated with or endorsed by Obsidian. It uses React, Vite, Markdown-it, YAML, DOMPurify, jsdom, KaTeX, and Lucide. The demo's Minimal theme is by kepano; its original license is included. README illustrations are original project assets. AI was used in the development of this project.
