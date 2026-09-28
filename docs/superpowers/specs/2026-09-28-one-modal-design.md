# One modal

Status: the owner set the rule on 2026-09-28, after the graph began opening over every page, and chose the terminal palette for it. The build waits for this spec's review. Decided against `robertblust/design` at v0.117.0 and the three sites as read that day. Those are the source of every fact below about what exists.

## Why now

The family now opens three different modals, each drawn and behaving a little differently:

- **The model page's Expand** moves the stage into its page's own `dialog#stagemodal`, in the page's palette, with a × at the corner.
- **A picture's full screen** is `chat.js`'s `dialog.rbchat-modal`, with its caption and zoom in the head.
- **The graph** opened from a link is `chat.js`'s `dialog.rbchat-graph`, in the terminal's palette. Its head carries a `model page ↗` link.

The owner, looking at the graph over a page, asked for one modal. The graph's dialog is the look to keep, as the owner's reference image `modal.png` shows it: the terminal's head bar with the title on the left and a × on the right, the model page's size, and a dimmed page behind. It should not carry `model page ↗`, since the modal is a frame for what it shows and knows nothing about where that lives. The model page's own Expand should open it too. The page behind should not scroll while it is open, because the dimmed page says the modal has the attention. The close should say its key. The chat's close should say the same.

## The shape

**One implementation.** `assets/modal.js` and `assets/modal.css` are the family's one modal. They ship in both the `stage` and the `chat` group, so every page that can open one has them.

- **How pages load it:** no page links them. `chat.js` and `stage.js` fetch `modal.js` from beside themselves on the first open, the way `chat.js` fetches Mermaid today. `modal.js` then links `modal.css` from beside itself. No site changes its markup, and a page whose visitor never opens a modal loads neither file.
- **The API:** `window.rbModal.open({ title, body, controls, opener, onClose })`.
  - `body` is the node the modal shows, moved in and not copied, and moved back to where it stood on close.
  - `controls` is an optional node for the head, placed between the title and the ×.
  - `rbModal.title(text)` changes the title while the modal is open.
  - `rbModal.close()` closes it.
- **One at a time, except the graph over a picture.** A second `open` while a modal is open stacks it, which is the one case the family has: the graph opened from a node in a picture's full screen. Closing the top modal returns to the one beneath.

**The look** is the graph dialog's, in the terminal's palette, dark by default and light where the page is light:

- **Head bar:** the title on the left in the dim mono ink, then the optional controls, then the ×.
- **Size:** the model page's size, `min(1500px, 96vw)` × `min(92vh, 1000px)`, and a full-screen sheet below 860px.
- **Backdrop:** dimmed.
- **Close:** the ×'s tooltip reads `Close · Esc`, in German `Schliessen · Esc`. Escape and a click on the backdrop close it too, and the focus goes back to what opened it.
- **Scrolling:** while a modal is open, the page behind it does not scroll. The root takes `overflow: hidden` while any modal is open and gets its scroll position back on close, so the wheel and the touch scroll what is in the modal, the card and the picture, and nothing else.
- **Palette:** the terminal's colors move out of `chat.css` into the tokens block as `--t-*`, so the chat panel and the modal read one palette.

**Two kinds of content,** the owner's two viewers:

- **The graph viewer.** On the model page it is the stage itself: Expand moves `.stagehead` and `.stage` into the modal and back, as it moves them into `#stagemodal` today. The title reads `graph · <name>` and follows the focus. On every other page it is the embedded model page, as today: an iframe of the model page with `embed`, whose stage fills the frame and speaks to the page in the messages it has now. The title follows `rb-graph-at`. The frame, the lazy first open, the focus by message and the failure line stay as they are. Only the dialog around them becomes the one modal.
- **The diagram viewer.** A picture's full screen moves its box into the modal, as it does into `dialog.rbchat-modal` today. The caption is the title, and the −, + and Fit controls sit in the head's controls slot. Zoom, pan and the node links are unchanged, and a node still opens the graph, stacked over the picture.

**What goes away:**

- `dialog.rbchat-graph` and `dialog.rbchat-modal` with their CSS.
- The `model page ↗` link.
- The model page's use of `#stagemodal` for Expand. The page's `#stagemodal` markup stays, for the embedded frame only: an embedded page still draws its stage in it, filling the frame, so no site has to edit its model page.

**The chat's close** takes the modal's tooltip, `Close · Esc`, since Escape closes the chat panel too.

## What has to change with it

**`verify/stage.mjs`**, the stage checks every site runs, says today that clicking `#expand` opens `dialog#stagemodal` holding `#fig` and `#card`, and that Escape closes it. It will say the same of the one modal: clicking `#expand` opens `dialog.rbmodal` holding `#fig` and `#card`, the page behind does not scroll, and Escape closes it and gives the stage back to the page. Its other assertions stay.

**The tests:**

- The existing browser tests move from the three old dialogs to the one modal: `chat-diagram.test.mjs`, `chat-graph.test.mjs`, `stage-embed.test.mjs` and `chat-place.test.mjs`.
- A new `test/modal.test.mjs` holds the modal itself:
  - it opens, stacks and closes;
  - the body goes back where it stood;
  - the focus returns to the opener;
  - the tooltip reads in both languages;
  - Escape and a backdrop click close it;
  - the page behind keeps its scroll position and does not scroll while open;
  - the head's controls slot works;
  - the size and the phone sheet are right.
- A source test holds that no other dialog is drawn: no `dialog.rbchat-graph`, no `dialog.rbchat-modal`, and no `model page`.

**The README** says there is one modal, what it takes and who opens it.

**Each site** takes the release with a re-pin, `npm run design` and `npm run og`. No markup changes.

## What this is not

Not a change to what the graph or a picture shows, how the stage draws, or how the graph embeds. Not a change to the talk decks, which open no modal. Not a change to the chat panel beyond its tooltip; the panel is not a modal and does not dim the page.

## The order

This spec's review, then a plan, then one design pull request and its release, then one pull request per site. Merging, the tag and each site's pull request wait for the owner's word.

## Decisions

Taken by the owner on 2026-09-28:

- One modal for every page, with the look of `modal.png` and no `model page ↗`.
- The model page's size.
- The model page's Expand uses it.
- It holds the graph viewer or the diagram viewer.
- The close says `Close · Esc`, and so does the chat's close.
- A dimmed page behind that does not scroll.
- The terminal palette everywhere, dark or light with the page.
