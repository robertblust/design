# Decks

A deck is a talk: slides laid out on one canvas, the chrome under them, a notes panel and narration. It has to open from `file://`, so it links no shared asset and carries everything as blocks, assembled into `tokens.css`, `deck.css` and `deck.js`. Each section says what the part is for and draws it; the contract is in the block's header comment.

## Transport

The control a deck is driven with, drawn as a physical object: a slab milled from the ground, a recessed display window for the slide number, the buttons, and the language and theme controls. The window stays dark on the light theme, as a real display on an aluminum body does. Contract: [blocks/deck-transport.css](../../blocks/deck-transport.css); its colors are the deck chrome family on [Tokens](tokens.md#token-families).

```text
Desk
┌───────────────────────────────────────────────────────────────────────────────────┐
│ lockup                ╭────────────────────────────────────────────────────────╮  │
│                       │ ┌───────┐                                              │  │
│                       │ │ 03/10 │  ⇤  ◀  (▶)  ▶  ⤢  │  [DE│EN] [☼│☾]  │  ↑  ✎  │  │
│                       │ │ ▔▔▔   │                                              │  │
│                       │ └───────┘                                              │  │
│                       ╰────────────────────────────────────────────────────────╯  │
└───────────────────────────────────────────────────────────────────────────────────┘
  .name (col 1)          .transport (col 2) on --slab: .lcd · .tmain · .tside
                         the LCD's hairline is how much of this slide's recording is left
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ .bar: the deck's progress, in --c-mid, on the chrome's top edge

Phone, or a tall screen
┌─────────────────────────────────────────────┐
│ 03/10  ⇤ ◀ (▶) ▶ ⤢   DE│EN ☼│☾   ↑ ✎        │  ← no slab, no lockup, full width
└─────────────────────────────────────────────┘
  the buttons keep a touch target at every tier; the tiers narrow the gaps, not the targets
```

## Lockup

The name in the chrome's corner, and it legitimately differs by site: blust.ch is one tier, the mark and **Robert Blust**; companygraph.io and guestgraph.io are two, the product and then the presenter. Both end in a link up to the talks. A site names its form in `design.config.json` as `"lockup": "one"` or `"two"`. The mark is the favicon inlined, drawn in the tokens' colors. Contract: [blocks/deck-lockup.css](../../blocks/deck-lockup.css), with each form's own rules in [blocks/deck-lockup-one.css](../../blocks/deck-lockup-one.css) and [blocks/deck-lockup-two.css](../../blocks/deck-lockup-two.css).

```text
one    ▣ Robert *Blust*  ·  Talks

two    ◈ Company*Graph*  ·  ▣ Robert *Blust*  ·  Talks
       └─ the product ─┘     └─ the presenter ┘     └─ up to the talks
```

## Fit

The canvas scaler, the last script in every deck. It lays the slides out once at a fixed height and scales the whole plane to the screen, so a slide never scrolls and the composition is the same on every screen; below the breakpoint the deck reflows into a scrolling reading view. Contract: [blocks/deck-fit.js](../../blocks/deck-fit.js).

```text
Desk: one composition, scaled               Phone: the reading view
┌──────────────────────────────────┐         ┌──────────────┐
│                                  │         │ slide 1      │
│     slide, at its fixed height,  │         ├──────────────┤
│     scaled to cover the screen   │         │ slide 2      │
│                                  │         ├──────────────┤
├──────────────────────────────────┤         │ …  scrolls   │
│ chrome                           │         ├──────────────┤
└──────────────────────────────────┘         │ chrome       │
                                             └──────────────┘
```

## Runtime

Everything a deck does: slide navigation, the language switch, the notes panel and narration. What differs between decks is only each talk's title and description in both languages, which the page declares above the block. Contract: [blocks/deck-runtime.js](../../blocks/deck-runtime.js).

## Export

A deck's PDF fallback, one slide per page in both languages, rendered from the deck exactly as it shows on screen. A site imports it into its own build and passes its own browser and PDF library in; the package has no dependencies of its own. Source: [decks/export.mjs](../../decks/export.mjs).
