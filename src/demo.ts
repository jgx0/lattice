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
author: Alex Morgan
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
author: Alex Morgan
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
author: Alex Morgan
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
author: Alex Morgan
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

> [!quote] A sentence from my notebook
> “Leave the door open, but put a floor under the visitor.”
>
> — Alex Morgan, private notebook, October 2026

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
author: Alex Morgan
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
author: Alex Morgan
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
curator: Alex Morgan
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
curator: Alex Morgan
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
curator: Alex Morgan
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
curator: Alex Morgan
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
curator: Alex Morgan
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
author: Alex Morgan
status: growing
category: project
date: 2026-11-18
tags: [lattice, design, publishing]
---

**Lattice** is a place to publish connected notes without pretending they are all articles. The name describes a light structure that supports growth without dictating every branch.

## The feeling

An editorial knowledge garden: warm paper, clear ink, generous reading measure, and a restrained violet accent. The familiar vocabulary of linked notes stays close to Obsidian, but the public page should feel like a well-kept reading room rather than an exposed control panel.

## The promise

A visitor can start at [[Welcome]], hover for context, follow a connection, and understand where they have arrived. Headings, properties, backlinks, and a local graph offer different ways to orient. None should compete with the sentence being read.

> [!todo] The next reading pass
> Test a route from the home page to a book, then a field note, using only the keyboard. Check that the same route makes sense on a narrow screen.

## What this garden demonstrates

The [[Library/The reading room|reading room]] turns book properties into a useful collection. [[Field Notes/Digital gardens]] scopes related notes to its own category. [[Atlas/Maps of meaning]] uses one small diagram rather than a decorative hero image. [[Atlas/Media cabinet]] keeps media optional and offline.

## What it refuses

No autoplay, no tracking scripts, no requirement to read chronologically. A reader who finds a useful idea and leaves has completed a good visit. [[Essays/A quieter internet]] explains that boundary; [[Essays/Enough is a design constraint]] helps keep it practical.

The design question is not “How much knowledge can a screen display?” It is “What helps this person make a meaningful next connection?”
`,
    },
    {
      path: 'Projects/A neighborhood atlas.md',
      kind: 'note',
      content: `---
title: A neighborhood atlas
aliases: [The neighborhood project]
author: Alex Morgan
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
author: Alex Morgan
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
author: Alex Morgan
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
author: Alex Morgan
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

For an account of the people behind these connections, see [[Atlas/People and influences]]. For the garden's keeper, see [[About/Alex Morgan]].
`,
    },
    {
      path: 'Atlas/Patterns and places.md',
      kind: 'note',
      content: `---
title: Patterns and places
aliases: [The lived place]
author: Alex Morgan
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
author: Alex Morgan
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
author: Alex Morgan
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
      path: 'About/Alex Morgan.md',
      kind: 'note',
      content: `---
title: Alex Morgan
aliases: [About Alex, The garden keeper]
author: Alex Morgan
status: evergreen
category: about
date: 2026-11-18
tags: [about, garden, practice]
---

I'm Alex Morgan, a designer, reader, and habitual walker. I like work that gets clearer when it is placed beside something from another field: a page beside a porch, a map beside a lived route, a design decision beside a book that asks a harder question.

## What I keep here

Notes that I expect to return to. Not everything I know, not a daily record, and not a finished philosophy. [[Welcome]] is the front door; [[Atlas/Maps of meaning]] is a map of the current connections.

I read with a pencil and often write the first draft after a walk. [[Library/The reading room]] gathers the books that keep turning up in those drafts. [[Field Notes/Digital gardens]] explains the tending practice.

## What I am making

A modest [[Projects/A neighborhood atlas|neighborhood atlas]], a possible [[Projects/The monthly letter|monthly letter]], and a clearer account of what a generous publishing interface should do in [[Projects/Lattice]]. The projects are small enough to meet the world before they harden into plans.

## A note about this place

This is a fictional but fully connected demonstration garden for **Lattice**. The books and authors are real; the personal observations and projects are written for the demo. There are no real contact details, participant records, or mailing-list integrations.

The agreement I want to model is genuine: keep sources visible, make uncertainty legible, and respect a visitor's time. If one connection helps you ask a better question in your own work, the garden has done enough.
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
  title: 'Alex’s digital garden',
  description: 'Notes, connections, and things worth keeping.',
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
