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

