import type { Vault, SiteSettings } from './types';

const gardenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520" viewBox="0 0 960 520" role="img" aria-labelledby="title desc">
  <title id="title">A garden of connected ideas</title>
  <desc id="desc">Observations lead to notes, connections, experiments, and new observations. Reading feeds connections; a monthly letter shares what grows.</desc>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#8065da"/></marker>
  </defs>
  <rect width="960" height="520" rx="24" fill="#faf8f4"/>
  <text x="48" y="58" font-family="Georgia,serif" font-size="28" fill="#302a3d">Nothing grows in isolation.</text>
  <text x="48" y="88" font-family="Arial,sans-serif" font-size="15" fill="#68616f">A connected-note publishing map · Lattice</text>
  <g fill="none" stroke="#8065da" stroke-width="2.5" marker-end="url(#arrow)">
    <path d="M260 192H340"/><path d="M550 192H630"/>
    <path d="M735 232V312"/><path d="M630 352H550"/>
    <path d="M340 352H160V232"/><path d="M445 312V232"/>
    <path d="M838 192Q916 278 838 350" stroke-dasharray="6 6"/>
  </g>
  <g stroke="#d9d1e9" stroke-width="1.5">
    <rect x="50" y="152" width="210" height="80" rx="14" fill="#fff"/>
    <rect x="340" y="152" width="210" height="80" rx="14" fill="#eee8fa"/>
    <rect x="630" y="152" width="210" height="80" rx="14" fill="#e5dcf7"/>
    <rect x="630" y="312" width="210" height="80" rx="14" fill="#eee8fa"/>
    <rect x="340" y="312" width="210" height="80" rx="14" fill="#fff"/>
  </g>
  <g font-family="Georgia,serif" font-size="23" text-anchor="middle" fill="#302a3d">
    <text x="155" y="185">Observe</text><text x="445" y="185">Write a note</text><text x="735" y="185">Make a connection</text>
    <text x="735" y="345">Try a small bet</text><text x="445" y="345">Read &amp; revisit</text>
  </g>
  <g font-family="Arial,sans-serif" font-size="14" text-anchor="middle" fill="#68616f">
    <text x="155" y="211">a walk, a question, a detail</text><text x="445" y="211">keep the context attached</text><text x="735" y="211">name what travels between</text>
    <text x="735" y="371">learn in the world</text><text x="445" y="371">let another voice in</text>
  </g>
  <text x="48" y="463" font-family="Georgia,serif" font-size="19" fill="#55446c">Observe → connect → try → return. Share the fruit, not every seed.</text>
  <text x="48" y="491" font-family="Arial,sans-serif" font-size="13" fill="#68616f">Arrows describe a practice, not a productivity funnel.</text>
</svg>`;
const gardenData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(gardenSvg)}`;

// A quiet, locally generated chime. No recording, fetch, or autoplay is involved.
const makeChimeData = (): string => {
  const rate = 8000;
  const samples = 2400;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const envelope = Math.sin((Math.PI * i) / samples) ** 2;
    view.setInt16(44 + i * 2, Math.round(4500 * envelope * Math.sin((2 * Math.PI * 440 * i) / rate)), true);
  }
  return `data:audio/wav;base64,${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`;
};
const chimeData = makeChimeData();

// One second of silent, original geometric landscape footage, embedded entirely offline.
const landscapeData = 'data:video/mp4;base64,AAAAJGZ0eXBpc29tAAACAGlzb21pc282aXNvMmF2YzFtcDQxAAAC721vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAHydHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAFAAAAAtAAAAAABjm1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAMAAAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAATltaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAD5c3RibAAAAK1zdHNkAAAAAAAAAAEAAACdYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAFAALQASAAAAEgAAAAAAAAAARVMYXZjNjEuMTkuMTAxIGxpYngyNjQAAAAAAAAAAAAAABj//wAAADdhdmNDAWQADP/hABpnZAAMrNlBQZ+fARAAAAMAEAAAAwGA8UKZYAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAEHN0dHMAAAAAAAAAAAAAABBzdHNjAAAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAABBzdGNvAAAAAAAAAAAAAAAobXZleAAAACB0cmV4AAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMAAAANBtb29mAAAAEG1maGQAAAAAAAAAAQAAALh0cmFmAAAAJHRmaGQAAAA5AAAAAQAAAAAAAAMTAAAEAAAAA9ABAQAAAAAAFHRmZHQBAAAAAAAAAAAAAAAAAAB4dHJ1bgAACgUAAAAMAAAA2AIAAAAAAAPQAAAIAAAAABEAABQAAAAADQAACAAAAAANAAAAAAAAAA0AAAQAAAAAFgAAFAAAAAAPAAAIAAAAAA0AAAAAAAAADQAABAAAAAAWAAAQAAAAAA8AAAQAAAAADQAABAAAAASBbWRhdAAAAq4GBf//qtxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz02IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0xMiBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAARpliIQAEP/+5sD5llpumF5FCtWkXKS8UmGVvB9OIBlyGh5c+AAT1Kde4uIhFiuJl/8PJcUCo0fwUDoHwiwJW63Inlvh8FRcqAnhrpMDurP1AEE2HulhNY6U8m4CNZn8zIMqLMojvwJ5m85KPUPYcAAARIHwLMyaYww4t2Enxt5Q7x61T5GVHfJ0+AwKJtsTyappFuqGyTdJDdUyL/1w9RzvlwS2fO2ZNIVeDiUd5dZUvf1HBfTHO9J1L9sSzo3Uhky9HkQTht7JGaoaUhTaZKHCE8R4OgESyMAY0Dp/4z1NDibar9s3lHFnpEhgxad6rl9vYQHJjKacHROk2j5bcmfFfuN1ac72cAVVO4cn8DRFNSbQUWvNSxqiLO8AAAANQZokbEEP/qpVAACFgAAAAAlBnkJ4hv8AAXcAAAAJAZ5hdEM/AAHHAAAACQGeY2pDPwABxwAAABJBmmhJqEFomUwIf//+qZYAAgcAAAALQZ6GRREsN/8AAXcAAAAJAZ6ldEM/AAHHAAAACQGep2pDPwABxwAAABJBmqtJqEFsmUwIZ//+nhAAD5gAAAALQZ7JRRUsN/8AAXcAAAAJAZ7qakM/AAHHAAAAQ21mcmEAAAArdGZyYQEAAAAAAAABAAAAAAAAAAEAAAAAAAAIAAAAAAAAAAMTAQEBAAAAEG1mcm8AAAAAAAAAQw==';

export const demoVault: Vault = {
  name: 'Lattice demo vault',
  files: [
    {
      path: 'Welcome.md',
      kind: 'note',
      content: `---
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

Use **Use this template → Create a new repository** on GitHub to make your own Lattice site. Clone your copy, add a vault, point Lattice at its folder, and run \`npm run dev\`. [[About/Quick start|Quick start]] walks through it from the first button click to your notes on screen.

- [[About/Documentation|Documentation]] — the guides, when you need them.
- [[About/Quick start|Quick start]] — create your repository, add a vault, and open your site.
- [[About/Obsidian themes|Obsidian themes]] — use an installed theme, enabled snippets, and \`publish.css\`.
- [[About/Deployment|Deployment]] — review the static output and deploy to Cloudflare Pages, Vercel, or Netlify.

## How publishing works

Markdown, properties, wikilinks, transclusions, and supported Bases are compiled before the site is served. Every published note has its own semantic HTML page; the browser adds reader interactions to already-rendered content. There is no browser-side vault upload or Obsidian plugin execution.

Set the source vault and site options in \`publish.config.json\`. The development server watches notes, attachments, and theme inputs. Only deliberately published content and referenced assets belong in the generated \`dist/\` directory; review [[About/Configuration]] and [[About/Security and privacy]] before sharing it.

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
`,
    },
    {
      path: 'Field Notes/Digital gardens.md',
      kind: 'note',
      content: `---
title: Digital gardens
aliases: [Working in public, Garden notes]
provenance: Demo content
status: evergreen
category: field-note
date: 2026-11-18
tags: [garden, writing, slow-web]
related-category: field-note
---

A digital garden is not a blog with the dates removed. It is a different agreement with a reader: these ideas have locations, neighbors, and a visible state of growth. You can arrive through any door. The most recent thing is not automatically the most important thing.

I started this garden after finding the same sentence in three notebooks. Each version was slightly better, but none knew about the others. Publishing was not the problem; continuity was. I wanted a place where a thought could remember its earlier encounters without making me maintain a perfect filing system.

## A note is a place to return

My useful unit is neither an isolated quotation nor a definitive essay. It is a question with enough context to revisit. [[Field Notes/Attention is a material]] began as a complaint about notifications. A walk and a reading of [[Library/Books/How to Do Nothing]] changed it into a question about the conditions under which attention becomes possible.

That change matters more than adding another paragraph. A garden should make revision ordinary. I use **seedling**, **growing**, and **evergreen** as descriptions of a note's current usefulness, not certificates of truth. Evergreen notes still need pruning; a seedling can contain the best observation on the site.

> [!note] Maturity is not certainty
> A mature note has a clear question, a source trail, and useful neighbors. It may still end with an honest “I don't know.”

## A link should carry a thought

A link is useful when I can finish the sentence “these belong together because…”. Linking two notes merely because both mention design makes a crowded graph and a weak reading experience. Linking [[Library/Books/A Pattern Language]] to [[Projects/A neighborhood atlas]] is different: both ask which recurring arrangements help ordinary life happen.

A good link tells the reader what travels between two places. ^link-test

I try to put that explanation in the surrounding prose. “See also” is sometimes fine, but “this changes how I choose a stopping place on a walk” gives the reader a reason to cross the bridge. [[Atlas/Maps of meaning]] collects these bridges; it is a map of arguments, not a taxonomy of everything I know.

## Tending is a small practice

On Friday mornings I open one neglected note. I check whether its opening still asks the right question, whether a quotation has a source, and whether a reader could follow the strongest connection without knowing my private shorthand. Then I stop. This is closer to watering a windowsill than managing a content pipeline.

The constraint protects the practice from becoming its own performance. [[Essays/Against the finished thought]] describes the obligation that remains: unfinished work can be hospitable without pretending to be authoritative. A public note is not a license to make the reader do all the editorial labor.

## The boundary matters

Not every observation belongs here. A conversation can shape an idea without becoming publishable material. My private notebook holds names, immediate feelings, and details I have not earned the right to share. The public garden contains what survives a second look and can travel without exposing someone else.

This boundary is also a design choice for [[Projects/Lattice]]. The interface should help a visitor orient, read, and leave; it should not turn the author into a daily entertainer. A successful visit may be short. Someone finds a useful distinction, takes it into their own work, and closes the tab.

## Nearby field notes

This embedded Base uses this note's category and excludes this file. It is a small door into the same shelf, not a list of everything in the vault.

![[Data/Related.base]]
`,
    },
    {
      path: 'Field Notes/Small bets & long horizons.md',
      kind: 'note',
      content: `---
title: Small bets & long horizons
aliases: [Small bets, The two clocks]
provenance: Demo content
status: growing
category: field-note
date: 2026-11-12
tags: [experiments, practice, time]
---

A small bet is a bounded action that makes uncertainty easier to see. A long horizon is a commitment to a question that deserves more than one attempt. I need both. Without the horizon, experiments become restless novelty. Without the small bets, a worthy intention can stay abstract for years.

The current question is simple: can I make a useful neighborhood atlas without turning other people's lives into material? [[Projects/A neighborhood atlas]] is the container. One walk, one sketch, or one invitation to correct a caption is a bet. None needs to prove that the whole project will succeed.

## The two clocks

The short clock asks what I can learn by Friday. The long clock asks what kind of practice I want to have by spring. These clocks should talk, but they should not be forced to agree on every tick. An awkward first sketch can be a good weekly result if it exposes a problem the seasonal project needs to understand.

My seasonal promise is to stay with the question for twelve weeks. My weekly promise is to make the next action small enough that real evidence can arrive. “Explore community” is not an action. “Ask two people whether this map omits a place to sit” is one, provided the invitation is optional and the answer is not treated as representative of everyone.

> [!example] A bet with a useful boundary
> Draw one block from memory, then walk it. Mark three differences. Spend no more than ninety minutes. Keep the surprising omission, not just the prettier map.

## Expected value is not the whole story

For a simple reversible decision, I sometimes write $E[V] = pG - (1-p)L - C$, where $p$ is the chance of a useful result, $G$ its value, $L$ the loss if it fails, and $C$ the cost of trying. The symbols force me to say what I mean by “worth it.” They do not turn uncertain guesses into measured facts.

The more important value can be learning. A trial that makes no attractive artifact might reveal that my research question was badly framed. I record that separately rather than inventing a number to make the equation look complete.

$$
V_{\\text{trial}} = V_{\\text{outcome}} + V_{\\text{learning}} + V_{\\text{option}} - C
$$

Here an option is the ability to take a better next step without being obliged to take it. Keeping a project reversible often matters more than maximizing its first result. This is where [[Essays/Enough is a design constraint]] meets experimentation: a budget can protect the room needed for learning.

## Decide the stopping rule first

Before starting, I write down the time limit, the evidence I hope to encounter, and the condition under which I will stop. Otherwise an interesting activity can quietly become an endless obligation. A stopping rule also prevents me from interpreting persistence as proof that the idea is good.

For the atlas, I will pause if I cannot explain what a participant gets from contributing. More data is not an answer to that question. [[Library/Books/Braiding Sweetgrass]] has made me more alert to the difference between receiving and extracting, though I do not want to flatten its richer account of reciprocity into a project-management slogan.

## A record, not a scoreboard

My review has three lines: what happened, what changed my mind, and what I will try next. I do not tally a winning streak. The point is to accumulate better contact with the world, not evidence that I am an unusually productive person.

The current checklist lives in [[Projects/A season of small bets]]. When I lose the larger thread, I return to [[Field Notes/Walking as research]]: the place gets a vote. That is the horizon worth keeping.
`,
    },
    {
      path: 'Field Notes/Attention is a material.md',
      kind: 'note',
      content: `---
title: Attention is a material
aliases: [The shape of attention]
provenance: Demo content
status: evergreen
category: field-note
date: 2026-11-10
tags: [attention, design, place]
---

I used to describe attention as a tank: full in the morning, depleted by evening. That metaphor helped me protect quiet hours, but it also made every interruption look like theft and every distraction look like a personal failure.

A material is a better metaphor. Attention has grain. It behaves differently in a conversation, on a familiar walk, and in front of a difficult page. The task is not simply to possess more of it, but to understand what arrangements let it take a useful shape.

## Conditions before willpower

At the library, a table facing a wall makes reading easier. At home, leaving my phone in the hallway helps more than deciding to be disciplined. These are modest observations, not universal rules. Their common feature is that they change the situation before demanding a heroic self.

[[Library/Books/How to Do Nothing]] adds a necessary complication: choosing what to attend to is also choosing which relationships to recognize. Looking closely at a tree is not merely a technique for returning to work refreshed. The tree, the street, and the history of that street might deserve attention in their own right.

> [!abstract] A working distinction
> Concentration narrows the field. Attention can also widen it. A well-designed place should make both possible.

## Three tests for an interface

1. Can I tell what matters without opening everything?
2. Can I stop without losing my place?
3. Is quietness a real default, or an option buried behind stimulation?

These tests guide [[Projects/Lattice]]. A readable page, a restrained violet accent, and links that explain their destination are not cosmetic preferences. They are ways to reduce the work of deciding where to look.

## What the metaphor misses

Calling attention a material could make it sound like something a designer owns and molds. It is not. A person arrives with needs and intentions I cannot infer from a click. The appropriate design ambition is to make room, not to capture.

[[Essays/A quieter internet]] follows this boundary into publishing. [[Field Notes/Walking as research]] follows it out the door. Both ask whether I can notice something without immediately turning it into an input.
`,
    },
    {
      path: 'Field Notes/Walking as research.md',
      kind: 'note',
      content: `---
title: Walking as research
aliases: [The place gets a vote]
provenance: Demo content
status: growing
category: field-note
date: 2026-11-08
tags: [walking, place, attention]
---

A walk is useful research when it can correct the question I brought outside. If I only collect examples of an argument already written, the neighborhood becomes an illustration instead of a participant.

## The second lap

On the first lap I write almost nothing. On the second, I record places where my pace changes: a narrow pavement, a tree with low branches, an unexpected bench. On the third visit, I ask which of those details still matters and which belonged to that day's mood.

This repeatable route is the first method for [[Projects/A neighborhood atlas]]. It keeps the project close enough to the ground that a beautiful diagram cannot hide a missing crossing.

> [!question] What did the map leave out?
> Routes are easy to draw. Shade, hesitation, welcome, and the possibility of resting take more careful description.

## What I carry

A pencil, one folded sheet, and a phone kept away unless a photograph has a clear purpose. I sketch arrangements rather than identifiable people. A private doorstep is not public research material merely because it is visible from the pavement.

## A detail to return to

The bench outside the repair shop faces sideways to the street. Sitting there, you can watch without feeling on display. That small orientation belongs beside [[Library/Books/A Pattern Language]] and [[Atlas/Patterns and places]]: a spatial choice changes a social possibility.

My reminder is simple: the place gets a vote. ^place-vote

See [[Field Notes/Small bets & long horizons]] for the rhythm that keeps this practice bounded, and [[Field Notes/Attention is a material]] for why changing pace can be a form of thinking.
`,
    },
    {
      path: 'Field Notes/The useful edge.md',
      kind: 'note',
      content: `---
title: The useful edge
aliases: [Productive boundaries]
provenance: Demo content
status: seedling
category: field-note
date: 2026-10-29
tags: [boundaries, design, patterns]
---

An edge can divide two things or give them a place to meet. A windowsill separates indoors from outdoors but also supports a plant. A book margin separates the author's sentence from the reader's response, while making room for both.

## Not every boundary is a wall

In [[Library/Books/A Pattern Language]], I keep returning to spaces that let a person choose how much to participate: a porch, an alcove, a seat at the side of a room. The useful edge offers a gradient rather than a demand to be entirely in or out.

A digital equivalent might be a preview. Hovering over a link in [[Welcome]] gives enough context to make a choice without replacing the page being read. The edge is useful because crossing it remains voluntary.

## Where the analogy breaks

A porch has weather, neighbors, and property rights. An interface has different constraints. I want the spatial analogy to generate questions, not answers. Does a preview clarify the destination? Can it be dismissed easily? Is the same information available without hovering?

The last question matters for keyboards and touch screens. A lovely edge that only works for one kind of visitor is not hospitable.

## Next observation

For [[Projects/A neighborhood atlas]], sketch three thresholds where people actually pause. For [[Projects/Lattice]], test one reading route without a mouse. Compare the choices each environment permits, not their visual resemblance.
`,
    },
    {
      path: 'Essays/A quieter internet.md',
      kind: 'note',
      content: `---
title: A quieter internet
aliases: [Invitation, not interruption]
provenance: Demo content
status: growing
category: essay
date: 2026-11-14
tags: [slow-web, attention, publishing]
---

The internet I want is not silent. It has lively conversations, strange personal pages, arguments that take time, and people who care enough to explain something carefully. What it lacks is the assumption that every available moment should be filled on someone else's behalf.

Quietness, in this sense, is the ability to choose an encounter. It is not an aesthetic of beige pages or a retreat from difficult subjects. A page can be visually spare and still be coercive. A bright, crowded site can be generous if it tells you where you are and lets you leave.

## Invitation and interruption

An invitation makes its terms visible. Here is a letter, a note, a question; you can decide when it fits. An interruption assigns urgency before the reader has had a chance to make that decision. The difference is not simply whether a notification exists. A requested reminder can be an invitation kept at the right time.

The problem begins when urgency is borrowed from relationships that have not been earned. A red badge uses the language of obligation. A streak makes absence look like damage. A feed that rearranges itself while I read treats orientation as expendable.

> [!warning] A quiet surface can still demand too much
> Removing animation does not fix a design that measures success by how difficult it is to stop. Ask what behavior the system rewards, not just what colors it uses.

[[Field Notes/Attention is a material]] gives me a practical test: does this arrangement support the reader's intention, or substitute a new intention for it? The answer can be uncomfortable even for a small personal site. Backlinks and graphs can help someone explore, but they can also make every note feel like an entrance to an endless maze.

## A page should have an exit

For [[Projects/Lattice]], I want a visitor to reach a useful stopping point. Headings should reveal the shape of a note. A link should explain what it adds. A page should not move unexpectedly. Optional panels should remain optional, and a reader should be able to enjoy the prose without understanding the machinery around it.

A good exit is sometimes a single sentence worth taking away. It might also be a book to find at the library or a question to carry on a walk. None of those outcomes requires another page view. The site has done its job when the reader's next action can happen elsewhere.

## A different rhythm of publishing

[[Projects/The monthly letter]] is my experiment with this rhythm. One letter gathers a few things that survived a month of revisiting. It does not announce every edit, and it does not manufacture an insight to justify its schedule. If the month produces one useful question instead of three polished conclusions, the letter can say that.

This is not a claim that slow is always better. Emergency information should be fast. Collaborative work can need rapid replies. The useful distinction is between the tempo a situation requires and the tempo a system imposes because it benefits from repeated checking.[^tempo]

## Small places are still places

A personal [[Field Notes/Digital gardens|digital garden]] cannot repair the whole internet. It can make a local agreement and keep it. No surprise sound. No unrelated recommendations disguised as continuation. No private conversation published as raw material. Enough context for a stranger, enough restraint to respect their time.

These are not nostalgic gestures toward an earlier web. They are present-tense design choices. The more convincing version of a quieter internet is not an argument about quietness; it is a page that behaves well when someone arrives tired, curious, and free to leave.

[^tempo]: This is a design distinction, not a clinical claim about attention or a measured comparison of platforms. My examples come from my own reading habits.
`,
    },
    {
      path: 'Essays/Against the finished thought.md',
      kind: 'note',
      content: `---
title: Against the finished thought
aliases: [An honest unfinishedness]
provenance: Demo content
status: evergreen
category: essay
date: 2026-11-03
tags: [writing, garden, uncertainty]
---

There is a familiar publishing trap: I wait until an idea can survive every imagined objection, and then mistake the resulting delay for rigor. Usually the thought is not becoming more accurate. It is becoming harder to encounter.

The opposite trap is equally familiar. I publish the first version, call it “working in public,” and ask the reader to supply the context, structure, and cautions I did not bother to write. Neither perfection nor raw exposure is a good agreement.

## What I owe a reader

A public draft should say what question it is trying to answer. It should separate observation from inference. If another person's work made the thought possible, that source should be visible. The opening should not promise a certainty the rest of the note cannot deliver.

These obligations do not require a finished argument. They require an edited encounter. A reader should be able to tell whether they are looking at a field observation, a proposal, or a claim supported by wider evidence. My frontmatter categories are modest signals toward that distinction, not substitutes for making it clear in the prose.

> [!quote] An illustrative reminder
> “Leave room for a question, and give the reader enough context to explore it.”
>
> — Demo note

## Revision without erasure

When [[Field Notes/Digital gardens]] changed from a note about organization into a note about returning, I kept the original problem in its opening. The earlier question still explains why the later argument exists. Revising everything into apparent inevitability would make the page smoother and less truthful.

I do not keep every sentence. A garden is not a museum of drafts. But when a correction changes the meaning of a note, I want the new version to acknowledge it. “I used to think…” is sometimes the most useful bridge a reader can cross.

## Confidence is not a writing style

Short declarative sentences sound confident even when their evidence is thin. Long qualifications can sound careful while hiding an empty claim. The task is not to choose one voice. It is to attach the right amount of confidence to the particular sentence.

[[Field Notes/Small bets & long horizons]] is an example. Its equations clarify a decision model; they do not establish measured values. Naming that limit makes the model more useful, not less. The reader can decide whether the distinction helps without being asked to accept the numbers as science.

## A place for the next version

I want each note to contain a reachable next question. Not a theatrical cliffhanger, just a visible edge: what observation would change this? What does the metaphor leave out? Whose perspective is absent?

[[Field Notes/The useful edge]] remains a seedling because the spatial analogy has not earned its conclusion. That is a useful state to publish if the questions are specific. The next walk or conversation can meet them.

An unfinished thought is worth sharing when it offers something complete enough to use: a distinction, a method, a source trail, or a question with real stakes. That is the standard I want for [[Projects/Lattice]], and for this garden. The work can remain open without leaving the reader stranded.
`,
    },
    {
      path: 'Essays/Enough is a design constraint.md',
      kind: 'note',
      content: `---
title: Enough is a design constraint
aliases: [The shape of enough]
provenance: Demo content
status: growing
category: essay
date: 2026-10-25
tags: [design, limits, practice]
---

“Enough” sounds like a decision made after the work: enough features, enough research, enough polish. I am trying to move it to the beginning. A useful constraint names what a project needs to protect before it names what the project could accumulate.

## What is the work for?

For [[Projects/Lattice]], enough means a stranger can find a note, read it comfortably, understand a connection, and return to the place they started. A graph is welcome if it helps that journey. It is not required to justify the app's existence.

For [[Projects/A neighborhood atlas]], enough means one route is described with care and can be corrected by the people who use it. A large map with unexamined captions would be more complete geographically and less complete ethically.

> [!success] A useful stopping point
> A person can do the thing they came to do, and nothing important has been hidden to make the experience feel simple.

## Constraints as room

A page budget makes me choose the sentence that actually carries the argument. A ninety-minute experiment leaves energy for a second attempt. A monthly letter means I do not need every day's reading to become an announcement.

These are not universal ideals of smallness. Some work needs scale, redundancy, or painstaking detail. The point is to choose a size appropriate to the responsibility rather than inherit a preference for more.

## The review question

Instead of “What else could we add?”, I ask “What is still difficult for the intended reader?” The answer might require a feature. It might require removing a feature, improving a heading, or admitting that the note does not yet know what it means.

[[Field Notes/Small bets & long horizons]] turns this into a rhythm: protect a long-lived question, bound the next attempt, and decide what evidence would justify another. Enough is not the enemy of ambition. It gives ambition somewhere to stand.
`,
    },
    {
      path: 'Library/The reading room.md',
      kind: 'note',
      content: `---
title: The reading room
aliases: [Reading room, Bookshelf]
provenance: Demo content
status: evergreen
category: library
date: 2026-11-17
tags: [reading, books, index]
collection: books
---

A small shelf of books that have changed the questions I ask. This is not a ranking of the best books, nor a record of everything I've finished. I keep a book here when it has become a useful conversation partner.

## On the shelf

The table below is a live Base, scoped to this note's **collection** property. Book entries have their own author, reading status, rating, and related ideas. Ratings describe my wish to revisit a book, not its value to every reader.

![[Data/Reading.base]]

## Three ways in

- **Attention and everyday life** — [[Library/Books/How to Do Nothing]] asks what deserves our attention; [[Library/Books/The Art of Noticing]] offers practical ways to begin looking.
- **Places and patterns** — [[Library/Books/A Pattern Language]] and [[Library/Books/The Practice of Everyday Life]] disagree fruitfully about what a designed space can determine.
- **Receiving and returning** — [[Library/Books/Braiding Sweetgrass]] slows my instinct to turn every useful idea into a tool.

> [!info] How I take a reading note
> Start with the book's question, write one claim in my own words, and connect it to an observation. Page references belong beside quotations. The notes here are paraphrases unless explicitly marked otherwise.

## Reading into the garden

A book note earns its place when it leaves the library. Alexander meets a sideways bench in [[Field Notes/Walking as research]]. Odell meets interface choices in [[Essays/A quieter internet]]. Kimmerer complicates my invitation to contribute to [[Projects/A neighborhood atlas]].

I try not to ask a book to endorse a project its author never encountered. “This made me ask…” is often more accurate than “This proves…”.

## Currently open

I am rereading selected patterns rather than reading Alexander straight through. De Certeau is slower going; I am keeping the disagreements visible in [[Atlas/Patterns and places]]. A question that survives a difficult chapter is sometimes a better result than a tidy summary.
`,
    },
    {
      path: 'Library/Books/A Pattern Language.md',
      kind: 'note',
      content: `---
title: A Pattern Language
aliases: [Alexander on patterns]
author: Christopher Alexander, Sara Ishikawa, and Murray Silverstein
contributors: [Max Jacobson, Ingrid Fiksdahl-King, Shlomo Angel]
provenance: Demo content
status: rereading
category: book
date: 2026-11-16
tags: [reading, patterns, place]
collection: books
rating: 5
year: 1977
publisher: Oxford University Press
---

**A Pattern Language: Towns, Buildings, Construction** proposes a connected vocabulary of spatial problems and responses. What interests me is not the possibility of a universal catalog. It is the insistence that a detail should be understood through the life it helps make possible.

## Patterns are relationships

A window seat is not only a seat next to a window. It combines a view, light, a degree of enclosure, and permission to pause. If I copy the visible form without the conditions, I may reproduce the object and miss the pattern.

This is the strongest bridge to [[Atlas/Patterns and places]]. A useful pattern names a recurring tension and the relationships that ease it. It should remain available to adaptation rather than become a rule that every site must obey.

## The bench test

The sideways bench in [[Field Notes/Walking as research]] offers a small test. Its orientation makes watching the street possible without placing the sitter directly on display. I can describe that relation without pretending that one bench proves a general theory.

For [[Projects/A neighborhood atlas]], I want captions that say what a place permits: rest near activity, shelter without isolation, a view without exposure. This is more informative than a list of amenities alone.

## A productive disagreement

[[Library/Books/The Practice of Everyday Life]] reminds me that people make uses a designer did not foresee. A pattern language can reveal possibilities, but it should not claim to determine experience. The lived place has authors beyond the architect.

**Return to:** [[Field Notes/The useful edge]], especially the question of choosing how much to participate. **Caution:** read these patterns as situated proposals; do not erase climate, access, culture, or ownership in pursuit of a pleasing form.
`,
    },
    {
      path: 'Library/Books/How to Do Nothing.md',
      kind: 'note',
      content: `---
title: How to Do Nothing
aliases: [Odell on attention]
author: Jenny Odell
provenance: Demo content
status: read
category: book
date: 2026-11-10
tags: [reading, attention, slow-web]
collection: books
rating: 5
year: 2019
publisher: Melville House
---

**How to Do Nothing: Resisting the Attention Economy** is not primarily an instruction to become less busy. I read it as an argument for recovering the ability to decide what matters, including things that cannot justify themselves through productivity.

## Attention has neighbors

The book helped me move from “How can I concentrate longer?” to “What am I learning to recognize?”. A repeated walk can reveal birds, maintenance work, informal gathering places, and histories that a route optimized for speed leaves invisible.

That shift is the hinge of [[Field Notes/Attention is a material]]. The issue is not only who owns my time. It is which relationships become perceptible when time is no longer arranged exclusively around output.

## Refusal is not disappearance

I do not take the book as a case for leaving public life. A refusal can make room for a different participation. The question is whether an action answers to the actual situation or to a system that makes constant availability feel compulsory.

[[Essays/A quieter internet]] applies this distinction to a personal website. The analogy is mine: a page can invite an encounter without converting the reader's curiosity into a demand to keep clicking.

## A practice I kept

Once a week I walk the same route without listening to anything. This is not a test of virtue. It is a way of letting the place interrupt my own internal feed. I record one thing I could not have noticed from my desk.

**Connected project:** [[Projects/A neighborhood atlas]]. **Open question:** how do I protect quiet attention without treating the people who need fast, noisy channels as the problem?
`,
    },
    {
      path: 'Library/Books/Braiding Sweetgrass.md',
      kind: 'note',
      content: `---
title: Braiding Sweetgrass
aliases: [Kimmerer on reciprocity]
author: Robin Wall Kimmerer
provenance: Demo content
status: read
category: book
date: 2026-10-30
tags: [reading, reciprocity, ecology]
collection: books
rating: 5
year: 2013
publisher: Milkweed Editions
---

**Braiding Sweetgrass: Indigenous Wisdom, Scientific Knowledge, and the Teachings of Plants** brings botanical knowledge, Indigenous teachings, and personal narrative into conversation. These are not interchangeable styles of describing an inert world. They carry different relationships and responsibilities.

## Receiving is an active relation

The question I keep carrying away is not “How can nature make my work better?” but “What does receiving well ask of me?”. Gratitude can become decorative if it has no effect on what I take, how I take it, or what I return.

I want to keep that question attached to the book's context. Reciprocity here is richer than a transaction in which I balance my own ledger. Reducing it to a clever sustainability principle would miss the relationships from which the teaching arises.

## A limit on my own project

In [[Projects/A neighborhood atlas]], a person who corrects a caption is offering time and local knowledge. A credit line does not automatically make that exchange fair. Can they see the result? Can they withdraw a detail? Does the atlas serve any purpose they recognize?

These are my project questions, not a claim that the book supplies a complete ethics protocol. The note helps me resist treating a generous contribution as frictionless input.

## Reading slowly

I reread one chapter at a time and leave room before turning it into a note. Some passages deserve a response in action more than a shareable sentence.

**Nearby:** [[Field Notes/Small bets & long horizons]], where reversibility meets responsibility; [[Atlas/People and influences]], where I keep sources visible. **Reminder:** a book can change my conduct without becoming evidence for every argument I want to make.
`,
    },
    {
      path: 'Library/Books/The Practice of Everyday Life.md',
      kind: 'note',
      content: `---
title: The Practice of Everyday Life
aliases: [De Certeau on everyday life]
author: Michel de Certeau
translator: Steven Rendall
provenance: Demo content
status: reading
category: book
date: 2026-11-07
tags: [reading, place, everyday-life]
collection: books
rating: 4
year: 1984
publisher: University of California Press
---

The English edition of **The Practice of Everyday Life** gives me a vocabulary for the difference between an arranged system and the ways people move through it. I am reading slowly, especially the discussion of walking in the city.

## The plan and the practice

A map can show a street without showing what it is like to cross it with a heavy bag, avoid a windy corner, or take a detour to greet someone. These uses are not necessarily failures to follow the plan. They are part of what makes the place lived.

This complicates [[Library/Books/A Pattern Language]]. I value design that makes generous possibilities available, but I should not confuse those possibilities with a complete script for life.

## A mapping question

For [[Projects/A neighborhood atlas]], what can I show without pretending to see from everywhere? A route caption can admit its standpoint: walked on a dry weekday morning, at my pace, with places to stop. That is less grand than a universal map and more useful to correct.

## Still working through

I am not yet confident enough to compress the distinction between strategies and tactics into a definition I would publish as settled. For now I am keeping examples beside the terms and checking them against the text.

**Next connection:** [[Atlas/Patterns and places]]. **Next practice:** walk the same block at a different hour and record what the first account could not see.
`,
    },
    {
      path: 'Library/Books/The Art of Noticing.md',
      kind: 'note',
      content: `---
title: The Art of Noticing
aliases: [A practice of noticing]
author: Rob Walker
provenance: Demo content
status: read
category: book
date: 2026-10-21
tags: [reading, attention, practice]
collection: books
rating: 4
year: 2019
publisher: Knopf
---

**The Art of Noticing** collects small exercises that interrupt familiar ways of looking. Its usefulness for me is practical: I can try one prompt on an ordinary Tuesday without reorganizing my life around a new discipline.

## Change the search image

Looking for a particular kind of detail changes what comes forward. On one walk I looked only for improvised signs. I noticed handwritten opening hours, a repaired noticeboard, and a lost-glove message that had become a tiny public conversation.

The exercise did not reveal the “real” neighborhood beneath a false one. It showed that my ordinary search image is selective. [[Field Notes/Walking as research]] turns that observation into a repeatable method: vary one condition and compare what becomes visible.

## Avoid the trophy cabinet

Noticing can become collecting clever observations for an audience. I try to keep one detail that does not make a good photograph or a witty sentence. The squeak of a gate is no less part of a place because it resists a social post.

## A small experiment

On the next atlas walk, record repairs rather than damage. Ask what the repairs reveal about care, constraints, and continued use. Do not infer the maker's motive from the object alone.

**In conversation with:** [[Library/Books/How to Do Nothing]]. Walker helps me begin an exercise; Odell asks what the exercise is for. I need both questions.
`,
    },
    {
      path: 'Projects/Lattice.md',
      kind: 'note',
      content: `---
title: Lattice
aliases: [Why Lattice, The garden interface]
category: project
tags: [lattice, publishing]
description: A filesystem-driven static publisher for connected Obsidian notes.
---

**Lattice** publishes an Obsidian vault as a static site with a restrained, note-native reader. Notes remain notes: no injected author cards, reading-time labels, maturity badges, product attribution, or decorative footers.

## What it does

Markdown, YAML properties, wikilinks, transclusions, Bases, and theme assets are compiled locally at build time. Each published note has its own semantic HTML page. The browser adds navigation, search, hover previews, graphs, sortable tables, and optional stacked pages to already-rendered content.

Use the actual theme installed in your vault, its enabled snippets, and \`publish.css\`; the reader exposes familiar Obsidian classes and CSS variables. Obsidian plugins are not executed.

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
`,
    },
    {
      path: 'Projects/A neighborhood atlas.md',
      kind: 'note',
      content: `---
title: A neighborhood atlas
aliases: [The neighborhood project]
provenance: Demo content
status: growing
category: project
date: 2026-11-16
tags: [place, walking, experiments]
---

A small atlas of places that make everyday life easier: a sheltered pause, a legible crossing, a bench where sitting does not feel like being on stage. The first edition will cover one walking route, not the entire neighborhood.

## What the first walks taught me

I began by drawing paths. The useful discoveries were stopping places. The sideways bench outside the repair shop, the sheltered corner beside the library, and a wide patch of pavement where two people can talk without blocking anyone all changed the character of the route.

[[Field Notes/Walking as research]] is the method note. [[Library/Books/A Pattern Language]] helps me describe arrangements, while [[Library/Books/The Practice of Everyday Life]] warns against treating a plan as the whole experience.

> [!failure] The first map was too certain
> A clean line implied a continuous, easy route. It hid a difficult crossing and a stretch with nowhere to rest. The next version needs honest interruptions, not more polish.

## Boundaries before detail

- No identifiable people in sketches.
- No private addresses presented as points of interest.
- Contributions are invitations, not requests that need an explanation to decline.
- A contributor can review or withdraw their detail before publication.
- Captions distinguish what I observed from what someone told me.

[[Library/Books/Braiding Sweetgrass]] is a reminder to ask what contributors receive, not just what the atlas receives.

## First edition

One folded route map, five short place notes, a date and weather line, and a clear invitation to correct an omission. Access observations will be specific, not an unsupported claim that a route works for everyone.

The weekly experiments live in [[Projects/A season of small bets]]. The larger map of ideas lives in [[Atlas/Patterns and places]]. I will call this edition useful when it can help someone choose a pause and can admit what it has not seen.
`,
    },
    {
      path: 'Projects/The monthly letter.md',
      kind: 'note',
      content: `---
title: The monthly letter
aliases: [Letters from the garden]
provenance: Demo content
status: seedling
category: project
date: 2026-11-13
tags: [writing, slow-web, correspondence]
---

A monthly letter is a slower front door to this garden. It gathers a few things that became more useful through revisiting, rather than announcing every new note.

This demo describes the practice; there is no subscription form, mailing service, or hidden signup.

## The shape of a letter

One observation from a walk, one book in conversation with it, and one question that has not settled. Three links at most. Enough context that a person can enjoy the letter without opening the site.

November's working thread is **places to pause**: the bench in [[Field Notes/Walking as research]], the conditions described in [[Library/Books/A Pattern Language]], and the question of voluntary participation in [[Field Notes/The useful edge]].

## An editorial boundary

A monthly date is an opportunity to review, not a demand to invent an insight. If all I have is a useful correction, that can be the letter. If someone else's story helped me think, their permission still matters even when the story would make a wonderful opening.

## Draft opening

This month I drew a route and discovered I had forgotten the places where a person could stop. The line was accurate as geometry and inaccurate as an invitation. I am trying again with the pauses marked first.

That sentence belongs beside [[Essays/A quieter internet]]. Publishing can offer a place to arrive without demanding that arrival happen immediately.

**Next step:** finish one honest letter before deciding whether this needs any infrastructure at all.
`,
    },
    {
      path: 'Projects/A season of small bets.md',
      kind: 'note',
      content: `---
title: A season of small bets
aliases: [The autumn experiments]
provenance: Demo content
status: growing
category: project
date: 2026-11-12
tags: [experiments, practice, atlas]
season: autumn-2026
---

Twelve weeks with one question: what makes a neighborhood route hospitable to a person who is not in a hurry? [[Field Notes/Small bets & long horizons]] explains the two clocks. This page holds the work, not a score.

## Checklist

- [x] Walk the first route without taking photographs.
- [x] Draw one block from memory and mark three omissions.
- [x] Replace “nice bench” with a description of what its orientation permits.
- [ ] Walk the route after rain and record shelter, puddles, and stopping places.
- [ ] Invite two optional caption reviews; explain how to withdraw a contribution.
- [ ] Make the first folded map with interruptions visible.
- [ ] Write a one-page account of what changed my question.

## Last review

**What happened:** the map contained movement but almost no rest.

**What changed my mind:** a short sit at the repair-shop bench made the street feel different. Orientation mattered as much as the presence of a seat.

**Next bet:** map five stopping places before drawing the connecting route. Limit the first pass to ninety minutes.

## Stop or change course

Pause if the atlas needs personal details that have no clear public purpose. Reduce scope if accuracy depends on more observation time than I can actually give. Do not use an approaching deadline as permission to make a caption more confident.

The result returns to [[Projects/A neighborhood atlas]]. The pattern question returns to [[Atlas/Patterns and places]]. A useful failed attempt is allowed to end here.
`,
    },
    {
      path: 'Atlas/Maps of meaning.md',
      kind: 'note',
      content: `---
title: Maps of meaning
aliases: [The garden map, Crossroads]
provenance: Demo content
status: evergreen
category: atlas
date: 2026-11-15
tags: [index, connections, garden]
---

A map is useful when it helps a person choose a next step. This one shows the practices that keep the garden alive, not a complete inventory of its contents.

## The working loop

![[Assets/Garden diagram.svg|A garden of connected ideas: observe, write, connect, try, and return]]

Observation gives a note something to answer to. Reading introduces another voice. A connection names what can travel between them. A small experiment returns the idea to the world, where it can be corrected.

The diagram is one responsive SVG with a descriptive title and text; it is a working illustration, not a photograph.

## Attention → place → practice

[[Field Notes/Attention is a material]] changes what I look for. [[Field Notes/Walking as research]] gives that looking a repeatable form. [[Projects/A neighborhood atlas]] asks whether the result can be useful to someone else.

## Reading → patterns → design

[[Library/The reading room]] is the source shelf. [[Atlas/Patterns and places]] holds a useful disagreement. [[Projects/Lattice]] turns some of the questions into an interface without claiming the books as endorsements.

## Writing → revision → hospitality

[[Field Notes/Digital gardens]] supplies the practice. [[Essays/Against the finished thought]] names the responsibility. [[Essays/A quieter internet]] asks whether the resulting place respects a reader's freedom to leave.

## A paragraph worth carrying

![[Field Notes/Digital gardens#^link-test]]

The block above is embedded from the original note, so the reminder has one place to be tended. A good map should reduce duplication as well as confusion.

For the authors and ideas connected by these sample notes, see [[Atlas/People and influences]].
`,
    },
    {
      path: 'Atlas/Patterns and places.md',
      kind: 'note',
      content: `---
title: Patterns and places
aliases: [The lived place]
provenance: Demo content
status: growing
category: atlas
date: 2026-11-09
tags: [patterns, place, design]
---

This is a crossroads between a designed arrangement and a lived use. I want to keep both visible without pretending they settle into a simple formula.

## Two books, one productive tension

[[Library/Books/A Pattern Language]] asks what recurring spatial relations support life. [[Library/Books/The Practice of Everyday Life]] attends to what people do within and around arranged systems. One helps me describe an invitation; the other keeps the invitation from becoming a script.

## From the street

![[Field Notes/Walking as research#A detail to return to]]

The bench is neither a neutral object nor an instruction its users must follow. Its orientation offers a possibility, and a person may use that possibility in a way I have not imagined.

> [!bug] A category error to avoid
> A drawn route is not an observed experience. More precise geometry cannot repair a claim that forgets its standpoint.

## Questions that travel

- What does this arrangement make easier, and for whom?
- What can someone decline without being excluded entirely?
- Which uses appear only when I return at another time?
- Where does the description need a boundary or a correction?

These questions belong in [[Projects/A neighborhood atlas]] as much as [[Projects/Lattice]]. A page has no weather, but it still offers and withholds possibilities. The analogy is useful when it sharpens a test; it is misleading when it claims the two environments are the same.

**Next visit:** [[Field Notes/The useful edge]], where thresholds become a specific observation rather than an attractive metaphor.

## A working note, kept in context

The full note below is embedded from its own page. It keeps the questions, cautions, and next observation together rather than extracting only a memorable line.

![[Field Notes/The useful edge]]
`,
    },
    {
      path: 'Atlas/People and influences.md',
      kind: 'note',
      content: `---
title: People and influences
aliases: [The source trail]
provenance: Demo content
status: evergreen
category: atlas
date: 2026-11-06
tags: [sources, reading, connections]
---

A garden of ideas has neighbors even when one name appears on the gate. This page keeps a few influences visible and names the questions I carry from them.

## A small constellation

| Voice | Question I carry | Reading note |
| --- | --- | --- |
| Jenny Odell | What becomes perceptible when attention is not organized only around output? | [[Library/Books/How to Do Nothing]] |
| Christopher Alexander and collaborators | Which relationships make a place hospitable to ordinary life? | [[Library/Books/A Pattern Language]] |
| Robin Wall Kimmerer | What does receiving well ask me to return? | [[Library/Books/Braiding Sweetgrass]] |
| Michel de Certeau | What does lived use do that a plan cannot describe? | [[Library/Books/The Practice of Everyday Life]] |
| Rob Walker | What changes when I deliberately vary what I look for? | [[Library/Books/The Art of Noticing]] |

## Influence is not endorsement

These authors did not review [[Projects/Lattice]] or [[Projects/A neighborhood atlas]]. The connections are mine, and the book notes should make the distance between the source and my application visible.

## Ordinary teachers

A repaired gate, a thoughtful caption correction, and a friend who asks a better question can all change the work. Their influence does not require publishing their identity. Attribution matters; so does permission.

The reader-facing standard lives in [[Essays/Against the finished thought#What I owe a reader]]. The practical result should be a source trail someone can follow, not a list of impressive names.
`,
    },
    {
      path: 'Atlas/Media cabinet.md',
      kind: 'note',
      content: `---
title: Media cabinet
aliases: [A quiet media shelf]
provenance: Demo content
status: evergreen
category: atlas
date: 2026-11-11
tags: [media, accessibility, lattice]
---

A small set of original, offline media examples for **Lattice**. Nothing here needs a remote service, a permission prompt, or an autoplay exception. Press play only if you want to.

## An image that keeps its shape

![[Assets/Garden diagram.svg|An accessible diagram of the garden's working loop]]

The same asset appears in [[Atlas/Maps of meaning]]. Keeping one source means its labels can improve without editing every host note.

## Audio, by invitation

<audio controls preload="none" aria-label="Play a short, quiet demonstration chime" src="${chimeData}"></audio>

**Text equivalent:** a single soft A4 tone fades in and out over three tenths of a second. This is a generated sound, not a field recording or a speech transcript. The source also lives at [[Assets/Quiet chime.wav|Quiet chime.wav]].

## A silent moving-image sample

<video controls playsinline preload="none" width="320" height="180" aria-label="A one-second silent geometric landscape" src="${landscapeData}">A pale lavender sky, a small gold sun, and two violet bands of ground. The clip has no sound.</video>

**Description:** a deliberately still, one-second landscape study built from colored shapes. This tests video controls without pretending to be documentary footage. [[Assets/Landscape study.mp4|Open the local video asset]].

## An iframe, only when invited

The optional example below is shown as code, not a live player. It makes **no network request**. Before using a remote frame, choose a trusted source, check the publisher's allowlist, and tell the reader what service they are about to contact.

~~~html
<iframe
  title="Optional introduction to birdwatching"
  src="https://www.youtube-nocookie.com/embed/"
  loading="lazy"
  referrerpolicy="no-referrer"
  sandbox="allow-scripts allow-same-origin allow-presentation"
  allow="fullscreen"
></iframe>
~~~

This is a template, not a working video address: add a reviewed video identifier only if you intentionally want a remote player. A privacy-enhanced hostname does not mean a third party receives no data. For this garden, a plain link and a short description would usually be enough.

> [!danger] Do not copy arbitrary embed code
> These examples are original and self-contained. A remote player can introduce tracking, scripts, or unexpected sound. Inspect the source and make the choice visible to the reader.

[[Essays/A quieter internet]] is the design reason for these defaults; [[Projects/Lattice]] is where they become a promise.
`,
    },
    {
      path: 'About/Maintainer.md',
      kind: 'note',
      content: `---
title: Maintainer
category: about
tags: [lattice, maintainer]
description: Lattice maintenance and contribution information.
---

Lattice is maintained by [jgx0](https://github.com/jgx0).

See [[About/Documentation|Documentation]] for the product guide and [[About/Contributing|Contributing]] for development and contribution guidelines.
`,
    },
    {
      path: 'About/Architecture.md',
      kind: 'note',
      content: `---
title: Architecture
category: documentation
tags: [lattice, documentation, architecture]
description: Follow a saved note from your vault to the website your readers see.
---

You write notes in your vault; Lattice turns them into a website. This guide explains what happens after you save, which command to use, and where to make changes.

## What happens when you save a note

With \`npm run dev\` running, save a note in the vault folder selected by \`publish.config.json\`. Lattice rebuilds the local site and refreshes the browser. It does not rewrite your notes.

\`\`\`text
Your vault        Lattice build        dist/          Browser
notes + media --> pages + links ------> website -----> read + search
                  themes + assets      (build only)
\`\`\`

During development, Lattice serves the generated site without writing a production \`dist/\` folder. \`npm run build\` creates that folder for previewing or hosting.

### 1. Lattice reads the selected vault

The \`vault\` setting points to the folder containing your Markdown notes and attachments. Lattice reads that folder on your computer or your hosting service's build machine.

Notes are included by default. It skips hidden paths and symlinks, folders listed in \`site.hiddenPaths\`, and notes marked \`private: true\` or \`publish: false\`. Those two frontmatter values must be unquoted YAML booleans.

If you set \`site.home\`, Lattice uses that public note as the homepage. If you omit it, Lattice picks a public note. See [[About/Configuration]] to choose your own.

### 2. Notes become linked pages

Lattice reads titles, properties, headings, tags, and links. It turns Markdown into HTML, resolves supported embeds and Bases, and rewrites internal links to website URLs.

It also cleans rendered HTML and SVG, collects referenced local media, and prepares search text, previews, backlinks, and graph connections. A Base shows matching public notes; it cannot pull in excluded notes.

A failed edit leaves the last successful local version on screen. Fix the reported note or setting and save again; the next successful rebuild refreshes the page.

### 3. The build creates the website

\`npm run build\` writes a complete static site to \`dist/\`: a homepage, a directory \`index.html\` for each other note, \`404.html\`, application files, and the collected media and theme assets.

Each note page already contains its text, navigation, outline, and backlinks before JavaScript runs. Deploy the contents of \`dist/\`, not the vault or the project checkout.

### 4. The browser adds reading tools

The reader adds search, link previews, graphs, the Quick switcher, and optional reading panels to the generated pages. It does not open your local vault or run Obsidian plugins.

Color mode, selected theme, and folder folds are saved in that browser when storage is available. These choices change how the site looks, not your source notes or which notes are public.

## Which command should I use?

Run these from the project folder containing \`package.json\`, not from inside the vault.

| You want to… | Command | What happens |
| --- | --- | --- |
| Write notes and see changes immediately | \`npm run dev\` | Starts a local site and refreshes after successful edits. |
| Prepare the site for hosting | \`npm run build\` | Checks TypeScript and writes a new \`dist/\` site. |
| See the built site locally | \`npm run preview\` | Serves the existing \`dist/\`; it does not rebuild or watch notes. |

For a production preview, run \`npm run build\` followed by \`npm run preview\`. Open the address printed by the command. Neither local server publishes the site online.

## What becomes public?

Published text, filenames, properties, links, rendered HTML, and previews are public site data. Hiding the Properties panel does **not** hide the properties from visitors.

Lattice does not copy complete original Markdown files into the reader data. It supplies rendered pages and searchable text instead. Ordinary Obsidian \`%% comments %%\` are removed from that text; literal examples inside code remain.

Excluded notes, unselected \`.obsidian\` files, and unreferenced vault attachments are not copied wholesale. Referenced media and selected CSS assets are public. Files you deliberately put in the project's \`public/\` folder are also copied into the site.

Before hosting, choose your exclusions and remove sensitive properties from public notes. [[About/Security and privacy]] walks through that review.

## Why do Obsidian themes work?

Lattice reads the installed theme CSS and enabled snippets, then includes them in the site with rewritten local asset URLs. The reader uses familiar Obsidian classes and variables for light/dark mode, note content, callouts, and navigation.

The selected theme loads before snippets, vault-root \`publish.css\`, and your extra CSS overrides. If reader theme switching is enabled, visitors can choose among the themes included in the build.

CSS changes the appearance; it does not recreate editing panes, plugin controls, or Style Settings plugin state. Remote fonts and CSS resources still need a network connection. See [[About/Obsidian themes]] for setup and examples.

## Where to change things

Most site owners only need the first three rows. The source-code rows are optional if you want to develop Lattice itself.

| Change | Where |
| --- | --- |
| Note text, titles, links, properties, or Bases | Your selected vault |
| Vault folder, homepage, exclusions, or reader defaults | \`publish.config.json\` |
| Your site's styling | Vault snippets, vault-root \`publish.css\`, or configured extra CSS |
| How vault files and themes are compiled | \`build/config.ts\`, \`build/compile.ts\` |
| Generated pages and local serving | \`build/staticPages.ts\`, \`build/vaultPlugin.ts\` |
| Markdown, links, and Bases support | \`src/lib/\` |
| Reader controls and navigation | \`src/App.tsx\` and reader components in \`src/\` |

Next: [[About/Deployment|put the built site online]], [[About/Troubleshooting|fix a problem]], or [[About/Contributing|contribute a change to Lattice]].

[[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'About/Configuration.md',
      kind: 'note',
      content: `---
title: Configuration
category: documentation
tags: [lattice, documentation, configuration]
description: Vault paths, site options, navigation, themes, and configuration precedence.
---

Make your site feel like your own: choose a name and homepage, arrange a couple of folders, and leave a private folder out of the published site.

Start with [[About/Quick start]] if you have not run Lattice yet. For your own site, the recommended starting point is GitHub's **Use this template → Create a new repository**, then clone your new repository. This walkthrough assumes dependencies are installed and your copied vault is in \`my-vault/\` beside \`publish.config.json\`.

## 1. Point at your notes

Open \`publish.config.json\` in the project folder and replace its contents with:

\`\`\`json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes"
  }
}
\`\`\`

Run \`npm run dev\` from the project folder and open the address printed in the terminal. You should see **My notes** above the file tree, with notes from \`my-vault/\` rather than the included demo. Keep the terminal running as you follow the steps below; saving changes rebuilds the local site.

\`./my-vault\` means “the folder called my-vault beside this configuration file.” It should contain your notes directly, not another folder wrapping the vault. If your vault lives elsewhere, use its full folder path instead, such as \`/Users/you/Documents/My Vault\` on macOS. Lattice reads that folder without moving or rewriting it.

## 2. Choose the page people land on

Create \`Home.md\` directly inside \`my-vault/\`, or use an existing public note as your homepage. For a new file, paste:

\`\`\`markdown
---
title: Home
---

Welcome to my notes. This is where I collect things I want to share.
\`\`\`

Then add \`home\` to your configuration:

\`\`\`json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "home": "Home.md"
  }
}
\`\`\`

Save both files and click **My notes** in the site's sidebar. You should arrive at **Home**, with your welcome paragraph below it. The page already supplies a title, so there is no need to add another \`# Home\` heading in the note.

The \`home\` path starts inside your vault: use \`Home.md\`, not \`my-vault/Home.md\`. For a note in a subfolder, use its full filename, such as \`Notes/Home.md\`. The file needs to exist and be included in the publication. Without \`home\`, Lattice chooses the first compiled note.

## 3. Put folders in a useful order

In your copied vault, create \`Notes/First project.md\` and \`Projects/Next project.md\`. Give each a sentence of text so you have something to open. Add \`navigation\` inside \`site\`:

\`\`\`json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "navigation": ["Projects", "Notes"]
  }
}
\`\`\`

The **Projects** folder should now appear before **Notes**. Open each folder and click its note. You can also list full note paths to order notes within a folder. Entries you do not list remain visible, sorted alphabetically: folders by name and notes by title. Folders are displayed before loose notes; this is not one mixed list of every sidebar item.

Click a folder name to collapse it, then reload the page. It stays collapsed in your browser. These choices do not change your vault or configuration, and a rebuild does not reset them. New folders start open; if browser storage is blocked, fold choices last only for the current session. Hiding the entire sidebar is a separate control.

To start a folder collapsed for new readers, add \`"collapsedFolders": ["Notes"]\` inside \`site\`. Use full displayed folder paths, such as \`Library/Books\`, for nested folders. This only sets the initial state: saved reader choices take precedence, including choosing to leave every folder open. The demo starts with every folder collapsed except **About**.

## 4. Leave a private folder out

Create a folder named \`Private\` inside \`my-vault/\` and put a harmless test note, \`Private/Test.md\`, in it. Before adding anything personal, extend your configuration:

\`\`\`json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "navigation": ["Projects", "Notes"],
    "hiddenPaths": ["Private"]
  }
}
\`\`\`

After saving, **Private** should disappear from the file tree, and searching for the test note should not find it. The folder's notes and attachments are excluded from the build, not merely tucked away in navigation. Removing a folder from \`navigation\` does not exclude it.

This controls the generated website, not what goes into your Git repository. Follow [[About/Security and privacy]] before pushing personal files or deploying; it also explains how to exclude individual notes.

## 5. Try the reader controls before setting defaults

Open **Reader settings** using the settings icon beneath the file tree. Try **Properties**, **Table of contents**, and **Stacked pages**, then open another note to see the difference. **Properties** appears below the note body when enabled; hiding it does not remove those values from the published data.

Press **Command+K** on macOS or **Ctrl+K** elsewhere to open the quick switcher. Type a note name, use the arrow keys, and press Enter. It searches titles, filenames, paths, and aliases. Turning off **Quick switcher** makes the same shortcut focus sidebar search instead.

When you know which layout you prefer, add the matching defaults inside \`site\`. For example:

\`\`\`json
"showProperties": false,
"showToc": true,
"stacked": false
\`\`\`

These lines are a fragment to add to your existing \`site\` object, not a replacement configuration. Use commas between settings, with no trailing comma after the last one. Most reading features start enabled; stacked pages and reader theme switching start disabled.

Reader choices saved in your browser take precedence over these defaults. To check what a new visitor will see, open the site in a fresh private window. To reset your regular browser, clear this site's stored data and reload; that also clears folder folds and other saved reader choices.

For colors and the theme picker, continue with [[About/Obsidian themes]]. Color mode (\`site.theme\`) and the selected Obsidian CSS theme (top-level \`theme\`) are independent settings.

## Optional: other paths and appearance settings

### Show a note in a different sidebar folder

You can change navigation without moving files. With the sample note from step 3, add this inside \`site\`:

\`\`\`json
"navigationFolders": {
  "Notes/First project.md": "Guides/Projects"
}
\`\`\`

The note appears under **Guides → Projects**, while its source remains \`Notes/First project.md\` and its published route is unchanged. Use the displayed folder path, \`Guides/Projects\`, if you want to order that folder with \`navigation\`.

### Publish beneath a website subfolder

The top-level \`base\` defaults to \`/\`. If your website is served beneath a path such as \`https://example.com/notes/\`, set \`"base": "/notes/"\` and rebuild. This is the website's path, not its domain or a folder on your computer. [[About/Deployment]] walks through hosting.

### Keep a vault or configuration elsewhere

Paths such as \`vault\`, an explicit theme CSS path, and entries in \`css\` are relative to the folder containing \`publish.config.json\`. Note paths such as \`home\` and \`hiddenPaths\` start inside the vault instead. Use \`/\` between folder names and do not put \`..\` in navigation or exclusion paths.

For a one-off build, environment variables can select a different configuration or vault:

\`\`\`sh
PUBLISH_CONFIG="/absolute/path/to/publish.config.json" npm run build
OBSIDIAN_VAULT="/absolute/path/to/Your Vault" npm run build
\`\`\`

\`OBSIDIAN_VAULT\` takes precedence over the configured \`vault\`. Relative paths in these two environment variables start from the project folder where Lattice runs, rather than beside a separately located configuration file.

### A few finishing touches

Add a short \`site.description\` for the site's default page description, or \`site.accent\` with a color such as \`#8065da\`. A note's own \`description\` overrides the site description, and a configured accent overrides the vault accent. \`readable\` controls the restrained reading width; \`showBacklinks\` and \`showGraph\` control the corresponding page-information sections.

For theme CSS, snippets, \`publish.css\`, and extra styles, use [[About/Obsidian themes]] rather than changing everything at once. If a setting is misspelled or a required file cannot be found, the terminal reports the problem; [[About/Troubleshooting]] can help.

[[About/Documentation|Back to the documentation index]].
`,
    },
    {
      path: 'About/Contributing.md',
      kind: 'note',
      content: `---
title: Contributing
category: documentation
tags: [lattice, documentation, contributing]
description: Create your own site, report a problem, or send a focused change to Lattice.
---

Want your own notes website, or want to improve Lattice? Those use different GitHub workflows. Choose the path below; you do not need to contribute code to publish a site.

## Create your own site: use the template

For your own website, start with [**Use this template**](https://github.com/jgx0/lattice/generate). Choose your GitHub account and a repository name, then create the repository.

Clone **your new repository**, install the dependencies, and follow [[About/Quick start]] to select your vault and start the local site. When it looks right, [[About/Deployment]] explains how to put it online.

A template creates an independent repository for your site. It does **not** create a fork relationship for upstream pull requests. Use the fork workflow below when you want to send a change back to Lattice.

## Report a problem or suggest an improvement

Search [the issues](https://github.com/jgx0/lattice/issues) for an existing report. If you do not find one, open an issue with:

- What you were trying to do and what happened instead.
- Your Node/npm versions, the command you ran, and the error message.
- A small example note, Base, or CSS file that shows the problem, if needed.

Use a made-up example rather than attaching a private vault or screenshots containing personal information. For a substantial feature, discuss it in an issue before spending time on the implementation.

For a setup problem, try [[About/Troubleshooting]] first; it may have the fix you need.

## Contribute a change: fork the repository

A documentation clarification is a good first contribution. The steps below use \`vault/About/Troubleshooting.md\` as an example; replace that filename if you choose another guide.

### 1. Make your GitHub fork

Open [jgx0/lattice](https://github.com/jgx0/lattice) and click **Fork**. Create the fork under your GitHub account. GitHub keeps it connected to the original repository so you can open an upstream pull request.

With Git and **Node.js 22.12 or newer** installed, run the following. Replace \`YOUR-USERNAME\` with your GitHub username.

\`\`\`sh
git clone https://github.com/YOUR-USERNAME/lattice.git
cd lattice
npm ci --include=dev
git switch -c docs/clearer-troubleshooting
\`\`\`

You now have a local checkout of your fork and a separate branch for this change. Run the remaining commands from this \`lattice\` folder.

### 2. Make one small edit

Open \`vault/About/Troubleshooting.md\` in your editor. Clarify one confusing instruction: name the action a reader should take and what they should see afterward. Save the file.

Keep the frontmatter title, stable filename, and working links. The site supplies the page title, so do not add a duplicate top-level heading. Avoid including personal notes or changing unrelated files.

To see the page locally, run \`npm run dev\`, open the printed address, and navigate to the guide. The saved text should appear on the page. Stop the server with Ctrl+C when finished.

The demo guides also have a copy in \`src/demo.ts\` for reader and integration tests. Open that file, find \`path: 'About/Troubleshooting.md'\`, and update the matching \`content\` text to match your edited guide. Keep the surrounding entry unchanged. The text is inside a JavaScript template literal, so use these escapes when copying it:

\`\`\`text
Markdown text    Inside the template literal
\`                \\\`
\\                \\\\
\${               \\\${
\`\`\`

The synchronization test checks that the guide and fixture contain the same text. This step is for contributing to the included demo, not for notes in your own publishing vault.

### 3. Check the change

\`\`\`sh
npm run check
\`\`\`

This runs type checking, the test suite, and a production build. A successful run finishes without errors and produces \`dist/\`. If a check fails, correct the problem and run it again before sending the change.

Review \`git diff\` to see the exact edit. For a documentation change, check that the steps are understandable to someone setting up their first site and that the links open the intended guides.

### 4. Commit and push to your fork

Stage the guide and its synchronized fixture, then commit and push your feature branch:

\`\`\`sh
git add vault/About/Troubleshooting.md src/demo.ts
git commit -m "docs: clarify troubleshooting steps"
git push -u origin docs/clearer-troubleshooting
\`\`\`

Your change is now on your fork's branch, not on the original repository. Do not include your personal vault, generated \`dist/\` output, or unrelated edits in the commit.

### 5. Open the upstream pull request

Open [Lattice's pull requests](https://github.com/jgx0/lattice/pulls) and choose **New pull request**, then **compare across forks**. Select \`jgx0/lattice\` as the base repository and your fork's \`docs/clearer-troubleshooting\` branch as the head. Use the upstream default branch as the base branch.

Give the pull request a short title. Explain the problem, the improvement, and which checks you ran; link the issue if there is one. The resulting pull request proposes your change to Lattice for review.

If a reviewer asks for an adjustment, edit locally, rerun the checks, commit the changed file, and push the same branch. The existing pull request updates automatically.

## Working on code or demo content?

[[About/Architecture]] has a short source-file map. Keep code changes focused and add a test for behavior you change. For reader changes, try a narrow screen, keyboard navigation, and both color modes; for generated-page changes, open a note URL directly.

Demo-content changes may also need updates to the in-memory test fixture and links. Keep examples clearly fictional, and use snippets or \`publish.css\` for site overrides rather than editing bundled third-party theme files.

Next: [[About/Architecture|find the right place to edit]] or [[About/Troubleshooting|resolve a local problem]]. [[About/Maintainer]] introduces the project's maintainer.

[[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'About/Deployment.md',
      kind: 'note',
      content: `---
title: Deployment
category: documentation
tags: [lattice, documentation, deployment]
description: Put your own Lattice site online with Cloudflare Pages, Vercel, or Netlify.
---

This guide takes your local site and gives it a public web address. If you haven't created your own repository and run Lattice yet, start with [[About/Quick start]].

You only need to choose **one** hosting provider. Cloudflare Pages, Vercel, and Netlify can all build a site from your GitHub repository. They'll rebuild it when you push changes.

## First, decide where your notes will live

**Automatic builds from GitHub:** the host needs your configuration, publishable notes, attachments, and selected theme files in **your own repository**. Put a reviewed copy of those files in a folder such as \`site-vault/\`, then set \`"vault": "./site-vault"\` in \`publish.config.json\`. Do not commit an entire personal archive just to make cloud builds work.

**Keep the vault on your computer:** if your vault is ignored by Git or lives outside the project, build locally and upload the generated \`dist/\` folder yourself. Follow the [[About/Deployment#CLI upload|Cloudflare upload steps]] below, or use your preferred static-file host.

A private GitHub repository can keep source files private, but the deployed website is still public. [[About/Security and privacy]] walks through choosing what to share.

## Build it once before connecting a host

In your project's terminal:

\`\`\`sh
npm run build
npm run preview
\`\`\`

Open **http://localhost:4173**. This is the version you'll deploy. Open a note directly by its URL, try an attachment, and check your theme. Preview won't update after edits until you run \`npm run build\` again. Press **Ctrl+C** to stop preview before running the next commands.

When you're happy with it, commit the files the cloud builder will need and push them to **your repository**. For example, if \`site-vault/\` contains only publishable material:

\`\`\`sh
git add publish.config.json site-vault/
git commit -m "Add my published notes"
git push origin main
\`\`\`

Check the files selected for the commit before running it. If \`site-vault/\` is in \`.gitignore\`, it won't be included; only remove that ignore rule after deciding those files can go to GitHub.

## Cloudflare Pages

### Git integration

1. Open [Cloudflare Pages setup](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages).
2. Choose **Pages → Connect to Git** and authorize GitHub if asked.
3. Select **the repository you created from the Lattice template**, such as \`YOUR-USERNAME/my-lattice\`.
4. Keep the root directory at the repository root and use these settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | \`npm run build\` |
| Build output directory | \`dist\` |
| Environment variables | \`NODE_VERSION=22\`, \`NPM_CONFIG_INCLUDE=dev\` |

The development dependencies are needed to build the site. \`NPM_CONFIG_INCLUDE=dev\` keeps them installed on the builder. Node.js must be 22.12 or newer.

5. Save and deploy. Once the build finishes, open the address Cloudflare gives you.

The included \`wrangler.jsonc\` starts with \`name: "lattice"\`, \`pages_build_output_dir: "./dist"\`, and a pinned \`compatibility_date\`. Change its name to match your Pages project if you use Wrangler. \`public/_headers\` supplies the site's response headers and asset-cache rules.

### CLI upload

Use this route when you want to build from a vault kept on your computer. You'll upload the website, not the vault.

Create a Pages project once in your account, either in the dashboard or with:

\`\`\`sh
npx wrangler pages project create my-lattice
\`\`\`

Then build and upload:

\`\`\`sh
npm ci --include=dev
npm run build
npx wrangler pages deploy dist --project-name=my-lattice
\`\`\`

Replace \`my-lattice\` with your project name. Wrangler will ask you to authenticate if needed. These commands publish when you run them; Lattice doesn't supply hosting credentials.

Choose Git integration or Direct Upload when creating your Pages project. Cloudflare doesn't let you freely switch every existing project between the two workflows.

## Vercel

1. Open [Vercel's new-project page](https://vercel.com/new).
2. Import **your own template-created repository** from GitHub.
3. Leave the root directory at the repository root.
4. Confirm these settings, supplied by \`vercel.json\`:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Install command | \`npm ci --include=dev\` |
| Build command | \`npm run build\` |
| Output directory | \`dist\` |

Choose Node.js 22 or newer in project settings, then deploy. Vercel gives you a URL when the build completes.

For reference, the configuration uses \`framework: null\`, \`cleanUrls: true\`, \`outputDirectory: "dist"\`, \`installCommand: "npm ci --include=dev"\`, and \`buildCommand: "npm run build"\`. You don't need to edit those values for a normal root-domain deployment. There is no catch-all rewrite to the homepage.

## Netlify

1. Open Netlify and choose **Add new site → Import an existing project**.
2. Connect GitHub and select **your own repository**.
3. Leave the build settings from \`netlify.toml\`: command \`npm run build\`, output \`dist\`, Node 22.
4. Deploy and open the generated address.

If your builder omits development dependencies, include them with \`npm ci --include=dev\`. The site itself is static and needs no Node server after the build.

## Check the public site

Try these on the provider's URL:

- Open a nested note, then reload it.
- Follow a heading link and an attachment.
- Switch themes if the picker is enabled.
- Open a made-up URL. It should show the missing-page screen, not the homepage.
- Confirm that excluded notes and private details are absent.

Lattice emits \`404.html\`. Keep the host's normal file routing and **don't add an SPA rewrite to \`index.html\`**. A missing URL should return HTTP 404. If an old note remains online after you exclude it, replace or clear the previous deployment rather than leaving stale files behind.

## Deploy under a subdirectory

Most provider URLs use the default \`base: "/"\`. Only change this if the site really lives below a path, such as \`example.com/notes/\`:

\`\`\`json
{
  "vault": "./site-vault",
  "base": "/notes/",
  "site": { "title": "My notes" }
}
\`\`\`

Rebuild and mount the **contents** of \`dist/\` at \`/notes/\`. The output won't contain an extra \`notes/\` folder. Revisit host routing and the path patterns in \`public/_headers\`, \`vercel.json\`, and \`netlify.toml\` when changing the mount path.

For GitHub Pages project sites, the base is usually your own repository name, such as \`/my-lattice/\`, not \`/lattice/\` unless that is your name. Use your own Pages deployment workflow to publish \`dist/\`.

## Updating your site

With Git-connected hosting, edit the publishable files, check the site locally, commit, and push to your own deployment branch. Your provider runs the next build. With manual hosting, run \`npm run build\` and upload the new \`dist/\` output again.

For your own site, use \`npm run build\` and \`npm run preview\` before an update. The build includes TypeScript checking; preview lets you inspect the generated pages. \`npm run check\` additionally runs Lattice's development regression suite, which assumes the included demo configuration. Use that suite when contributing changes to Lattice, not as the only test of your personalized site.

### The inherited GitHub check

The template includes \`.github/workflows/verify.yml\`, which runs the development checks on Node 22 and 24 for pushes and pull requests. It **does not deploy**. After you customize the configuration, this workflow may fail because some tests expect the demo; an ignored local vault also isn't available to GitHub's runner.

For a personal site, open **your repository → Actions → Verify → ⋯ → Disable workflow** if you aren't using that check. Alternatively, adapt the workflow to build your committed publishing vault with \`npm run build\`. Your hosting provider's Git integration can still build and deploy the site independently.

Setting up a host requires your own account, and no hosting account or live deployment is provisioned by these files. Authentication and confirmation are still required.

[[About/Troubleshooting|Deployment troubleshooting]] · [[About/Documentation|Guide index]].
`,
    },
    {
      path: 'About/Documentation.md',
      kind: 'note',
      content: `---
title: Documentation
aliases: [Lattice documentation]
category: documentation
tags: [lattice, documentation]
description: Start with your own repository, build your note site, customize it, and put it online.
---

Want your Obsidian notes on the web? Start with [[About/Quick start|Quick start]]. You'll create your own repository from the Lattice template, add a vault, and open the site on your computer.

You don't need to read every page before starting. Follow the guides below as you reach each step.

## Build your first site

1. [[About/Quick start|Quick start]] — create your copy and get your notes on screen.
2. [[About/Configuration|Make the site yours]] — pick a name, homepage, and navigation layout.
3. [[About/Obsidian themes|Change the appearance]] — use Default, Publish, or your installed Obsidian theme.
4. [[About/Markdown and Bases|Try linked content]] — add links, properties, embeds, and a Base table.
5. [[About/Security and privacy|Choose what to share]] — leave private notes out before publishing.
6. [[About/Deployment|Put it online]] — connect **your own repository** to a host or upload a local build.

## Need help with a specific problem?

[[About/Troubleshooting|Troubleshooting]] covers missing folders, homepage errors, empty Bases, theme issues, and broken deployed URLs. Start with the message you see in the terminal, then find the matching section.

## Curious about how Lattice works?

[[About/Architecture|Architecture]] explains what happens when you save a note and why the deployed site doesn't need Obsidian or a running compiler. [[About/Contributing|Contributing]] shows how to make and submit a project improvement.

The [[Projects/Lattice|project overview]] is a good place to compare features. The sample essays and reading notes are here to demonstrate the reader, not to tell you what your vault must look like.

## A few things to know

Lattice publishes notes; it doesn't run Obsidian plugins or provide Sync, collaboration, or a login service. Bases supports the functions described in its guide, not every expression from Obsidian or community plugins.

Your local preview is not public. Deploying the generated site makes it public unless you add access restrictions through your host. When you're ready for that step, use the privacy guide first.

[[Welcome|Return to Welcome]].
`,
    },
    {
      path: 'About/Markdown and Bases.md',
      kind: 'note',
      content: `---
title: Markdown and Bases
category: documentation
tags: [lattice, documentation, markdown]
description: Supported Markdown, wikilinks, transclusions, media, and the bounded Bases runtime.
---

Create two linked notes, add a few useful properties, and turn a collection of notes into a Base table. Along the way, you will see how the published reader handles headings, callouts, embeds, and backlinks.

Complete [[About/Quick start]] first and keep \`npm run dev\` running. Make changes in your copied vault, not the included demo. Examples for new notes are shown as code to copy; the live book table later on uses the existing demo notes.

## 1. Write your first page

Create a \`Notes\` folder in your copied vault, then create \`Notes/My first note.md\` with:

\`\`\`markdown
---
title: My first note
aliases: [My starting point]
tags: [learning]
description: A first page for my published notes.
---

This is my first published note.

## Something worth keeping

A small observation is enough to begin. ^first-thought
\`\`\`

Save the file, open **Notes** in the website's file tree, and click **My first note**. You should see its title above the opening paragraph. The reader supplies that heading from \`title\`, so you do not need another top-level \`# My first note\` in the body. Without a \`title\` property, the filename supplies the title.

Open the page-information sidebar if it is closed. **On this page** should list **Something worth keeping**; clicking it scrolls to the section. Try searching for the alias **My starting point** with **Command+K** or **Ctrl+K**.

## 2. Connect a second note

Create \`Notes/Another note.md\` with:

\`\`\`markdown
---
title: Another note
---

This idea grows out of [[Notes/My first note|my first page]].
\`\`\`

Save, open **Another note**, and click **my first page**. It should take you to the first note, where **Linked mentions** now includes **Another note**. The interactive graph also connects the two pages. If these sections are hidden, enable **Backlinks** and **Interactive graph** in Reader settings.

The part before \`|\` identifies the target; the part after it changes the visible label. Using the full path inside the vault avoids confusion when different folders contain notes with the same name. Ordinary Markdown links work too: from \`Notes/Another note.md\`, \`[my first page](./My%20first%20note.md)\` points at the same file.

Your note's filename and folders determine its published route. Changing \`title\` changes the heading, not the route; renaming the file can change the route, so update incoming links as well.

## 3. Make properties into useful links

Add these properties to the existing frontmatter of \`Notes/My first note.md\`, before the closing \`---\`:

\`\`\`yaml
category: "[[Notes/Another note]]"
related:
  - "[[Notes/Another note|A related idea]]"
\`\`\`

Save and scroll to the bottom of **My first note**. If **Properties** is enabled in Reader settings, both values should be clickable. Follow the category link to **Another note**: it now has a linked mention from **My first note**.

A category can be plain text such as \`category: book\`, or a link to another note. A link in a single property value, a list, or a nested property counts toward backlinks and graph connections just like a body link. Base cells can display these links too. Plain text categories are useful for filters; linked categories are useful when you want the category to have its own page.

Properties remain part of the published data even when their panel is hidden. Exclude private notes or folders using [[About/Configuration]] and [[About/Security and privacy]], rather than relying on a reader setting.

## 4. Add a callout, tasks, math, and a footnote

Append this to \`Notes/My first note.md\`:

\`\`\`markdown
> [!tip] Start small
> One clear paragraph is enough for today.

- [x] Create my first page
- [ ] Add another observation

Inline math: $E = mc^2$.

A note can leave room for a source.[^source]

[^source]: Put the reference or extra explanation here.
\`\`\`

After saving, you should see a styled **Start small** callout, one checked and one unchecked task, formatted math, and a numbered footnote. Click the footnote number to move to its explanation.

The website is read-only: task checkboxes show the source state but cannot update it. Change \`[ ]\` to \`[x]\` in your vault and save to change the published task. Ordinary fenced code is displayed rather than executed. Tables, highlighting with \`==text==\`, and block math between \`$$\` lines are also supported.

## 5. Bring a section into another page

Append this to \`Notes/Another note.md\`:

\`\`\`markdown
## A section to revisit

![[Notes/My first note#Something worth keeping]]

## Just the observation

![[Notes/My first note#^first-thought]]
\`\`\`

The second note should now show the heading section and, separately, the paragraph marked \`^first-thought\`. A leading \`!\` embeds content; leaving it out creates a link to the heading or block. To embed the whole note, use \`![[Notes/My first note]]\`. Avoid embedding pages back into each other: recursive expansion is limited.

For images and other media, keep files in your vault and embed their actual filenames. [[Atlas/Media cabinet]] demonstrates the demo's local image, audio, and video. Local PDFs are supported too; playback and display depend on the reader's browser and the media format. Remote resources can make external requests, so choose them deliberately rather than assuming everything will work offline.

## 6. Turn notes into a Base table

A Base is a saved description of which notes to show and which properties to display. You can write it directly in a note inside a code fence labeled \`base\`.

For a table of your own tutorial notes, append this to \`Notes/Another note.md\`:

\`\`\`\`markdown
\`\`\`base
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
\`\`\`
\`\`\`\`

Save and open the page. You should see a **My notes** table with the two notes you created, plus any other published notes already in \`Notes\`. Click a name to open that page. The category cell for your first note links to **Another note**. A fence labeled \`yaml\` only displays the definition; \`base\` renders it.

Here is a working table on this documentation page, using the five books already in the demo vault:

\`\`\`base
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
\`\`\`

The demo books have plain \`category: book\` properties, so the filter matches them without needing properties on this host page. Click a column heading to change the table's sorting, or a book name to read it. In your own vault, change \`Library/Books\` to a folder you actually have and add \`category: book\` to the notes you want included.

If you prefer a reusable file, save the definition without the surrounding backticks as a \`.base\` file, then embed its vault-relative filename in a note. The demo [[Library/The reading room|reading room]] embeds \`Data/Reading.base\`:

\`\`\`markdown
![[Data/Reading.base]]
\`\`\`

That particular Base also matches a book's \`collection\` against the host note's \`collection\`. The reading room has \`collection: books\`; copying that embed to a page without the property will not reproduce its shelf. The inline bookshelf above avoids that extra requirement.

## 7. List notes that link to the current page

Append this block to \`Notes/My first note.md\`:

\`\`\`\`markdown
\`\`\`base
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
\`\`\`
\`\`\`\`

You should see **Another note** in **Notes linking here**, because it links to your first page. \`file\` is each possible row; \`this.file\` is the page containing the Base. Links in properties count too. With an embedded \`.base\` file, \`this.file\` still means the host note, not the Base file.

\`file.mtime\` sorts by the source file's filesystem modification time, not a frontmatter date. Copying or cloning your vault can change those times. For dates you want to preserve across computers, add a note property and sort by that instead.

Bases only see included public notes. A folder excluded with \`hiddenPaths\`, or a note excluded with \`private: true\` or \`publish: false\`, cannot appear as a row. A missing property does not supply a guessed value; it can leave a cell empty or cause a filter not to match.

## Optional: more Base expressions

The familiar building blocks are property access, comparisons, Boolean conditions, arithmetic, lists, and formulas. \`note.author\` and bare \`author\` both access a row's frontmatter. \`order\` chooses columns, \`sort\` sets initial ordering, and \`limit\` caps the displayed rows. Supported view types are \`table\`, \`list\`, and \`cards\`; multiple views appear as separate sections.

A few useful expressions to try in filters or formulas are:

\`\`\`text
file.hasLink(this.file)
file.hasLink("Field Notes/Digital gardens")
file.hasTag("research")
link("Field Notes/Digital gardens").toString()
\`\`\`

\`file.hasLink(this.file)\` is another way to select notes linking to the host. Link targets can resolve note aliases and heading/block references. \`file.hasTag("research")\` accepts an optional leading \`#\`, ignores case, and also matches nested tags such as \`research/methods\`. \`toString()\` converts supported values for display; on a link, it produces a wikilink string.

Helpers such as \`contains\`, \`length\`, \`if\`, \`number\`, and \`file.inFolder\` cover common cases, along with selected string/list methods. This is a supported subset, not every Obsidian Bases function or arbitrary JavaScript. Unsupported expressions and invalid definitions show a visible Base error; start with a small working table and add one expression at a time. [[About/Troubleshooting]] can help when a table is empty or reports an error.

### What carries over from Obsidian?

Ordinary Markdown, supported wikilinks, heading/block embeds, callouts, read-only tasks, footnotes, math, local media, properties, and the Base views above are good building blocks for published pages. Obsidian comments outside literal code are omitted from the rendered and searchable body.

Obsidian plugins do not run in the reader. Dataview queries, plugin widgets, editing workflows, and unsupported Base functions do not become working website features simply by copying the note. For a page that uses them, replace the output with ordinary Markdown or a supported Base before publishing.

[[About/Documentation|Back to the documentation index]].
`,
    },
    {
      path: 'About/Obsidian themes.md',
      kind: 'note',
      content: `---
title: Obsidian themes
category: documentation
tags: [lattice, documentation, themes]
description: Publish with actual Obsidian theme CSS, enabled snippets, and local assets.
---

Choose a look for your notes, add a small CSS snippet, and optionally let readers choose their own theme. You can use the built-in **Default (Obsidian)** and **Publish** themes without installing anything, or publish the original CSS from an installed Obsidian theme such as Minimal.

Before you begin, complete [[About/Quick start]] and keep your local site running. The examples assume your own vault is \`my-vault/\`. Keep the title and homepage settings you added in [[About/Configuration]].

## 1. Try the two built-in themes

Open \`publish.config.json\`. Add \`theme\` beside \`vault\`, not inside \`site\`:

\`\`\`json
{
  "vault": "./my-vault",
  "theme": "default",
  "site": {
    "title": "My notes",
    "home": "Home.md",
    "theme": "system"
  }
}
\`\`\`

If you have not created \`Home.md\`, keep your existing homepage setting or leave \`home\` out. Save and open the site in a fresh private browser window so an earlier reader choice does not mask your new default. **Default (Obsidian)** gives you the built-in baseline appearance.

Change top-level \`theme\` to \`"publish-theme"\` and save again. You should see the **Publish** style, with a compact file tree, generous page titles, and a page-information column on wider screens. Both built-ins ship with Lattice; neither needs a folder in \`.obsidian/themes\`.

Now open **Reader settings → Color scheme** and try **Light**, **Dark**, and **Adapt to system**. These change the color mode without changing the CSS theme. In the configuration, \`site.theme\` sets that color-mode default; top-level \`theme\` chooses the design.

## 2. Use Minimal's original CSS

If Minimal is not installed in your copied vault, open that vault in Obsidian. Go to **Settings → Appearance → Themes → Manage**, find **Minimal**, install it, and select it. No Obsidian plugin is needed.

Obsidian saves the theme at \`.obsidian/themes/Minimal/theme.css\` inside the vault and records the selection in \`.obsidian/appearance.json\`. If you are copying a vault from elsewhere, include its hidden \`.obsidian\` folder so those files come along.

Back in \`publish.config.json\`, change the top-level selection:

\`\`\`json
"theme": "Minimal"
\`\`\`

Save, then reload your private-window preview. The site should now use Minimal's installed CSS. This loads the theme's actual stylesheet, not a separate approximation of Minimal.

Alternatively, remove the top-level \`theme\` setting altogether to follow the theme selected in Obsidian. Lattice reads \`cssTheme\` from \`.obsidian/appearance.json\`; if nothing selects a theme, it uses Default (Obsidian). The included demo explicitly selects \`"default"\`, so merely selecting Minimal in Obsidian will not override that configuration.

If the build says Minimal is unavailable, check for \`.obsidian/themes/Minimal/theme.css\` in the vault named by \`vault\`. Choosing a name does not install or download a theme.

## 3. Add one visible snippet

In your copied vault, create \`.obsidian/snippets/roomier-paragraphs.css\` with:

\`\`\`css
.markdown-rendered p {
  line-height: 1.8;
}
\`\`\`

In Obsidian, open **Settings → Appearance → CSS snippets**, refresh the list if needed, and enable **roomier-paragraphs**. Leave \`snippets\` out of \`publish.config.json\` to follow Obsidian's enabled snippets.

Save a note or reload the local preview. Paragraphs should look more spacious. Obsidian records the enabled name in \`enabledCssSnippets\`; the relevant part of \`.obsidian/appearance.json\` looks like this:

\`\`\`json
{
  "cssTheme": "Minimal",
  "enabledCssSnippets": ["roomier-paragraphs"]
}
\`\`\`

You do not need to replace that file by hand. To select snippets only for the website, add top-level \`"snippets": ["roomier-paragraphs"]\` to your publish configuration. To publish without snippets, use \`"snippets": []\`. An omitted setting follows Obsidian; an empty array turns snippets off. A selected snippet file needs to exist.

## 4. Let readers choose a theme

Add \`allowThemeSwitching\` inside \`site\`:

\`\`\`json
{
  "vault": "./my-vault",
  "theme": "Minimal",
  "site": {
    "title": "My notes",
    "allowThemeSwitching": true
  }
}
\`\`\`

Keep your existing \`home\` and other site settings when adding this option. Save, open **Reader settings**, and find **Obsidian theme**. Choose **Publish**, then **Default (Obsidian)**, then **Minimal**. Each selection should change the page's styling without navigating away or editing your vault. Try **Color scheme** too: it remains independent of the theme picker.

With switching enabled, Lattice includes both built-ins, the site's selected theme, and other installed themes it discovers in \`.obsidian/themes\`. Switching is off by default.

If you want to limit the installed choices, add a top-level allowlist:

\`\`\`json
"themes": ["Minimal"]
\`\`\`

Only name themes already installed, or use existing CSS file paths. **Default (Obsidian)**, **Publish**, and the selected site theme always remain available, even if they are not in the allowlist. \`"themes": []\` skips discovery and leaves those choices; omitting \`themes\` discovers installed themes. With only Minimal installed, this allowlist does not visibly change the picker yet, but it prevents future installations from being offered automatically.

## 5. Check the default and reset saved choices

Reload after choosing a theme. Your browser remembers that choice, along with its separate color-mode preference. A new configuration default does not replace a reader's saved, still-available theme choice.

To see the configured default, use a fresh private window. To return your regular browser to the site defaults, close the site's tabs, clear its stored site data in your browser settings, and reopen it. Clearing site data also resets saved layout preferences and folder folds; there is no reset button in Reader settings.

On startup, Lattice applies the saved or configured color mode early and, when needed, loads the saved theme before revealing the content. If that startup theme request fails or takes more than **four seconds**, the page opens with the site's default theme instead. A failed switch made in Reader settings keeps the current theme and shows an error. The selected theme styles are local website assets; snippets and site overrides continue to apply to every choice.

## Optional: finishing touches and CSS limits

### Reuse font and accent settings

Lattice also reads the vault's accent color, base text size, and text/monospace font names from \`.obsidian/appearance.json\`. A configured \`site.accent\` overrides the vault accent. Font names do not download fonts: visitors need the font installed, or you can supply it through CSS. Numeric base text sizes from 8 to 72 pixels are supported.

### Choose where an override belongs

For a website-only style, put \`publish.css\` directly inside your vault. For a CSS file beside \`publish.config.json\`, add a top-level setting such as \`"css": ["./site-overrides.css"]\` after creating that file. Explicit theme and snippet CSS paths also start beside the configuration file, while simple names resolve inside the vault's \`.obsidian\` folder.

After the reader baseline, the theme layer loads in this order:

1. The selected theme's CSS.
2. Selected snippets in their listed order.
3. Vault-root \`publish.css\`, if present.
4. Additional files listed in \`css\`.
5. Appearance-derived variables and optional \`site.customCss\`.

Later rules can override earlier ones according to the usual CSS cascade. \`bodyClasses\` adds site-wide classes, and \`cssclasses\` on a note styles that note; homepage \`cssclasses\` also contribute site-wide classes.

### Keep styles portable

Local CSS imports, fonts, and supported images are copied into the built site with rewritten URLs. Keep a theme's assets in its theme directory, and a snippet or explicit CSS file's assets within its own directory. Vault-root \`publish.css\` can use allowed assets elsewhere in the vault, but not excluded ones. Missing files, unsupported assets, or circular imports cause build errors.

Use CSS you trust. Remote \`@import\` and \`url(...)\` references remain remote: readers may contact those third-party servers, and the styles may need an internet connection. The build does not download them for offline use.

Lattice is a reader, not Obsidian running in the browser. Theme rules targeting reading content and familiar Obsidian classes can work; editor panes, plugin controls, and Style Settings plugin state are not reproduced. Check your chosen style in light and dark modes and on a narrow screen. See [[About/Troubleshooting]] if a style does not load, or [[About/Security and privacy]] for more on external resources.

[[About/Documentation|Back to the documentation index]].
`,
    },
    {
      path: 'About/Quick start.md',
      kind: 'note',
      content: `---
title: Quick start
category: documentation
tags: [lattice, documentation, setup]
description: Create your own Lattice repository, add a vault, and open your first site.
---

By the end of this guide, your Obsidian notes will be running as a website on your computer. The whole setup is **create your repository, clone it, add a vault, choose its folder, and run**.

You'll need a GitHub account, Git, and **Node.js 22.12 or newer**. Installing Node also installs npm, which runs the commands below.

## 1. Create your own repository

Open [Lattice on GitHub](https://github.com/jgx0/lattice) and click **Use this template → Create a new repository**. You can also go straight to [Create from template](https://github.com/jgx0/lattice/generate).

Choose your own account as the owner and name the repository something like **\`my-lattice\`**. Choose **Private** if you plan to keep your source notes there. Click **Create repository**.

You now have your own copy of Lattice. This is the repository you'll edit and connect to a hosting provider—not \`jgx0/lattice\`.

## 2. Clone your copy

On your new repository page, click **Code**, select **HTTPS**, and copy its URL. Open a terminal and run:

\`\`\`sh
git clone https://github.com/YOUR-USERNAME/my-lattice.git
cd my-lattice
npm ci
\`\`\`

Replace \`YOUR-USERNAME\` and \`my-lattice\` with the names in your copied URL. Keep the terminal open in this folder for the rest of the guide.

Want a quick look before adding your notes? Run \`npm run dev\` now to see the included demo. Press **Ctrl+C** when you're ready to continue.

## 3. Add your vault

Use Finder or File Explorer to copy your Obsidian vault into the project folder. For this guide, call the copy **\`my-vault\`**:

\`\`\`text
my-lattice/
├── my-vault/
│   ├── .obsidian/
│   ├── Home.md
│   ├── Notes/
│   └── Attachments/
├── vault/                 # the included demo
├── publish.config.json
└── package.json
\`\`\`

Copy the whole vault, including its hidden \`.obsidian\` folder if you want its installed theme and snippets. Make sure \`my-vault\` directly contains your notes, not another folder around them. You can leave the demo folder alone.

**Using a personal vault?** Add \`my-vault/\` on a new line in the project's \`.gitignore\` before committing anything. This keeps the copied notes out of your GitHub repository. You can still run and build the site locally. [[About/Security and privacy|Choose what to publish]] before putting the site online.

You do not have to copy the vault if you prefer to keep it where it is. The next step accepts its full folder path instead.

## 4. Point Lattice at the folder

Open **\`publish.config.json\`** in your project folder and replace its contents with:

\`\`\`json
{
  "vault": "./my-vault",
  "site": { "title": "My notes" }
}
\`\`\`

Change \`my-vault\` if your folder has a different name. That's enough to start. Lattice fills in the other settings and picks a note for the homepage.

To use a vault outside the project, set \`vault\` to its full folder path. On Windows, use forward slashes, such as \`C:/Users/you/Documents/My Vault\`.

## 5. Open your site

Back in the terminal:

\`\`\`sh
npm run dev
\`\`\`

Open **http://localhost:5173**, or the address printed in the terminal. Your notes should be there.

Try opening a note from the file tree. Press **Command+K** on Mac or **Ctrl+K** elsewhere to find a file quickly. Save an edit to a source note and watch the page refresh. Folder expansion choices are remembered in this browser.

Leave the terminal running while you work. Press **Ctrl+C** to stop the local server.

## Make it yours

You can stop here—you have a working local site. When you want to customize it:

- [[About/Configuration|Choose a homepage and site name]].
- [[About/Obsidian themes|Try your Obsidian theme]].
- [[About/Markdown and Bases|Add linked notes and an inline Base]].

## Put it online when you're ready

Running locally does not upload your vault or create a public site. Follow [[About/Deployment]] for Cloudflare Pages, Vercel, or Netlify.

A cloud builder can only use files it can access. If your vault is ignored by Git or lives elsewhere on your computer, use a local build and upload \`dist/\` yourself. For automatic cloud builds, put **only the notes and assets you're comfortable sharing** in your own repository. A private GitHub repository does not make the resulting website private.

## Stuck?

- **Folder not found:** check that \`vault\` matches the folder containing your notes.
- **Homepage not found:** remove \`site.home\` or change it to a note that exists.
- **\`npm\` not found:** install Node.js, then reopen your terminal.

[[About/Troubleshooting|Troubleshooting]] has more fixes. [[About/Documentation|Back to the guide index]].
`,
    },
    {
      path: 'About/Security and privacy.md',
      kind: 'note',
      content: `---
title: Security and privacy
category: documentation
tags: [lattice, documentation, privacy]
description: Choose which notes to share, keep personal files out of GitHub, and check your public site.
---

Before putting your site online, decide which notes you're happy for anyone to read. Lattice publishes **every note it finds unless you exclude it**—not just the notes linked from the homepage.

A private GitHub repository can protect your source files, but it doesn't make the hosted website private. Lattice itself has no login or password gate.

## 1. Choose a publishing workflow

If your vault contains personal notes, the easiest starting point is to leave it on your computer and build locally. Add its copied folder, for example \`my-vault/\`, to the project's \`.gitignore\`. This prevents new files in that folder from being committed to GitHub.

For automatic cloud builds, make a smaller folder such as \`site-vault/\` containing only notes and assets you want to publish. Point Lattice at that folder and commit it to **your own repository**.

Adding a folder to \`.gitignore\` does not remove files already committed or erase earlier history. If you're not sure whether a vault is tracked, check \`git status\` and the repository's file list before pushing.

## 2. Exclude a private folder

Suppose your vault has a \`Private/\` folder. Add \`hiddenPaths\` inside \`site\` in \`publish.config.json\`:

\`\`\`json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes",
    "hiddenPaths": ["Private", "Templates"]
  }
}
\`\`\`

Both folders are left out of the site. You can also exclude a single note by its path, such as \`People/Contact details.md\`.

These paths are relative to the vault, not to the project folder. Keep your other settings when adding this option; the example is a complete minimal configuration.

## 3. Exclude a single note

Add this at the very start of the note:

\`\`\`yaml
---
publish: false
---
\`\`\`

If the note already has frontmatter, add \`publish: false\` inside the existing block instead of creating a second one. \`private: true\` works too. Use real booleans without quotation marks.

Rebuild and try opening the note's URL. An excluded note won't appear in search, graphs, backlinks, Bases, or note transclusions. If a privacy setting is malformed, Lattice stops the build and names the problem rather than publishing with the setting ignored.

## 4. Check the public version

\`\`\`sh
npm run build
npm run preview
\`\`\`

Open **http://localhost:4173** and read the site as a visitor. Check a few notes, links, attachments, and properties.

Remember:

- **Collapsed folders are still public.** Folding navigation only changes the reader's view.
- **Hidden properties are still public.** \`showProperties: false\` hides the panel, not the metadata in public search data.
- **Copied text is still copied text.** Excluding a private note doesn't remove a quotation you've pasted into another public note.
- **Comments in code examples are visible.** Ordinary Obsidian \`%% comments %%\` are omitted, but literal examples inside code remain.

The generated site includes public note text, properties, HTML, previews, and referenced assets. It doesn't need your original complete Markdown files or private vault files on the host. Only deploy \`dist/\`.

Files you deliberately put in the project's \`public/\` folder are also copied to the site. Don't put private files there.

## 5. Think about external resources

Local attachments stay local to your published site. Remote video frames, fonts, images, and CSS can contact third-party servers when a visitor opens a page. Use a plain link instead of an embed if you don't want that resource loading on the page.

Lattice removes unsafe HTML such as script tags and event handlers and sanitizes SVGs. It also checks filesystem paths. Themes and snippets are different: they are **CSS you chose to trust**, so install them from sources you trust and respect their licenses. The [[Atlas/Media cabinet|media demo]] shows examples you can inspect.

## If something private was already published

Remove or exclude it, build again, and replace the deployment. Make sure the old page is no longer served; a host that leaves stale files behind can keep removed notes accessible. Review Git history separately if the source was committed.

If a credential was exposed, revoke or rotate it. Deleting the page doesn't make a published secret safe again, and caches or copies may remain outside your control.

[[About/Deployment|Next: deploy the reviewed site]] · [[About/Documentation|Guide index]].
`,
    },
    {
      path: 'About/Troubleshooting.md',
      kind: 'note',
      content: `---
title: Troubleshooting
category: documentation
tags: [lattice, documentation, troubleshooting]
description: Find a symptom, try a concrete fix, and get your site working again.
---

Find the symptom below and try its fix. Run npm commands from the project folder containing \`package.json\`, not from inside your vault.

## “npm: command not found”

Install **Node.js 22.12 or newer**, which includes npm, then close and reopen your terminal. Run \`node --version\` and \`npm --version\`; both should print a version.

In the project folder, run \`npm ci --include=dev\`, then \`npm run dev\`. The local site should start. If \`vite\` or \`tsc\` was missing, installing the development dependencies fixes that too. See [[About/Quick start]] for the full setup.

## “Folder not found” or “Cannot load publish configuration”

Open the project's \`publish.config.json\`. Set \`vault\` to the **actual folder containing your notes**, for example \`"vault": "./my-vault"\` when \`my-vault\` sits beside that configuration file.

If a copied folder contains another folder that holds the notes, point at the inner folder—not its wrapper. Relative vault paths start beside the configuration file; you can also use a full folder path.

If you previously set \`OBSIDIAN_VAULT\` or \`PUBLISH_CONFIG\`, remove the unwanted override from your terminal environment (\`unset OBSIDIAN_VAULT PUBLISH_CONFIG\` in bash/zsh). Then run \`npm run dev\` again. Your chosen vault should appear.

## “Configured home note is missing or private”

Remove the optional \`home\` entry from \`site\` to let Lattice choose a public note, or set it to an existing public filename such as \`"home": "Home.md"\` or \`"home": "Notes/Home.md"\`.

Use the vault-relative file path, not the displayed title or website URL. Keep private notes excluded. Save the configuration; the site should open with a valid homepage. If there are no published notes at all, add a public note or select the correct vault folder.

## A build stops on frontmatter, a setting, or a route collision

For an unknown setting, remove it or use a supported option from [[About/Configuration]]. For frontmatter errors, close the YAML block with \`---\` and use unquoted booleans such as \`private: true\` or \`publish: false\`; keep the intended exclusion.

For a route collision, rename one of the conflicting note files and update its incoming links. Run \`npm run build\` again. It should finish and write \`dist/\`.

## A link or embed says it is missing

Change the target to its full vault-relative path, especially if two notes share a filename. Check the heading text or \`^block-id\` when linking to a section. After renaming a file, update the links pointing to it.

Excluded notes cannot be linked or embedded on the public site; remove that reference or link to a public alternative. For an “embed recursion limit” message, replace the repeating whole-note embed with a direct link or a smaller section. Save the note; the corrected target should resolve. See [[About/Markdown and Bases]].

## A Base is empty

Temporarily remove its filters and use a \`table\` view with \`order: [file.name]\`. Public notes should appear. Add the filters back one at a time to find which condition removes the rows.

Check property spelling and YAML types: \`rating: 5\` is a number, while \`rating: "5"\` is text; a list is different from a single string. Check folder paths and the properties of the **host Markdown note**: \`this.file\` means that note, not the \`.base\` file.

If sorting by \`file.mtime\` changed after copying or cloning, use an explicit frontmatter date property for stable ordering. The filesystem timestamp is not your note's \`date\` property.

## An inline Base appears as code, or says “Unable to render Base”

For an inline view, change the opening fence from \`yaml\` to \`base\`:

\`\`\`\`markdown
\`\`\`base
views:
  - type: table
    order: [file.name]
\`\`\`
\`\`\`\`

Save the note; this should display a table of public notes. For an embedded file, use \`![[Data/Reading.base]]\` (the demo's example) or replace that path with your own Base.

For a render error, start with the table above and add expressions back gradually. \`file.hasLink(this.file)\` **is supported** for finding notes that link to the host. Replace other unsupported functions with simpler supported filters; use \`table\`, \`list\`, or \`cards\` views and remove circular formulas. [[About/Markdown and Bases]] lists supported expressions.

## Dark mode or the theme ignores my configuration

Open **Reader settings** and choose the color mode you want. If the Obsidian theme picker is available, choose the theme there too. Saved browser choices take precedence over the site's defaults and should survive a reload.

To try the configured defaults without changing your saved choices, open the site in a fresh private window. To reset saved choices, clear this site's browser storage; this also resets other reader preferences.

If a saved theme cannot load at startup, the page uses the site's default theme after a failed request or at most four seconds. Re-upload the complete build, including \`_theme/\`, then select the desired theme again. A failed switch in Reader settings keeps the current theme.

## Theme CSS fails to build, or plugin styling is missing

Check that \`.obsidian/appearance.json\` is valid JSON and that the selected \`theme.css\` and enabled snippet files exist. Top-level \`theme\` selects a theme; \`site.theme\` must be \`light\`, \`dark\`, or \`system\`.

To isolate the problem, temporarily set top-level \`"theme": "default"\`, \`"themes": []\`, and \`"snippets": []\`. If the error names extra CSS or a local import, fix that file path too. Rebuild; then restore one style at a time.

Plugin controls and Style Settings state do not run on the website. Use a snippet or vault-root \`publish.css\` for the reader styling you need. [[About/Obsidian themes]] explains the options.

## Folder folds reset or seem different on another visit

Fold a sidebar folder, then reload. It should stay folded in the same browser when storage is allowed. Removed or renamed folders lose their old fold state; new folders start open.

The folder preference key includes the homepage URL and source filename. Changing \`base\` or \`site.home\` starts a separate set of folds. Fold the folders again for the new site location; this does not change your notes. If all preferences reset on reload, allow site storage or use a normal window instead of a private session.

## Saved changes do not appear

**Using \`npm run preview\`?** Stop it with Ctrl+C, run \`npm run build\`, then \`npm run preview\` again. Preview serves the previous \`dist/\` and does not watch edits. Use \`npm run dev\` while writing notes.

**Using \`npm run dev\`?** Save in the vault selected by \`publish.config.json\`. If an error overlay appears, fix the named file or setting and save again; Lattice keeps the last working page until the edit succeeds. After changing \`base\`, restart the server and open the new base URL.

**Already deployed?** Upload the new build or trigger your host's deployment. A local save alone does not update the public site.

## A font, image, or video is missing

Open the resource URL directly. For a local attachment, correct its path and rebuild; upload all of \`dist/\`, including \`_assets/\` and \`_theme/\`. The resource should load at its generated URL.

Remote fonts, CSS imports, and media stay remote; they are not downloaded into the build. Check that their HTTPS URLs work and that your browser or host policy allows them, or replace them with local files. A font name alone does not supply the font.

If audio or video loads but will not play, try a browser-supported encoding and keep playback controls visible. If seeking fails only after deployment, use a static host that supports byte-range media requests. Provide a download link or text alternative where useful.

## The homepage works, but a direct note URL fails

Set \`base\` to the hosting path: \`"/"\` for a domain root or, for example, \`"/notes/"\` for a subdirectory. Rebuild and mount the **contents** of \`dist/\` there; \`base\` does not create an extra \`notes/\` output folder.

Configure the host to serve each note directory's \`index.html\`. Remove any blanket SPA rewrite to the homepage, and configure \`404.html\` for missing URLs with a 404 status. A direct note URL should open that note; an invented URL should show the missing-page page, not the homepage.

If renamed or excluded pages still open, replace the old deployment rather than leaving its files alongside the new build. See [[About/Deployment]] for host-specific steps.

## Still stuck?

[Open an issue](https://github.com/jgx0/lattice/issues) with the command, Node/npm versions, exact error, expected result, and a small non-sensitive note, Base, or CSS example. Leave out private vaults and secrets. [[About/Contributing]] explains how to propose a fix.

[[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'Data/Reading.base',
      kind: 'base',
      content: `filters:
  and:
    - 'file.ext == "md"'
    - 'file.inFolder("Library/Books")'
    - 'category == "book"'
    - 'collection == this.file.properties.collection'
properties:
  file.name:
    displayName: Book
  note.author:
    displayName: Author
  note.status:
    displayName: Reading status
  note.rating:
    displayName: Revisit / 5
  note.year:
    displayName: Published
views:
  - type: table
    name: The annotated shelf
    order:
      - file.name
      - note.author
      - note.status
      - note.rating
      - note.year
    sort:
      - property: note.rating
        direction: DESC
      - property: file.name
        direction: ASC
`,
    },
    {
      path: 'Data/Related.base',
      kind: 'base',
      content: `filters:
  and:
    - 'file.ext == "md"'
    - 'file.inFolder("Field Notes")'
    - 'category == this.file.properties["related-category"]'
    - 'file.path != this.file.path'
properties:
  file.name:
    displayName: Nearby note
  note.status:
    displayName: Growth
  note.date:
    displayName: Last tended
  note.tags:
    displayName: Threads
views:
  - type: table
    name: Nearby field notes
    order:
      - file.name
      - note.status
      - note.date
      - note.tags
    sort:
      - property: note.date
        direction: DESC
`,
    },
    {
      path: 'Assets/Garden diagram.svg',
      kind: 'asset',
      mime: 'image/svg+xml',
      content: gardenSvg,
      data: gardenData,
    },
    {
      path: 'Assets/Quiet chime.wav',
      kind: 'asset',
      mime: 'audio/wav',
      content: '',
      data: chimeData,
    },
    {
      path: 'Assets/Landscape study.mp4',
      kind: 'asset',
      mime: 'video/mp4',
      content: '',
      data: landscapeData,
    },
  ],
};

export const defaultSettings: SiteSettings = {
  home: 'Welcome.md',
  title: 'Lattice',
  description: 'Publish connected Obsidian notes with a static, note-native reader.',
  accent: '#8065da',
  theme: 'light',
  communityTheme: 'default',
  customCss: '',
  readable: true,
  showProperties: true,
  showToc: true,
  showBacklinks: true,
  showGraph: true,
  stacked: false,
  navigation: ['Field Notes', 'Essays', 'Library', 'Projects', 'Atlas', 'About'],
  hiddenPaths: ['Data', 'Templates'],
};
