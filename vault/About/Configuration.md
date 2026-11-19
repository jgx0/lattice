---
title: Configuration
category: documentation
tags: [lattice, documentation, configuration]
description: Vault paths, site options, navigation, themes, and configuration precedence.
---

Start with just your vault folder and a site name. Open `publish.config.json` in the `lattice` project folder and use:

```json
{
  "vault": "./my-vault",
  "site": { "title": "My notes" }
}
```

If you copied your vault into `lattice/my-vault/`, that's all you need. Change the folder name to match yours, then run `npm run dev`. You can leave every other setting at its default. See [[About/Quick start]] for the full walkthrough.

The sections below are optional reference material. Lattice reads `publish.config.json` from the project folder; a misspelled setting produces an error so you know it has not taken effect.

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
| `quickSwitcher` | `true` | Command/Ctrl+K file picker; readers can disable it in settings. |
| `allowThemeSwitching` | `false` | Let readers choose included Obsidian themes in settings. |
| `navigation` | `[]` | Order folders and full note paths. |
| `navigationFolders` | Unset | Place notes in custom navigation folders without moving source files. |
| `hiddenPaths` | `[]` | Exclude matching vault-relative files or whole folders before rendering. |
| `communityTheme` | `default` | Fallback CSS theme when no top-level theme or vault selection applies. |
| `customCss` | Empty | Inline trusted CSS applied after other appearance inputs. |

The demo deliberately sets `showProperties: false` and `allowThemeSwitching: true`; these are not the defaults. Saved browser preferences override the corresponding reader defaults, including `quickSwitcher`. Reader controls change presentation, not source notes or access permissions.

Press **Command+K** (macOS) or **Ctrl+K** to open the quick switcher. It searches published file titles, names, paths, and aliases. Use Up/Down and Enter to choose a note; Escape dismisses it. **Reader settings → Quick switcher** turns the popup on or off and remembers the choice locally. With it disabled, the same shortcut focuses sidebar search.

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

Paths in `navigation` and `hiddenPaths` must be vault-relative, non-empty, and without `..`. Use full note filenames, including folders and `.md`, rather than frontmatter titles or published URLs. Unlisted entries remain visible in alphabetical order: folders by name, notes by title. See [[About/Security and privacy]] for explicit note-level exclusion.

Folder expansion/collapse is remembered in this browser for the site, independently of the note being viewed. Rebuilds do not reset it or write it into your vault. Removed or renamed folder paths are discarded, new folders start open, and folding a parent preserves its children's fold choices. Custom navigation folders use their displayed folder paths. If storage is blocked, changes still work for the current session but do not survive a reload. This does not persist the button that hides the entire sidebar.

## Appearance inputs

Top-level `theme` selects `"default"`, `"publish-theme"`, an installed community theme name, or a CSS file path. Omit it to follow the vault's selected theme, falling back to Default (Obsidian). When `site.allowThemeSwitching` is enabled, optional top-level `themes` limits the installed/custom choices; Default, Publish, and the selected site theme always remain available. Omit `themes` to discover installed themes, or use `[]` to disable that discovery. See [[About/Obsidian themes#Let readers switch themes|the theme-picker guide]]. `snippets` selects CSS snippet names or paths; omit it to follow Obsidian, or use `[]` to disable snippets. `css` lists additional CSS paths. `bodyClasses` adds individual class names, without whitespace inside a name.

`site.communityTheme` is a fallback when no explicit theme or vault `cssTheme` is selected. `site.customCss` accepts inline trusted CSS; prefer a versioned `publish.css` or CSS file for maintainability. These are not a plugin runtime.

See [[About/Obsidian themes]] for precedence, assets, and compatibility limits; [[About/Deployment]] covers host paths.

[[About/Documentation|Documentation index]].
