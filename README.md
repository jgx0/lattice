# Lattice

**Your Obsidian vault, published as a website.**

Lattice is an independent alternative to Obsidian Publish. It builds your Markdown notes into a static site with real Obsidian themes, wikilinks, hover previews, backlinks, graphs, and stacked pages. Your vault stays on the build machine; you deploy the generated website.

[Quick start](#quick-start) · [Themes](#themes) · [Deployment](#deployment) · [Documentation](vault/About/Documentation.md) · [Report a bug](https://github.com/jgx0/lattice/issues)

## Quick start

**Clone the repo, put your vault in the folder, point Lattice at it, and run. That's really all you need.**

You'll need Git and **Node.js 22.12 or newer**. Node includes npm.

### 1. Clone and install

```sh
git clone https://github.com/jgx0/lattice.git
cd lattice
npm ci
```

Run the remaining commands from this `lattice` folder.

### 2. Copy in your vault

Use Finder, File Explorer, or your usual file manager to copy your Obsidian vault into the project. For this example, call it **`my-vault`**:

```text
lattice/
├── my-vault/
│   ├── .obsidian/       # your installed themes and snippets
│   ├── Home.md
│   └── Attachments/
├── publish.config.json
└── package.json
```

Copy the whole vault, including the hidden `.obsidian` folder if you want its theme. Leave the included `vault/` demo alone; your own vault goes in a separate folder.

### 3. Point Lattice at the folder

Replace the contents of **`publish.config.json`** with:

```json
{
  "vault": "./my-vault",
  "site": { "title": "My notes" }
}
```

Use your actual folder name instead of `my-vault`. This minimal config is enough. Lattice supplies defaults and picks a note for the homepage. To choose one yourself, add `"home": "Home.md"` inside `site`, using an existing full vault-relative filename—not its frontmatter title or published URL.

### 4. Run

```sh
npm run dev
```

Open **http://localhost:5173**, or the address printed in the terminal. **You're ready to go.** Save an edit in your vault and Lattice rebuilds and refreshes the site. Leave the terminal running while you work; press **Ctrl+C** to stop it.

- **Just trying it?** After step 1, run `npm run dev` without editing the config to see the demo.
- **Don't want to copy the vault?** Set `vault` to its full folder path instead. Lattice does not move or rewrite your notes.
- **Before pushing or publishing:** add a personal vault folder such as `my-vault/` to `.gitignore` and review what should be public. Notes are included unless excluded. [Read the privacy guide](vault/About/Security%20and%20privacy.md).

Local setup does not publish anything to the internet. See [Deployment](#deployment) when you're ready to put the site online.

## What it supports

- **Connected reading:** wikilinks, aliases, heading/block links, note transclusions, hover previews, backlinks, local/global graphs, and horizontally stacked pages.
- **A familiar reader:** collapsible sidebars, a Command/Ctrl+K file quick switcher, search filters, heading outlines, readable line length, light/dark/system modes, and a built-in Publish-style theme.
- **Obsidian content:** properties—including linked property values—callouts, tasks, footnotes, highlighting, code, math, images, audio, video, and inline PDFs.
- **Bases:** embedded `.base` files and fenced `base` blocks, table/list/cards views, host-aware `this.file`, supported link/tag filters, and sortable tables.
- **Static output:** individual HTML pages, separate attachments, clean URLs, useful no-JavaScript content, and a real 404 page.

**Compatibility is not unlimited.** Bases implements a bounded, no-eval subset. Obsidian plugins, Dataview, Canvas editing, Sync, collaboration, hosted accounts, and password protection are not included. Browser media support varies. See [Markdown and Bases](vault/About/Markdown%20and%20Bases.md) for details.

**Quick switcher:** press **Command+K** on macOS or **Ctrl+K** elsewhere to find a note by title, filename, folder path, or alias. Use the arrow keys and Enter to open it, or Escape to close. Turn it off in **Reader settings → Quick switcher**; the preference stays in that browser. When disabled, the shortcut focuses sidebar search instead. Set `site.quickSwitcher` to `false` to start with it disabled.

**Folder navigation:** folder folds are remembered in this browser for this site, including across reloads and rebuilds. They do not change your vault or publication settings; removed or renamed folder paths are discarded. If browser storage is blocked, folds last only for the current session.

## Themes

Lattice can use the actual CSS installed in your vault. It follows `.obsidian/appearance.json`, enabled snippets, and `publish.css`; local CSS imports, fonts, and images are included in the build.

The demo starts with **Default (Obsidian)** and also offers **Publish** and the bundled original **Minimal** theme. To choose Publish for your site, add top-level `"theme": "publish-theme"`; to choose an installed theme, use its name, such as `"theme": "Minimal"`.

Let readers switch themes without rebuilding:

```json
{
  "vault": "./my-vault",
  "themes": ["Minimal", "Things"],
  "site": { "allowThemeSwitching": true }
}
```

Only list themes you have installed. Omit `themes` to discover installed vault themes. Default, Publish, and the selected site theme remain available. The picker is disabled by default; the demo enables it.

Theme choices are saved in this browser; light/dark/system mode is separate. The first paint uses the configured or saved color mode and restores a saved theme from local assets before revealing the page. If startup loading fails or takes more than four seconds, the page uses the site's default theme instead. Without JavaScript, static note content remains readable with that default theme.

Editor-only styles, plugin controls, and Style Settings plugin execution cannot run in a static reader. Use snippets, `publish.css`, and `bodyClasses` for theme-specific adjustments. CSS is trusted input—only use themes you trust.

[Full theme guide](vault/About/Obsidian%20themes.md)

## Configuration

You can add options later; you do not need these to get started:

```json
{
  "vault": "./my-vault",
  "base": "/",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "theme": "system",
    "readable": true,
    "showProperties": true,
    "showToc": true,
    "showGraph": true,
    "showBacklinks": true,
    "stacked": false,
    "hiddenPaths": ["Private", "Templates"]
  }
}
```

`site.theme` means light, dark, or system. Top-level `theme` selects the CSS theme. Use `base: "/notes/"` for a subdirectory deployment. Folder/note ordering, custom navigation folders, CSS overrides, and environment overrides are covered in [Configuration](vault/About/Configuration.md).

## Deployment

<p>
  <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages"><img src="docs/assets/cloudflare-pages-button.svg" alt="Set up Cloudflare Pages" height="40" /></a>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjgx0%2Flattice"><img src="docs/assets/vercel-button.svg" alt="Deploy with Vercel" height="40" /></a>
</p>

The Vercel button opens setup for [jgx0/lattice](https://github.com/jgx0/lattice). The Cloudflare button opens Pages setup; select this repository or your fork. **Both require your own account and confirmation.** Opening either button does not deploy automatically.

Build and inspect locally:

```sh
npm run build
npm run preview
```

Deploy **only `dist/`**, not the checkout or source vault. Production builders need development dependencies (`npm ci --include=dev`). The finished website needs no Node runtime or source files. Vite development/preview servers are local tools, not production web servers.

| Host                 | Included configuration                                                   | Setup                                                                                                               |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Pages** | [`wrangler.jsonc`](wrangler.jsonc), [`public/_headers`](public/_headers) | Framework None; build `npm run build`; output `dist`; Node 22 with `NPM_CONFIG_INCLUDE=dev`.                        |
| **Vercel**           | [`vercel.json`](vercel.json)                                             | Import the repository or use the button; static preset, development dependencies, and `dist` output are configured. |
| **Netlify**          | [`netlify.toml`](netlify.toml)                                           | Connect the repository; build/output and conservative headers are configured.                                       |
| **GitHub Pages**     | Your own Pages workflow                                                  | Set `base` to `/lattice/` for a project site before building; publish `dist`.                                       |

For an existing Cloudflare Pages project, manual upload is also possible:

```sh
npm ci --include=dev
npm run build
npx wrangler pages deploy dist --project-name=lattice
```

Create the project once in your account first (dashboard or `npx wrangler pages project create lattice`). Choose Git integration or direct uploads deliberately. CLI commands authenticate and deploy when **you** run them.

The checked-in host header paths assume `base: "/"`. Review routing and headers for subdirectory deployments. **Do not add a catch-all SPA rewrite to `index.html`.** Serve the generated `404.html` with HTTP 404, and test a nested note, an attachment, a heading anchor, and a missing URL after deployment.

[Detailed deployment guide](vault/About/Deployment.md)

## Privacy

A deployed Lattice site is public unless your host restricts access. **Every surviving note is published in full**, even if it is not linked from the homepage. Exclude private folders with `hiddenPaths` or mark a note with unquoted `publish: false` or `private: true`. Filtering happens before rendering, so excluded notes cannot enter transclusions, Bases, previews, search, or graphs. Invalid publication metadata fails the build.

Public note text and properties are included in reader/search data. **Hiding properties in the UI does not make them private.** Non-literal Obsidian comments are removed; literal `%%` examples in code remain visible. Review your output before publishing and replace old deployments so newly excluded pages do not survive as stale files.

HTML is sanitized; dangerous URLs, scripts, and event handlers are removed. Vault/config source access is blocked in the live server. These are safeguards, not a security certification or an authentication system.

[Security and privacy guide](vault/About/Security%20and%20privacy.md)

## Documentation and troubleshooting

The guides live in the demo vault and are published by the same pipeline:

[Documentation index](vault/About/Documentation.md) · [Quick start](vault/About/Quick%20start.md) · [Configuration](vault/About/Configuration.md) · [Themes](vault/About/Obsidian%20themes.md) · [Markdown and Bases](vault/About/Markdown%20and%20Bases.md) · [Deployment](vault/About/Deployment.md) · [Architecture](vault/About/Architecture.md) · [Troubleshooting](vault/About/Troubleshooting.md)

If setup fails, start with the filename and message in the terminal. Check that `vault` points to the folder containing your notes, and remove or correct a `home` setting that names a missing note.

## Build performance

Lattice indexes links/backlinks once, reuses parsed Markdown, and prepares navigation/page shells once per build. A synthetic 300-note benchmark improved from 161 seconds to about 2.5 seconds; optimized 1,000-note and 3,000-note runs took about 7.6 and 27.6 seconds. These measure compilation and HTML generation, not bundling/disk writes, and are not guarantees for your vault.

```sh
npm run benchmark:build -- --notes 1000
```

The benchmark uses temporary synthetic notes and does not change your vault. Very large builds still need memory and disk space: every static page includes navigation for no-JavaScript reading. [More about the architecture](vault/About/Architecture.md)

## Contributing

[Open an issue](https://github.com/jgx0/lattice/issues) or [submit a pull request](https://github.com/jgx0/lattice/pulls). Keep changes focused, include regression tests, and run:

```sh
npm run check
npm audit
```

The [CI workflow](.github/workflows/verify.yml) checks Node 22 and 24; it does not deploy. [Contribution guide](vault/About/Contributing.md)

## Credits and licensing

Lattice is maintained by [jgx0](https://github.com/jgx0) and is not affiliated with or endorsed by Obsidian. It uses React, Vite, Markdown-it, YAML, DOMPurify, jsdom, KaTeX, and Lucide. The bundled Minimal theme is by kepano and retains its original license. AI was used in development.

This repository currently makes no blanket open-source license grant for project code. Do not infer one from third-party theme licenses.
