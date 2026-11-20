---
title: Welcome to Lattice
aliases: [Home, Start here]
category: documentation
tags: [lattice, documentation, welcome]
description: Publish connected Obsidian notes with Lattice, and explore the documentation and demo vault.
---

**Lattice** turns an Obsidian vault into a static website with a note-native reader. Publish connected notes, keep your vault's theme, and give readers search, hover previews, backlinks, graphs, and optional stacked pages.

> [!tip] Find any note in a few keystrokes
> Press **Command+K** on Mac or **Ctrl+K** on Windows/Linux to open the quick switcher. Start typing a note’s name, then press **Enter** to open it.

## Get started

Use **Use this template → Create a new repository** on GitHub to make your own Lattice site. Clone your copy, add a vault, point Lattice at its folder, and run `npm run dev`. [[About/Quick start|Quick start]] walks through it from the first button click to your notes on screen.

- [[About/Documentation|Documentation]] — the guides, when you need them.
- [[About/Quick start|Quick start]] — create your repository, add a vault, and open your site.
- [[About/Obsidian themes|Obsidian themes]] — use an installed theme, enabled snippets, and `publish.css`.
- [[About/Deployment|Deployment]] — review the static output and deploy to Cloudflare Pages, Vercel, or Netlify.

## How publishing works

Markdown, properties, wikilinks, transclusions, and supported Bases are compiled before the site is served. Every published note has its own semantic HTML page; the browser adds reader interactions to already-rendered content. There is no browser-side vault upload or Obsidian plugin execution.

Set the source vault and site options in `publish.config.json`. The development server watches notes, attachments, and theme inputs. Only deliberately published content and referenced assets belong in the generated `dist/` directory; review [[About/Configuration]] and [[About/Security and privacy]] before sharing it.

## Explore the demo

Sample notes are illustrative fixtures for linked-note publishing.

- [[Library/The reading room|The reading room]] — a sortable Base built from book properties.
- [[Field Notes/Digital gardens|Digital gardens]] — note links, section anchors, and a host-relative related-note Base.
- [[Atlas/Maps of meaning|Maps of meaning]] — a local SVG and block transclusion.
- [[Atlas/Media cabinet|Media cabinet]] — optional offline audio and video.
- [[Projects/Lattice|Lattice overview]] — features and implementation boundaries.

> [!tip] There is no correct route
> Follow a link that catches your eye. Hover over [[Field Notes/Digital gardens|digital gardens]] for a little context, or start with [[Library/The reading room|the reading room]].

## Follow a thread

- **Pay attention** → [[Field Notes/Attention is a material|Attention is a material]] → [[Field Notes/Walking as research|Walking as research]] → [[Projects/A neighborhood atlas|A neighborhood atlas]].
- **Make room for unfinished work** → [[Field Notes/Digital gardens|Digital gardens]] → [[Essays/Against the finished thought|Against the finished thought]] → [[Projects/Lattice|Lattice]].
- **Build for the long view** → [[Field Notes/Small bets & long horizons|Small bets & long horizons]] → [[Essays/Enough is a design constraint|Enough is a design constraint]] → [[Projects/A season of small bets|A season of small bets]].

## Recently tended

This example table demonstrates note links and heading anchors.

| Note | Example change | Tended |
| --- | --- | --- |
| [[Field Notes/Digital gardens#A link should carry a thought|Digital gardens]] | A better test for meaningful links | Nov 18 |
| [[Projects/A neighborhood atlas#What the first walks taught me|A neighborhood atlas]] | Resting places matter more than routes | Nov 16 |
| [[Essays/A quieter internet|A quieter internet]] | Invitation and interruption | Nov 14 |
| [[Field Notes/Small bets & long horizons#The two clocks|Small bets & long horizons]] | A weekly rhythm inside a seasonal commitment | Nov 12 |
