# Assets

An asset is a whole file a site copies next to its pages and links, rather than a block written into them. A site takes assets in groups, `fonts`, `stage` and `chat`, by naming them in its `design.config.json`; which file belongs to which group is [lib/groups.mjs](../../lib/groups.mjs). Each section says what the asset is for and draws it. What it must do, and why, is in the file's own header comment.

## Stage

The drawing a model page, and any page that names a data block, puts at its center, with one card beside it: one focused node and what surrounds it, not the whole graph. Expand moves the same stage into the [modal](#modal). Source: [assets/stage.css](../../assets/stage.css) for the look, [assets/stage.js](../../assets/stage.js) for the drawing and what it shows around the focus; what a page brings for it to sit on is the [stage contract](blocks.md#stage-contract).

```text
Desk
┌─────────────────────────────────────────────────────────────────────────────────┐
│ model › processes › delivery     was-name [⇤ ◀ 01/03 ▶] will-name     [Expand]  │  ← .stagehead: path, .history, .expand
├───────────────────────────────────────────────┬─┬───────────────────────────────┤
│  ┄┄ sources ┄┄   ○   ○                        │ │ Title                         │
│                                               │ │ tagline                       │
│  root                                         │║│ prose                         │  ← the card
│   └ ancestor                ┌ child           │ │ fields · references           │
│      └ ● focus ─────────────┼ child           │ │                               │
│                             └ child           │ │                               │
│  ┄┄ targets ┄┄   ○   ○   ○                    │ │ repo @ commit        path     │
└───────────────────────────────────────────────┴─┴───────────────────────────────┘
                   the canvas                    handle          the details

Phone, below the breakpoint
┌──────────────────────────────┐
│ path · history · Expand      │
├──────────────────────────────┤
│ the canvas                   │
├──────────────────────────────┤
│ the card                     │
└──────────────────────────────┘
```

The stage's file also draws the timeline's ledger, a row per experience with its card opening under it, under the ledger's own comment.

## Card

One entity rendered into a body and a foot, the same wherever it appears: beside the stage, under a ledger row, in a seat's drawer, in the surfaces panel. It knows no page; what it cannot read off the entity it takes from its caller. Source: [assets/card.js](../../assets/card.js), whose header lists its calls.

```text
┌──────────────────────────────────────────┐
│ Title                                    │
│ The tagline                              │
│ Prose.                                   │
│ Field     value · reference › · link ↗   │  ← a reference walks the model, a link leaves it
│ Skills    ▸ Category (n)   chip ■■□      │  ← a level's marks on a chip
├──────────────────────────────────────────┤
│ repo @ commit                  file path │  ← the foot, mono
└──────────────────────────────────────────┘
```

## Modal

The family's one modal: everything a page opens over itself opens here, the graph and a picture's full screen alike. No page links it; the stage and the chat fetch it on first use. Source: [assets/modal.css](../../assets/modal.css), [assets/modal.js](../../assets/modal.js).

```text
 ░░░░░░░░░░░░░░░░░░░ the page, dimmed ░░░░░░░░░░░░░░░░░░░░
 ░ ┌──────────────────────────────────────────────────┐ ░
 ░ │ title                     [controls]         ×   │ ░  ← .rbmodal-head: .rbmodal-title, .rbmodal-controls, ×
 ░ ├──────────────────────────────────────────────────┤ ░
 ░ │                                                  │ ░
 ░ │   the graph, or a picture                        │ ░  ← the body
 ░ │                                                  │ ░
 ░ └──────────────────────────────────────────────────┘ ░
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## Chat

A button at the foot of a page and the terminal it opens over the site's chat service, a card on a desk and a sheet on a phone. A deck shows the button on a desk and not on a phone, where its transport takes the bottom edge ([Decks](decks.md#transport)). The endpoint and the model page are named on the script's own tag. Source: [assets/chat.css](../../assets/chat.css), [assets/chat.js](../../assets/chat.js), whose header gives the tag.

An address can ask for the chat, so a post can send its reader to the panel or to one answer: `?chat=open` opens the panel, and `?ask=` opens it with a question waiting, with `?chat=open` or without it. The page reads either once and takes it out of the address, so a reload or a shared address does not ask again. Nothing is sent on arrival, as the intro's notice says: the question waits in `.rbchat-ask`, a card under that notice and above what the panel offers to try, or at the end of the log where the tab already holds a conversation, and Send hands it to the chat as if typed, Edit puts it in the input and Discard drops it. On a desk Send takes the focus, so Enter sends; on a touch screen nothing is focused, so no keyboard rises over the page. The question is trimmed and set as text, never as markup, and one that is empty, too long for a message or not decodable opens the panel without a card.

Where the chat service checks its answers, a claim the evidence does not carry is marked once the answer has finished, and only where its probability passes the threshold the service sends: a dotted underline, `--t-part` for a claim carried in part and `--t-bad` for the rest. Hover or keyboard focus shows its note in the panel's own tooltip box, the one under the header's buttons, with a name and one line; a tap does not, and on a phone the line under the answer says how many statements are not fully backed. With no threshold nothing is marked.

```text
Desk                                            Phone
                ┌───────────────────────────┐   ┌──────────────────────────┐
                │ chat · blust.ch   [+]  ×  │   │ chat · blust.ch  [+]  ×  │  ← .rbchat-head
                ├───────────────────────────┤   ├──────────────────────────┤
                │ > the visitor's question  │   │ > question               │
                │                           │   │                          │  ← .rbchat-log
                │ The answer, drawn whole:  │   │ The answer …             │
                │ prose, lists, tables,     │   │ a claim not backed       │
                │ a claim not backed        │   │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄       │  ← .rbchat-claim
                │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄        │   │                          │
                │ ┌─────────────────────┐   │   │                          │
                │ │ Contradicted  The   │   │   │                          │  ← .rbchat-note,
                │ │ model's pages say … │   │   │                          │    never on a phone
                │ └─────────────────────┘   │   │                          │
                │ a picture [⤢]             │   │                          │
                │ 1 statement here isn't …  │   │ 1 statement here isn't … │  ← .rbchat-claims
                │ sources · next questions  │   │                          │
                │ ┎───────────────────────┐ │   │                          │
                │ ┃ The link you opened … │ │   │                          │  ← .rbchat-ask: a link's question,
                │ ┃ > the link's question │ │   │                          │    on a phone too
                │ ┃ [Send ⏎] Edit Discard │ │   │                          │
                │ ┖───────────────────────┘ │   │                          │
                ├───────────────────────────┤   ├──────────────────────────┤
                │ > Ask about the model…    │   │ > Ask about the model…   │  ← .rbchat-form
                └───────────────────────────┘   └──────────────────────────┘
                                   ( ● Chat )     a sheet, full width
                                        ↑ .rbchat-open, fixed at the foot
```

## Fonts

The three faces, self-hosted, each with its license beside it. What each face sets is on [Tokens](tokens.md#faces). Source: [assets/fonts/](../../assets/fonts/).

## Libraries

Vendored, never fetched from a CDN, each with its license beside it. d3 draws the stage and ships in the `stage` group: [assets/d3.v7.min.js](../../assets/d3.v7.min.js). Mermaid draws a picture under a chat answer and is fetched only when the first picture arrives: [assets/mermaid.min.js](../../assets/mermaid.min.js). The chat inlines GitHub's Octicon mark, whose notice is [assets/octicons.LICENSE.txt](../../assets/octicons.LICENSE.txt).
