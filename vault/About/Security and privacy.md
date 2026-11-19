---
title: Security and privacy
category: documentation
tags: [lattice, documentation, privacy]
description: Exclude private notes before compilation and review public data, CSS, and embeds.
---

A published Lattice site is **public** unless your host separately restricts access. Lattice has no accounts, authorization service, or password protection. The build reads the vault locally and does not upload it; deploying the output is the step that makes the compiled material available to readers.

## Exclude, do not merely hide

Use `site.hiddenPaths` in configuration to exclude whole files or folders:

```json
{
  "site": { "hiddenPaths": ["Private", "Templates", "People/Contact details.md"] }
}
```

Or use actual YAML booleans in a note:

```yaml
---
publish: false
---
```

`private: true` also excludes a Markdown note. Do not quote these booleans. Publication fails closed: malformed or unterminated frontmatter, non-object metadata, duplicate YAML keys, and non-Boolean `publish`/`private` values stop compilation rather than publishing a note with ignored privacy flags. Fix the reported error before deploying.

Dot-prefixed paths and vault symlinks are skipped during scanning. Private/hidden notes are filtered **before rendering**, so they cannot enter note transclusions, Bases rows, hover previews, search, or graph data. A private homepage is a build error rather than a publishable fallback.

`showProperties: false`, collapsed folders, and navigation ordering are **not** privacy controls. Published note text, properties, rendered HTML, and previews remain accessible through public pages and compiled reader/search data. The original complete Markdown file is not included in the browser payload: its `content` is empty, and nonliteral Obsidian comments are removed from the searchable body. Literal `%%` examples in fenced or inline code remain public. Keep secrets out of public prose, properties, and code examples; if a secret has already been copied into another public note, excluding its original source does not remove the copy.

## Files and assets

The builder does not blindly copy the vault, `.obsidian` source, or every attachment into output. Referenced permitted assets are emitted separately; selected trusted CSS and its supported local dependencies are included. Filesystem and CSS-import boundaries are checked, and hidden vault assets cannot be included through CSS references.

Vite's `public/` directory is a separate intentional static-asset input. Keep it reviewed: files placed there can be copied to the deployed output. The build rejects public-directory inputs that resolve into the vault/configuration, overlapping source/output directories, and conflicting published output paths; these checks do not classify arbitrary manually copied public files as non-sensitive.

Direct development requests for vault sources are blocked. Nevertheless, keep local development bound to loopback when possible, and deploy only `dist/` to a static host, never the checkout or source vault.

## HTML sanitization

Rendered HTML is sanitized at compilation with DOMPurify. Scripts, event handlers, dangerous URLs, and raw `srcdoc` are removed. SVG assets are sanitized. External iframes are sandboxed, while generated PDF frames retain restrictive sandboxing.

Sanitization is not an assurance that an external service is private, benign, or appropriate. A permitted remote frame can still execute scripts in its frame and contact its provider. Review the actual destination, permissions, and user-facing explanation; a plain link is often the safer choice. [[Atlas/Media cabinet]] demonstrates offline examples and shows a remote embed only as unexecuted code.

## CSS is trusted input

Themes, snippets, `publish.css`, and configured CSS are trusted author input, not sanitized untrusted content. Use sources you trust and respect their licenses. Local imports are bounded and cycle-checked; remote CSS imports and remote asset URLs remain remote and can make requests from readers' browsers.

The build does not fetch those remote resources, so offline compilation does not imply an offline published page. Check themes for remote fonts, images, and imports if avoiding third-party contact matters.

## Pre-publication review

1. Keep secrets outside the publishing vault where practical; use explicit exclusions as defense in depth.
2. Check configuration and valid frontmatter, then run tests and build.
3. Inspect the generated output, including properties, previews, assets, and transcluded content.
4. Review contact details, quoted conversations, permissions, and external embeds manually.
5. Replace previous deployment files so newly excluded pages cannot remain available as stale output.

Sample notes are illustrative fixtures. Review any replacement notes and assets independently before publishing them.

[[About/Deployment|Deployment]] covers hosting boundaries. [[About/Documentation|Documentation index]].
