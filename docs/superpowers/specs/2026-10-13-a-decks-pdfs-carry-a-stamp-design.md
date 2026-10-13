# A deck's PDFs carry a stamp

Status: the owner asked on 2026-10-13 that a deck's PDFs get a stamp like the one a share card has, and approved the design below in chat the same day, with the exporter keeping a file whose slides render as before. Nothing is built. Decided against `robertblust/design` at `main` after #282 and the three sites as read that day, which are the source of every fact below about what exists.

## Why

A deck's PDFs are one screenshot per slide, made by `exportDecks` when someone runs `npm run pdf`. A share card is the same kind of copy, and it has a stamp, `og.sha`, the hash of what went into it, which `og:check` reads in CI. A deck's PDFs have none, and no check reads them, so they fall behind their deck while every check passes. `WORKING.md` says CI checks that a committed copy matches what would be built, and names exported PDFs among the copies; for them nothing does.

On 2026-10-13 two decks of companygraph.io had done so. The requirements talk's PDFs were rendered on its branch before it took v0.152.0, and slide 12 still showed the use case's scope frame as the release had stopped drawing it. The landscape talk's PDFs were rendered before its trademark edits, and still linked a copy of a specification the deck had stopped linking two days earlier. Nobody was told. Both arrived through files the card's stamp already reads: the first through `chat.css`, the second through the deck's own page.

## The shape

**What current means.** A deck's PDFs are current when the hash of what went into them is the one in the stamp beside them. What went in is found the way a card's is: `sources` of `cards/recipe.mjs` walks the deck's page and returns the page and every file of its own repository that a tag or a `url()` in it names, which for a deck of companygraph.io is its page, `deck.css`, `deck.js`, `chat.css`, `chat.js`, `tokens.css`, its `scenes.js`, the fonts and the favicon. The walk is used as it stands and the card recipe is not touched.

**One file no tag names.** `chat.js` fetches `mermaid.min.js` from beside itself when a slide holds a picture, and no tag names it, so the walk does not find it. Where the walk finds `chat.js`, the deck's recipe hashes the `mermaid.min.js` beside it as well, when there is one. These are the two files a drawn picture's own stamp reads, in `lib/pictures.mjs`, for the same reason.

**The exporter's knobs are in the hash.** What `exportDecks` does to a slide is the package's and not the site's: the frame, the scale, the two languages, the rule that hides the transport. These move out of `decks/export.mjs` into a new module, `decks/recipe.mjs`, which the exporter reads them from and the recipe hashes, so a knob that changes moves every deck's hash by being changed. The hash opens with a mark, `pdf-recipe/1`, raised by hand for a change no knob holds, such as how a link is written onto a page. The deck's own entry, `dir` and `slug`, is hashed with its keys sorted, as a card's is.

**One stamp for a deck.** The stamp is `pdf.sha` in the deck's directory, beside `<slug>-en.pdf` and `<slug>-de.pdf`, and it covers both: a deck's page holds both languages, so nothing that moves one PDF's inputs leaves the other's alone.

**The exporter keeps what did not change.** Nearly every release of this package changes a file every deck links, so every re-pin marks every deck stale. Writing each PDF again would put all of them into a site's history for a change most do not show: companygraph.io exported eighteen on 2026-10-13, 56.9 MB together, and fourteen held the same picture on every page as the file already committed. So `exportDecks` renders a deck as it does today and then, for each of its two PDFs, reads the file on disk with the `PDFDocument` it is handed and compares the two page by page: the picture a page holds, byte for byte as the PDF stores it, and the links over it, each rectangle and address. A file with the same number of pages, the same pictures and the same links is left as it is and logged as kept; any other is written and logged as today. The comparison is exact. A machine that rasterizes differently writes the file again, which costs a commit and misleads nobody.

**The stamp is written last.** After both PDFs of a deck are decided, `exportDecks` writes `pdf.sha`, so a run that dies half way leaves the deck reported stale and never reported current on a file it did not finish. The stamp is written whether or not either file was, since it says what the PDFs were checked against and not when they were written.

**A check that needs no browser.** A new module, `@robertblust/design/decks/check`, exports `checkDecks({ decks, root })`, which returns a count and never exits, as `checkCards` does. For each deck it logs one line and counts a problem where the stamp is missing, where the stamp is not the hash, and where a PDF the deck names is not on disk. It closes with the command that clears it: `npm run pdf`, then commit each `pdf.sha` with the PDFs that changed. It imports only `node:` builtins and `decks/recipe.mjs`, so it runs in CI after `npm ci` and before the browser is installed, beside `og:check`.

**What a site holds.** The list of decks is the site's data, and today it sits inside `export-pdf.mjs`. A check needs the same list, and a second copy is a deck that can be added to one and not the other. So the list moves into one file at the site's root, `decks.mjs`, which `export-pdf.mjs` and a new `pdf-check.mjs` both import; `pdf-check.mjs` calls `checkDecks` and exits on what it returns, as `og-check.mjs` does. `package.json` gains `pdf:check`. In `pins.json`, each `after` list that runs `npm run og` runs `npm run pdf` beside it, and `verify` lists `npm run pdf:check`. CI runs `pdf:check` after `og:check`.

**Tests.** `decks/recipe.mjs`: the hash moves when the page moves, when a file the page names moves, when `mermaid.min.js` moves beside a `chat.js` the page names, when a knob moves and when the deck's entry moves, and does not move when the entry's keys change order. `decks/check.mjs`: a current deck passes, and each of the three failures is counted and named; the module imports no browser. `decks/export.mjs`, against the fake browser and the fake `PDFDocument` its tests already use, which gains a `load`: a file whose pages match is not written and its stamp is, a file with one changed picture is written, a file with one changed link is written, a file with a different number of pages is written, a deck with no file on disk is written, and the stamp is written after both.

## What it costs

- **A design minor.** `decks/recipe` and `decks/check` are new exports, and `exportDecks` reads the file on disk and writes `pdf.sha`. Nothing breaks for a site that re-pins: its `npm run pdf` starts writing a stamp beside each deck, and nothing reads it until the site adds the check. `exportDecks` calls `PDFDocument.load`, which pdf-lib has, so a caller's call does not change.
- **Each site that adopts it:** `decks.mjs`, `pdf-check.mjs`, the script, the two edits to `pins.json`, the CI step and a line in its build notes. Its first `npm run pdf` stamps every deck and shows which PDFs were behind. After that a re-pin renders every deck and commits the stamps and the PDFs that changed.
- **companygraph.io adopts it with this work**, in a pull request of its own after the release. blust.ch and guestgraph.io take it when the owner says, on a re-pin of theirs.

## Known limits

- **A file a script fetches is not seen**, other than `mermaid.min.js`. Nothing else a slide shows arrives that way today; a later one is named in the recipe when its deck is.
- **A file named only inside a linked stylesheet is not seen**, as for a card. The fonts are named in the deck's own page and are seen.
- **Two slides are not still.** A scene's dot sits a few pixels along from one run to the next on one slide of the levels deck, and one edge label of a drawn picture moves by a hair on the landscape deck. Their PDFs are written again more often than they need to be, and that is accepted.

## Not in this

- Rendering only the decks whose stamp is stale. Every run renders every deck, on the exporter's one path.
- Making the two slides still.
- The card recipe and `og:check`, which stay as they are.
- A check that renders and compares pixels in CI, which would report the machine it ran on.
- Holding a PDF's page count to its deck's slide count.
