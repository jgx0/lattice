---
title: Troubleshooting
category: documentation
tags: [lattice, documentation, troubleshooting]
description: Find a symptom, try a concrete fix, and get your site working again.
---

Find the symptom below and try its fix. Run npm commands from the project folder containing `package.json`, not from inside your vault.

## “npm: command not found”

Install **Node.js 22.12 or newer**, which includes npm, then close and reopen your terminal. Run `node --version` and `npm --version`; both should print a version.

In the project folder, run `npm ci --include=dev`, then `npm run dev`. The local site should start. If `vite` or `tsc` was missing, installing the development dependencies fixes that too. See [[About/Quick start]] for the full setup.

## “Folder not found” or “Cannot load publish configuration”

Open the project's `publish.config.json`. Set `vault` to the **actual folder containing your notes**, for example `"vault": "./my-vault"` when `my-vault` sits beside that configuration file.

If a copied folder contains another folder that holds the notes, point at the inner folder—not its wrapper. Relative vault paths start beside the configuration file; you can also use a full folder path.

If you previously set `OBSIDIAN_VAULT` or `PUBLISH_CONFIG`, remove the unwanted override from your terminal environment (`unset OBSIDIAN_VAULT PUBLISH_CONFIG` in bash/zsh). Then run `npm run dev` again. Your chosen vault should appear.

## “Configured home note is missing or private”

Remove the optional `home` entry from `site` to let Lattice choose a public note, or set it to an existing public filename such as `"home": "Home.md"` or `"home": "Notes/Home.md"`.

Use the vault-relative file path, not the displayed title or website URL. Keep private notes excluded. Save the configuration; the site should open with a valid homepage. If there are no published notes at all, add a public note or select the correct vault folder.

## A build stops on frontmatter, a setting, or a route collision

For an unknown setting, remove it or use a supported option from [[About/Configuration]]. For frontmatter errors, close the YAML block with `---` and use unquoted booleans such as `private: true` or `publish: false`; keep the intended exclusion.

For a route collision, rename one of the conflicting note files and update its incoming links. Run `npm run build` again. It should finish and write `dist/`.

## A link or embed says it is missing

Change the target to its full vault-relative path, especially if two notes share a filename. Check the heading text or `^block-id` when linking to a section. After renaming a file, update the links pointing to it.

Excluded notes cannot be linked or embedded on the public site; remove that reference or link to a public alternative. For an “embed recursion limit” message, replace the repeating whole-note embed with a direct link or a smaller section. Save the note; the corrected target should resolve. See [[About/Markdown and Bases]].

## A Base is empty

Temporarily remove its filters and use a `table` view with `order: [file.name]`. Public notes should appear. Add the filters back one at a time to find which condition removes the rows.

Check property spelling and YAML types: `rating: 5` is a number, while `rating: "5"` is text; a list is different from a single string. Check folder paths and the properties of the **host Markdown note**: `this.file` means that note, not the `.base` file.

If sorting by `file.mtime` changed after copying or cloning, use an explicit frontmatter date property for stable ordering. The filesystem timestamp is not your note's `date` property.

## An inline Base appears as code, or says “Unable to render Base”

For an inline view, change the opening fence from `yaml` to `base`:

````markdown
```base
views:
  - type: table
    order: [file.name]
```
````

Save the note; this should display a table of public notes. For an embedded file, use `![[Data/Reading.base]]` (the demo's example) or replace that path with your own Base.

For a render error, start with the table above and add expressions back gradually. `file.hasLink(this.file)` **is supported** for finding notes that link to the host. Replace other unsupported functions with simpler supported filters; use `table`, `list`, or `cards` views and remove circular formulas. [[About/Markdown and Bases]] lists supported expressions.

## Dark mode or the theme ignores my configuration

Open **Reader settings** and choose the color mode you want. If the Obsidian theme picker is available, choose the theme there too. Saved browser choices take precedence over the site's defaults and should survive a reload.

To try the configured defaults without changing your saved choices, open the site in a fresh private window. To reset saved choices, clear this site's browser storage; this also resets other reader preferences.

If a saved theme cannot load at startup, the page uses the site's default theme after a failed request or at most four seconds. Re-upload the complete build, including `_theme/`, then select the desired theme again. A failed switch in Reader settings keeps the current theme.

## Theme CSS fails to build, or plugin styling is missing

Check that `.obsidian/appearance.json` is valid JSON and that the selected `theme.css` and enabled snippet files exist. Top-level `theme` selects a theme; `site.theme` must be `light`, `dark`, or `system`.

To isolate the problem, temporarily set top-level `"theme": "default"`, `"themes": []`, and `"snippets": []`. If the error names extra CSS or a local import, fix that file path too. Rebuild; then restore one style at a time.

Plugin controls and Style Settings state do not run on the website. Use a snippet or vault-root `publish.css` for the reader styling you need. [[About/Obsidian themes]] explains the options.

## Folder folds reset or seem different on another visit

Fold a sidebar folder, then reload. It should stay folded in the same browser when storage is allowed. Removed or renamed folders lose their old fold state; new folders start open.

The folder preference key includes the homepage URL and source filename. Changing `base` or `site.home` starts a separate set of folds. Fold the folders again for the new site location; this does not change your notes. If all preferences reset on reload, allow site storage or use a normal window instead of a private session.

## Saved changes do not appear

**Using `npm run preview`?** Stop it with Ctrl+C, run `npm run build`, then `npm run preview` again. Preview serves the previous `dist/` and does not watch edits. Use `npm run dev` while writing notes.

**Using `npm run dev`?** Save in the vault selected by `publish.config.json`. If an error overlay appears, fix the named file or setting and save again; Lattice keeps the last working page until the edit succeeds. After changing `base`, restart the server and open the new base URL.

**Already deployed?** Upload the new build or trigger your host's deployment. A local save alone does not update the public site.

## A font, image, or video is missing

Open the resource URL directly. For a local attachment, correct its path and rebuild; upload all of `dist/`, including `_assets/` and `_theme/`. The resource should load at its generated URL.

Remote fonts, CSS imports, and media stay remote; they are not downloaded into the build. Check that their HTTPS URLs work and that your browser or host policy allows them, or replace them with local files. A font name alone does not supply the font.

If audio or video loads but will not play, try a browser-supported encoding and keep playback controls visible. If seeking fails only after deployment, use a static host that supports byte-range media requests. Provide a download link or text alternative where useful.

## The homepage works, but a direct note URL fails

Set `base` to the hosting path: `"/"` for a domain root or, for example, `"/notes/"` for a subdirectory. Rebuild and mount the **contents** of `dist/` there; `base` does not create an extra `notes/` output folder.

Configure the host to serve each note directory's `index.html`. Remove any blanket SPA rewrite to the homepage, and configure `404.html` for missing URLs with a 404 status. A direct note URL should open that note; an invented URL should show the missing-page page, not the homepage.

If renamed or excluded pages still open, replace the old deployment rather than leaving its files alongside the new build. See [[About/Deployment]] for host-specific steps.

## Still stuck?

[Open an issue](https://github.com/jgx0/lattice/issues) with the command, Node/npm versions, exact error, expected result, and a small non-sensitive note, Base, or CSS example. Leave out private vaults and secrets. [[About/Contributing]] explains how to propose a fix.

[[About/Documentation|Documentation index]].
