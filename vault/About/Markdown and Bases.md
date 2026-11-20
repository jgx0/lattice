---
title: Markdown and Bases
category: documentation
tags: [lattice, documentation, markdown]
description: Supported Markdown, wikilinks, transclusions, media, and the bounded Bases runtime.
---

Create two linked notes, add a few useful properties, and turn a collection of notes into a Base table. Along the way, you will see how the published reader handles headings, callouts, embeds, and backlinks.

Complete [[About/Quick start]] first and keep `npm run dev` running. Make changes in your copied vault, not the included demo. Examples for new notes are shown as code to copy; the live book table later on uses the existing demo notes.

## 1. Write your first page

Create a `Notes` folder in your copied vault, then create `Notes/My first note.md` with:

```markdown
---
title: My first note
aliases: [My starting point]
tags: [learning]
description: A first page for my published notes.
---

This is my first published note.

## Something worth keeping

A small observation is enough to begin. ^first-thought
```

Save the file, open **Notes** in the website's file tree, and click **My first note**. You should see its title above the opening paragraph. The reader supplies that heading from `title`, so you do not need another top-level `# My first note` in the body. Without a `title` property, the filename supplies the title.

Open the page-information sidebar if it is closed. **On this page** should list **Something worth keeping**; clicking it scrolls to the section. Try searching for the alias **My starting point** with **Command+K** or **Ctrl+K**.

## 2. Connect a second note

Create `Notes/Another note.md` with:

```markdown
---
title: Another note
---

This idea grows out of [[Notes/My first note|my first page]].
```

Save, open **Another note**, and click **my first page**. It should take you to the first note, where **Linked mentions** now includes **Another note**. The interactive graph also connects the two pages. If these sections are hidden, enable **Backlinks** and **Interactive graph** in Reader settings.

The part before `|` identifies the target; the part after it changes the visible label. Using the full path inside the vault avoids confusion when different folders contain notes with the same name. Ordinary Markdown links work too: from `Notes/Another note.md`, `[my first page](./My%20first%20note.md)` points at the same file.

Your note's filename and folders determine its published route. Changing `title` changes the heading, not the route; renaming the file can change the route, so update incoming links as well.

## 3. Make properties into useful links

Add these properties to the existing frontmatter of `Notes/My first note.md`, before the closing `---`:

```yaml
category: "[[Notes/Another note]]"
related:
  - "[[Notes/Another note|A related idea]]"
```

Save and scroll to the bottom of **My first note**. If **Properties** is enabled in Reader settings, both values should be clickable. Follow the category link to **Another note**: it now has a linked mention from **My first note**.

A category can be plain text such as `category: book`, or a link to another note. A link in a single property value, a list, or a nested property counts toward backlinks and graph connections just like a body link. Base cells can display these links too. Plain text categories are useful for filters; linked categories are useful when you want the category to have its own page.

Properties remain part of the published data even when their panel is hidden. Exclude private notes or folders using [[About/Configuration]] and [[About/Security and privacy]], rather than relying on a reader setting.

## 4. Add a callout, tasks, math, and a footnote

Append this to `Notes/My first note.md`:

```markdown
> [!tip] Start small
> One clear paragraph is enough for today.

- [x] Create my first page
- [ ] Add another observation

Inline math: $E = mc^2$.

A note can leave room for a source.[^source]

[^source]: Put the reference or extra explanation here.
```

After saving, you should see a styled **Start small** callout, one checked and one unchecked task, formatted math, and a numbered footnote. Click the footnote number to move to its explanation.

The website is read-only: task checkboxes show the source state but cannot update it. Change `[ ]` to `[x]` in your vault and save to change the published task. Ordinary fenced code is displayed rather than executed. Tables, highlighting with `==text==`, and block math between `$$` lines are also supported.

## 5. Bring a section into another page

Append this to `Notes/Another note.md`:

```markdown
## A section to revisit

![[Notes/My first note#Something worth keeping]]

## Just the observation

![[Notes/My first note#^first-thought]]
```

The second note should now show the heading section and, separately, the paragraph marked `^first-thought`. A leading `!` embeds content; leaving it out creates a link to the heading or block. To embed the whole note, use `![[Notes/My first note]]`. Avoid embedding pages back into each other: recursive expansion is limited.

For images and other media, keep files in your vault and embed their actual filenames. [[Atlas/Media cabinet]] demonstrates the demo's local image, audio, and video. Local PDFs are supported too; playback and display depend on the reader's browser and the media format. Remote resources can make external requests, so choose them deliberately rather than assuming everything will work offline.

## 6. Turn notes into a Base table

A Base is a saved description of which notes to show and which properties to display. You can write it directly in a note inside a code fence labeled `base`.

For a table of your own tutorial notes, append this to `Notes/Another note.md`:

````markdown
```base
filters:
  and:
    - 'file.inFolder("Notes")'
views:
  - type: table
    name: My notes
    order: [file.name, note.category, note.tags]
    sort:
      - property: file.name
        direction: ASC
```
````

Save and open the page. You should see a **My notes** table with the two notes you created, plus any other published notes already in `Notes`. Click a name to open that page. The category cell for your first note links to **Another note**. A fence labeled `yaml` only displays the definition; `base` renders it.

Here is a working table on this documentation page, using the five books already in the demo vault:

```base
filters:
  and:
    - 'file.inFolder("Library/Books")'
    - 'category == "book"'
views:
  - type: table
    name: Demo bookshelf
    order: [file.name, note.author, note.rating]
    sort:
      - property: note.rating
        direction: DESC
      - property: file.name
        direction: ASC
```

The demo books have plain `category: book` properties, so the filter matches them without needing properties on this host page. Click a column heading to change the table's sorting, or a book name to read it. In your own vault, change `Library/Books` to a folder you actually have and add `category: book` to the notes you want included.

If you prefer a reusable file, save the definition without the surrounding backticks as a `.base` file, then embed its vault-relative filename in a note. The demo [[Library/The reading room|reading room]] embeds `Data/Reading.base`:

```markdown
![[Data/Reading.base]]
```

That particular Base also matches a book's `collection` against the host note's `collection`. The reading room has `collection: books`; copying that embed to a page without the property will not reproduce its shelf. The inline bookshelf above avoids that extra requirement.

## 7. List notes that link to the current page

Append this block to `Notes/My first note.md`:

````markdown
```base
views:
  - type: table
    name: Notes linking here
    filters:
      and:
        - file.links.contains(this.file)
    order: [file.name]
    sort:
      - property: file.mtime
        direction: DESC
```
````

You should see **Another note** in **Notes linking here**, because it links to your first page. `file` is each possible row; `this.file` is the page containing the Base. Links in properties count too. With an embedded `.base` file, `this.file` still means the host note, not the Base file.

`file.mtime` sorts by the source file's filesystem modification time, not a frontmatter date. Copying or cloning your vault can change those times. For dates you want to preserve across computers, add a note property and sort by that instead.

Bases only see included public notes. A folder excluded with `hiddenPaths`, or a note excluded with `private: true` or `publish: false`, cannot appear as a row. A missing property does not supply a guessed value; it can leave a cell empty or cause a filter not to match.

## Optional: more Base expressions

The familiar building blocks are property access, comparisons, Boolean conditions, arithmetic, lists, and formulas. `note.author` and bare `author` both access a row's frontmatter. `order` chooses columns, `sort` sets initial ordering, and `limit` caps the displayed rows. Supported view types are `table`, `list`, and `cards`; multiple views appear as separate sections.

A few useful expressions to try in filters or formulas are:

```text
file.hasLink(this.file)
file.hasLink("Field Notes/Digital gardens")
file.hasTag("research")
link("Field Notes/Digital gardens").toString()
```

`file.hasLink(this.file)` is another way to select notes linking to the host. Link targets can resolve note aliases and heading/block references. `file.hasTag("research")` accepts an optional leading `#`, ignores case, and also matches nested tags such as `research/methods`. `toString()` converts supported values for display; on a link, it produces a wikilink string.

Helpers such as `contains`, `length`, `if`, `number`, and `file.inFolder` cover common cases, along with selected string/list methods. This is a supported subset, not every Obsidian Bases function or arbitrary JavaScript. Unsupported expressions and invalid definitions show a visible Base error; start with a small working table and add one expression at a time. [[About/Troubleshooting]] can help when a table is empty or reports an error.

### What carries over from Obsidian?

Ordinary Markdown, supported wikilinks, heading/block embeds, callouts, read-only tasks, footnotes, math, local media, properties, and the Base views above are good building blocks for published pages. Obsidian comments outside literal code are omitted from the rendered and searchable body.

Obsidian plugins do not run in the reader. Dataview queries, plugin widgets, editing workflows, and unsupported Base functions do not become working website features simply by copying the note. For a page that uses them, replace the output with ordinary Markdown or a supported Base before publishing.

[[About/Documentation|Back to the documentation index]].
