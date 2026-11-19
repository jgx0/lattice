---
title: Troubleshooting
category: documentation
tags: [lattice, documentation, troubleshooting]
description: Diagnose configuration, link, Base, CSS, watcher, and static-host problems.
---

Begin with the **first reported build or development error**. The live server preserves the last successful compilation, so a readable page after an error may be an older snapshot rather than proof that the edit worked.

## Installation or compilation fails

- Check Node.js is 22.12 or newer.
- Run `npm ci --include=dev` from the project root; the builder needs TypeScript, Vite, and JSDOM from development dependencies.
- Verify the vault and configuration file exist and are readable.
- Unknown configuration fields are rejected; do not add unsupported options hoping they will take effect.
- Malformed or unterminated frontmatter and quoted/non-Boolean privacy flags fail compilation. Repair the YAML rather than removing a needed exclusion.
- Published-route collisions are build errors; rename conflicting note paths rather than relying on one page to overwrite another.
- Run `npm run build` to reproduce the error outside the watcher.

See [[About/Quick start]] and [[About/Configuration]] for working examples.

## Homepage missing or no published notes

`site.home` must resolve to an existing public Markdown note. Check spelling, folder path, extension, `hiddenPaths`, and privacy frontmatter. If all notes are excluded, compilation cannot create a site. Do not weaken privacy settings merely to make an error disappear; choose a genuinely public homepage.

## A link or transclusion is unresolved

Use an exact vault-relative path, especially when several folders contain the same filename. Check the heading text or block identifier as well as the note name. A link cannot reveal a filtered private note. Update incoming links after renaming a source file.

A cyclic or overly nested embed can reach the renderer's limit. Prefer a direct link or a smaller heading/block embed rather than an endless whole-note chain. [[About/Markdown and Bases]] shows valid targets from this vault.

## A Base is empty or reports an error

An empty view can be correct: no public notes match its filters. Check property names, YAML value types, folder paths, and the host note's properties. `this.file` means the host Markdown note; it is not the `.base` file.

A visible “Unable to render Base” message indicates invalid YAML, an unsupported view/expression, a circular formula, or an evaluator limit. Reduce the expression to supported operations and verify the result on a small collection. Obsidian's complete Bases runtime and general JavaScript are not supported.

## A theme or CSS asset fails

- Check `.obsidian/appearance.json` is valid JSON.
- Verify the selected theme's `theme.css` and enabled snippet files exist.
- Distinguish top-level `theme` from `site.theme` color mode.
- Set top-level `theme: "default"` and `snippets: []` temporarily to isolate a CSS issue, then restore the intended configuration.
- Check local import/asset paths, supported extensions, allowed directories, and import cycles.
- Check connectivity for remote CSS resources; the build leaves their URLs remote.

Style Settings plugin state, editing controls, and plugin-only components cannot appear merely by loading their CSS. See [[About/Obsidian themes]] for the compatibility boundary.

## Saved edits do not appear

Read terminal and browser error output first. A failed edit intentionally leaves the previous snapshot live. Fix the cause and save again; a successful compile refreshes readers. If changes involve configuration base paths, verify the new URL and restart the local command if needed. `npm run preview` does not watch or compile source changes; rerun `npm run build` before previewing.

## Deep links or assets fail after deployment

Verify the configured `base` equals the host's mount path, then rebuild. Mount `dist/` contents there, including `_assets/`, `_theme/`, and application assets. The host must serve note-directory `index.html` files. Test a direct note URL and a nonexistent URL rather than relying only on client-side clicks or a universal homepage fallback.

If renamed or excluded pages remain available, replace or clean the old deployment. Local output changes do not delete stale files from a remote host. [[About/Deployment]] provides the complete checklist.

## Media will not play

Check the emitted file URL, browser codec support, and visible playback controls. Development serves generated assets with single-byte-range responses for media seeking and ETags for conditional requests; the production static host must provide appropriate file-serving behavior. No autoplay is required by the offline examples. A working file does not guarantee every browser can decode its format; provide a useful text description or download link.

## Reporting a reproducible issue

Include the command, Node/npm versions, minimal configuration, exact error, expected behavior, and a non-sensitive sample note/Base/CSS file. Never attach a private vault or unredacted secrets. See [[About/Contributing]] for tests and source locations.

[[About/Documentation|Documentation index]].
