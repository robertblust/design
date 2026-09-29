# Blocks

A block is the part of a page the family owns. Each one is a fence a page carries between two markers, and most are also assembled into `page.css` or `page.js`; the [map](README.md#map) says which. Each section here says what the block is for and draws what it looks like. What it must do, and why, is in the block's own header comment, which the section links.

## Prose reset

The first rules every prose page declares after its tokens: the box model, the body's face, `.mono` for data and `.shell` for the column. It is where the [faces](tokens.md#faces) are set. Contract: [blocks/reset.css](../../blocks/reset.css).

## Link

One link style for text on every page and deck: `--c-mid`, no line at rest, a line under the pointer or the keyboard's focus. An anchor with a class is a component and takes only the color. Contract: [blocks/link.css](../../blocks/link.css).

```text
  … the model is the source, and every  surface  is drawn from it …
                                        ‾‾‾‾‾‾‾
                                        at rest: no line · hover/focus: a line in --c-mid
```

## Header row

One row at the top of every prose page, the same on every site, kept at the top as the page scrolls. The order of its links, its baseline, its states and when it tightens or collapses are the contract. Contract: [blocks/header.css](../../blocks/header.css); whether it fits is measured by [nav fit](#behavior).

```text
Desk
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ ▣ Wordmark   CLI  Team  Principles  Surfaces  …  Blog  Talks  Privacy   [EN│DE] [☼│☾] │
└───────────────────────────────────────────────────────────────────────────────────────┘
  │               │                                                  │        │
  the site's own  fixed order: a site skips a link, never reorders   language theme,
  (outside the    hover = a line · current page = brighter ink       sets the same
  fence)                                                             height   height

Phone, or a row that does not fit once tightened
┌──────────────────────────────────┐
│ [≡]  ▣ Wordmark          [EN│DE] │
└──────────────────────────────────┘
  the menu takes the left corner; the language control stays on the bar
```

## Title

How every prose page opens. The headline is two blocks, a light dim clause over its heavy completion, with at most one accented word; the tagline under it wraps balanced. A site's front page is its own statement and not this block. Contract: [blocks/title.css](../../blocks/title.css).

```text
┌──────────────────────────────────────────────┐
│ The first clause, light and dim,             │  ← h1, block one
│ the completion, *heavy*                      │  ← h1, block two · one em at most
│                                              │
│ A tagline that wraps balanced at its measure,│  ← .tagline
│ never leaving one word alone on a line.      │
│                                              │
│ ▎ The caveat, once per page                  │  ← .note, in --c-flag (see Lines)
└──────────────────────────────────────────────┘
```

## Lines

What a prose page lifts out of its paragraphs, and the color that says what each is. The meaning of each color is on [Tokens](tokens.md#color-roles); where each line goes and how often is the block's. Contract: [blocks/lines.css](../../blocks/lines.css).

```text
  ▎ The caveat before you trust the rest.        .title .note · --c-flag · once per page

  … a paragraph of the section …
  The section's one point, said once.            .keyline · --c-firm text, no line
                                                 at most once per section

  … a paragraph with the figures …
  ▎ What the figures above add up to.            .conclusion · --c-sum line
                                                 at most once per section, never beside a key line
```

## Footer

The row at the foot of every prose page: the repository and the license, in mono because they are data. On companygraph.io and guestgraph.io it carries the credit lockup; blust.ch does not credit itself. A site names its form in `design.config.json` as `"footer": "credit"` or `"plain"`. Contract: [blocks/footer.css](../../blocks/footer.css), and the lockup's rules in [blocks/footer-credit.css](../../blocks/footer-credit.css).

```text
credit
┌───────────────────────────────────────────────────────────────┐
│ github.com/…/site · MIT                    ▣ Robert *Blust*   │
└───────────────────────────────────────────────────────────────┘
  mono: a record                               Instrument Sans: a brand, not a record

plain
┌───────────────────────────────────────────────────────────────┐
│ github.com/…/site · MIT                                       │
└───────────────────────────────────────────────────────────────┘
```

## Principles

The values `/principles/` lists, one `article.value` each, as the model's renderer writes them. Contract: [blocks/principles.css](../../blocks/principles.css).

```text
┌──────────────────────────────────────────────┐
│ Value name                                   │  ← h3, Bricolage: a section's mark
│ The value's tagline                          │  ← .tagline
│ What holding to it means, in prose.          │  ← p
└──────────────────────────────────────────────┘
```

## Team board

The board `/team/` draws for each process: a head rail naming who holds its seats, with an Open-all button; a grid of seats against phases, each cell saying whether the seat executes the phase, supports it or approves its gate; the drawer a seat's card opens into; the legend; and the phases under it. A seat's mark says whether a person or an agent holds it. Contract: [blocks/team.css](../../blocks/team.css); the card in the drawer is the [model card](#model-card)'s.

```text
┌──────────────────────────────────────────────────────────────────┐
│ ● Robert Blust        ◆ AI Agent                     [Open all]  │  ← .hdrail: .whos + .openall
│   human · holds …       agent · holds …                          │
├──────────────┬───────────┬───────────┬───────────┬───────────────┤
│ SEAT         │ 01 Shape  │ 02 Spec   │ 03 Plan   │ …             │  ← .ghead: .phnum + name
├──────────────┼───────────┼───────────┼───────────┼───────────────┤
│ ▸ ● Owner    │    ex     │    ga     │    ga     │               │  ← a seat: details/summary
│ ▸ ◆ Planner  │           │           │    ex     │    su         │
│ ▾ ◆ Writer   │           │    su     │           │    ex         │
│   ┌──────────────────────────────────────────────────────────┐   │  ← .drawer: its card
│   │ the seat's card                                          │   │
│   └──────────────────────────────────────────────────────────┘   │
├──────────────┴───────────┴───────────┴───────────┴───────────────┤
│ ex executes the phase   su supports it   ga approves the gate    │  ← .legend (.g.ex .g.su .g.ga)
└──────────────────────────────────────────────────────────────────┘
  ● a person · ◆ an agent (.mk.human, .mk.agent) · the phases follow, one tagline under each
```

## Surfaces lineage

The lineage `/surfaces/` draws: the model, the makers under it, the surfaces each maker produces, and the wires between them. Choosing a surface redraws its wires and opens its card in the panel below. Contract: [blocks/surfaces.css](../../blocks/surfaces.css) for the drawing, [blocks/surfaces.js](../../blocks/surfaces.js) for its behavior and the contract with the page around it.

```text
                    ┌───────────────┐
                    │ The model     │                   ← .ln-model: label, name, @commit
                    │ mental-model  │
                    └───────┬───────┘
          ┌─────────────────┼─────────────────┐         ← .wires; the chosen one's wires lit
   ┌──────┴─────┐    ┌──────┴─────┐    ┌──────┴─────┐
   │ ✎ The owner│    │ ⚙ repo     │    │ ⚙ repo     │   ← .ln-maker · ✎ by hand, ⚙ build
   │   by hand  │    │   build    │    │   build    │
   └──┬─────┬───┘    └──┬─────────┘    └──┬─────────┘
   surface surface    surface            surface         ← .ln-s: name + host
┌──────────────────────────────────────────────────────┐
│ the chosen surface's card                            │  ← #lnpanel
└──────────────────────────────────────────────────────┘
```

## Index list

The list a section's index page draws under its title, one row per talk on `/talks/` or post on `/blog/`. The whole entry is one link; the line under it says what can be done with it. Contract: [blocks/index.css](../../blocks/index.css).

```text
──────────────────────────────────────────────────────────
  Title in Bricolage                               9 min    ← .t · .meta, mono
  The dim description under the title.                      ← .d · the whole entry is one link
  Watch the talk · Download PDF                             ← .dl: what a reader can do
──────────────────────────────────────────────────────────
  Next title                                       6 min
  …
──────────────────────────────────────────────────────────
```

## Home sections

The sections a site's home page argues in, one `section.sec` each: the vision, the values, the latest writing, what is built now. Contract: [blocks/home.css](../../blocks/home.css).

```text
┌──────────────────────────────────────────────────────────┐
│ KICKER                                                   │  ← .kicker
│ A section heading, one word *accented*                   │  ← h2
│ A lede in prose.                                         │  ← .lede
│                                                          │
│ Value one ─ what it means                                │  ← .values: one link per row
│ Value two ─ what it means                                │
│                                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐             │  ← .tiles
│ │ Title      │ │ Title      │ │ Title      │             │
│ │ a line     │ │ a line     │ │ a line     │             │
│ └────────────┘ └────────────┘ └────────────┘             │
└──────────────────────────────────────────────────────────┘
```

## Stage contract

The few rules a page brings for a [stage](assets.md#stage) to sit on it: air above the figure, the hint on its own line, the caption at a readable measure, and the provenance line in mono end to end. Contract: [blocks/stage.css](../../blocks/stage.css).

```text
  (air)
  ┌──────────────────────────────────────────┐
  │               the stage                  │   ← assets/stage.css draws inside
  └──────────────────────────────────────────┘
  Click a node to focus it; drag to pan.         ← the hint: small, dim, prose
  What the figure shows, at a measure prose      ← .figcap
  can be read at.
  github.com/…/mental-model @ 1a2b3c4 model/     ← provenance: mono, a record
```

## Model card

The glue that opens a seat's card on a board: rendered by the [card](assets.md#card) the first time its row opens, again after the language changes, and on arrival at a seat's address. The page declares what the block needs above it. Contract: [blocks/model-card.js](../../blocks/model-card.js).

## Behavior

Four blocks draw nothing of their own and have no picture.

| Block | What it does | Contract |
| --- | --- | --- |
| Theme boot | Sets the theme, and the embed and chat-waiting marks, before the first paint; the one script in `<head>` | [blocks/theme-boot.js](../../blocks/theme-boot.js) |
| Theme | Switches and remembers light and dark across the family's domains | [blocks/theme.js](../../blocks/theme.js) |
| Language | Decides and remembers English or German across the family's domains | [blocks/lang.js](../../blocks/lang.js) |
| Nav fit | Measures whether the header row fits, and sets it wide, tight or compact | [blocks/nav-fit.js](../../blocks/nav-fit.js) |
