# The chat opens the graph, sets its answer on a card, and names its versions

Status: the owner chose all three on 2026-09-28 from the prototype of the terminal chat: answer background B, the versions line in the banner, and the graph over the chat. The build waits for this spec's review. Decided against `robertblust/design` at v0.116.0, `companygraph/meta-model` at v0.57.0, and the three sites and three instances as read that day. Those are the source of every fact below about what exists.

## Why now

The terminal chat went live on all three sites on 2026-09-28, and three things read wrong in use.

**A name in an answer leaves the chat.** Every link into the model, whether a name in the text, a title on the cite line or a node in a picture, goes to the model page, `/model/?stage=expanded#<id>` (on companygraph.io, `/?stage=expanded#<id>`). The visitor lands on another page with the graph expanded over it, and the chat panel follows only because the tab keeps the conversation. The owner found this confusing and noisy. A picture's Expand already opens as a dialog over the chat and closes back to it, and the graph should open the same way.

**The answer does not stand apart.** An answer is set on the terminal's own ground, behind only its green rail, so a long one runs into the question above it and the menu below. Of four variants shown in the prototype (the rail alone, a card, a full-width band, a green wash), the owner chose the card.

**The chat does not say what it answers from.** The CLI's banner names its release. The chat's banner names only its host, although what it answers from is exactly two things: the meta-model's core the model is written in, and the model at one commit.

## The shape

### The graph over the chat

A link into the model inside the chat panel opens the graph as a dialog over the page, focused on that entity. This covers a name in an answer, a title on the cite line, a node in an answer's picture, and a node in that picture opened full screen. The dialog takes the diagram dialog's shape: the terminal's colors, a head, a × with its note, Escape and a backdrop click to close, a full-screen sheet on a phone, and focus given back to the link that opened it. The head reads `graph · <title>`. Beside the × stands `model page ↗`, the link as it is today, for a visitor who wants the whole page.

The graph in the dialog is the model page's own stage, not a second drawing. The dialog holds an iframe of the page the tag's `data-model` names, at the address `link()` builds today with one more parameter, `embed`: for example `/model/?stage=expanded&embed#<id>`. The stage code is written against its page's own elements, its dialog, its caption and its address. Embedding the page keeps every behavior of the stage exactly as it is, where a stage lifted into the chat would mean rewriting it. The iframe is same-origin, so it takes the page's theme and language from the family's storage keys like any page of the site, and it loads d3, `stage.js`, `card.js` and the model file only when a visitor first opens a graph. The iframe is made on the first open, not before: nothing is fetched for a visitor who never opens one.

**A page asked for `embed`** draws the stage alone. Inside the dialog, a page with `embed` in its address marks its root as `data-embed`. The stage's rules then show only the expanded stage, filling the frame, with no header, no footer, no page around it, no expand button and no chat. `chat.js` does nothing on an embedded page. The stage's × and Escape inside the frame post one message to the parent, `rb-graph-close`, from the same origin, and the chat closes its dialog on it. The parent checks the message's origin and ignores any other. The model page's own graph, opened normally, is unchanged.

**Moving the focus inside the graph** works as it does on the page: a node click, the history arrows and the card's links. On its own page the stage keeps its history in the browser's: a focus writes the hash, and the arrows call `history.back()`, `forward()` and `go()`. In a frame, every one of those would write to the tab's history, so the visitor's Back after closing the dialog would walk the graph they had closed. So an embedded stage keeps its history in memory. A focus writes the address with `history.replaceState`, the trail the stage already keeps is the whole history, and its arrows and keys move along that trail directly. Opening the dialog again for another entity posts one message to the frame, `rb-graph-focus` with the entity's id, from the same origin. The stage focuses it as a click would, pushing it on its trail, so a second open is instant, reloads nothing, and writes nothing to the tab's history. The first open loads the frame at its address, which a new frame's first navigation does without a history entry. The iframe is kept for the page's life once made. The embedded page asks for no `?stage=expanded` round trip of its own: `embed` implies it.

**Links outside the chat** are unchanged. A page's own picture, like the team page's, and the stage's own card keep linking as they do, since they are already on a page of the site and a dialog over them would be a page over itself.

### The answer on a card

An answer is set on a card one step lighter than the terminal: `--t-card`, `#141D29` in the dark palette and `#F3F1EB` in the light one. The rail stays on its left edge, green as today, and the card's right corners are rounded 8 px. The padding is `.55rem .9rem .55rem .95rem`. The question at the prompt, the spinner, the menus and refusals stay on the terminal's ground, so the card marks the one thing the model wrote. The two new values are checked for contrast against the answer's dim prose and its links in both palettes before they are committed: at least 4.5:1 for the text, and 3:1 for the rail.

### The versions line

The banner gets a third line under `chat · <host>`: `meta-model <core> · model <commit>`, in German `Meta-Modell <core> · Modell <commit>`. The commit is cut to seven characters.

- **The core version** is the version of the vocabulary the model is written in, as its instance vendors it. It links to that vendored core in the model's repository at that commit, `https://github.com/<repo>/tree/<commit>/meta/core`: the exact vocabulary the model uses, which a core release page could not name.
- **The model's commit** links to the model's repository at that commit, `https://github.com/<repo>/tree/<commit>`.

Both values, and the repository, come from the model file `data-questions` names, from the one read the widget already makes when the panel opens. So the line asks nothing of any server. A model file without a core names the model alone, and one without a commit shows no line. The line is dim, as the host line above it is, and it follows a language switch.

**The model file gains `core`.** The file carries `repo` and `commit` today, which each site's build writes from its `source.json`. It carries nothing about the meta-model. `companygraph/meta-model`'s instance export adds a top-level `core`: the version in the vendored core's `manifest.json`, which every site already hands the parser with the schemas it reads from `meta/core/`, and null where there is none. Nothing else in the file changes, and a site's page code that reads the file ignores a field it does not know.

## What has to change with it

**`companygraph/meta-model`** exports `core`, with tests for a core that carries a manifest, one without, and a manifest that is not JSON. That is a minor release.

**`robertblust/design`** makes the three changes above in the `chat` group and the stage group (`stage.js`, `stage.css`, and the embed rules), adds the page-side `embed` handling to the block every model page takes, updates the README's chat and stage paragraphs, and releases a minor.

**Each site** takes both releases in one pull request: the meta-model pin moves in `package.json` and its lockfile, as the re-pin hazards require, the model file is rebuilt so it carries `core`, and `npm run design` and `npm run og` run. Its page checks prove that the model page with `embed` shows the stage alone. blust.ch and guestgraph.io name `/model/`, and companygraph.io names `/`, its home page, whose stage draws the company. So companygraph.io's home page must honor `embed` too.

**The tests.**

- **The versions line:** the pure parts go in `test/chat.test.mjs`. `versionsOf(file)` returns the core, the commit and the repository, or nulls, and `graphHref(model, id)` returns the embedded address.
- **The graph in the browser:** a new `test/chat-graph.test.mjs` drives it in Chromium against a stub model page. A name, a cite title and a picture's node each open the dialog focused on their entity. A second open moves the focus by message without reloading the frame. The frame's × closes the dialog. Back after closing goes where it went before, and a message from another origin is ignored.
- **The card and the line:** `chat-terminal.test.mjs` gains the answer card's computed background in both palettes, and the versions line with and without `core`.
- **The meta-model:** its own tests hold the export.

## What this is not

Not a second drawing of the graph in the chat, and not a change to the stage's behavior on its own page. Not a change to the chat server, the MCP servers or what is sent. Not a change to where a page's own picture links. Not a version for the mental-model beyond its commit: an instance has no release tags, by the family's rule that pins are editorial.

## The order

This spec's review, then an implementation plan. Then the meta-model pull request and its release. Then the design pull request and its release. Then one pull request per site that takes both, rebuilds its model file and is checked. Merging, each tag and each site's pull request wait for the owner's word.

## Decisions

Taken by the owner on 2026-09-28 from the prototype: answer background B, the card; the versions line in the banner, naming the meta-model's core and the model's commit; the graph opened over the chat as a dialog, not on the model page, by embedding the model page's own stage.
