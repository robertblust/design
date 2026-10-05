# Blocks

A block is the part of a page the family owns. Each one is a fence a page carries between two markers, and most are also assembled into `page.css` or `page.js`; the [map](README.md#map) says which. Each section says what the block is for and draws its parts by their class names. What the block requires of them, and why, is its contract, in the header comment of the file the section links.

## Prose reset

The first rules every prose page declares after its tokens: the box model, the body, the column and the data face. Contract: [blocks/reset.css](../../blocks/reset.css).

## Link

The family's one style for a link in text, on every page and deck. Contract: [blocks/link.css](../../blocks/link.css).

```text
  … the model is the source, and every  surface  is drawn from it …
                                        ‾‾‾‾‾‾‾
                                        a (no class): the link block's rest and hover states
```

## Header row

The row at the top of every prose page: the site's mark, its links and the language and theme controls. Contract: [blocks/header.css](../../blocks/header.css), which gives the links' order and the row's states; whether the row fits is measured by [nav fit](#behavior).

```text
Desk
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ ▣ Wordmark   CLI  Team  Principles  Surfaces  …  Blog  Talks  Privacy   [EN│DE] [☼│☾] │
└───────────────────────────────────────────────────────────────────────────────────────┘
  └ the site's own ┘ └──────────────── nav a ─────────────────────────┘  └ .seg ┘ └ .seg.theme

Compact, when the row does not fit
┌──────────────────────────────────┐
│ [≡]  ▣ Wordmark          [EN│DE] │
└──────────────────────────────────┘
  └ the menu button    the links behind it; the language control stays on the bar
```

## Title

How every prose page opens: the headline, the tagline under it, and a caveat when the page has one. A site's front page is its own statement and not this block. Contract: [blocks/title.css](../../blocks/title.css).

```text
┌──────────────────────────────────────────────┐
│ The first clause,                            │  ← .title h1, its first block
│ the completion, *heavy*                      │  ← .title h1, its second block · em
│                                              │
│ A tagline under the headline, at its own     │  ← .tagline
│ measure.                                     │
│                                              │
│ ▎ The caveat                                 │  ← .title .note (see Lines)
└──────────────────────────────────────────────┘
```

## Lines

The lines a prose page lifts out of its paragraphs, each drawn in a color role from [Tokens](tokens.md#color-roles). Contract: [blocks/lines.css](../../blocks/lines.css), which says where each line goes and how often.

```text
  ▎ The caveat before you trust the rest.        ← .title .note · --c-flag rule

  … a paragraph of the section …
  The section's one point, said once.            ← .keyline · --c-firm text

  … a paragraph with the figures …
  ▎ What the figures above add up to.            ← .conclusion · --c-sum rule
```

## Footer

The row at the foot of every prose page: the repository and the license, and on companygraph.io and guestgraph.io the credit to blust.ch. A site names its form in `design.config.json` as `"footer": "credit"` or `"plain"`. Contract: [blocks/footer.css](../../blocks/footer.css), and the credit's rules in [blocks/footer-credit.css](../../blocks/footer-credit.css).

```text
credit
┌───────────────────────────────────────────────────────────────┐
│ github.com/…/site · MIT                    ▣ Robert *Blust*   │
└───────────────────────────────────────────────────────────────┘
  └ footer, mono ┘                             └ footer .credit ┘

plain
┌───────────────────────────────────────────────────────────────┐
│ github.com/…/site · MIT                                       │
└───────────────────────────────────────────────────────────────┘
```

## Principles

The values `/principles/` lists, one `article.value` each, as the model's renderer writes them. Contract: [blocks/principles.css](../../blocks/principles.css).

```text
────────────────────────────────────────────────  ← .value, a rule above
  Value name                                      ← .value h3
  The value's tagline                             ← .value .tagline
  What holding to it means, in prose.             ← .value p
────────────────────────────────────────────────
  Next value
```

## Team board

The board `/team/` draws for each process: who holds its seats, the seats against the phases, what each seat does in each phase, and each seat's card. Contract: [blocks/team.css](../../blocks/team.css); the card in the drawer is opened by the [model card](#model-card).

```text
┌──────────────────────────────────────────────────────────────────┐
│ ● Robert Blust        ◆ AI Agent                     [Open all]  │  ← .hdrail: .whos .hw, .openall
│   human · holds …       agent · holds …                          │
├──────────────┬───────────┬───────────┬───────────┬───────────────┤
│ SEAT         │ 01 Shape  │ 02 Spec   │ 03 Plan   │ …             │  ← .ghead: .phnum, .phname
├──────────────┼───────────┼───────────┼───────────┼───────────────┤
│ ▸ ● Owner    │    ex     │    ga     │    ga     │               │  ← details: .mk, .g
│ ▸ ◆ Planner  │           │           │    ex     │    su         │
│ ▾ ◆ Writer   │           │    su     │           │    ex         │
│   ┌──────────────────────────────────────────────────────────┐   │  ← .drawer
│   │ the seat's card                                          │   │
│   └──────────────────────────────────────────────────────────┘   │
├──────────────┴───────────┴───────────┴───────────┴───────────────┤
│ ex executes the phase   su supports it   ga approves the gate    │  ← .legend
└──────────────────────────────────────────────────────────────────┘
  ● .mk.human · ◆ .mk.agent · the phases follow in dl.phases
```

## Surfaces lineage

The lineage `/surfaces/` draws: the model, the makers under it, the surfaces each maker produces, and the wires between them, with the chosen surface's card below. Contract: [blocks/surfaces.css](../../blocks/surfaces.css) for the drawing, [blocks/surfaces.js](../../blocks/surfaces.js) for its behavior and what it needs from the page.

```text
                    ┌───────────────┐
                    │ The model     │                   ← .ln-model: .lbl, .nm, .at
                    │ mental-model  │
                    └───────┬───────┘
          ┌─────────────────┼─────────────────┐         ← .wires
   ┌──────┴──────┐   ┌──────┴─────┐    ┌──────┴─────┐
   │ The owner   │   │ repo       │    │ repo       │   ← .ln-maker: .mk.hand or .mk.build, .who, .how
   │   by hand   │   │   build    │    │   build    │
   └──┬─────┬────┘   └──┬─────────┘    └──┬─────────┘
   surface surface    surface            surface         ← .ln-s: .nm, .host
┌──────────────────────────────────────────────────────┐
│ the chosen surface's card                            │  ← #lnpanel
└──────────────────────────────────────────────────────┘
```

## Privacy path

The lineage a privacy page draws under "Where your data goes": the visit on the left, the keys the browser keeps grouped by how long they last and each processing activity in the middle, and under each its keys or the data processors it hands data to, with what each receives. It is the surfaces lineage's markup and behavior, so the page carries the `surfaces lineage` fence, `card.js`, `STAGE_PAGE`, a `link[data-stage]` to the artifact, `#lnpanel`, `#lnhint` and `#srclink` as /surfaces/ does, and `render/privacy` writes the drawing between `<!-- privacy:start -->` and `<!-- privacy:end -->`. A page's own `.card` rules must not reach `#lnpanel .card`; give a page's own boxes a class of their own.

## Index list

The list a section's index page draws under its title, one row per talk on `/talks/` or post on `/blog/`. Contract: [blocks/index.css](../../blocks/index.css).

```text
──────────────────────────────────────────────────────────  ← .index .row
  Title                                            9 min    ← .entry: .t, .meta
  The description under the title.                          ← .d
  Watch the talk · Download PDF                             ← .dl
──────────────────────────────────────────────────────────
  Next title                                       6 min
  …
──────────────────────────────────────────────────────────
```

## Home sections

The sections a site's home page argues in, one `section.sec` each: the vision, the values, the latest writing, what is built now. Contract: [blocks/home.css](../../blocks/home.css).

```text
┌──────────────────────────────────────────────────────────┐
│ KICKER                                                   │  ← .sec .kicker
│ A section heading, one word *accented*                   │  ← .sec h2
│ A lede in prose.                                         │  ← .sec .lede
│                                                          │
│ Value one ─ what it means                                │  ← .sec .values a
│ Value two ─ what it means                                │
│                                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐             │  ← .sec .tiles .tile
│ │ Title      │ │ Title      │ │ Title      │             │
│ │ a line     │ │ a line     │ │ a line     │             │
│ └────────────┘ └────────────┘ └────────────┘             │
└──────────────────────────────────────────────────────────┘
```

## Stage contract

What a page brings for a [stage](assets.md#stage) to sit on it: the figure's section, the hint, the caption and the provenance line. Contract: [blocks/stage.css](../../blocks/stage.css).

```text
  ┌──────────────────────────────────────────┐   ← .figure-section
  │               the stage                  │
  └──────────────────────────────────────────┘
  Click a node to focus it; drag to pan.         ← the hint
  What the figure shows.                         ← .figcap
  github.com/…/mental-model @ 1a2b3c4 model/     ← the provenance line
```

## Model card

The glue that opens a seat's card on a board, through the [card](assets.md#card). Contract: [blocks/model-card.js](../../blocks/model-card.js), which also lists what the page must declare above it.

## Behavior

These blocks draw nothing of their own and have no picture.

| Block | What it does | Contract |
| --- | --- | --- |
| Theme boot | Sets the theme before the first paint | [blocks/theme-boot.js](../../blocks/theme-boot.js) |
| Theme | Switches and remembers light and dark across the family's domains | [blocks/theme.js](../../blocks/theme.js) |
| Language | Decides and remembers English or German across the family's domains | [blocks/lang.js](../../blocks/lang.js) |
| Nav fit | Measures whether the header row fits | [blocks/nav-fit.js](../../blocks/nav-fit.js) |
