---
title: Configuration
category: documentation
tags: [lattice, documentation, configuration]
description: Vault paths, site options, navigation, themes, and configuration precedence.
---

Lattice reads `publish.config.json` from the project root. Configuration is validated: unknown top-level fields and unknown `site` settings are errors, not silently accepted extensions.

## Source and deployment paths

| Field | Meaning |
| --- | --- |
| `vault` | Source directory; defaults to `./vault`. Relative paths resolve beside the config file. |
| `base` | Rooted public URL pathname; defaults to `/`. Use `/notes/` for a subdirectory deployment. |
| `site.home` | Existing public homepage note, preferably its full vault-relative path. If omitted, the first compiled note is used. |

`base` is a path, not a full domain URL. Query strings, fragments, traversal segments, and protocol-relative paths are rejected. Internal links, theme assets, attachments, and the application bundle share this base. Rebuild when it changes.

```sh
PUBLISH_CONFIG="/absolute/path/to/publish.config.json" npm run build
OBSIDIAN_VAULT="/absolute/path/to/Your Vault" npm run build
```

A relative `PUBLISH_CONFIG` resolves from the project root. `OBSIDIAN_VAULT` overrides `vault`; a relative environment vault path resolves from the project root rather than from the config file.

## Reader settings

| `site` setting | Default | Purpose |
| --- | --- | --- |
| `title` | `Notes` | Site name. |
| `description` | Empty | Fallback HTML description; a note's `description` property takes precedence. |
| `theme` | `system` | Reader color mode: `light`, `dark`, or `system`. Not a community theme name. |
| `accent` | Empty | Optional `#RGB` or `#RRGGBB`; otherwise a valid vault accent can apply. |
| `readable` | `true` | Restrained reading width. |
| `showProperties` | `true` | Display YAML properties; hiding this panel does not make properties private. |
| `showToc` | `true` | Heading outline. |
| `showBacklinks` | `true` | Incoming note links. |
| `showGraph` | `true` | Graph panel. |
| `stacked` | `false` | Horizontal stacked-page reading. |
| `navigation` | `[]` | Order folders and full note paths. |
| `hiddenPaths` | `[]` | Exclude matching vault-relative files or whole folders before rendering. |

The demo deliberately sets `showProperties: false`. Reader controls can change presentation locally; they are not an authoring or access-control interface.

## Navigation is not privacy

`navigation` orders entries; it does not restrict what is published. `navigationFolders` moves a note to another public navigation folder without moving its source:

```json
{
  "site": {
    "navigation": ["About", "Projects", "Notes"],
    "navigationFolders": {
      "Research/Methods.md": "Guides/Research"
    },
    "hiddenPaths": ["Private", "Templates"]
  }
}
```

Paths in `navigation` and `hiddenPaths` must be vault-relative, non-empty, and without `..`. Use full note paths to avoid ambiguous filenames. See [[About/Security and privacy]] for explicit note-level exclusion.

## Appearance inputs

Top-level `theme` selects an installed community theme name or CSS file path. `snippets` selects CSS snippet names or paths; omit it to follow Obsidian, or use `[]` to disable snippets. `css` lists additional CSS paths. `bodyClasses` adds individual class names, without whitespace inside a name.

`site.communityTheme` is a fallback when no explicit theme or vault `cssTheme` is selected. `site.customCss` accepts inline trusted CSS; prefer a versioned `publish.css` or CSS file for maintainability. These are not a plugin runtime.

See [[About/Obsidian themes]] for precedence, assets, and compatibility limits; [[About/Deployment]] covers host paths.

[[About/Documentation|Documentation index]].
