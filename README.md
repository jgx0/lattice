# Obsidian vault publishing

A filesystem-driven static site generator with an Obsidian-style reader. Markdown, properties, links, transclusions, Bases, search metadata and theme assets are compiled **on the server at build time**. The public browser only handles navigation, hover previews, graph interactions, sorting and reader preferences.

## Run

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The live server watches notes, attachments, `.obsidian` appearance/theme/snippet files, `publish.css`, and configuration. A successful edit recompiles the vault and refreshes connected readers. If an edit fails compilation, the server reports it and retains the last successful snapshot.

```sh
npm run build    # Compile the vault and write deployable HTML/assets to dist/
npm run preview  # Serve the production output at http://localhost:4173
```

Deploy `dist/` to any static host. Each published note has its own semantic HTML file under its clean URL, so note content, navigation, outlines and backlinks are present before JavaScript runs. Attachments are separate files; no upload or browser ZIP generation is involved.

## Your vault

Edit `publish.config.json`:

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

The checked-in `vault/` is a filesystem demo vault, not a browser-bundled upload. Any note can be the homepage. Other notes get sanitized, URL-encoded slugs. Set `base` to `/notes/` when deploying under a subdirectory.

Environment overrides are supported:

```sh
OBSIDIAN_VAULT="/path/to/Your Vault" npm run dev
PUBLISH_CONFIG="/path/to/publish.config.json" npm run build
```

`site.navigation` orders folders and full note paths. `site.navigationFolders` can map a note path to a different public folder without moving the source file:

```json
{
  "site": {
    "navigationFolders": {
      "Research/Methods.md": "Guides/Research"
    }
  }
}
```

## Real Obsidian themes

The generator reads the vault's `.obsidian/appearance.json`:

- `cssTheme` selects `.obsidian/themes/<theme>/theme.css`.
- `enabledCssSnippets` selects `.obsidian/snippets/<snippet>.css`.
- `accentColor`, text/monospace fonts and text size are applied when configured.
- The vault's `publish.css` is loaded afterward.

Use the actual theme installed in Obsidian—there is no imitation-theme selector. The demo vault includes the original **Minimal** theme and its license, verified against the reader; the default appearance remains Obsidian's baseline. Set `cssTheme` to `"Minimal"` in the demo's `.obsidian/appearance.json`, or override the selected theme in build configuration:

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

Top-level `theme` is a community theme name or a CSS file path; `site.theme` is the reader's light/dark/system color mode. Set top-level `theme` to `"default"` to ignore a vault theme, or `snippets` to `[]` to ignore enabled vault snippets. Additional CSS paths are relative to the config file. Relative CSS imports, fonts and images are collected at build time and their URLs are rewritten to emitted assets. Remote CSS URLs remain remote and need connectivity.

The reader uses Obsidian's `.theme-light`/`.theme-dark`, workspace, file tree, `.markdown-preview-view`, `.markdown-rendered`, callout, metadata and hover-popover classes, plus native CSS variables such as `--background-primary`, `--text-normal`, `--font-text`, `--file-line-width` and `--h1-size`. Baseline rules have low specificity and theme CSS loads afterward. No author names, reading times, maturity labels, product attribution or decorative page footers are injected.

**Compatibility limit:** Obsidian is an Electron application. Themes that style plugin-only controls, editing panes or Style Settings plugin state cannot reproduce those features on a published page. Their reader CSS and native variables work where matching elements exist. Use snippets, `publish.css`, or `bodyClasses` for theme-specific settings; theme plugins are not executed.

## Reader features

- Collapsible nested file navigation, inline global search, clean note URLs and browser back/forward navigation.
- Hover previews, backlinks, automatically generated outlines, local/global graphs, and horizontal stacked pages.
- Wikilinks and aliases, Markdown links, heading/block anchors, and note/heading/block transclusions.
- YAML properties, native-style callouts, disabled tasks, footnotes, highlighting, fenced code and bundled LaTeX output.
- Images, audio, video, inline PDFs and sanitized HTML/iframes. Native playback depends on browser support.
- `.base` embeds with table/list/cards views, filters/formulas, configured sort/limits and clickable column sorting.
- Bases `this.file` context uses the host note, including `this.file.properties`, for related-note filters.

Bases implements a bounded, no-eval expression subset, not Obsidian's entire evolving runtime. Unsupported expressions fail visibly. Plugin execution, Dataview, Canvas editing, Sync, collaboration, account services and password-protected hosting are not included.

## Privacy and safety

Notes under `hiddenPaths` and notes with frontmatter `publish: false` are filtered **before rendering**, so they cannot enter transclusions, Bases rows, previews, search or graph data. Assets and `.obsidian` source files are not blindly copied into the output. Symlinked vault files/directories are skipped; filesystem and CSS import boundaries are checked.

HTML is sanitized at compilation with a window-bound DOMPurify instance. Scripts, handlers, dangerous URLs and raw `srcdoc` are removed. External frames are sandboxed; generated PDF frames retain restrictive sandboxing. CSS files are trusted author input: only use themes/snippets you trust.

The vault is read locally. Neither the build nor live server uploads it. A publicly deployed site is public; review output and source embeds before deployment.

## Verification

```sh
npm test
npm run build
npm audit
```

Tests cover rendering/link/search/Bases behavior, true Node compilation without browser globals, themes/CSS assets, privacy filtering, static clean-route HTML, preview serving, live-watcher error recovery and React reader interactions.

## Code structure

- `build/config.ts`: validated build configuration.
- `build/compile.ts`: filesystem vault loading, theme ingestion and rendering.
- `build/vaultPlugin.ts`: virtual compiled-site module, live watching and output emission.
- `build/staticPages.ts`: semantic no-JavaScript note pages.
- `src/App.tsx`: public reader; no source-vault processing.
- `src/SidebarTree.tsx`, `src/GraphView.tsx`, `src/MarkdownContent.tsx`: reader components.
- `src/lib/`: build-time note model, safe Markdown/Bases rendering and client-only search.

Independent project; not affiliated with Obsidian.
