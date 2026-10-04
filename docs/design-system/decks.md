# Decks

A deck is a talk: slides laid out on one canvas, the chrome under them, a notes panel and narration. It has to open from `file://`, so it links no shared asset and carries everything as blocks, assembled into `tokens.css`, `deck.css` and `deck.js`. Each section says what the part is for and draws it; the contract is in the block's header comment.

## Transport

The control a deck is driven with, drawn as a physical object: a slab, a display window for the slide number, the buttons, and the language and theme controls. On a desk the chat's button stands beside it, bottom right; on a phone the transport takes the whole bottom edge and the button has no place, so a deck shows none there, and the chat still opens from `?chat=open`. Contract: [blocks/deck-transport.css](../../blocks/deck-transport.css); its colors are the deck chrome family on [Tokens](tokens.md#token-families).

```text
Desk
┌───────────────────────────────────────────────────────────────────────────────────┐
│ lockup                ╭────────────────────────────────────────────────────────╮  │
│                       │ ┌───────┐                                              │  │
│                       │ │ 03/10 │  ⇤  ◀  (▶)  ▶  ⤢  │  [DE│EN] [☼│☾]  │  ↑  ¶  │  │
│                       │ │ ▔▔▔   │                                              │  │
│                       │ └───────┘                                              │  │
│                       ╰────────────────────────────────────────────────────────╯  │
│                                                               ( ▢ Ask the model ) │
└───────────────────────────────────────────────────────────────────────────────────┘
  .name (col 1)          .transport (col 2) on --slab: .lcd · .tmain · .tside
                         .rbchat-open: the chat's button, fixed bottom right
                         .lcd .clip: the recording's progress on this slide
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ .bar: the deck's progress

Phone, or a tall screen
┌─────────────────────────────────────────────┐
│ 03/10  ⇤ ◀ (▶) ▶ ⤢   DE│EN ☼│☾   ↑ ¶        │  ← no slab, no lockup, full width
└─────────────────────────────────────────────┘
  no chat button: the transport takes the bottom edge
  the tiers below the breakpoint are the transport's own, in its contract
```

## Lockup

The name in the chrome's corner, which differs by site: blust.ch is one tier, companygraph.io and guestgraph.io two, the product and then the presenter. A site names its form in `design.config.json` as `"lockup": "one"` or `"two"`. Contract: [blocks/deck-lockup.css](../../blocks/deck-lockup.css), with each form's own rules in [blocks/deck-lockup-one.css](../../blocks/deck-lockup-one.css) and [blocks/deck-lockup-two.css](../../blocks/deck-lockup-two.css).

```text
one    ▣ Robert *Blust*  ·  Talks
       └─ .lockup ────┘     └─ .nlink

two    ◈ Company*Graph*  ·  ▣ Robert *Blust*  ·  Talks
       └─ .lockup ────┘     └─ .nperson ───┘     └─ .nlink
```

## Fit

The canvas scaler: on a desk the slides are one composition scaled to the screen, and below the breakpoint the deck reflows into a scrolling reading view. Contract: [blocks/deck-fit.js](../../blocks/deck-fit.js).

```text
Desk: one composition, scaled               Phone: the reading view
┌──────────────────────────────────┐         ┌──────────────┐
│                                  │         │ slide 1      │
│     the slide, scaled            │         ├──────────────┤
│                                  │         │ slide 2      │
│                                  │         ├──────────────┤
├──────────────────────────────────┤         │ …  scrolls   │
│ chrome                           │         ├──────────────┤
└──────────────────────────────────┘         │ chrome       │
                                             └──────────────┘
```

## Runtime

Everything a deck does: slide navigation, the language switch, the notes panel and narration. Every slide has an address, the number it shows: `#03` opens the slide whose kicker reads 03, and the address follows as the deck moves. What differs between decks is only each talk's title and description in both languages, which the page declares above the block. Contract: [blocks/deck-runtime.js](../../blocks/deck-runtime.js).

## Export

A deck's PDF fallback, rendered from the deck as it shows on screen, in both languages. A site imports it into its own build and passes its browser and PDF library in. Given pdf-lib's `PDFString` too, every link on a slide stays a link in the PDF, resolved against the deck's canonical address, and the chat button opens the deck on that slide with the chat open. Source: [decks/export.mjs](../../decks/export.mjs).
