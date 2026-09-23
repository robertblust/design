# What is shared is a file, not a fence

Status: approved by the owner on 2026-09-23, both decisions below taken. Decided on 2026-09-23 against `robertblust/design` at v0.79.0, `robertblust/robertblust.github.io` at 88e3391, `companygraph/companygraph.github.io` at 5cafa82 and `guestgraph/guestgraph.github.io`, whose files were read that day and are the source of every fact below about what exists.

## Why now

Everything this package shares with a page is a copy written into that page between markers, and the reason was one line: a deck has to open from `file://`, where a linked stylesheet is a broken box, so there is nothing to import and every page carries its own copy. The owner dropped that requirement on 2026-09-23. A deck is presented from the site or handed on as a PDF, and nobody is sent a folder of HTML; the one thing the rule bought is a case that does not happen.

What it costs is paid on every release. A prose page of blust.ch carries between forty and sixty kilobytes of fenced blocks, and a change to one block rewrites it in nine pages there, ten on companygraph.io and six on guestgraph.io, so a one-line change to the header arrives as twenty-five identical hunks that a reader has to diff against each other to be sure they are identical. The mechanism that keeps them identical — `design sync`, byte comparison, a version in every marker — exists to make that safe, and all of it is machinery for a problem a file does not have.

The chat is the proof of the other shape. `chat.css` and `chat.js` are whole files, copied into the site and linked by the pages, and taking a release is a re-pin, one line of diff, and a browser that fetches each once for the whole visit.

## The shape

Five files, copied into a site by `design sync` exactly as `stage.css` and `chat.css` are today, and named by the pages:

| File | What it holds | Who links it |
| --- | --- | --- |
| `tokens.css` | the palette, the faces, the two theme blocks | every page and every deck |
| `page.css` | reset, header, title, prose footer, and the principles, team and surfaces rules | every prose page |
| `deck.css` | the transport bar, the lockup, the slide canvas | every deck |
| `deck.js` | the deck's runtime and its fit | every deck |
| `page.js` | the language control, the theme control and the nav fit | every prose page |

`stage.css`, `stage.js`, `card.js`, `d3.v7.min.js`, `chat.css` and `chat.js` stay as they are: they are already files, and this change makes them the rule rather than the exception.

**One fence survives, and it is the reason the others can go.** `theme-boot.js` runs before the first paint, reads the stored theme and writes it onto the root element, so that a page never flashes the wrong one. A linked script is a request, and a request is a frame too late. It stays inline, in its markers, checked as it is checked now.

A page's own CSS stays in the page. What this package shares is what every site has; what one page has is that page's, and a page that grows a rule nobody else needs does not thereby own a copy of everything.

## What has to change with it

**The deck exporter opens a deck from disk.** `@robertblust/design/decks/export` calls `page.goto(pathToFileURL(…))`, which is the last thing in the family that depends on the dropped requirement. It serves the tree instead, as the card exporter already does, and takes a base URL. A deck opened by hand from Finder stops working the day this lands, and that is the requirement being dropped, said out loud.

**Four checks read the fences.** `design:check` compares a fence's bytes with the release's; it compares whole files for the files it already ships and does the same for these. `noFlash` asserts that nothing that can block or repaint precedes the boot script: it gains the new links, which must come after it. `fontsAvailable` reads the faces a page names; the faces move into `tokens.css` and it reads them there. The card recipe hashes every local file a page names, so the stamps move when a stylesheet moves, which is what it already does for `chat.css`.

**The pages themselves.** Twenty-five pages across three sites lose their fenced blocks and gain three or four `<link>` and `<script src>` lines each, at the right depth. That is a site edit beyond `npm run design`, so this is a major, and the sites take it one at a time.

## What this is not

It is not a build step. The files are copied, not compiled, and the pages name them by path; there is no bundler, no hash in a filename and no manifest.

It is not a CDN. Everything stays on the site's own origin, which the privacy pages state and the suites assert.

It is not a change to what the pages look like. The bytes that render are the same bytes, in a different place.

## The order

One release, taken by one site at a time, in the family's re-sync order: design, then blust.ch, then companygraph.io, then guestgraph.io. The package keeps writing the fences until the last site has moved, so a site that has not taken the release yet stays green; the fences are dropped from the package in the release after that, when nothing names them.

## Two decisions

**The caching window is accepted.** GitHub Pages serves with a short cache, so for a few minutes after a deploy an old stylesheet can meet new markup, which today cannot happen. A version in the file name would end it and would write a line into every page on every release, which is the thing this change removes. So the window stands, and the rule that follows from it is the one that matters: no release may need both halves at once. A rule renamed, a class dropped, a selector a page starts using — each of those is two releases, the file first and the page after, and never one.

**`page.js` moves with the CSS.** It is the half that can break a page rather than only make it ugly, so it is the half the suite has to catch: every page of every site declares the checks that press the language control, the theme control and the nav, and those run before a site's pull request is merged, which is the same gate the fenced copies pass today.
