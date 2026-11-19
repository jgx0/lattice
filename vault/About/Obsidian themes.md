---
title: Obsidian themes
category: documentation
tags: [lattice, documentation, themes]
description: Publish with actual Obsidian theme CSS, enabled snippets, and local assets.
---

Lattice uses **actual installed Obsidian CSS**, not approximations selected from a theme gallery. It reads your vault's `.obsidian/appearance.json` and loads the corresponding files at build time.

## Follow the vault

```json
{
  "cssTheme": "Minimal",
  "enabledCssSnippets": ["typography", "tables"],
  "accentColor": "#8065da",
  "baseFontSize": 18,
  "textFontFamily": "Inter",
  "monospaceFontFamily": "JetBrains Mono"
}
```

This example expects `.obsidian/themes/Minimal/theme.css` and `.obsidian/snippets/typography.css` and `tables.css` to exist. The demo includes the original Minimal theme and its license, but its baseline appearance does not require selecting Minimal. Install and select any other theme in your own Obsidian vault before publishing it.

Fonts named in appearance settings must be available in the browser or supplied through trusted CSS; naming a font does not download it. Text size applies for numeric values from 8 to 72 pixels. A configured site accent takes precedence over the vault accent.

## Override deliberately

In `publish.config.json`:

```json
{
  "vault": "./vault",
  "theme": "Minimal",
  "snippets": [],
  "css": ["./site-overrides.css"],
  "bodyClasses": ["minimal-style-default"],
  "site": { "theme": "system", "showProperties": false }
}
```

Top-level `theme` chooses the community theme; `site.theme` chooses light/dark/system mode. Set top-level `theme` to `"default"` to ignore the vault's selected theme. Omitted `snippets` follows `enabledCssSnippets`; an empty array disables them.

Theme/snippet names resolve inside `.obsidian`. Explicit CSS paths and additional `css` entries resolve beside the configuration file. Files named by explicit settings must exist; unavailable selected themes or snippets fail compilation rather than silently switching styles.

## Loading order and assets

Reader baseline CSS is followed by the compiled theme layer. Within that layer, Lattice loads:

1. The selected community theme.
2. Selected snippets, in their listed order.
3. Optional vault-root `publish.css`.
4. Additional top-level `css` files.
5. Appearance-derived variables and optional `site.customCss`.

Local CSS imports are processed recursively. Supported local fonts and images are emitted with rewritten URLs under the configured deployment base. Import cycles, unsupported asset types, and references outside a file's allowed boundary are build errors. A named theme's assets must stay within that theme directory; a snippet or explicit CSS file's assets stay within its directory. Vault-root `publish.css` can reference allowed assets within the vault, but not hidden assets.

Remote imports and remote `url(...)` references remain remote. The build does not fetch them; readers need connectivity and may contact third-party servers. Only use CSS you trust.

## Matching Obsidian, not running Obsidian

The reader exposes `.theme-light`, `.theme-dark`, workspace/file-tree classes, `.markdown-preview-view`, `.markdown-rendered`, callouts, metadata, and hover-popover classes. Native variables include `--background-primary`, `--text-normal`, `--font-text`, and `--file-line-width`. Homepage `cssclasses` can contribute body classes alongside configured `bodyClasses`.

Obsidian is an Electron application. Plugin-only controls, editing panes, and Style Settings plugin state are not reproduced or executed. Use reviewed snippets, `publish.css`, or body classes for matching reader styles, and test both color modes and narrow screens.

See [[About/Troubleshooting]] for missing CSS and [[About/Security and privacy]] for the trust boundary.

[[About/Documentation|Documentation index]].
