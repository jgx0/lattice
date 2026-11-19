---
title: Markdown and Bases
category: documentation
tags: [lattice, documentation, markdown]
description: Supported Markdown, wikilinks, transclusions, media, and the bounded Bases runtime.
---

Lattice compiles notes on the build machine. Ordinary Markdown and supported Obsidian syntax become sanitized HTML. The browser receives rendered public pages and searchable note text/properties, not the original complete Markdown files. Nonliteral Obsidian comments are omitted from the searchable body; literal `%%` examples inside fenced or inline code are preserved. The browser does not upload or process local vault files or run Obsidian plugins.

## Note titles and properties

Put the page title in YAML frontmatter. The reader supplies the page heading, so avoid repeating it as a top-level heading in the body.

```markdown
---
title: My note
aliases: [Another name]
tags: [research]
description: A short description for this page.
---

An opening paragraph.

## A useful section

The note continues here.
```

Properties can drive Bases and are part of public compiled data even if the properties panel is hidden. Wikilinks in property strings, lists, and nested values contribute to backlinks and graphs and become clickable links in the properties panel and Base cells. For example:

```yaml
category: "[[Field Notes/Digital gardens]]"
related:
  - "[[Field Notes/Walking as research|Walking]]"
  - "[[Field Notes/Digital gardens#A link should carry a thought|A useful link]]"
```

Use unquoted YAML booleans for privacy flags, not strings; see [[About/Security and privacy]].

## Links and transclusions

Use vault-relative wikilinks when filenames could be ambiguous. Aliases change displayed text without changing the target.

```markdown
[[Field Notes/Digital gardens]]
[[Field Notes/Digital gardens|Digital gardens]]
[[Field Notes/Digital gardens#A link should carry a thought]]
[[Field Notes/Digital gardens#^link-test]]

![[Field Notes/Digital gardens#^link-test]]
![[Field Notes/Walking as research#A detail to return to]]
![[Field Notes/The useful edge]]
```

These examples point to existing sample notes. A block identifier such as `^link-test` marks the source block. Whole-note, heading, and block embeds are supported; recursion is bounded, so cyclic or excessively nested embeds are not an unlimited expansion mechanism.

Markdown links and heading/block anchors also work. The build rewrites resolved internal links to published URLs. Renaming a file can change its route; update incoming links before rebuilding.

## Reader syntax and media

Supported forms include tables, native-style callouts, disabled task checkboxes, footnotes, highlighting, fenced code, and bundled LaTeX output. Tasks are rendered for reading, not synchronized back to the source. Fenced code is displayed, not executed.

```markdown
> [!note] A useful boundary
> Keep the source visible and name the uncertainty.

- [ ] An illustrative task

Inline math: $E = mc^2$.
```

Local images, audio, video, and PDFs are supported, including wiki asset embeds and sanitized HTML media. Native playback depends on the browser and codec. Keep controls and text equivalents visible; [[Atlas/Media cabinet]] demonstrates offline SVG/audio/video. Remote frames are a separate trust and privacy decision, not a free extension of the local-media model.

## Bases

Embed a `.base` file from a note. The [[Library/The reading room|reading room]] uses `Data/Reading.base`; [[Field Notes/Digital gardens]] uses `Data/Related.base`.

```markdown
![[Data/Reading.base]]
```

A minimal Base file can select public notes and order a table:

```yaml
filters:
  and:
    - 'file.inFolder("Library/Books")'
    - 'category == "book"'
views:
  - type: table
    name: Books
    order: [file.name, note.author, note.rating]
    sort:
      - property: note.rating
        direction: DESC
    limit: 10
```

You can also put the Base definition directly in your note, in a fenced block labeled `base`:

````markdown
```base
views:
  - type: table
    name: Topic
    filters:
      and:
        - file.links.contains(this.file)
    order:
      - file.name
    sort:
      - property: file.mtime
        direction: DESC
```
````

This renders a table of public notes that link to the current note, with the most recently modified first. `this.file` is the note containing the block. Property wikilinks count too. `file.mtime` comes from the source file's filesystem modification time; `file.ctime` uses its creation time where available. A copied or freshly cloned vault may have different timestamps from the original vault.

Inline Bases use the same views and filters as embedded `.base` files. A fence labeled `yaml` is just a code example; label it `base` to render the view. Invalid configurations produce a visible Base error.

Supported views are `table`, `list`, and `cards`. View-level filters combine with base-level filters; `order` chooses fields, `sort` defines initial sorting, and `limit` bounds displayed rows. A table's columns can also be sorted in the reader. Multiple configured views are rendered as sections, not an Obsidian editing interface.

## Expression context and limits

`file` describes the candidate row; `note` and bare property names access its frontmatter. `this.file` describes the **host note**, not the `.base` source file. For example, `collection == this.file.properties.collection` selects books for the reading room, while `file.path != this.file.path` excludes the host from related rows.

`file.hasLink("Field Notes/Digital gardens")` tests whether a row links to a note, including links in its properties. `file.hasLink(this.file)` and `file.links.contains(this.file)` select notes that link to the host. String, `link(...)`, and `file.link` targets can resolve aliases and heading/block references. `file.hasTag("research")` includes nested tags such as `research/methods`, and supported values can use `toString()` for display.

The evaluator supports a bounded, no-eval subset: property access, comparisons, Boolean/arithmetic operators, lists, conditionals, formulas, and selected helpers such as `contains`, `length`, `if`, `number`, `string`, and `file.inFolder`. Supported list/string methods include `contains`, `join`, `split`, `unique`, `map`, and `filter`; this is not general JavaScript or every Obsidian Bases function. Formula cycles, excessive complexity, and unsupported expressions produce visible Base errors.

Only filtered public notes can become rows. A missing property usually means an empty value or no matching row, not an automatic inferred value. See [[About/Troubleshooting]] for diagnosing Base errors.

[[About/Documentation|Documentation index]].
