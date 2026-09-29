# Robert Blust — Design System

What the design system of [blust.ch](https://blust.ch), [companygraph.io](https://companygraph.io) and [guestgraph.io](https://guestgraph.io) is made of, what each part looks like, and where each part ships. The CSS and scripts are the design system; these pages are its map. Nothing here repeats a value, a contract or a reason the source already states, so every entry names the file that says it.

The brand is kept one level up, in each site's model: the name, the promise, the mark and the voice are in the `model/brand.md` of [robertblust/mental-model](https://github.com/robertblust/mental-model/blob/main/model/brand.md), [companygraph/mental-model](https://github.com/companygraph/mental-model/blob/main/model/brand.md) and [guestgraph/mental-model](https://github.com/guestgraph/mental-model/blob/main/model/brand.md). The color roles and the faces, which the three share, are on [Tokens](tokens.md).

How the package delivers any of this to a site, fences, whole files and groups, is the [package README](../../README.md)'s subject.

## Pages

| Page | What it describes |
| --- | --- |
| [Tokens](tokens.md) | The color roles and what each means, the token families, and the faces |
| [Blocks](blocks.md) | The parts every prose page carries: header, title, lines, footer, and the rules of the model pages |
| [Assets](assets.md) | The stage, the card, the modal, the chat, the fonts, and the libraries shipped beside them |
| [Decks](decks.md) | A talk's chrome: the transport, the lockup, the canvas and the runtime |

## Map

A fence is a block a page carries between two markers; a whole file is assembled from blocks and linked; a group is a set of files a site takes by naming it in its `design.config.json`.

| Part | Source | Ships as | Described in |
| --- | --- | --- | --- |
| Design tokens | [blocks/tokens.css](../../blocks/tokens.css) | fence `design tokens`, file `tokens.css` | [Tokens](tokens.md) |
| Prose reset | [blocks/reset.css](../../blocks/reset.css) | fence `prose reset`, in `page.css` | [Blocks](blocks.md#prose-reset) |
| Link | [blocks/link.css](../../blocks/link.css) | fence `link`, in `page.css` and `deck.css` | [Blocks](blocks.md#link) |
| Header row | [blocks/header.css](../../blocks/header.css) | fence `header contract`, in `page.css` | [Blocks](blocks.md#header-row) |
| Title | [blocks/title.css](../../blocks/title.css) | fence `title contract`, in `page.css` | [Blocks](blocks.md#title) |
| Lines | [blocks/lines.css](../../blocks/lines.css) | fence `lines`, in `page.css` | [Blocks](blocks.md#lines) |
| Footer | [blocks/footer.css](../../blocks/footer.css), [blocks/footer-credit.css](../../blocks/footer-credit.css) | fence `prose footer`, in `page.css` | [Blocks](blocks.md#footer) |
| Principles | [blocks/principles.css](../../blocks/principles.css) | fence `principles`, in `page.css` | [Blocks](blocks.md#principles) |
| Team board | [blocks/team.css](../../blocks/team.css) | fence `team`, in `page.css` | [Blocks](blocks.md#team-board) |
| Surfaces lineage | [blocks/surfaces.css](../../blocks/surfaces.css), [blocks/surfaces.js](../../blocks/surfaces.js) | fences `surfaces` in `page.css`, `surfaces lineage` | [Blocks](blocks.md#surfaces-lineage) |
| Index list | [blocks/index.css](../../blocks/index.css) | fence `index`, in `page.css` | [Blocks](blocks.md#index-list) |
| Home sections | [blocks/home.css](../../blocks/home.css) | fence `home`, in `page.css` | [Blocks](blocks.md#home-sections) |
| Stage contract | [blocks/stage.css](../../blocks/stage.css) | fence `stage contract` | [Blocks](blocks.md#stage-contract) |
| Model card | [blocks/model-card.js](../../blocks/model-card.js) | fence `model card` | [Blocks](blocks.md#model-card) |
| Language | [blocks/lang.js](../../blocks/lang.js) | fence `language`, in `page.js` | [Blocks](blocks.md#behavior) |
| Theme boot | [blocks/theme-boot.js](../../blocks/theme-boot.js) | fence `theme boot`, always a fence | [Blocks](blocks.md#behavior) |
| Theme | [blocks/theme.js](../../blocks/theme.js) | fence `theme`, in `page.js` and `deck.js` | [Blocks](blocks.md#behavior) |
| Nav fit | [blocks/nav-fit.js](../../blocks/nav-fit.js) | fence `nav fit`, in `page.js` | [Blocks](blocks.md#behavior) |
| Stage | [assets/stage.css](../../assets/stage.css), [assets/stage.js](../../assets/stage.js) | group `stage` | [Assets](assets.md#stage) |
| Card | [assets/card.js](../../assets/card.js) | group `stage` | [Assets](assets.md#card) |
| Modal | [assets/modal.css](../../assets/modal.css), [assets/modal.js](../../assets/modal.js) | group `stage` | [Assets](assets.md#modal) |
| Chat | [assets/chat.css](../../assets/chat.css), [assets/chat.js](../../assets/chat.js) | group `chat` | [Assets](assets.md#chat) |
| Fonts | [assets/fonts/](../../assets/fonts/) | group `fonts` | [Assets](assets.md#fonts) |
| Libraries | [assets/d3.v7.min.js](../../assets/d3.v7.min.js), [assets/mermaid.min.js](../../assets/mermaid.min.js), [assets/octicons.LICENSE.txt](../../assets/octicons.LICENSE.txt) | groups `stage` and `chat` | [Assets](assets.md#libraries) |
| Deck transport | [blocks/deck-transport.css](../../blocks/deck-transport.css) | fence `deck transport`, in `deck.css` | [Decks](decks.md#transport) |
| Deck lockup | [blocks/deck-lockup.css](../../blocks/deck-lockup.css), [blocks/deck-lockup-one.css](../../blocks/deck-lockup-one.css), [blocks/deck-lockup-two.css](../../blocks/deck-lockup-two.css) | fence `deck lockup`, in `deck.css` | [Decks](decks.md#lockup) |
| Deck fit | [blocks/deck-fit.js](../../blocks/deck-fit.js) | fence `deck fit`, in `deck.js` | [Decks](decks.md#fit) |
| Deck runtime | [blocks/deck-runtime.js](../../blocks/deck-runtime.js) | fence `deck runtime`, in `deck.js` | [Decks](decks.md#runtime) |
| Deck export | [decks/export.mjs](../../decks/export.mjs) | imported by a site's build | [Decks](decks.md#export) |
