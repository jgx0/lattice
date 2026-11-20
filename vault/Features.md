---
title: Features
aliases: [Lattice features, What Lattice can do]
category: documentation
tags: [lattice, features, publishing]
description: "Everything Lattice brings to published Obsidian notes: connected reading, real themes, rich Markdown, Bases, and portable static websites."
---

**Your notes, your theme, your website.** Lattice turns an Obsidian vault into a connected, readable website without making you rewrite your notes for a different publishing system.

Keep writing in Markdown, with both `.md` and `.markdown` note files supported. Keep your links, properties, and attachments together. Build on your own computer or through your hosting provider, and publish the resulting static files wherever you choose.

This is a tour of what Lattice can do today. For a hands-on start, follow [[About/Quick start|Quick start]]; for the details behind an individual feature, use [[About/Documentation|the tutorials]].

## Connected reading, not isolated pages

A vault is more than a collection of documents. Lattice carries its connections onto the web so readers can follow an idea instead of constantly returning to a homepage.

- **Wikilinks.** Publish familiar `[[Note]]` links as ordinary website links, with routes resolved during the build.
- **Custom link labels.** Use `[[Note|a more useful label]]` without renaming the destination.
- **Note aliases.** Give notes alternative names in frontmatter and use them when linking or finding a file.
- **Folder-aware resolution.** Link to full vault-relative paths when you want an exact target; local and relative links are supported too.
- **Heading links.** Send a reader directly to a section rather than the top of a long page.
- **Block links.** Link to an individual passage marked with a block identifier such as `^observation`.
- **Ordinary Markdown links.** Existing relative Markdown links can resolve to notes and be rewritten to their published URLs.
- **Hover previews.** Let readers peek at a linked note before deciding whether to open it.
- **Backlinks.** Show the public notes that link to the current page under **Linked mentions**.
- **Links in properties.** Wikilinks in a property string, list, or nested value participate in backlinks and graphs—not just links in the note body.
- **Linked property displays.** Resolved property values become clickable in the properties panel and in Base cells.
- **Heading-generated navigation.** The **On this page** outline follows the note's headings, with section links and a current-section indicator.
- **Direct links and browser history.** Notes have their own URLs. Readers can bookmark a page, share a section, open a nested route directly, and use the browser's Back and Forward controls.

Try the connections in [[Field Notes/Digital gardens|Digital gardens]], or hover over that link for a preview.

## A reader that feels at home beside Obsidian

Lattice is built around the note, not a blog template. It gives your writing room to breathe while keeping the tools for exploring close by.

- **An Obsidian-style file tree.** Browse folders and notes in a familiar nested navigation pane.
- **Collapsible folders.** Fold a section you are not using; the choice persists across reloads in that browser.
- **Author-selected initial folds.** Configure which folders start collapsed for new readers without overriding their saved choices. In this demo, **About** starts open and the other folders start collapsed.
- **Independent sidebar controls.** Fold either sidebar and reopen it with the small controls that remain available.
- **A single main reading scrollbar.** On wider screens, the note and its contextual information share the reading area instead of competing through multiple content scrollbars.
- **Quiet file navigation.** The file tree remains scrollable without a distracting visible scrollbar track.
- **Responsive sidebars.** On narrower screens, sidebars become dismissible overlays rather than squeezing the note into an unreadable column.
- **Readable line length.** Use a restrained reading width, or let readers turn it off when they need more horizontal room.
- **Optional stacked pages.** Open connected notes side by side in a horizontal stack instead of replacing the previous page. Keep up to eight panes, close individual panes, and follow the current route through the stack. The page-information sidebar steps aside while multiple panes are open.
- **Visible stacking status.** The stacking control shows whether it is enabled, and Reader settings stays in sync with it.
- **Properties below the writing.** When enabled, the properties panel appears after the note body, expanded by default, with Obsidian-style rows and type icons.
- **Reader-controlled panels.** Readers can choose whether to show properties, the outline, backlinks, and the graph.
- **Saved reading preferences.** Color mode, supported layout choices, and quick-switcher preferences stay in that browser.
- **Keyboard-friendly controls.** Dialogs support focus management and Escape dismissal; interactive graph nodes can be opened with Enter.
- **No injected article furniture.** Lattice does not add author cards, reading-time labels, note-maturity badges, product attribution, or promotional footers to your notes.

Your source notes stay unchanged. Reader preferences alter presentation, not the files in your vault.

## Find the next note in seconds

There are two ways to find a page: search its content, or jump straight to a file.

### Command/Ctrl+K quick switcher

Press **Command+K** on macOS or **Ctrl+K** elsewhere to open the file picker.

- Search note titles, filenames, folder paths, and aliases.
- Type multiple terms to narrow the results.
- Get ranked matches, with exact and strong filename/title matches ahead of weaker matches.
- Use the arrow keys to move through results and Enter to open a note.
- Press Escape, click the backdrop, or use the close control to dismiss it.
- Keep the popup visually consistent with the selected theme and color mode.
- Enable or disable it in Reader settings. When disabled, the same shortcut focuses sidebar search instead.

### Sidebar search

Search the public note collection without downloading or uploading a source vault. The search index is built from the notes that are actually published. Ordinary terms match titles, vault-relative paths, and comment-stripped Markdown body text.

- **Targeted fields.** Use `path:`, `file:`, `tag:`, `heading:`, and `content:` to say where a term should match.
- **Combined conditions.** Combine terms with uppercase `AND`, `OR`, and `NOT`; spaces between terms imply AND.
- **Exclusions and grouping.** Use `-` or `!` to negate a term and parentheses to group conditions.
- **Quoted phrases.** Search a phrase in single or double quotes.
- **Case-sensitive searches.** Use `match-case:true` when capitalization matters, or `match-case:false` for case-insensitive matching.
- **Bounded regular expressions.** Use supported `/pattern/` expressions and flags for more precise matching; oversized or rejected unsafe patterns match nothing.
- **Nested tags.** A tag search can match a tag or its descendants, such as `research` and `research/methods`.

For example, try these individually in sidebar search:

```text
path:"Library/Books"
tag:writing AND content:link
heading:"Get started"
(garden OR notes) NOT path:Essays
match-case:true Lattice
```

Use search when you remember an idea rather than a filename; use the quick switcher when you already know which file you want. Aliases are available in the quick switcher, but sidebar search is not an arbitrary frontmatter query engine.

## See the shape of your vault

Sometimes the quickest way to discover a connection is to see it.

- **A compact local graph beside the note.** See the current page and its incoming and outgoing connections in the page-information sidebar.
- **An expanded local graph popup.** Use the expand icon to explore those nearby connections without leaving the note.
- **A vault graph popup.** Open the broader public note network from the sidebar's graph controls.
- **Minimal popup chrome.** Graph popups have a floating X rather than a title or search bar, keeping the network itself in focus.
- **Theme-aware nodes and edges.** Popup colors follow Obsidian-style graph variables and the current theme.
- **Pan and zoom.** Drag the canvas, scroll to zoom, or use the zoom and reset controls.
- **Movable nodes.** Drag individual nodes to inspect a busy cluster.
- **Connection highlighting.** Hover over a note to make its relationships easier to follow.
- **Open a note from the graph.** Select a node with the pointer or focus it and press Enter.
- **Keep your place.** Opening and dismissing the popup preserves the note, URL, reading position, stacked panes, and sidebar state underneath.
- **Public links only.** Graphs use the compiled public link network, including property links; excluded notes are not hidden nodes waiting to be discovered.

The interactive graph displays up to 250 matching notes at a time to keep the layout manageable. It is an exploration view, not a promise to draw an unlimited vault in one frame.

## Real Obsidian themes, not just color presets

Your website can use the CSS you already chose for your vault.

- **Default (Obsidian).** A built-in baseline with familiar reading styles and native-looking controls.
- **Publish.** A built-in Publish-style theme with compact navigation, generous note titles, contextual sidebars, and hierarchical outlines.
- **Installed community themes.** Use the actual stylesheet from a theme installed in `.obsidian/themes`, rather than a separate imitation.
- **Minimal included in the demo.** Try the bundled original Minimal theme without installing it yourself; its upstream license is preserved.
- **Follow your vault's appearance.** Read the selected CSS theme and enabled snippets from `.obsidian/appearance.json` when the publish configuration does not override them.
- **Light, dark, or system mode.** Choose the CSS design independently from the color-mode default.
- **Optional reader theme switching.** Let visitors change among the included themes without rebuilding the site or editing your vault.
- **A controlled theme catalog.** Discover installed themes automatically, or provide an allowlist. Default, Publish, and the selected site theme remain available.
- **Saved theme choices.** Readers can return to their chosen design and separate color-mode preference.
- **Early appearance restoration.** Apply the color mode before the main content paints and restore an available saved theme before revealing it; startup loading has a bounded fallback rather than hiding the page indefinitely.
- **CSS snippets.** Follow enabled Obsidian snippets, select snippets just for the site, or turn them off explicitly.
- **Vault-root `publish.css`.** Add website-specific styles without modifying the original theme.
- **Extra stylesheets and custom CSS.** Layer your own overrides after the theme and snippets.
- **Site and note classes.** Apply site-wide body classes and note-level `cssclasses` for targeted styling.
- **Accent and typography settings.** Reuse supported accent, base text size, text-font, and monospace-font preferences from the vault. Override the accent in configuration when needed.
- **Local stylesheet dependencies.** Supported local CSS imports, fonts, and images are emitted with rewritten deployment URLs.
- **Familiar CSS hooks.** Reading content exposes Obsidian-style classes and variables for notes, callouts, properties, file navigation, and popovers.

A font name does not download a font, and remote stylesheet resources can still contact their providers. Themes style the reader; Obsidian editor panes, plugins, and Style Settings plugin execution are not reproduced. [[About/Obsidian themes|The theme tutorial]] explains how to choose and customize a look.

## Rich notes without a conversion project

Publish the useful parts of your existing Markdown instead of rebuilding each page in a web editor.

- **Headings and paragraphs.** Clear page titles, heading anchors, and normal document structure.
- **Emphasis and links.** Bold, italic, strikethrough, and ordinary web links.
- **Lists and tables.** Ordered lists, unordered lists, nested content, quotations, and Markdown tables.
- **Automatic web links.** Recognize supported plain-text web URLs as links.
- **Code.** Inline code and fenced code blocks remain readable literal examples rather than executable page instructions.
- **Highlighting.** Use `==highlighted text==` for passages that deserve attention.
- **Callouts.** Familiar Obsidian-style callout blocks with titles, icons, and visual treatments. Use `[!type]+` or `[!type]-` for collapsible callouts that start expanded or folded.
- **Tasks.** Render checked and unchecked Markdown tasks. They are read-only on the website; edit the source to change their state.
- **Footnotes.** Numbered references and links between the note and its footnote explanations.
- **Math.** Inline and block LaTeX rendered with bundled KaTeX styles and fonts, without a remote math-rendering service.
- **YAML properties.** Titles, aliases, tags, descriptions, custom values, lists, and nested data can carry through into the public model.
- **Page descriptions.** Use note descriptions with a site-wide fallback for generated HTML metadata.
- **Safe raw HTML.** Supported HTML can enrich a note while build-time sanitization removes scripts, event handlers, and dangerous URLs.
- **Obsidian comments.** Nonliteral `%% comments %%` are omitted from rendered and searchable body text; literal examples inside code remain visible.

The page title comes from frontmatter or the filename, so you do not need to repeat it as a top-level heading in every note. Follow [[About/Markdown and Bases|the content tutorial]] to build two linked pages and try these features.

## Reuse notes, sections, and blocks

Keep a passage in one place and show it where readers need it.

- **Whole-note transclusions.** Embed another public note with `![[Note]]`.
- **Section transclusions.** Embed a particular heading section instead of an entire document.
- **Block transclusions.** Reuse an individual marked passage.
- **Nested embeds.** Supported embeds can contain further embeds, with recursion limits to prevent endless expansion.
- **Host-aware embedded data views.** Bases in embedded content keep the correct host-note context rather than assuming the `.base` file is the page.
- **Built before serving.** Embedded material becomes part of the compiled HTML, so it does not depend on a visitor having your vault or Obsidian installed.

[[Atlas/Maps of meaning|Maps of meaning]] demonstrates a block transclusion. Keep circular whole-note embeds out of your published writing; use a direct link when expansion would not help the reader.

## Images, audio, video, and PDFs

Your attachments can travel with the website rather than requiring a separate media service.

- **Local images.** Resolve supported vault image embeds and Markdown image references during the build.
- **SVG artwork.** Publish sanitized SVG assets with their visual content intact.
- **Audio players.** Embed local audio with browser playback controls.
- **Video players.** Embed local video without making a remote player mandatory.
- **Inline PDFs.** Display local PDFs in a restricted frame with a download fallback.
- **Referenced attachments only.** Emit permitted referenced assets instead of copying every file in the vault blindly.
- **Embed dimensions.** Supported image/media wikilink aliases can request a width or `widthxheight`, such as `![[picture.png|320]]` or `![[picture.png|320x180]]`.
- **Deployment-aware URLs.** Rewrite attachments to the generated asset locations under the configured site base.
- **Media-friendly local serving.** Generated media supports content types, conditional requests, HEAD requests, and single byte-range requests for seeking during development and preview.
- **Optional remote resources.** Use permitted external media or frames deliberately, with the understanding that they may contact third-party servers.

[[Atlas/Media cabinet|The media cabinet]] includes local image, audio, and video examples. Playback depends on the browser and codec; external resources are not an offline guarantee.

## Turn properties into collections with Bases

Use a Base to make a reading list, index, project directory, or table of notes that link to the current page.

- **Reusable `.base` files.** Save a view definition in the vault and embed it in a note.
- **Inline Base blocks.** Put a fenced block labeled `base` directly in the note when the view belongs to that page.
- **Tables, lists, and cards.** Choose a supported presentation for the collection.
- **Multiple views.** Render multiple configured views as separate sections.
- **Top-level and per-view filters.** Narrow the public note collection with supported conditions.
- **Chosen columns and labels.** Select fields with `order` and give them readable display names.
- **Initial sorting.** Order by file fields, note properties, or supported formulas, including multiple sort keys.
- **Interactive table sorting.** Readers can click column headings to reorder a rendered table.
- **Row limits.** Keep a large collection to an intentional number of entries.
- **Formulas.** Derive displayed values with supported expressions rather than duplicating a value in every note.
- **Linked file cells.** Open a note directly from its row.
- **Linked property cells.** Property wikilinks remain useful links inside a collection.
- **Frontmatter access.** Use `note.author`, other custom properties, or supported bare property names in expressions.
- **File information.** Work with names, paths, extensions, folders, links, tags, and supported filesystem timestamps.
- **The host note as `this.file`.** A shared Base can change its results depending on the page containing it.
- **Incoming-link collections.** Use `file.links.contains(this.file)` or `file.hasLink(this.file)` to show notes linking here, including links in properties.
- **Tag predicates.** Use `file.hasTag(...)` for supported tag matching, including nested tags.
- **Link values and conversion.** Use `link(...)`, `file.link`, and supported `toString()` conversions.
- **Safe expression evaluation.** Supported comparisons, Boolean conditions, arithmetic, lists, conditionals, string/list methods, and helper functions run without executing arbitrary JavaScript.
- **Public-note filtering.** Excluded notes cannot become Base rows.
- **Visible definition errors.** Invalid or unsupported expressions report a Base error instead of silently running unexpected code.

The expression toolkit includes `if`, `list`, `length`, `contains`, `link`, `any`, `all`, `number`, `string`, `date`, `min`, `max`, `sum`, `round`, `abs`, and `isEmpty`. Supported value methods include `containsAny`, `containsAll`, `startsWith`, `endsWith`, lowercase/uppercase conversion, `trim`, `split`, `join`, `unique`, `reverse`, `sort`, `slice`, `map`, and `filter`, alongside the file/link methods above. These operate on their supported value types; list mapping and filtering use expression variables such as `value` and `index`, not JavaScript arrow functions.

Views are compiled from the public snapshot at build time, not live database queries in the browser. Table clicks reorder the rendered rows; they do not edit the underlying properties. `file.hasBacklink(...)` and `file.asLink()` are not supported.

Try [[Library/The reading room|the reading room]] for a property-driven bookshelf, then [[About/Markdown and Bases|the Base tutorial]] for copyable definitions. Filesystem modification times can change after copying or cloning a vault; use explicit note properties for dates that must stay stable across machines.

## Make navigation and URLs your own

The structure of your source vault does not have to dictate every detail of the published reader.

- **Your site name and description.** Replace the demo identity with your own.
- **Your homepage.** Select an existing public note as the page readers land on.
- **Manual navigation ordering.** Order folders and note paths while keeping unlisted entries available.
- **Custom folder hierarchies.** Use `navigationFolders` to place a note in another displayed folder without moving its source file.
- **Initial collapsed folders.** Set a tidy starting file tree while respecting reader preferences thereafter.
- **Filename-based clean routes.** Source filenames and folders determine safe published paths; changing a frontmatter title does not rename the route.
- **Unicode-aware route names.** Normalize filename segments into lowercase URL slugs, replace spaces and underscores with hyphens, retain supported Unicode letters and numbers, and disambiguate duplicate slugs.
- **Nested note pages.** Generated directory indexes allow direct navigation to deeper routes.
- **Subdirectory publishing.** Set a base such as `/notes/` when the website lives below a domain's root.
- **Shared URL handling.** Notes, application assets, theme files, and attachments use the same deployment base.
- **Flexible vault location.** Keep the vault beside the project or point at an existing folder elsewhere.
- **Alternative configuration files.** Select a configuration or vault with environment overrides for different local build setups.

Renaming a file can change its URL; Lattice does not generate automatic redirects for renamed notes. [[About/Configuration|The configuration walkthrough]] starts with a site name and homepage, then adds navigation only when you need it.

## Publish on your terms

Lattice's output is a website you can take to another host, not a vault locked inside a publishing account.

- **Build-time vault ingestion.** Read and compile the filesystem vault on the build machine—not through a browser upload or ZIP-processing workflow.
- **A live local server.** Save a note and see the local website refresh.
- **Watched publishing inputs.** Changes to notes, attachments, configuration, and relevant appearance/CSS inputs trigger rebuilding.
- **Complete build snapshots.** Publish successful compilations as a unit rather than exposing a half-updated collection.
- **Last-good recovery.** A failed live edit reports an error while keeping the previous successful snapshot available; a corrected edit can recover.
- **Static production output.** `npm run build` produces the website in `dist/`.
- **A local production preview.** Inspect the generated output before deploying; preview does not need to re-read the source vault.
- **No production Node server required.** The finished website can be served by a static host.
- **Individual semantic HTML pages.** Notes, navigation, outlines, and backlinks exist before the interactive reader starts.
- **Useful reading without JavaScript.** The static note content remains available; JavaScript adds search, popups, preferences, graphs, and other interactive features.
- **A real missing-page document.** Unknown routes use a generated `404.html`, not a universal homepage fallback.
- **Referenced assets and theme assets.** Emitted files have deployment URLs and content-derived naming.
- **Included hosting configurations.** Start with Cloudflare Pages, Vercel, or Netlify settings supplied in the repository.
- **Manual or Git-connected publishing.** Build locally and upload `dist/`, or let a provider build the reviewed publishing vault in your own repository.
- **Response-header templates.** Included host settings cover baseline security headers and cache rules for hashed assets.
- **Template-based setup.** Create your own repository with GitHub's **Use this template**, then edit and deploy your copy.

[[About/Deployment|The deployment tutorial]] explains both paths. A cloud builder needs access to its source files; an ignored vault on your computer is available to local builds, not automatically to a hosting provider.

## Built to handle more than a tiny notebook

Large collections should not require a separate link scan for every connection.

- **Indexed link resolution.** Reuse lookups when resolving links, aliases, and relative note targets.
- **Prepared backlink data.** Build the reverse link network once rather than searching every note for each page.
- **Reusable Markdown parsing.** Share parsed content and safe rendering work within a build.
- **Cached rendering and assets.** Reuse appropriate transclusion, math, SVG, and asset-processing results.
- **Prepared page shells and navigation.** Build common static-page structures once per compiled snapshot.
- **A repeatable benchmark.** Run a temporary synthetic vault benchmark without changing your own notes.

Build time still depends on your content, embedded views, hardware, and output size. Each static page includes navigation for no-JavaScript reading, so very large vaults still need memory and disk space. [[About/Architecture|How the build works]] explains those trade-offs.

## Deliberate publication controls

A public website should contain what you intend to publish, not everything you happened to store nearby.

- **Folder and file exclusions.** Use `site.hiddenPaths` to leave specific paths out of the publication.
- **Per-note exclusions.** Unquoted `publish: false` or `private: true` excludes a note.
- **Filtering before rendering.** Excluded notes do not enter transclusions, Bases, previews, search, or graph data.
- **Strict publication metadata.** Malformed frontmatter and ambiguous privacy flags stop compilation rather than being silently ignored.
- **No blind vault copy.** Unselected `.obsidian` source files and arbitrary unreferenced attachments are not simply mirrored into the website. Files deliberately placed in the project's separate `public/` directory are static publishing inputs, so keep that folder reviewed too.
- **Source-request blocking.** The local server blocks direct vault/configuration source access, including unsafe filesystem aliases.
- **Filesystem safeguards.** Skip vault symlinks and reject unsafe source/output overlaps or conflicting generated paths.
- **Build-time HTML sanitization.** Remove executable scripts, unsafe attributes, and dangerous URLs from supported rendered HTML.
- **Restricted embed handling.** Sanitize SVGs and restrict generated PDF frames and permitted external frames.
- **A smaller public payload.** Original complete Markdown files are not included as raw source in the reader data; published HTML, public properties, previews, and searchable text are still public.

**Exclusion is the privacy control.** A collapsed folder, hidden properties panel, private GitHub repository, or unlinked note does not make the deployed page private. All non-excluded notes are published; `publish: true` is not required. Review public text and assets before deploying, and replace old releases so newly excluded pages do not remain online as stale files.

Lattice has no built-in login or password gate. CSS is trusted author input, and external resources may contact other services. [[About/Security and privacy|The privacy walkthrough]] is the place to make those decisions before sharing.

## Clear limits, no surprise promises

Lattice is an independent publishing reader, not Obsidian itself running in a browser.

- Obsidian plugins, Dataview queries, and plugin widgets do not execute.
- Editing, Obsidian Sync, collaboration, and Canvas editing are not included.
- Bases implements a supported subset, not every Obsidian function or arbitrary JavaScript.
- Theme compatibility covers reading content and available CSS hooks, not editor controls or plugin state.
- Tasks are read-only, browser media support varies, and remote resources can require connectivity.
- The website is public unless separate hosting infrastructure restricts access.
- Hosting configurations do not create accounts, provide credentials, or deploy anything just by being present.

These boundaries keep the workflow straightforward: write notes, choose what may be public, build, and host the result.

## Try it yourself

Start with [[About/Quick start|your own repository and first local site]]. Then [[About/Obsidian themes|choose a look]], [[About/Markdown and Bases|connect a few notes]], and [[About/Deployment|put the finished website online]].

[[Welcome|Back to Welcome to Lattice]] · [[About/Documentation|Browse the tutorials]]
