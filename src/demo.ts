import type { Vault, SiteSettings } from './types';

const gardenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520" viewBox="0 0 960 520" role="img" aria-labelledby="title desc">
  <title id="title">A garden of connected ideas</title>
  <desc id="desc">Observations lead to notes, connections, experiments, and new observations. Reading feeds connections; a monthly letter shares what grows.</desc>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#8065da"/></marker>
  </defs>
  <rect width="960" height="520" rx="24" fill="#faf8f4"/>
  <text x="48" y="58" font-family="Georgia,serif" font-size="28" fill="#302a3d">Nothing grows in isolation.</text>
  <text x="48" y="88" font-family="Arial,sans-serif" font-size="15" fill="#68616f">A working map of Alex Morgan’s knowledge garden · Lattice</text>
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
const landscapeData = 'data:video/mp4;base64,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';

export const demoVault: Vault = {
  name: 'Lattice — Alex Morgan',
  files: [
    {
      path: 'Welcome.md',
      kind: 'note',
      content: `---
title: A place for connected ideas
aliases: [Home, Start here]
author: Alex Morgan
status: evergreen
category: garden
date: 2026-11-18
tags: [garden, index, welcome]
---

I'm Alex. This is my corner of **Lattice**: a notebook for noticing, reading, and making things with a little more care. Some ideas are well rooted; others are still finding their shape. You're welcome to wander.

> [!tip] There is no correct route
> Follow a link that catches your eye. Hover over [[Field Notes/Digital gardens|digital gardens]] for a little context, or start with [[Library/The reading room|the reading room]]. A return visit often reveals a different path.

## Follow a thread

- **Pay attention** → [[Field Notes/Attention is a material|Attention is a material]] → [[Field Notes/Walking as research|Walking as research]] → [[Projects/A neighborhood atlas|A neighborhood atlas]].
- **Make room for unfinished work** → [[Field Notes/Digital gardens|Digital gardens]] → [[Essays/Against the finished thought|Against the finished thought]] → [[Projects/Lattice|Why Lattice]].
- **Build for the long view** → [[Field Notes/Small bets & long horizons|Small bets & long horizons]] → [[Essays/Enough is a design constraint|Enough is a design constraint]] → [[Projects/A season of small bets|A season of small bets]].

If you prefer a map, [[Atlas/Maps of meaning|Maps of meaning]] gathers the crossroads. For the person behind the notes, meet [[About/Alex Morgan|Alex Morgan]].

## Recently tended

| Note | What changed | Tended |
| --- | --- | --- |
| [[Field Notes/Digital gardens#A link should carry a thought|Digital gardens]] | A better test for meaningful links | Nov 18 |
| [[Projects/A neighborhood atlas#What the first walks taught me|A neighborhood atlas]] | Resting places matter more than routes | Nov 16 |
| [[Essays/A quieter internet|A quieter internet]] | A distinction between invitation and interruption | Nov 14 |
| [[Field Notes/Small bets & long horizons#The two clocks|Small bets & long horizons]] | A weekly rhythm inside a seasonal commitment | Nov 12 |

## A living collection

These books keep escaping their shelves and turning up in other notes. The [[Library/The reading room|reading room]] has the full, sortable collection.

| Book | Author | A thought worth keeping |
| --- | --- | --- |
| [[Library/Books/A Pattern Language|A Pattern Language]] | Christopher Alexander and collaborators | Describe the conditions for life, not just the shape of a room. |
| [[Library/Books/How to Do Nothing|How to Do Nothing]] | Jenny Odell | Attention is a relationship with a place, not only a personal resource. |
| [[Library/Books/Braiding Sweetgrass|Braiding Sweetgrass]] | Robin Wall Kimmerer | Receiving something well includes asking what reciprocity requires. |

The working agreement is simple: keep the source, name the uncertainty, and leave something useful for the next person. See [[Essays/Against the finished thought#What I owe a reader|what I owe a reader]] for the longer version.

*Last tended 18 November 2026 · A personal knowledge garden, not a feed.*

#garden #reading #slow-web
`,
    },
    {
      path: 'Field Notes/Digital gardens.md',
      kind: 'note',
      content: `---
title: Digital gardens
aliases: [Working in public, Garden notes]
author: Alex Morgan
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
author: Alex Morgan
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
author: Alex Morgan
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
