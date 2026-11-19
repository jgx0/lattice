---
title: Lattice
aliases: [Why Lattice, The garden interface]
category: project
tags: [lattice, publishing]
description: A filesystem-driven static publisher for connected Obsidian notes.
---

**Lattice** publishes an Obsidian vault as a static site with a restrained, note-native reader. Notes remain notes: no injected author cards, reading-time labels, maturity badges, product attribution, or decorative footers.

## What it does

Markdown, YAML properties, wikilinks, transclusions, Bases, and theme assets are compiled locally at build time. Each published note has its own semantic HTML page. The browser adds navigation, search, hover previews, graphs, sortable tables, and optional stacked pages to already-rendered content.

Use the actual theme installed in your vault, its enabled snippets, and `publish.css`; the reader exposes familiar Obsidian classes and CSS variables. Obsidian plugins are not executed.

## Start here

- [[About/Documentation|Documentation]] — the complete guide.
- [[About/Quick start|Quick start]] — run the demo, select a vault, and build.
- [[About/Configuration|Configuration]] — site settings and publishing boundaries.
- [[About/Deployment|Deployment]] — review and host the static output.
- [[About/Architecture|Architecture]] — the build-time/compiler and browser boundary.

## What this vault demonstrates

The [[Library/The reading room|reading room]] turns sample book properties into a sortable collection. [[Field Notes/Digital gardens]] scopes a related-note Base to the host note. [[Atlas/Maps of meaning]] embeds a local SVG; [[Atlas/Media cabinet]] keeps media optional and offline.

Sample notes are illustrative fixtures for rendering and navigation.

## Boundaries

Lattice is not Obsidian Sync, a plugin runtime, an editing environment, a collaboration service, or an authentication layer. Bases supports a bounded expression subset, not Obsidian's complete runtime. External themes and embeds remain author-controlled trust decisions; see [[About/Security and privacy]].

Independent project; not affiliated with Obsidian. See [[About/Maintainer|the maintainer]] and [[About/Contributing|contribution guidelines]] for project maintenance.
