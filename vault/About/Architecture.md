---
title: Architecture
category: documentation
tags: [lattice, documentation, architecture]
description: Follow a saved note from your vault to the website your readers see.
---

You write notes in your vault; Lattice turns them into a website. This guide explains what happens after you save, which command to use, and where to make changes.

## What happens when you save a note

With `npm run dev` running, save a note in the vault folder selected by `publish.config.json`. Lattice rebuilds the local site and refreshes the browser. It does not rewrite your notes.

```text
Your vault        Lattice build        dist/          Browser
notes + media --> pages + links ------> website -----> read + search
                  themes + assets      (build only)
```

During development, Lattice serves the generated site without writing a production `dist/` folder. `npm run build` creates that folder for previewing or hosting.

### 1. Lattice reads the selected vault

The `vault` setting points to the folder containing your Markdown notes and attachments. Lattice reads that folder on your computer or your hosting service's build machine.

Notes are included by default. It skips hidden paths and symlinks, folders listed in `site.hiddenPaths`, and notes marked `private: true` or `publish: false`. Those two frontmatter values must be unquoted YAML booleans.

If you set `site.home`, Lattice uses that public note as the homepage. If you omit it, Lattice picks a public note. See [[About/Configuration]] to choose your own.

### 2. Notes become linked pages

Lattice reads titles, properties, headings, tags, and links. It turns Markdown into HTML, resolves supported embeds and Bases, and rewrites internal links to website URLs.

It also cleans rendered HTML and SVG, collects referenced local media, and prepares search text, previews, backlinks, and graph connections. A Base shows matching public notes; it cannot pull in excluded notes.

A failed edit leaves the last successful local version on screen. Fix the reported note or setting and save again; the next successful rebuild refreshes the page.

### 3. The build creates the website

`npm run build` writes a complete static site to `dist/`: a homepage, a directory `index.html` for each other note, `404.html`, application files, and the collected media and theme assets.

Each note page already contains its text, navigation, outline, and backlinks before JavaScript runs. Deploy the contents of `dist/`, not the vault or the project checkout.

### 4. The browser adds reading tools

The reader adds search, link previews, graphs, the Quick switcher, and optional reading panels to the generated pages. It does not open your local vault or run Obsidian plugins.

Color mode, selected theme, and folder folds are saved in that browser when storage is available. These choices change how the site looks, not your source notes or which notes are public.

## Which command should I use?

Run these from the project folder containing `package.json`, not from inside the vault.

| You want to… | Command | What happens |
| --- | --- | --- |
| Write notes and see changes immediately | `npm run dev` | Starts a local site and refreshes after successful edits. |
| Prepare the site for hosting | `npm run build` | Checks TypeScript and writes a new `dist/` site. |
| See the built site locally | `npm run preview` | Serves the existing `dist/`; it does not rebuild or watch notes. |

For a production preview, run `npm run build` followed by `npm run preview`. Open the address printed by the command. Neither local server publishes the site online.

## What becomes public?

Published text, filenames, properties, links, rendered HTML, and previews are public site data. Hiding the Properties panel does **not** hide the properties from visitors.

Lattice does not copy complete original Markdown files into the reader data. It supplies rendered pages and searchable text instead. Ordinary Obsidian `%% comments %%` are removed from that text; literal examples inside code remain.

Excluded notes, unselected `.obsidian` files, and unreferenced vault attachments are not copied wholesale. Referenced media and selected CSS assets are public. Files you deliberately put in the project's `public/` folder are also copied into the site.

Before hosting, choose your exclusions and remove sensitive properties from public notes. [[About/Security and privacy]] walks through that review.

## Why do Obsidian themes work?

Lattice reads the installed theme CSS and enabled snippets, then includes them in the site with rewritten local asset URLs. The reader uses familiar Obsidian classes and variables for light/dark mode, note content, callouts, and navigation.

The selected theme loads before snippets, vault-root `publish.css`, and your extra CSS overrides. If reader theme switching is enabled, visitors can choose among the themes included in the build.

CSS changes the appearance; it does not recreate editing panes, plugin controls, or Style Settings plugin state. Remote fonts and CSS resources still need a network connection. See [[About/Obsidian themes]] for setup and examples.

## Where to change things

Most site owners only need the first three rows. The source-code rows are optional if you want to develop Lattice itself.

| Change | Where |
| --- | --- |
| Note text, titles, links, properties, or Bases | Your selected vault |
| Vault folder, homepage, exclusions, or reader defaults | `publish.config.json` |
| Your site's styling | Vault snippets, vault-root `publish.css`, or configured extra CSS |
| How vault files and themes are compiled | `build/config.ts`, `build/compile.ts` |
| Generated pages and local serving | `build/staticPages.ts`, `build/vaultPlugin.ts` |
| Markdown, links, and Bases support | `src/lib/` |
| Reader controls and navigation | `src/App.tsx` and reader components in `src/` |

Next: [[About/Deployment|put the built site online]], [[About/Troubleshooting|fix a problem]], or [[About/Contributing|contribute a change to Lattice]].

[[About/Documentation|Documentation index]].
