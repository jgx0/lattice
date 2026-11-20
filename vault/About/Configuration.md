---
title: Configuration
category: documentation
tags: [lattice, documentation, configuration]
description: Vault paths, site options, navigation, themes, and configuration precedence.
---

Make your site feel like your own: choose a name and homepage, arrange a couple of folders, and leave a private folder out of the published site.

Start with [[About/Quick start]] if you have not run Lattice yet. For your own site, the recommended starting point is GitHub's **Use this template → Create a new repository**, then clone your new repository. This walkthrough assumes dependencies are installed and your copied vault is in `my-vault/` beside `publish.config.json`.

## 1. Point at your notes

Open `publish.config.json` in the project folder and replace its contents with:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes"
  }
}
```

Run `npm run dev` from the project folder and open the address printed in the terminal. You should see **My notes** above the file tree, with notes from `my-vault/` rather than the included demo. Keep the terminal running as you follow the steps below; saving changes rebuilds the local site.

`./my-vault` means “the folder called my-vault beside this configuration file.” It should contain your notes directly, not another folder wrapping the vault. If your vault lives elsewhere, use its full folder path instead, such as `/Users/you/Documents/My Vault` on macOS. Lattice reads that folder without moving or rewriting it.

## 2. Choose the page people land on

Create `Home.md` directly inside `my-vault/`, or use an existing public note as your homepage. For a new file, paste:

```markdown
---
title: Home
---

Welcome to my notes. This is where I collect things I want to share.
```

Then add `home` to your configuration:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "home": "Home.md"
  }
}
```

Save both files and click **My notes** in the site's sidebar. You should arrive at **Home**, with your welcome paragraph below it. The page already supplies a title, so there is no need to add another `# Home` heading in the note.

The `home` path starts inside your vault: use `Home.md`, not `my-vault/Home.md`. For a note in a subfolder, use its full filename, such as `Notes/Home.md`. The file needs to exist and be included in the publication. Without `home`, Lattice chooses the first compiled note.

## 3. Put folders in a useful order

In your copied vault, create `Notes/First project.md` and `Projects/Next project.md`. Give each a sentence of text so you have something to open. Add `navigation` inside `site`:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "navigation": ["Projects", "Notes"]
  }
}
```

The **Projects** folder should now appear before **Notes**. Open each folder and click its note. You can also list full note paths to order notes within a folder. Entries you do not list remain visible, sorted alphabetically: folders by name and notes by title. Folders are displayed before loose notes; this is not one mixed list of every sidebar item.

Click a folder name to collapse it, then reload the page. It stays collapsed in your browser. These choices do not change your vault or configuration, and a rebuild does not reset them. New folders start open; if browser storage is blocked, fold choices last only for the current session. Hiding the entire sidebar is a separate control.

To start a folder collapsed for new readers, add `"collapsedFolders": ["Notes"]` inside `site`. Use full displayed folder paths, such as `Library/Books`, for nested folders. This only sets the initial state: saved reader choices take precedence, including choosing to leave every folder open. The demo starts with every folder collapsed except **About**.

## 4. Leave a private folder out

Create a folder named `Private` inside `my-vault/` and put a harmless test note, `Private/Test.md`, in it. Before adding anything personal, extend your configuration:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "navigation": ["Projects", "Notes"],
    "hiddenPaths": ["Private"]
  }
}
```

After saving, **Private** should disappear from the file tree, and searching for the test note should not find it. The folder's notes and attachments are excluded from the build, not merely tucked away in navigation. Removing a folder from `navigation` does not exclude it.

This controls the generated website, not what goes into your Git repository. Follow [[About/Security and privacy]] before pushing personal files or deploying; it also explains how to exclude individual notes.

## 5. Try the reader controls before setting defaults

Open **Reader settings** using the settings icon beneath the file tree. Try **Properties**, **Table of contents**, and **Stacked pages**, then open another note to see the difference. **Properties** appears below the note body when enabled; hiding it does not remove those values from the published data.

Press **Command+K** on macOS or **Ctrl+K** elsewhere to open the quick switcher. Type a note name, use the arrow keys, and press Enter. It searches titles, filenames, paths, and aliases. Turning off **Quick switcher** makes the same shortcut focus sidebar search instead.

When you know which layout you prefer, add the matching defaults inside `site`. For example:

```json
"showProperties": false,
"showToc": true,
"stacked": false
```

These lines are a fragment to add to your existing `site` object, not a replacement configuration. Use commas between settings, with no trailing comma after the last one. Most reading features start enabled; stacked pages and reader theme switching start disabled.

Reader choices saved in your browser take precedence over these defaults. To check what a new visitor will see, open the site in a fresh private window. To reset your regular browser, clear this site's stored data and reload; that also clears folder folds and other saved reader choices.

For colors and the theme picker, continue with [[About/Obsidian themes]]. Color mode (`site.theme`) and the selected Obsidian CSS theme (top-level `theme`) are independent settings.

## Optional: other paths and appearance settings

### Show a note in a different sidebar folder

You can change navigation without moving files. With the sample note from step 3, add this inside `site`:

```json
"navigationFolders": {
  "Notes/First project.md": "Guides/Projects"
}
```

The note appears under **Guides → Projects**, while its source remains `Notes/First project.md` and its published route is unchanged. Use the displayed folder path, `Guides/Projects`, if you want to order that folder with `navigation`.

### Publish beneath a website subfolder

The top-level `base` defaults to `/`. If your website is served beneath a path such as `https://example.com/notes/`, set `"base": "/notes/"` and rebuild. This is the website's path, not its domain or a folder on your computer. [[About/Deployment]] walks through hosting.

### Keep a vault or configuration elsewhere

Paths such as `vault`, an explicit theme CSS path, and entries in `css` are relative to the folder containing `publish.config.json`. Note paths such as `home` and `hiddenPaths` start inside the vault instead. Use `/` between folder names and do not put `..` in navigation or exclusion paths.

For a one-off build, environment variables can select a different configuration or vault:

```sh
PUBLISH_CONFIG="/absolute/path/to/publish.config.json" npm run build
OBSIDIAN_VAULT="/absolute/path/to/Your Vault" npm run build
```

`OBSIDIAN_VAULT` takes precedence over the configured `vault`. Relative paths in these two environment variables start from the project folder where Lattice runs, rather than beside a separately located configuration file.

### A few finishing touches

Add a short `site.description` for the site's default page description, or `site.accent` with a color such as `#8065da`. A note's own `description` overrides the site description, and a configured accent overrides the vault accent. `readable` controls the restrained reading width; `showBacklinks` and `showGraph` control the corresponding page-information sections.

For theme CSS, snippets, `publish.css`, and extra styles, use [[About/Obsidian themes]] rather than changing everything at once. If a setting is misspelled or a required file cannot be found, the terminal reports the problem; [[About/Troubleshooting]] can help.

[[About/Documentation|Back to the documentation index]].
