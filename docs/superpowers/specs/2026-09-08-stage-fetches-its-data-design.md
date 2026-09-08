# The stage fetches its data — design

> A page that draws a model inlines the whole model to do it, twice on blust.ch. The stage
> fetches the committed artifact instead, the page names it with a link, and the parse stops
> being copied into HTML at all. A major release: a site cannot take it by re-pinning.

Status: proposed. Decided on 2026-09-08 against this repository and the three sites at `main`,
all pinned to v0.54.0. Every number below was counted, not estimated.

---

## 1. What is true today, measured

| Fact | Value |
|---|---|
| `assets/stage.js` | 922 lines, **0** occurrences of `async` or `await` |
| How it finds its data | `document.querySelector('script[type="application/json"][data-stage]')`, parsed at script-eval time |
| blust.ch `/model/` | 359,790 bytes, **83%** of it the inlined block |
| blust.ch `/timeline/` | 374,739 bytes, **80%** of it the same block again |
| companygraph.io `/model/` and `/example/` | 105,388 and 83,482 bytes, 38% and 28% blocks |
| The same parse in blust.ch's repository | three times: `model.json` and two identical 301,651-byte blocks |
| How a card is rendered | `pathToFileURL(...)`, deliberately, so `npm run og` needs no server |
| A card rendered over `http` instead | **byte-identical** — same 199,262 bytes, same SHA-256 |

Two of those rows decide the work.

**The artifact already exists and is already served.** blust.ch commits `model.json` and
publishes it at a stable URL, which its `Dataset` node names as a download. companygraph.io
commits `example.json` and `model.json` the same way. The pages nonetheless carry their own
copy, because that is how the stage has always found its data — so the parse exists three times
in one repository and a visitor to `/model/` downloads 300KB of JSON to look at a drawing.

**Only one thing prevents fetching it, and it is not the file type.** Measured on 2026-09-08 in
Chromium: from a `file://` page a classic `<script src>` loads, while `fetch` and a JSON module
import are both blocked, and a `<script type="application/json" src>` never loads its `src` at
any origin. Over `http` both `fetch` and the module import work. So the obstacle is the origin,
and the origin is the card exporter's choice: it navigates to `pathToFileURL(...)` so that
`npm run og` needs no second terminal.

That reason survives the change. An exporter that starts its own server still needs no second
terminal.

## 2. What was decided

**The page names its data and the stage fetches it.**

```html
<link rel="preload" as="fetch" href="../model.json" data-stage>
```

The marker stays an attribute rather than an id, which is the property `stage.js`'s own comment
claims — one script serves both pages because it queries `data-stage`, not a name. And the tag
is one the card recipe already walks: `sources()` collects every `src` and `href` outside an
`<a>`, so the artifact enters each card's hash by being named, and a model that changes still
reports its card stale. That was verified against the real `sources()` rather than assumed.

**`stage.js` becomes asynchronous at its entry and nowhere else.** Its 922 lines run today
against a parsed object available when the script evaluates. They become the body of `start(data)`,
called once the fetch resolves. Nothing inside changes, because nothing inside depends on when it
ran — only on having the data.

**A page with no link fails loudly.** This release cannot be taken by re-pinning, and its version
does not shout — see section 4. So the error is the safety net: a site that syncs the new stage
without moving its pages must get a message naming what to do, and `STAGE_CHECKS.graph` must fail
in that site's own suite. That failure is how the mistake is found, so it is designed rather than
left to whatever a missing element throws.

**`verify/stage.mjs` reads the same file the page does.** Its `graph` check parses
`document.getElementById(id).textContent` today. It fetches the link's `href` instead, so the
check and the page agree about where the data is by construction rather than by convention.

**`cards/export.mjs` serves the site.** A static server on a free port from `node:http`, which
this package can use because it has no dependencies and that module is built in. Navigation
becomes `http://127.0.0.1:<port>/<dir>/<hash>`. A card rendered this way was measured
byte-identical to one rendered from `file://`, so no committed card moves and no site re-renders
anything.

**The blocks go, and nothing replaces them in the page.** blust.ch's two pages drop to about
58,000 and 73,000 bytes. Its repository holds the parse once — `model.json` — rather than three
times.

## 3. What each consumer has to do

This is where the release earns the word major. `README.md` sets the rule: a change needing a
site edit beyond `npm run design` is a major, and this needs three.

Each site must, in **one commit**, re-pin, run `npm run design` to take the new stage, and change
its own pages. Splitting those is what turns a suite red, so the sequence is not a preference.

**blust.ch.** `build/pages.mjs` writes the preload link where it wrote the block. `/timeline/`
carries its own reader, site code rather than the package's, and fetches the same way. The
`graph` and `ledger` entries in `verify/check.mjs` name an element id today and become plain
flags. Its twelve derived regions stay twelve — the two that were data blocks become the two
links — so `npm run pages` and `pages:check` keep the shape they have.

**companygraph.io.** The same, for `/example/` and `/model/`, each naming its own artifact.
Its blocks are 28% and 38% of their pages rather than 83%, so it takes the mechanism for a
fraction of the benefit — but leaving it behind means one family doing one thing two ways, and
`stage.js` is shared, so it could not stay on blocks even if that were wanted.

**guestgraph.io** takes only the `fonts` group and loads no stage. It needs nothing beyond a
routine re-pin whenever convenient.

## 4. The release

**v0.55.0**, in the shape every release here has had, with the notes carrying the warning: what
changed, what breaks, how to take it, in that order.

The owner chose this over v1.0.0 deliberately. The cost is that the tag reads like the fifty-four
routine bumps before it, so nothing about the number tells a reader they cannot simply re-pin.
The mitigation is mechanical rather than editorial: a site that re-pins and syncs without moving
its pages fails its own suite, because the stage finds no link and `STAGE_CHECKS.graph` reports
it. The release notes say so, and the stage's own error says what to do.

`version` in `package.json` moves to `0.55.0` in the same commit as the change, because
`design sync --check` compares the tag a site pins against the version it installed and goes red
when they differ.

## 5. What this does not change

`model.json`, `example.json` and the other artifacts: their content, their formatting, their
URLs and the `Dataset` and `DefinedTermSet` nodes that name them. The JSON-LD on any page. The
principles page. The fences, the tokens, the header contract. Every card's pixels, measured.
`runSuite`, the shared-node check, and every per-page check other than `graph`.

Two things are deliberately out of scope. **The timeline still downloads the whole model** to
list thirty-six experiences, because trimming what each page needs is a question about the
artifact's shape rather than about how a page gets it. And **a visitor to one page downloads the
same bytes either way** — the page shrinks by exactly what the fetch adds. The wins are that a
second page is nearly free, the HTML is six times smaller to parse, and the repository stops
carrying three copies of one parse; the wins are not first-paint on a single visit, and this
design does not claim them.

## 6. How it is verified

The stage's own suite covers the entry: a page whose link resolves draws, a page with no link
fails with a message naming the remedy, and a page whose link 404s fails distinguishably from
one with no link at all.

Each site proves the rest. `npm run verify` must pass with `STAGE_CHECKS.graph` reading the
fetched file, `npm run og:check` must pass with no card re-rendered, and the pages must be
byte-identical to what `npm run pages` produces from the artifact, which is the same acceptance
test those sites already use.

The card equivalence is proved once, on the design side, by rendering the same page both ways
and comparing bytes — done on 2026-09-08 and recorded in section 1, to be re-run against the
real exporter rather than a replica of it.
