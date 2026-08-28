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

