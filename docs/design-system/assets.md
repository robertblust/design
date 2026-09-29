# Assets

An asset is a whole file a site copies next to its pages and links, rather than a block written into them. A site takes assets in groups, `fonts`, `stage` and `chat`, by naming them in its `design.config.json`; which file belongs to which group is [lib/groups.mjs](../../lib/groups.mjs). Each section says what the asset is for and draws it. What it must do, and why, is in the file's own header comment.

## Stage

The drawing a model page, and any page that names a data block, puts at its center, with one card beside it. It never shows the whole graph: one focused node, its ancestors on the left, its children on the right, and its references in two dashed bands, sources above and targets below. Expand moves the same stage into the [modal](#modal). Source: [assets/stage.css](../../assets/stage.css) for the look, [assets/stage.js](../../assets/stage.js) for the drawing; what a page brings for it to sit on is the [stage contract](blocks.md#stage-contract).

```text
Desk
┌──────────────────────────────────────────────────────────────────────────────┐
│ model › processes › delivery      [◀ back │ 03/07 │ next ▶]        [Expand]  │  ← path · history · Expand
├────────────────────────────────────────────┬─┬───────────────────────────────┤
│              ┄┄ sources ┄┄                 │ │ Title                         │
│                  ○   ○                     │ │ tagline                       │
│   ancestor ── ancestor ── ● focus ── child │║│ prose, dim                    │  ← the card
│                             └───── child   │ │ fields · references           │
│              ┄┄ targets ┄┄                 │ │                               │
│                  ○   ○   ○                 │ │ repo @ commit        path     │  ← the card's foot
└────────────────────────────────────────────┴─┴───────────────────────────────┘
                   canvas                    handle          details

Phone, below the breakpoint
┌──────────────────────────────┐
│ path · history · Expand      │
├──────────────────────────────┤
│ canvas                       │  ← the top half
├──────────────────────────────┤
│ card                         │  ← the bottom half
└──────────────────────────────┘
```

The stage also draws the timeline's ledger: every experience a row on one vertical rule, each row's card opening under it. Its rules are in the same file, under the ledger's own comment.

## Card

One entity rendered into a body and a foot, the same wherever it appears: beside the stage, under a ledger row, in a seat's drawer, in the surfaces panel. It knows no page; what it cannot read off the entity it takes from its caller. Source: [assets/card.js](../../assets/card.js), whose header lists its calls.

```text
┌──────────────────────────────────────────┐
│ Title                                    │
│ The tagline                              │
│ Prose, dim.                              │
│ Field     value · reference › · link ↗   │  ← a reference walks the model, a link leaves it
│ Skills    ▸ Category (n)   chip ■■□      │  ← a level's marks on a chip
├──────────────────────────────────────────┤
│ repo @ commit                  file path │  ← the foot, mono
└──────────────────────────────────────────┘
```

## Modal

The family's one modal: everything a page opens over itself opens here, the graph and a picture's full screen alike, one at a time. It is drawn in the terminal's colors, at the model page's size, over a dimmed page, with a close that names its key. No page links it; the stage and the chat fetch it on first use. Source: [assets/modal.css](../../assets/modal.css), [assets/modal.js](../../assets/modal.js).

```text
 ░░░░░░░░░░░░░░░░░░░ the page, dimmed ░░░░░░░░░░░░░░░░░░░░
 ░ ┌──────────────────────────────────────────────────┐ ░
 ░ │ title                     [controls]         ×   │ ░  ← .rbmodal-head, mono
 ░ ├──────────────────────────────────────────────────┤ ░
 ░ │                                                  │ ░
 ░ │   the graph, or a picture                        │ ░  ← body, in the terminal's colors
 ░ │                                                  │ ░
 ░ └──────────────────────────────────────────────────┘ ░
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## Chat

A button at the foot of a prose page and the terminal it opens over the site's chat service: a card on a desk, a sheet on a phone. Nothing is sent until the visitor presses send. The endpoint and the model page are named on the script's own tag. Source: [assets/chat.css](../../assets/chat.css), [assets/chat.js](../../assets/chat.js), whose header gives the tag.

```text
Desk                                            Phone
                ┌───────────────────────────┐   ┌──────────────────────────┐
                │ chat · blust.ch   [+]  ×  │   │ chat · blust.ch  [+]  ×  │  ← .rbchat-head
                ├───────────────────────────┤   ├──────────────────────────┤
                │ > the visitor's question  │   │ > question               │
                │                           │   │                          │  ← .rbchat-log
                │ The answer, drawn whole:  │   │ The answer …             │
                │ prose, lists, tables,     │   │                          │
                │ a picture [⤢]             │   │                          │
                │ sources · next questions  │   │                          │
                ├───────────────────────────┤   ├──────────────────────────┤
                │ > Ask about the model…    │   │ > Ask about the model…   │  ← .rbchat-form
                └───────────────────────────┘   └──────────────────────────┘
                                   ( ● Chat )     a sheet, full width
                                        ↑ .rbchat-open, fixed at the foot
```

## Fonts

The three faces, self-hosted so a page ships no external asset, each with its license beside it. What each face sets is on [Tokens](tokens.md#faces). Source: [assets/fonts/](../../assets/fonts/).

## Libraries

Vendored, never fetched from a CDN, each with its license beside it. d3 draws the stage and ships in the `stage` group: [assets/d3.v7.min.js](../../assets/d3.v7.min.js). Mermaid draws a picture under a chat answer and is fetched only when the first picture arrives: [assets/mermaid.min.js](../../assets/mermaid.min.js). The chat inlines GitHub's Octicon mark, whose notice is [assets/octicons.LICENSE.txt](../../assets/octicons.LICENSE.txt).
