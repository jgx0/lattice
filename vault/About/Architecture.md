---
title: Architecture
category: documentation
tags: [lattice, documentation, architecture]
description: Lattice's filesystem compiler, static-page generator, and browser reader boundary.
---

Lattice separates the **source vault**, the **compiled public site**, and the **browser reader**. Markdown processing and theme ingestion happen on the build machine. Reader interactions operate on compiled public data.

## Build pipeline

1. `build/config.ts` reads and validates disk configuration and environment overrides.
2. `build/compile.ts` scans allowed vault files, skips hidden paths and symlinks, validates publication frontmatter with fail-closed errors, and filters private notes before building the note model.
3. `src/lib/model.ts` extracts titles, properties, headings, links, tags, and slugs.
4. `src/lib/render.ts` and `src/lib/bases.ts` render Markdown, transclusions, media, and supported Bases views. Sanitization uses an isolated JSDOM window and window-bound DOMPurify helpers from `src/lib/sanitize.ts`.
5. The compiler rewrites internal links and local asset references to deployment URLs, ingests selected theme/snippet CSS, and collects referenced assets.
6. `build/vaultPlugin.ts` integrates compilation with Vite and emits assets, per-note pages, and `404.html`. `build/staticPages.ts` creates semantic note HTML around the application shell and a missing-page shell that does not mount the reader. Route/output collisions and source/output overlap fail the build rather than overwriting pages or the vault.

The compiler closes its isolated DOM after a compilation. It does not depend on browser globals, fetch remote CSS, or upload the vault.

## Output boundary

`dist/` contains semantic note HTML, the reader bundle, compiled public metadata/search data, and emitted assets. The browser payload does not include each original complete Markdown file: `PublishedNote.content` is empty, and its searchable `body` omits nonliteral Obsidian comments. Literal `%%` examples inside fenced or inline code are preserved. Published note text, properties, HTML, and previews remain public; a hidden panel does not make them confidential. Private notes, unselected `.obsidian` source files, and arbitrary unreferenced vault attachments are not blindly copied.

Public metadata is still public: YAML properties, search information, previews, and links for surviving notes may be available even if a panel hides them. The privacy boundary is **exclusion before compilation**, not a visual control in the reader.

Each published note has a URL and directory `index.html`; its text, navigation, outline, and backlinks exist before JavaScript. The browser receives precompiled published pages and a public search index, and adds interactions without uploading or processing local vault files.

## Browser reader

- `src/App.tsx` coordinates navigation, browser history, preferences, optional panes, and the compiled site.
- `src/SidebarTree.tsx` renders nested file navigation.
- `src/MarkdownContent.tsx` handles interactions with already-rendered note content.
- `src/GraphView.tsx` presents local/global connections.
- `src/lib/search.ts` searches public compiled note information.

Reader preferences are local presentation state, not an account, synchronized vault, or authorization mechanism. Obsidian plugins and theme plugins do not execute in this layer.

## Local development

The Vite plugin watches vault roots, configuration, appearance settings, CSS inputs, and dependencies discovered during compilation. It debounces edits and publishes only a complete successful snapshot. If a new edit fails, the previous snapshot stays available and the error is reported; a later successful edit can recover.

The development middleware serves compiled notes and emitted assets and blocks direct requests for vault source files, including source requests through Vite's filesystem route. This is useful defense in depth, not a reason to deploy a development server publicly.

## Tests and fixtures

`src/demo.ts` is an in-memory sample fixture for integration and reader tests, not the production vault loader. Production reads the configured filesystem vault. Keep fixture links and sample note content synchronized when editing the checked-in demo; do not replace the build pipeline with browser-side file processing.

See [[About/Contributing]] for regression checks, [[About/Security and privacy]] for trust boundaries, and [[About/Deployment]] for static hosting.

[[About/Documentation|Documentation index]].
