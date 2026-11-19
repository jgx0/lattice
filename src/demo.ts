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

## Get started

Clone the repo, copy your vault into the project folder, point Lattice at it in \`publish.config.json\`, and run \`npm run dev\`. **That's all you need to start.** Follow [[About/Quick start|Quick start]] for the commands and a small configuration example.

- [[About/Documentation|Documentation]] — the guides, when you need them.
- [[About/Quick start|Quick start]] — clone, copy your vault, choose its folder, and run.
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
description: Lattice's filesystem compiler, static-page generator, and browser reader boundary.
---

Lattice separates the **source vault**, the **compiled public site**, and the **browser reader**. Markdown processing and theme ingestion happen on the build machine. Reader interactions operate on compiled public data.

## Build pipeline

1. \`build/config.ts\` reads and validates disk configuration and environment overrides.
2. \`build/compile.ts\` scans allowed vault files, skips hidden paths and symlinks, validates publication frontmatter with fail-closed errors, and filters private notes before building the note model.
3. \`src/lib/model.ts\` extracts titles, properties, headings, links, tags, and slugs.
4. \`src/lib/render.ts\` and \`src/lib/bases.ts\` render Markdown, transclusions, media, and supported Bases views. Sanitization uses an isolated JSDOM window and window-bound DOMPurify helpers from \`src/lib/sanitize.ts\`.
5. The compiler rewrites internal links and local asset references to deployment URLs, ingests selected theme/snippet CSS, and collects referenced assets.
6. \`build/vaultPlugin.ts\` integrates compilation with Vite and emits assets, per-note pages, and \`404.html\`. \`build/staticPages.ts\` creates semantic note HTML around the application shell and a missing-page shell that does not mount the reader. Route/output collisions and source/output overlap fail the build rather than overwriting pages or the vault.

The compiler closes its isolated DOM after a compilation. It does not depend on browser globals, fetch remote CSS, or upload the vault.

## Output boundary

\`dist/\` contains semantic note HTML, the reader bundle, compiled public metadata/search data, and emitted assets. The browser payload does not include each original complete Markdown file: \`PublishedNote.content\` is empty, and its searchable \`body\` omits nonliteral Obsidian comments. Literal \`%%\` examples inside fenced or inline code are preserved. Published note text, properties, HTML, and previews remain public; a hidden panel does not make them confidential. Private notes, unselected \`.obsidian\` source files, and arbitrary unreferenced vault attachments are not blindly copied.

Public metadata is still public: YAML properties, search information, previews, and links for surviving notes may be available even if a panel hides them. The privacy boundary is **exclusion before compilation**, not a visual control in the reader.

Each published note has a URL and directory \`index.html\`; its text, navigation, outline, and backlinks exist before JavaScript. The browser receives precompiled published pages and a public search index, and adds interactions without uploading or processing local vault files.

## Browser reader

- \`src/App.tsx\` coordinates navigation, browser history, preferences, optional panes, and the compiled site.
- \`src/SidebarTree.tsx\` renders nested file navigation.
- \`src/MarkdownContent.tsx\` handles interactions with already-rendered note content.
- \`src/GraphView.tsx\` presents local/global connections.
- \`src/lib/search.ts\` searches public compiled note information.

Reader preferences are local presentation state, not an account, synchronized vault, or authorization mechanism. Obsidian plugins and theme plugins do not execute in this layer.

## Local development

The Vite plugin watches vault roots, configuration, appearance settings, CSS inputs, and dependencies discovered during compilation. It debounces edits and publishes only a complete successful snapshot. If a new edit fails, the previous snapshot stays available and the error is reported; a later successful edit can recover.

The development middleware serves compiled notes and emitted assets and blocks direct requests for vault source files, including source requests through Vite's filesystem route. This is useful defense in depth, not a reason to deploy a development server publicly.

## Tests and fixtures

\`src/demo.ts\` is an in-memory sample fixture for integration and reader tests, not the production vault loader. Production reads the configured filesystem vault. Keep fixture links and sample note content synchronized when editing the checked-in demo; do not replace the build pipeline with browser-side file processing.

See [[About/Contributing]] for regression checks, [[About/Security and privacy]] for trust boundaries, and [[About/Deployment]] for static hosting.

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

Start with just your vault folder and a site name. Open \`publish.config.json\` in the \`lattice\` project folder and use:

\`\`\`json
{
  "vault": "./my-vault",
  "site": { "title": "My notes" }
}
\`\`\`

If you copied your vault into \`lattice/my-vault/\`, that's all you need. Change the folder name to match yours, then run \`npm run dev\`. You can leave every other setting at its default. See [[About/Quick start]] for the full walkthrough.

The sections below are optional reference material. Lattice reads \`publish.config.json\` from the project folder; a misspelled setting produces an error so you know it has not taken effect.

## Source and deployment paths

| Field | Meaning |
| --- | --- |
| \`vault\` | Source directory; defaults to \`./vault\`. Relative paths resolve beside the config file. |
| \`base\` | Rooted public URL pathname; defaults to \`/\`. Use \`/notes/\` for a subdirectory deployment. |
| \`site.home\` | Existing public homepage note, preferably its full vault-relative path. If omitted, the first compiled note is used. |

\`base\` is a path, not a full domain URL. Query strings, fragments, traversal segments, and protocol-relative paths are rejected. Internal links, theme assets, attachments, and the application bundle share this base. Rebuild when it changes.

\`\`\`sh
PUBLISH_CONFIG="/absolute/path/to/publish.config.json" npm run build
OBSIDIAN_VAULT="/absolute/path/to/Your Vault" npm run build
\`\`\`

A relative \`PUBLISH_CONFIG\` resolves from the project root. \`OBSIDIAN_VAULT\` overrides \`vault\`; a relative environment vault path resolves from the project root rather than from the config file.

## Reader settings

| \`site\` setting | Default | Purpose |
| --- | --- | --- |
| \`title\` | \`Notes\` | Site name. |
| \`description\` | Empty | Fallback HTML description; a note's \`description\` property takes precedence. |
| \`theme\` | \`system\` | Reader color mode: \`light\`, \`dark\`, or \`system\`. Not a community theme name. |
| \`accent\` | Empty | Optional \`#RGB\` or \`#RRGGBB\`; otherwise a valid vault accent can apply. |
| \`readable\` | \`true\` | Restrained reading width. |
| \`showProperties\` | \`true\` | Display YAML properties; hiding this panel does not make properties private. |
| \`showToc\` | \`true\` | Heading outline. |
| \`showBacklinks\` | \`true\` | Incoming note links. |
| \`showGraph\` | \`true\` | Graph panel. |
| \`stacked\` | \`false\` | Horizontal stacked-page reading. |
| \`allowThemeSwitching\` | \`false\` | Let readers choose included Obsidian themes in settings. |
| \`navigation\` | \`[]\` | Order folders and full note paths. |
| \`hiddenPaths\` | \`[]\` | Exclude matching vault-relative files or whole folders before rendering. |

The demo deliberately sets \`showProperties: false\`. Reader controls can change presentation locally; they are not an authoring or access-control interface.

## Navigation is not privacy

\`navigation\` orders entries; it does not restrict what is published. \`navigationFolders\` moves a note to another public navigation folder without moving its source:

\`\`\`json
{
  "site": {
    "navigation": ["About", "Projects", "Notes"],
    "navigationFolders": {
      "Research/Methods.md": "Guides/Research"
    },
    "hiddenPaths": ["Private", "Templates"]
  }
}
\`\`\`

Paths in \`navigation\` and \`hiddenPaths\` must be vault-relative, non-empty, and without \`..\`. Use full note paths to avoid ambiguous filenames. See [[About/Security and privacy]] for explicit note-level exclusion.

## Appearance inputs

Top-level \`theme\` selects an installed community theme name or CSS file path. When \`site.allowThemeSwitching\` is enabled, optional top-level \`themes\` limits the reader's choices to listed theme names or CSS paths; otherwise installed themes are discovered automatically. See [[About/Obsidian themes#Let readers switch themes|the theme-picker guide]]. \`snippets\` selects CSS snippet names or paths; omit it to follow Obsidian, or use \`[]\` to disable snippets. \`css\` lists additional CSS paths. \`bodyClasses\` adds individual class names, without whitespace inside a name.

\`site.communityTheme\` is a fallback when no explicit theme or vault \`cssTheme\` is selected. \`site.customCss\` accepts inline trusted CSS; prefer a versioned \`publish.css\` or CSS file for maintainability. These are not a plugin runtime.

See [[About/Obsidian themes]] for precedence, assets, and compatibility limits; [[About/Deployment]] covers host paths.

[[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'About/Contributing.md',
      kind: 'note',
      content: `---
title: Contributing
category: documentation
tags: [lattice, documentation, contributing]
description: Maintain Lattice with focused changes, regression tests, and truthful demo provenance.
---

Make focused changes that preserve the build/browser boundary, note-native presentation, and privacy filtering. See [[About/Maintainer|the maintainer]] for project maintenance information. Source, issues, and pull requests are hosted at [jgx0/lattice](https://github.com/jgx0/lattice).

## Set up and verify

From the project root, using Node.js 22.12 or newer:

\`\`\`sh
git clone https://github.com/jgx0/lattice.git
cd lattice
npm ci --include=dev
npm run check
npm audit
\`\`\`

\`npm run check\` runs type checking, the complete test suite, and the production build. The build also runs TypeScript checks and compiles the filesystem demo. The checked-in GitHub Actions workflow verifies Node.js 22 and 24; it does not deploy a site. Tests cover note/link/search/Bases behavior, sanitization, true Node compilation without browser globals, themes and CSS assets, privacy filtering, static HTML, preview serving, watcher recovery, and React reader interactions.

For a demo-content change, a focused regression command is:

\`\`\`sh
npm test -- src/lib/integration.test.ts src/App.test.ts build/compile.test.ts
\`\`\`

Run the full suite before treating a cross-cutting change as complete. Audit results need investigation; do not claim a clean audit without running it.

## Find the right layer

| Area | Primary files |
| --- | --- |
| Configuration validation | \`build/config.ts\` |
| Filesystem compilation and theme assets | \`build/compile.ts\` |
| Vite integration, watcher, static emission | \`build/vaultPlugin.ts\` |
| Semantic note pages | \`build/staticPages.ts\` |
| Note model, links, Markdown/Bases, sanitization | \`src/lib/\` |
| Reader state and navigation | \`src/App.tsx\` |
| Reader components | \`src/SidebarTree.tsx\`, \`src/GraphView.tsx\`, \`src/MarkdownContent.tsx\` |
| Filesystem demo | \`vault/\` |
| In-memory regression fixture | \`src/demo.ts\` |

Read [[About/Architecture]] before moving logic between these layers. Public reader code should consume compiled data, not load private source files or parse vaults at runtime.

## Keep the demo truthful

Sample notes are illustrative fixtures. Keep their observations, book ratings, and example project histories labeled as demo content, and preserve genuine bibliographic author names.

When renaming a demo note, update wikilinks, transclusion targets, fixtures, and relevant regressions. Prefer exact vault-relative links. Documentation pages use frontmatter titles without a duplicate top-level body heading.

Do not modify third-party theme vendor files casually. Preserve their licenses and provenance; use snippets or \`publish.css\` for site-level overrides.

## Review changes as a reader

Check a narrow screen, keyboard navigation, both color modes, direct URLs, heading links, previews, optional panels, and no-JavaScript note content. Look for unresolved links, embed limits, Base errors, and unexpectedly exposed metadata.

For privacy or asset changes, add a regression that proves excluded material cannot enter public HTML, transclusions, previews, Bases, or metadata. Test failure cases, not only successful rendering.

## Share an issue or proposed change

[Open an issue](https://github.com/jgx0/lattice/issues) or [submit a pull request](https://github.com/jgx0/lattice/pulls). Use a minimal, non-sensitive reproduction and explain expected versus actual behavior. Include commands and version information. Avoid publishing a full private vault, screenshots with personal data, or configuration containing secrets.

See [[About/Troubleshooting]] for diagnosis and [[About/Security and privacy]] for the safety review.

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
description: Build, inspect, and deploy only Lattice's static output to a production host.
---

Deploy **the generated \`dist/\` directory**, not the project checkout or the source vault. Lattice produces static HTML, application assets, referenced attachments, and theme assets; a production host does not need access to your notes or a running compiler.

## Build on your machine or in CI

Use Node.js 22.12 or newer. From the project root:

\`\`\`sh
npm ci --include=dev
npm run check
npm run preview
\`\`\`

\`npm run check\` runs type checking, all tests, and the production build. The build requires development dependencies: TypeScript, Vite, and build-time JSDOM are installed there. Do not use a production-only install such as \`npm ci --omit=dev\` for the builder. \`--include=dev\` is explicit so CI environments with \`NODE_ENV=production\` still install the toolchain.

\`preview\` serves the already-built output, normally at \`http://localhost:4173\`. It is a **local verification tool**, not a hardened production service. Likewise, the live development server is not the public deployment target.

## Review before upload

- Open the homepage and a deep note URL directly, including after a reload.
- Check links, heading anchors, navigation, and static note content with JavaScript disabled.
- Test images, audio, video, PDFs, and local theme assets where used.
- Inspect \`dist/\` for secrets, unwanted properties, copied quotations, and private details.
- Confirm there are no unresolved links or visible Base/embed errors on the routes you intend to share.
- Remove old deployment output when replacing a site; excluded notes must not survive as stale files on the host.

A successful build validates compilation, not the appropriateness of making every surviving sentence public. Follow [[About/Security and privacy]] for source exclusion and external-resource review.

## Static host requirements

Configure your host to serve \`dist/\` as the site's document root. Note routes are emitted as directory \`index.html\` files, so the host should serve directory indexes and preserve encoded URL paths. Each note's semantic HTML includes its content, navigation, outline, and backlinks before JavaScript runs.

Do not rely on a blanket single-page-app fallback that serves the homepage for every unknown URL; it can hide missing routes. The build emits \`404.html\`, and local development/preview return an actual 404 status for missing pages without mounting the reader over the error page. Configure the static host to use that missing-page document with a 404 status, then test a URL that does not exist. Configure HTTPS, caching, and any desired security headers on the host. There is no built-in login or password gate; private access requires separate hosting infrastructure.

## Cloudflare Pages

The root \`wrangler.jsonc\` identifies the Pages project with \`name: "lattice"\`, sets \`pages_build_output_dir: "./dist"\`, and pins a \`compatibility_date\`. These are Pages settings, not a Worker entry point. Change the project name if you use a different Pages project.

### Git integration

Open the [Cloudflare Pages setup dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages), create a **Pages** project, and select [jgx0/lattice](https://github.com/jgx0/lattice) or a fork that you control. Select the project root and configure:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | \`npm run build\` |
| Build output directory | \`dist\` |
| Node.js | 22.12 or newer in the Node 22 release line (\`NODE_VERSION=22\`) |
| Install dependencies | Set \`NPM_CONFIG_INCLUDE=dev\`; use \`npm ci --include=dev\` where an install command is configurable |

If the dashboard uses an automatic dependency install, ensure its environment does not omit development dependencies. With a custom install step, skip the automatic install if needed and run \`npm ci --include=dev\` before \`npm run build\`. The repository's Node version file selects Node 22, but verify the version reported in the build log.

### CLI upload

First create the Pages project in your Cloudflare account, using the dashboard or \`npx wrangler pages project create lattice\`. Then, from the project root:

\`\`\`sh
npm ci --include=dev
npm run build
npx wrangler pages deploy dist --project-name=lattice
\`\`\`

Wrangler requires authentication and an existing project named \`lattice\`; the commands above do not provide credentials. Choose Git integration or direct uploads when setting up the project, rather than assuming an existing project supports switching workflows.

\`public/_headers\` is copied into \`dist/\` for Cloudflare Pages static responses. It configures baseline security headers and immutable caching for hashed application, attachment, and theme assets. Review it alongside your theme and embed choices; headers do not add authentication or make published notes private.

## Vercel

The root \`vercel.json\` selects a static build with \`framework: null\`, \`cleanUrls: true\`, \`outputDirectory: "dist"\`, \`installCommand: "npm ci --include=dev"\`, and \`buildCommand: "npm run build"\`. It also defines security and hashed-asset cache headers without a blanket SPA rewrite. Use Node.js 22.12 or newer in the Node 22 release line in the project's dashboard settings.

Open the [Vercel clone-and-deploy flow](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjgx0%2Flattice), or import [jgx0/lattice](https://github.com/jgx0/lattice) or your fork from the dashboard, and keep the root directory at this project's root. Verify the framework is **Other**, the install command includes development dependencies, the build command is \`npm run build\`, and the output directory is \`dist\` before deploying. Only the static output is served; the source vault is a build input.

The repository is [jgx0/lattice](https://github.com/jgx0/lattice). The Vercel link opens a repository-specific clone-and-deploy setup flow; authentication and confirmation are still required. Git-triggered deployments require connecting your repository or fork and pushing to its configured deployment branch. Neither the link nor these configuration files pushes local changes or provisions a deployment automatically.

## Netlify and continuous verification

The checked-in \`netlify.toml\` uses Node.js 22, runs \`npm run build\`, and publishes \`dist\`. It configures \`nosniff\`, referrer/permissions policies, and long-lived immutable caching for hashed application, attachment, and theme assets. It intentionally has no blanket SPA redirect. Ensure dependency installation includes the development toolchain.

The GitHub Actions verification workflow installs dependencies and runs \`npm run check\` on Node.js 22 and 24. It verifies the project but does not deploy it or provision hosting credentials. These host configurations are starting points, not a security certification or a private-access mechanism; no hosting account or live deployment is provisioned by the configuration files.

## Deploy under a subdirectory

Start with the default root \`base: "/"\` for the Cloudflare Pages, Vercel, and Netlify setups above. If you later host at a path such as \`/notes/\`, configure:

\`\`\`json
{
  "vault": "./vault",
  "base": "/notes/",
  "site": { "title": "My notes", "home": "Welcome.md" }
}
\`\`\`

Rebuild, then mount the **contents** of \`dist/\` at \`/notes/\` on the host. The base prefixes public URLs; it does not add a nested \`notes/\` directory to the output. Preview reads the emitted base manifest, so visit its printed base URL when checking the build.

Changing a domain alone does not require changing \`base\`; changing the mount path does. A correct base must reach note pages, the application bundle, \`_assets/\`, and \`_theme/\` consistently. Revisit host routing and the path patterns in \`public/_headers\`, \`vercel.json\`, and \`netlify.toml\` when moving away from \`/\`; the checked-in hashed-asset cache rules assume a root deployment.

## Updating the site

Edit locally, rerun the checks and build, and replace the deployment with the new output. Prefer atomic deployments or a host that versions releases, especially when note names or privacy settings change. Keep the source vault and its \`.obsidian\` settings on the build side; only deliberately emitted public files belong on the host.

[[About/Configuration|Configuration]] covers path overrides; [[About/Troubleshooting]] covers deep-link and asset failures.

[[About/Documentation|Documentation index]].
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
description: Setup, configuration, themes, Markdown, deployment, and safety for Lattice.
---

**Lattice** turns your Obsidian vault into a website. To get started, clone the repo, copy your vault into the project folder, point \`publish.config.json\` at that folder, and run \`npm run dev\`. You do not need to convert notes or work through every setting.

**Start with [[About/Quick start|Quick start]].** The other guides are here when you need them. [[Projects/Lattice|The project overview]] describes the reader and its features.

## Publish a vault

1. [[About/Quick start|Quick start]] — clone, copy your vault, choose its folder, and run.
2. [[About/Configuration|Configuration]] — choose a vault, homepage, navigation, and hidden paths.
3. [[About/Obsidian themes|Obsidian themes]] — use the installed theme, snippets, and CSS assets.
4. [[About/Markdown and Bases|Markdown and Bases]] — supported note syntax, transclusions, and data views.
5. [[About/Security and privacy|Security and privacy]] — decide what may become public.
6. [[About/Deployment|Deployment]] — verify output and publish to a static host.

## Understand and maintain it

- [[About/Architecture|Architecture]] — what happens during compilation versus in the browser.
- [[About/Troubleshooting|Troubleshooting]] — configuration errors, missing links, themes, and deployment paths.
- [[About/Contributing|Contributing]] — code locations, regression checks, and demo-content standards.

## A useful boundary

This is a **publisher**, not an Obsidian plugin host or a private workspace service. There is no plugin execution, Dataview runtime, Canvas editing, Sync, collaboration, account system, or password protection. Bases is a supported subset, not a promise of compatibility with every Obsidian expression.

Sample notes are illustrative fixtures for rendering, navigation, and linked collections. Use them to explore the reader, then replace them with the notes you intend to publish.

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

Lattice compiles notes on the build machine. Ordinary Markdown and supported Obsidian syntax become sanitized HTML. The browser receives rendered public pages and searchable note text/properties, not the original complete Markdown files. Nonliteral Obsidian comments are omitted from the searchable body; literal \`%%\` examples inside fenced or inline code are preserved. The browser does not upload or process local vault files or run Obsidian plugins.

## Note titles and properties

Put the page title in YAML frontmatter. The reader supplies the page heading, so avoid repeating it as a top-level heading in the body.

\`\`\`markdown
---
title: My note
aliases: [Another name]
tags: [research]
description: A short description for this page.
---

An opening paragraph.

## A useful section

The note continues here.
\`\`\`

Properties can drive Bases and are part of public compiled data even if the properties panel is hidden. When visible, the properties panel appears at the bottom of the note so reading begins with the title and note body. Wikilinks in property strings, lists, and nested values contribute to backlinks and graphs and become clickable links in the properties panel and Base cells. For example:

\`\`\`yaml
category: "[[Field Notes/Digital gardens]]"
related:
  - "[[Field Notes/Walking as research|Walking]]"
  - "[[Field Notes/Digital gardens#A link should carry a thought|A useful link]]"
\`\`\`

Use unquoted YAML booleans for privacy flags, not strings; see [[About/Security and privacy]].

## Links and transclusions

Use vault-relative wikilinks when filenames could be ambiguous. Aliases change displayed text without changing the target.

\`\`\`markdown
[[Field Notes/Digital gardens]]
[[Field Notes/Digital gardens|Digital gardens]]
[[Field Notes/Digital gardens#A link should carry a thought]]
[[Field Notes/Digital gardens#^link-test]]

![[Field Notes/Digital gardens#^link-test]]
![[Field Notes/Walking as research#A detail to return to]]
![[Field Notes/The useful edge]]
\`\`\`

These examples point to existing sample notes. A block identifier such as \`^link-test\` marks the source block. Whole-note, heading, and block embeds are supported; recursion is bounded, so cyclic or excessively nested embeds are not an unlimited expansion mechanism.

Markdown links and heading/block anchors also work. The build rewrites resolved internal links to published URLs. Renaming a file can change its route; update incoming links before rebuilding.

## Reader syntax and media

Supported forms include tables, native-style callouts, disabled task checkboxes, footnotes, highlighting, fenced code, and bundled LaTeX output. Tasks are rendered for reading, not synchronized back to the source. Fenced code is displayed, not executed.

\`\`\`markdown
> [!note] A useful boundary
> Keep the source visible and name the uncertainty.

- [ ] An illustrative task

Inline math: $E = mc^2$.
\`\`\`

Local images, audio, video, and PDFs are supported, including wiki asset embeds and sanitized HTML media. Native playback depends on the browser and codec. Keep controls and text equivalents visible; [[Atlas/Media cabinet]] demonstrates offline SVG/audio/video. Remote frames are a separate trust and privacy decision, not a free extension of the local-media model.

## Bases

Embed a \`.base\` file from a note. The [[Library/The reading room|reading room]] uses \`Data/Reading.base\`; [[Field Notes/Digital gardens]] uses \`Data/Related.base\`.

\`\`\`markdown
![[Data/Reading.base]]
\`\`\`

A minimal Base file can select public notes and order a table:

\`\`\`yaml
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
\`\`\`

You can also put the Base definition directly in your note, in a fenced block labeled \`base\`:

\`\`\`\`markdown
\`\`\`base
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
\`\`\`
\`\`\`\`

This renders a table of public notes that link to the current note, with the most recently modified first. \`this.file\` is the note containing the block. Property wikilinks count too. \`file.mtime\` comes from the source file's filesystem modification time; \`file.ctime\` uses its creation time where available. A copied or freshly cloned vault may have different timestamps from the original vault.

Inline Bases use the same views and filters as embedded \`.base\` files. A fence labeled \`yaml\` is just a code example; label it \`base\` to render the view. Invalid configurations produce a visible Base error.

Supported views are \`table\`, \`list\`, and \`cards\`. View-level filters combine with base-level filters; \`order\` chooses fields, \`sort\` defines initial sorting, and \`limit\` bounds displayed rows. A table's columns can also be sorted in the reader. Multiple configured views are rendered as sections, not an Obsidian editing interface.

## Expression context and limits

\`file\` describes the candidate row; \`note\` and bare property names access its frontmatter. \`this.file\` describes the **host note**, not the \`.base\` source file. For example, \`collection == this.file.properties.collection\` selects books for the reading room, while \`file.path != this.file.path\` excludes the host from related rows.

\`file.hasLink("Field Notes/Digital gardens")\` tests whether a row links to a note, including links in its properties. \`file.hasLink(this.file)\` and \`file.links.contains(this.file)\` select notes that link to the host. String, \`link(...)\`, and \`file.link\` targets can resolve aliases and heading/block references. \`file.hasTag("research")\` includes nested tags such as \`research/methods\`, and supported values can use \`toString()\` for display.

The evaluator supports a bounded, no-eval subset: property access, comparisons, Boolean/arithmetic operators, lists, conditionals, formulas, and selected helpers such as \`contains\`, \`length\`, \`if\`, \`number\`, \`string\`, and \`file.inFolder\`. Supported list/string methods include \`contains\`, \`join\`, \`split\`, \`unique\`, \`map\`, and \`filter\`; this is not general JavaScript or every Obsidian Bases function. Formula cycles, excessive complexity, and unsupported expressions produce visible Base errors.

Only filtered public notes can become rows. A missing property usually means an empty value or no matching row, not an automatic inferred value. See [[About/Troubleshooting]] for diagnosing Base errors.

[[About/Documentation|Documentation index]].
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

Lattice uses **actual installed Obsidian CSS**, not approximations selected from a theme gallery. It reads your vault's \`.obsidian/appearance.json\` and loads the corresponding files at build time.

## Built-in Publish theme

The demo starts with **Default (Obsidian)**; Publish remains available in Reader settings. Lattice includes \`publish-theme\`, a built-in reader style based on the public Obsidian Publish layout: one reading scrollbar, a restrained file tree, a sticky page-context column, compact graph icons with a local-graph popover, hierarchical outlines, and Publish-sized titles.

\`\`\`json
{
  "vault": "./vault",
  "theme": "publish-theme",
  "site": { "theme": "system" }
}
\`\`\`

This theme ships with Lattice, so it does not need to exist in \`.obsidian/themes\`. It still respects your light/dark choice and loads snippets, \`publish.css\`, extra CSS, and configured appearance variables afterward. Use a real installed theme instead when you want that theme's original design.

## Follow the vault

\`\`\`json
{
  "cssTheme": "Minimal",
  "enabledCssSnippets": ["typography", "tables"],
  "accentColor": "#8065da",
  "baseFontSize": 18,
  "textFontFamily": "Inter",
  "monospaceFontFamily": "JetBrains Mono"
}
\`\`\`

This example expects \`.obsidian/themes/Minimal/theme.css\` and \`.obsidian/snippets/typography.css\` and \`tables.css\` to exist. The demo includes the original Minimal theme and its license, but its baseline appearance does not require selecting Minimal. Install and select any other theme in your own Obsidian vault before publishing it.

Fonts named in appearance settings must be available in the browser or supplied through trusted CSS; naming a font does not download it. Text size applies for numeric values from 8 to 72 pixels. A configured site accent takes precedence over the vault accent.

## Override deliberately

In \`publish.config.json\`:

\`\`\`json
{
  "vault": "./vault",
  "theme": "Minimal",
  "snippets": [],
  "css": ["./site-overrides.css"],
  "bodyClasses": ["minimal-style-default"],
  "site": { "theme": "system", "showProperties": false }
}
\`\`\`

Top-level \`theme\` chooses the community theme; \`site.theme\` chooses light/dark/system mode. Set top-level \`theme\` to \`"default"\` to ignore the vault's selected theme. Omitted \`snippets\` follows \`enabledCssSnippets\`; an empty array disables them.

Theme/snippet names resolve inside \`.obsidian\`. Explicit CSS paths and additional \`css\` entries resolve beside the configuration file. Files named by explicit settings must exist; unavailable selected themes or snippets fail compilation rather than silently switching styles.

## Let readers switch themes

To show an **Obsidian theme** picker in Reader settings, enable it in \`publish.config.json\`:

\`\`\`json
{
  "vault": "./vault",
  "site": { "allowThemeSwitching": true }
}
\`\`\`

Lattice includes Default (Obsidian) and the themes installed in \`.obsidian/themes\`. The reader can switch immediately without rebuilding or changing your vault. The choice is saved in that browser; light/dark/system color mode remains a separate setting.

Want to offer only a few themes? Add a top-level allowlist:

\`\`\`json
{
  "vault": "./vault",
  "themes": ["Minimal", "Things"],
  "site": { "allowThemeSwitching": true }
}
\`\`\`

Only list themes already installed in your vault, or explicit CSS file paths. Default and the site's selected theme remain available. Use \`themes: []\` to offer only those two. Theme switching is disabled by default, so other theme files are not bundled unless you enable it.

Theme styles are served as local CSS assets and fetched only when selected. Snippets, \`publish.css\`, and your other site overrides still apply afterward. If a theme cannot be loaded, the reader keeps the current appearance and shows an error. This does not install themes or execute Obsidian plugins.

## Loading order and assets

Reader baseline CSS is followed by the compiled theme layer. Within that layer, Lattice loads:

1. The selected community theme.
2. Selected snippets, in their listed order.
3. Optional vault-root \`publish.css\`.
4. Additional top-level \`css\` files.
5. Appearance-derived variables and optional \`site.customCss\`.

Local CSS imports are processed recursively. Supported local fonts and images are emitted with rewritten URLs under the configured deployment base. Import cycles, unsupported asset types, and references outside a file's allowed boundary are build errors. A named theme's assets must stay within that theme directory; a snippet or explicit CSS file's assets stay within its directory. Vault-root \`publish.css\` can reference allowed assets within the vault, but not hidden assets.

Remote imports and remote \`url(...)\` references remain remote. The build does not fetch them; readers need connectivity and may contact third-party servers. Only use CSS you trust.

## Matching Obsidian, not running Obsidian

The reader exposes \`.theme-light\`, \`.theme-dark\`, workspace/file-tree classes, \`.markdown-preview-view\`, \`.markdown-rendered\`, callouts, metadata, and hover-popover classes. Native variables include \`--background-primary\`, \`--text-normal\`, \`--font-text\`, and \`--file-line-width\`. Homepage \`cssclasses\` can contribute body classes alongside configured \`bodyClasses\`.

Obsidian is an Electron application. Plugin-only controls, editing panes, and Style Settings plugin state are not reproduced or executed. Use reviewed snippets, \`publish.css\`, or body classes for matching reader styles, and test both color modes and narrow screens.

See [[About/Troubleshooting]] for missing CSS and [[About/Security and privacy]] for the trust boundary.

[[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'About/Quick start.md',
      kind: 'note',
      content: `---
title: Quick start
category: documentation
tags: [lattice, documentation, setup]
description: Clone Lattice, copy in your vault, choose its folder, and start your site.
---

**Clone the repo, put your vault in the project folder, point Lattice at it, and run.** You do not need to upload notes, convert your Markdown, or configure every setting.

You'll need Git and **Node.js 22.12 or newer** installed. Node includes npm, which runs the commands below.

## 1. Clone Lattice

Open a terminal and run:

\`\`\`sh
git clone https://github.com/jgx0/lattice.git
cd lattice
npm ci
\`\`\`

Keep this terminal open. Run the remaining commands from this \`lattice\` folder—not from inside your vault.

## 2. Copy your vault into the folder

Using Finder, File Explorer, or your usual file manager, copy your Obsidian vault into the \`lattice\` folder. For this guide, name the copied folder **\`my-vault\`**:

\`\`\`text
lattice/
├── my-vault/
│   ├── .obsidian/
│   ├── Home.md
│   ├── Notes/
│   └── Attachments/
├── publish.config.json
└── package.json
\`\`\`

Your notes and attachments stay as they are. Include the hidden \`.obsidian\` folder if you want Lattice to use your installed theme and enabled CSS snippets.

The included \`vault/\` folder is just the demo. Leave it alone; your own vault goes in a separate folder. Make sure \`my-vault\` is the actual vault folder containing your notes, not an extra folder wrapped around it.

## 3. Tell Lattice which folder to use

Open **\`publish.config.json\`** in the \`lattice\` folder. Replace its contents with:

\`\`\`json
{
  "vault": "./my-vault",
  "site": {
    "title": "My notes"
  }
}
\`\`\`

That's the only configuration you need to start. If your folder has a different name, change \`./my-vault\` to match it. Lattice uses the other settings' defaults and picks a note as the homepage.

If you want a specific homepage, add \`"home": "Home.md"\` inside \`site\`, using the name of a note that actually exists in your vault. See [[About/Configuration]] for optional settings—you do not need them to get started.

## 4. Start your site

Back in the terminal, run:

\`\`\`sh
npm run dev
\`\`\`

Open **http://localhost:5173**, or the address printed in the terminal. Your notes should now be on the site.

**You're ready to go.** Edit a note in the copied vault and save it; Lattice rebuilds and refreshes the page. Leave the terminal running while you work. Press **Ctrl+C** when you want to stop the server.

If you prefer to keep your vault somewhere else, you can use its full folder path in \`vault\` instead of copying it. Lattice reads the folder you choose; it does not move or rewrite your source notes.

## Want to try the demo first?

After step 1, run \`npm run dev\` without changing anything. The original configuration opens the included demo vault. Stop the server, then follow steps 2 and 3 when you want to use your own notes.

## Ready to put it online?

Local setup and public deployment are separate. When you are happy with your site:

\`\`\`sh
npm run build
\`\`\`

Lattice writes the website to **\`dist/\`**. Deploy that folder to Cloudflare Pages, Vercel, Netlify, or another static host; follow [[About/Deployment]] for the provider steps. \`npm run dev\` only starts a local preview—it does not publish your vault to the internet.

**Before pushing your repository or deploying:** keep your personal vault out of Git (for this example, add \`my-vault/\` to \`.gitignore\`) and review which notes should be public. Notes are included unless you exclude them. [[About/Security and privacy]] explains how to hide private notes and folders.

## If something doesn't work

- **Folder not found:** check that \`vault\` matches the folder name and that you're editing the project's \`publish.config.json\`.
- **Homepage not found:** remove the optional \`home\` setting or point it at an existing note.
- **Command not found:** check that Node.js and npm are installed, then reopen your terminal.
- **A build error appears:** read the filename and message in the terminal; fix the note or setting and save again.

More help: [[About/Troubleshooting]].

[[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'About/Security and privacy.md',
      kind: 'note',
      content: `---
title: Security and privacy
category: documentation
tags: [lattice, documentation, privacy]
description: Exclude private notes before compilation and review public data, CSS, and embeds.
---

A published Lattice site is **public** unless your host separately restricts access. Lattice has no accounts, authorization service, or password protection. The build reads the vault locally and does not upload it; deploying the output is the step that makes the compiled material available to readers.

## Exclude, do not merely hide

Use \`site.hiddenPaths\` in configuration to exclude whole files or folders:

\`\`\`json
{
  "site": { "hiddenPaths": ["Private", "Templates", "People/Contact details.md"] }
}
\`\`\`

Or use actual YAML booleans in a note:

\`\`\`yaml
---
publish: false
---
\`\`\`

\`private: true\` also excludes a Markdown note. Do not quote these booleans. Publication fails closed: malformed or unterminated frontmatter, non-object metadata, duplicate YAML keys, and non-Boolean \`publish\`/\`private\` values stop compilation rather than publishing a note with ignored privacy flags. Fix the reported error before deploying.

Dot-prefixed paths and vault symlinks are skipped during scanning. Private/hidden notes are filtered **before rendering**, so they cannot enter note transclusions, Bases rows, hover previews, search, or graph data. A private homepage is a build error rather than a publishable fallback.

\`showProperties: false\`, collapsed folders, and navigation ordering are **not** privacy controls. Published note text, properties, rendered HTML, and previews remain accessible through public pages and compiled reader/search data. The original complete Markdown file is not included in the browser payload: its \`content\` is empty, and nonliteral Obsidian comments are removed from the searchable body. Literal \`%%\` examples in fenced or inline code remain public. Keep secrets out of public prose, properties, and code examples; if a secret has already been copied into another public note, excluding its original source does not remove the copy.

## Files and assets

The builder does not blindly copy the vault, \`.obsidian\` source, or every attachment into output. Referenced permitted assets are emitted separately; selected trusted CSS and its supported local dependencies are included. Filesystem and CSS-import boundaries are checked, and hidden vault assets cannot be included through CSS references.

Vite's \`public/\` directory is a separate intentional static-asset input. Keep it reviewed: files placed there can be copied to the deployed output. The build rejects public-directory inputs that resolve into the vault/configuration, overlapping source/output directories, and conflicting published output paths; these checks do not classify arbitrary manually copied public files as non-sensitive.

Direct development requests for vault sources are blocked. Nevertheless, keep local development bound to loopback when possible, and deploy only \`dist/\` to a static host, never the checkout or source vault.

## HTML sanitization

Rendered HTML is sanitized at compilation with DOMPurify. Scripts, event handlers, dangerous URLs, and raw \`srcdoc\` are removed. SVG assets are sanitized. External iframes are sandboxed, while generated PDF frames retain restrictive sandboxing.

Sanitization is not an assurance that an external service is private, benign, or appropriate. A permitted remote frame can still execute scripts in its frame and contact its provider. Review the actual destination, permissions, and user-facing explanation; a plain link is often the safer choice. [[Atlas/Media cabinet]] demonstrates offline examples and shows a remote embed only as unexecuted code.

## CSS is trusted input

Themes, snippets, \`publish.css\`, and configured CSS are trusted author input, not sanitized untrusted content. Use sources you trust and respect their licenses. Local imports are bounded and cycle-checked; remote CSS imports and remote asset URLs remain remote and can make requests from readers' browsers.

The build does not fetch those remote resources, so offline compilation does not imply an offline published page. Check themes for remote fonts, images, and imports if avoiding third-party contact matters.

## Pre-publication review

1. Keep secrets outside the publishing vault where practical; use explicit exclusions as defense in depth.
2. Check configuration and valid frontmatter, then run tests and build.
3. Inspect the generated output, including properties, previews, assets, and transcluded content.
4. Review contact details, quoted conversations, permissions, and external embeds manually.
5. Replace previous deployment files so newly excluded pages cannot remain available as stale output.

Sample notes are illustrative fixtures. Review any replacement notes and assets independently before publishing them.

[[About/Deployment|Deployment]] covers hosting boundaries. [[About/Documentation|Documentation index]].
`,
    },
    {
      path: 'About/Troubleshooting.md',
      kind: 'note',
      content: `---
title: Troubleshooting
category: documentation
tags: [lattice, documentation, troubleshooting]
description: Diagnose configuration, link, Base, CSS, watcher, and static-host problems.
---

Begin with the **first reported build or development error**. The live server preserves the last successful compilation, so a readable page after an error may be an older snapshot rather than proof that the edit worked.

## Installation or compilation fails

- Check Node.js is 22.12 or newer.
- Run \`npm ci --include=dev\` from the project root; the builder needs TypeScript, Vite, and JSDOM from development dependencies.
- Verify the vault and configuration file exist and are readable.
- Unknown configuration fields are rejected; do not add unsupported options hoping they will take effect.
- Malformed or unterminated frontmatter and quoted/non-Boolean privacy flags fail compilation. Repair the YAML rather than removing a needed exclusion.
- Published-route collisions are build errors; rename conflicting note paths rather than relying on one page to overwrite another.
- Run \`npm run build\` to reproduce the error outside the watcher.

See [[About/Quick start]] and [[About/Configuration]] for working examples.

## Homepage missing or no published notes

\`site.home\` must resolve to an existing public Markdown note. Check spelling, folder path, extension, \`hiddenPaths\`, and privacy frontmatter. If all notes are excluded, compilation cannot create a site. Do not weaken privacy settings merely to make an error disappear; choose a genuinely public homepage.

## A link or transclusion is unresolved

Use an exact vault-relative path, especially when several folders contain the same filename. Check the heading text or block identifier as well as the note name. A link cannot reveal a filtered private note. Update incoming links after renaming a source file.

A cyclic or overly nested embed can reach the renderer's limit. Prefer a direct link or a smaller heading/block embed rather than an endless whole-note chain. [[About/Markdown and Bases]] shows valid targets from this vault.

## A Base is empty or reports an error

An empty view can be correct: no public notes match its filters. Check property names, YAML value types, folder paths, and the host note's properties. \`this.file\` means the host Markdown note; it is not the \`.base\` file.

A visible “Unable to render Base” message indicates invalid YAML, an unsupported view/expression, a circular formula, or an evaluator limit. Reduce the expression to supported operations and verify the result on a small collection. Obsidian's complete Bases runtime and general JavaScript are not supported.

## A theme or CSS asset fails

- Check \`.obsidian/appearance.json\` is valid JSON.
- Verify the selected theme's \`theme.css\` and enabled snippet files exist.
- Distinguish top-level \`theme\` from \`site.theme\` color mode.
- Set top-level \`theme: "default"\` and \`snippets: []\` temporarily to isolate a CSS issue, then restore the intended configuration.
- Check local import/asset paths, supported extensions, allowed directories, and import cycles.
- Check connectivity for remote CSS resources; the build leaves their URLs remote.

Style Settings plugin state, editing controls, and plugin-only components cannot appear merely by loading their CSS. See [[About/Obsidian themes]] for the compatibility boundary.

## Saved edits do not appear

Read terminal and browser error output first. A failed edit intentionally leaves the previous snapshot live. Fix the cause and save again; a successful compile refreshes readers. If changes involve configuration base paths, verify the new URL and restart the local command if needed. \`npm run preview\` does not watch or compile source changes; rerun \`npm run build\` before previewing.

## Deep links or assets fail after deployment

Verify the configured \`base\` equals the host's mount path, then rebuild. Mount \`dist/\` contents there, including \`_assets/\`, \`_theme/\`, and application assets. The host must serve note-directory \`index.html\` files. Test a direct note URL and a nonexistent URL rather than relying only on client-side clicks or a universal homepage fallback.

If renamed or excluded pages remain available, replace or clean the old deployment. Local output changes do not delete stale files from a remote host. [[About/Deployment]] provides the complete checklist.

## Media will not play

Check the emitted file URL, browser codec support, and visible playback controls. Development serves generated assets with single-byte-range responses for media seeking and ETags for conditional requests; the production static host must provide appropriate file-serving behavior. No autoplay is required by the offline examples. A working file does not guarantee every browser can decode its format; provide a useful text description or download link.

## Reporting a reproducible issue

Include the command, Node/npm versions, minimal configuration, exact error, expected behavior, and a non-sensitive sample note/Base/CSS file. Never attach a private vault or unredacted secrets. See [[About/Contributing]] for tests and source locations.

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
