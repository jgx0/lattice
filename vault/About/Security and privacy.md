---
title: Security and privacy
category: documentation
tags: [lattice, documentation, privacy]
description: Choose which notes to share, keep personal files out of GitHub, and check your public site.
---

Before putting your site online, decide which notes you're happy for anyone to read. Lattice publishes **every note it finds unless you exclude it**—not just the notes linked from the homepage.

A private GitHub repository can protect your source files, but it doesn't make the hosted website private. Lattice itself has no login or password gate.

## 1. Choose a publishing workflow

If your vault contains personal notes, the easiest starting point is to leave it on your computer and build locally. Add its copied folder, for example `my-vault/`, to the project's `.gitignore`. This prevents new files in that folder from being committed to GitHub.

For automatic cloud builds, make a smaller folder such as `site-vault/` containing only notes and assets you want to publish. Point Lattice at that folder and commit it to **your own repository**.

Adding a folder to `.gitignore` does not remove files already committed or erase earlier history. If you're not sure whether a vault is tracked, check `git status` and the repository's file list before pushing.

## 2. Exclude a private folder

Suppose your vault has a `Private/` folder. Add `hiddenPaths` inside `site` in `publish.config.json`:

```json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "hiddenPaths": ["Private", "Templates"]
  }
}
```

Both folders are left out of the site. You can also exclude a single note by its path, such as `People/Contact details.md`.

These paths are relative to the vault, not to the project folder. Keep your other settings when adding this option; the example is a complete minimal configuration.

## 3. Exclude a single note

Add this at the very start of the note:

```yaml
---
publish: false
---
```

If the note already has frontmatter, add `publish: false` inside the existing block instead of creating a second one. `private: true` works too. Use real booleans without quotation marks.

Rebuild and try opening the note's URL. An excluded note won't appear in search, graphs, backlinks, Bases, or note transclusions. If a privacy setting is malformed, Lattice stops the build and names the problem rather than publishing with the setting ignored.

## 4. Check the public version

```sh
npm run build
npm run preview
```

Open **http://localhost:4173** and read the site as a visitor. Check a few notes, links, attachments, and properties.

Remember:

- **Collapsed folders are still public.** Folding navigation only changes the reader's view.
- **Hidden properties are still public.** `showProperties: false` hides the panel, not the metadata in public search data.
- **Copied text is still copied text.** Excluding a private note doesn't remove a quotation you've pasted into another public note.
- **Comments in code examples are visible.** Ordinary Obsidian `%% comments %%` are omitted, but literal examples inside code remain.

The generated site includes public note text, properties, HTML, previews, and referenced assets. It doesn't need your original complete Markdown files or private vault files on the host. Only deploy `dist/`.

Files you deliberately put in the project's `public/` folder are also copied to the site. Don't put private files there.

## 5. Think about external resources

Local attachments stay local to your published site. Remote video frames, fonts, images, and CSS can contact third-party servers when a visitor opens a page. Use a plain link instead of an embed if you don't want that resource loading on the page.

Lattice removes unsafe HTML such as script tags and event handlers and sanitizes SVGs. It also checks filesystem paths. Themes and snippets are different: they are **CSS you chose to trust**, so install them from sources you trust and respect their licenses. The [[Atlas/Media cabinet|media demo]] shows examples you can inspect.

## If something private was already published

Remove or exclude it, build again, and replace the deployment. Make sure the old page is no longer served; a host that leaves stale files behind can keep removed notes accessible. Review Git history separately if the source was committed.

If a credential was exposed, revoke or rotate it. Deleting the page doesn't make a published secret safe again, and caches or copies may remain outside your control.

[[About/Deployment|Next: deploy the reviewed site]] · [[About/Documentation|Guide index]].
