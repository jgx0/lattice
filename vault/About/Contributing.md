---
title: Contributing
category: documentation
tags: [lattice, documentation, contributing]
description: Maintain Lattice with focused changes, regression tests, and truthful demo provenance.
---

Make focused changes that preserve the build/browser boundary, note-native presentation, and privacy filtering. See [[About/Maintainer|the maintainer]] for project maintenance information. Source, issues, and pull requests are hosted at [jgx0/lattice](https://github.com/jgx0/lattice).

## Set up and verify

From the project root, using Node.js 22.12 or newer:

```sh
git clone https://github.com/jgx0/lattice.git
cd lattice
npm ci --include=dev
npm run check
npm audit
```

`npm run check` runs type checking, the complete test suite, and the production build. The build also runs TypeScript checks and compiles the filesystem demo. The checked-in GitHub Actions workflow verifies Node.js 22 and 24; it does not deploy a site. Tests cover note/link/search/Bases behavior, sanitization, true Node compilation without browser globals, themes and CSS assets, privacy filtering, static HTML, preview serving, watcher recovery, and React reader interactions.

For a demo-content change, a focused regression command is:

```sh
npm test -- src/lib/integration.test.ts src/App.test.ts build/compile.test.ts build/readme.test.ts
```

Run the full suite before treating a cross-cutting change as complete. Audit results need investigation; do not claim a clean audit without running it.

## Find the right layer

| Area | Primary files |
| --- | --- |
| Configuration validation | `build/config.ts` |
| Filesystem compilation and theme assets | `build/compile.ts` |
| Vite integration, watcher, static emission | `build/vaultPlugin.ts` |
| Semantic note pages | `build/staticPages.ts` |
| Note model, links, Markdown/Bases, sanitization | `src/lib/` |
| Reader state and navigation | `src/App.tsx` |
| Reader components | `src/SidebarTree.tsx`, `src/GraphView.tsx`, `src/MarkdownContent.tsx` |
| Filesystem demo | `vault/` |
| In-memory regression fixture | `src/demo.ts` |

Read [[About/Architecture]] before moving logic between these layers. Public reader code should consume compiled data, not load private source files or parse vaults at runtime.

## Keep the demo truthful

Sample notes are illustrative fixtures. Keep their observations, book ratings, and example project histories labeled as demo content, and preserve genuine bibliographic author names.

When editing or renaming a demo note, synchronize its content in `src/demo.ts` and update wikilinks, transclusion targets, and relevant regressions. Prefer exact vault-relative links. Documentation pages use frontmatter titles without a duplicate top-level body heading.

Do not modify third-party theme vendor files casually. Preserve their licenses and provenance; use snippets or `publish.css` for site-level overrides.

## Review changes as a reader

Check a narrow screen, keyboard navigation, both color modes, direct URLs, heading links, previews, optional panels, and no-JavaScript note content. Look for unresolved links, embed limits, Base errors, and unexpectedly exposed metadata.

For privacy or asset changes, add a regression that proves excluded material cannot enter public HTML, transclusions, previews, Bases, or metadata. Test failure cases, not only successful rendering.

## Share an issue or proposed change

[Open an issue](https://github.com/jgx0/lattice/issues) or [submit a pull request](https://github.com/jgx0/lattice/pulls). Use a minimal, non-sensitive reproduction and explain expected versus actual behavior. Include commands and version information. Avoid publishing a full private vault, screenshots with personal data, or configuration containing secrets.

See [[About/Troubleshooting]] for diagnosis and [[About/Security and privacy]] for the safety review.

[[About/Documentation|Documentation index]].
