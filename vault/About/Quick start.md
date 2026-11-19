---
title: Quick start
category: documentation
tags: [lattice, documentation, setup]
description: Run Lattice locally, choose an Obsidian vault, and build static output.
---

Start with the project checkout and **Node.js 22.12 or newer**, plus npm. Commands below run from the project root, not from inside your vault.

## Run the included demo

```sh
npm ci
npm run dev
```

Open `http://localhost:5173` or the URL printed by Vite. The scripts bind to `127.0.0.1` by default; `npm start` is an alias for the local development command. The checked-in `vault/` is the source demo; there is no browser upload step. Binding to loopback keeps local testing on your machine rather than exposing the development server to your network.

Edit a note and save it. The development server watches notes, attachments, `.obsidian` appearance/theme/snippet files, `publish.css`, and configuration. A successful compilation refreshes connected readers. A failed edit reports an error and retains the last successful snapshot; fix the reported cause before trusting the preview.

## Select your vault

Edit `publish.config.json` to identify the source directory and an existing public homepage:

```json
{
  "vault": "/absolute/path/to/Your Vault",
  "base": "/",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "theme": "system",
    "showProperties": false,
    "hiddenPaths": ["Private", "Templates"]
  }
}
```

The homepage is a vault-relative note path. A relative `vault` path resolves from the configuration file's directory. Create the homepage in your own vault before starting, and read [[About/Security and privacy]] before selecting a personal notebook.

For a temporary source override:

```sh
OBSIDIAN_VAULT="/absolute/path/to/Your Vault" npm run dev
```

See [[About/Configuration]] for settings and configuration-file overrides.

## Build and inspect

```sh
npm run build
npm run preview
```

Open `http://localhost:4173` or Vite's printed URL. `build` first runs TypeScript checks, then compiles the vault and writes HTML and assets to `dist/`. `preview` serves that existing output for local inspection; it is not a hardened production server.

Follow an internal link, open that note's URL directly, test an attachment, and verify that private material is absent from the output. Deploy **only `dist/`**, as described in [[About/Deployment]].

## Next

Use [[About/Obsidian themes]] to preserve your vault's appearance, [[About/Markdown and Bases]] to check supported syntax, and [[About/Troubleshooting]] if a build or link does not behave as expected.

[[About/Documentation|Documentation index]].
