# @robertblust/design

The design system shared by [blust.ch](https://blust.ch),
[companygraph.io](https://companygraph.io) and [guestgraph.io](https://guestgraph.io).

## The rule

> If a visitor downloads it and every copy is the same, it is generated into the
> repository and committed.
> If only CI runs it, it is imported from the package.
> If a visitor downloads it but every copy legitimately differs, only its *shape* is
> shared — as an assertion, not as bytes.

The three sites are static, ship no external assets, and are served straight from their
repository trees by GitHub Pages. So this package is **never a runtime dependency of a
published page**. It is a `devDependency` that copies files into a site and lends that
site's suite a few checks.

## In a site

```jsonc
// design.config.json
{ "groups": ["fonts", "stage"] }   // guestgraph.io takes ["fonts"] — it draws no graph
```

A page that draws a stage names the file it draws and loads three scripts in this order —
`d3.v7.min.js`, `card.js`, `stage.js`. The file is named by a link the stage looks for,
`<link rel="preload" as="fetch" href="…" data-stage crossorigin>`, and a page that carries none
throws a message naming that markup rather than drawing an empty figure. `card.js` before
`stage.js` is not a preference either: the stage calls `rbCard` on the first click and throws
without it. A page that only shows cards, blust.ch's timeline, loads `card.js` alone and names
no data.

Such a page has to be served over `http` rather than opened from disk, because `fetch` from a
`file://` page is blocked and the stage draws nothing without its data. `npm run og` starts its
own server for that reason; looking at a page by hand needs one too.

```jsonc
// package.json
"scripts": {
  "design": "design sync",
  "design:check": "design sync --check"
},
"devDependencies": { "@robertblust/design": "github:robertblust/design#v0.1.0" }
```

The ref is a tag, not a range, for the same reason the sites pin `"d3": "7.9.0"` exactly:
this package's bytes end up committed in the consuming repository, so the version should be
a visible, reviewable line, not a range that can move under a lockfile refresh. `npm ci`
records the resolved commit SHA in the lockfile, so installs stay reproducible. The
repository is public, so installing it needs no token, no login and no npm account.

`npm run design:check` runs in CI after `npm ci` and before `npm run verify`.

## The card harness

Four modules under `cards/`, imported rather than generated. The rule at the top of this file
decides that: a visitor never downloads any of them, only CI and a developer run them.

```jsonc
"scripts": {
  "og":       "node export-og.mjs",
  "og:check": "node og-check.mjs",
  "test:og":  "node --test verify/og-recipe.test.mjs"
}
```

| module | what it is |
|---|---|
| `cards/recipe` | `sources`, `recipe`, `stampOf`, `state`, `stamp`, and `recipeFor(root)` which binds them |
| `cards/check` | `checkCards(recipeModule)` — staleness and the dark-background check; returns a count |
| `cards/export` | `exportCards({ chromium, recipe })` — the renderer; takes a `chromium`, never imports one |
| `cards/recipe-tests` | `checkRecipe(recipeModule)` — 32 shared assertions about a site's recipe |
| `decks/export` | `exportDecks({ chromium, PDFDocument, root, decks })` — renders each deck to a 16:9 PDF fallback; takes a `chromium` and a `PDFDocument`, never imports either |

A site keeps one file with real content — `og-recipe.mjs`, holding its `REPO_ROOT`, its frame,
its hide rules and its card list — and three thin callers:

```js
// og-recipe.mjs — the data stays here, and so does REPO_ROOT
export const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const cards = [ /* this site's cards */ ];
export const { sources, recipe, stampOf, state, stamp } = recipeFor(REPO_ROOT);
```

**`REPO_ROOT` belongs to the site, and `root` is always a parameter here.** A package module
that works out where it is resolves inside `node_modules`; that shipped once already, as
`SITE_ROOT` in `verify/design.mjs`, and cost a release to undo.

**Bind through `recipeFor`, not `export * from`.** Re-exporting the raw functions leaves `root`
unbound and `state()` throws for the site's own callers. And the specifier carries no `.mjs`:
the `exports` map has no suffixed entry, so `…/cards/recipe.mjs` raises
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Copy each site's `FRAME` verbatim.** The recipe hashes every key of a card, so one added key
moves every `og.sha` in that repository. No two sites' frames are interchangeable: blust.ch and
companygraph.io carry `clipY` and no `deviceScaleFactor`, guestgraph.io the reverse.

**`og:check` and `test:og` run after `npm ci`.** They import this package, which is not on disk
before that. They still run before `npx playwright install`, because `cards/check.mjs` imports
only `node:` builtins and needs no browser — a property asserted by importing it from a child
process in a directory with no `node_modules` above it, rather than by grepping for imports.

## Fences

Beside the whole files this package copies into a site, eleven of its blocks live *inside* a
page: a fence is a pair of comment markers the page already carries — `design tokens`,
`header contract`, `title contract`, `stage contract`, `prose reset`, `language`, `prose
footer`, `deck transport`, `deck lockup`, `deck fit` and `deck runtime` — and the package
owns everything between and including them, prose, version and CSS alike. That is the whole reason a fence
is not just another synced file: a synced file is copied whole, but a fenced block sits in
the middle of a page the tool never fully owns, so the markers are what tell it exactly
where its part starts and stops.

Editing a fenced block by hand does nothing that lasts. The next `npm run design` reads the
markers, finds the package's own version underneath, and overwrites whatever is between them
— the block is generated, not maintained in place. The block to change is the one in
`blocks/` in this repository; a page only ever carries a copy of it.

The `design tokens` fence is the one exception with a choice attached: its opening line
carries a variant word, `page` or `deck`. A prose page closes its `:root` inside the fence,
because nothing after it adds more tokens; a deck leaves the brace open, because the deck
still has tokens of its own to declare once the shared ones end. That word is how the tool
knows which shape to write back — it is read off the page, never guessed, so a page that
forgets it or gets it wrong is an error, not a silent wrong render.

A site opts a page into a fence by putting the markers in it — there is no list of pages
this package tracks or needs to know about. The absence of a fence is itself the only
state that matters.

Taking a block out of the package works the same way in reverse: delete its fence from the
page, and from then on the page owns that CSS outright. That is a visible decision, made in
the page's own diff, to diverge from the shared copy — not a way to make a red
`design:check` go quiet without deciding anything.

## No parameters

Every substitution this package makes comes from a value it owns: the variant word from a
fixed set `lib/fences.mjs` declares, the version from `versions.json`, a part from a file
beside the block. Nothing comes from the site. `design.config.json` names the groups a site
takes and nothing else, and a key it does not name is an error that names the file and the key.

The storage keys are the family's. `lang` and `theme`, the words the address already carries,
are what every page on the three origins reads and writes, and they are written into the
blocks rather than chosen per site: a storage key is a promise to every visitor, it is one
promise across three origins, and a promise the package makes is one no site can quietly make
differently. Renaming a storage key starts every visitor over, so a rename is a release whose
notes say so, never a site's diff.

`FAMILY`, the regex naming the three domains a language rides between, is exported from
`lib/family.mjs` and the sites import it: a site that could set its own would be a site that
could quietly stop carrying the language to one of its siblings.

## Spelling

Everything here is American English — core's R14 applied to a package whose comments are
copied into sixteen pages on three domains, where the sites' own rule is that every word of a
page is en-US. `test/spelling.test.mjs` scans what ships (`blocks`, `lib`, `verify`, `cards`,
`decks`, `bin`, `assets/stage.js`, this file) against a list of British forms and fails on the
first hit. It is a list, not a dictionary: a false positive is a word to add to its allow list,
never a reason to reword a sentence. German inside a block belongs to the block's `data-de` or
`de:` branch and is not English at all; the scanner sees so little of it that no exception has
been needed.

The sites' `translates` check — the one shared check that presses DE and reads the German — is
here in `verify/pages.mjs` beside the rest, so the German half of every page in the family is
seen by the same code. After the toggle it also holds the German `<title>` and meta description to
WRITING.md's German marks, because those are script strings the cold scan in `typography`
never sees; `typography` holds the English pair the same way, since both live in the head
outside the body it reads. A spec's `shows` and `hides` sample three strings a page, so after
the toggle the check also walks every element carrying `data-de` and every one carrying
`data-de-aria` and names any that kept its English: a translation the list never quotes, or
one a script rewrote after the switch, fails here instead of shipping. The `data-de-aria`
labels are applied by the language block itself, which watches `<html lang>` and writes the
label for the language into every such element, the English captured on load as
`data-en-aria`; a page adds nothing to its own switch to get it.

## A warning about `stage.js` and `card.js`

`stage.js` and `card.js` are the shared files no deck loads — a deck draws static SVG and has
to open from `file://` with no network. **Never link a deck to `stage.js`, `card.js` or
`stage.css`.** They are reached only by served prose pages, through a plain `<link>` and
`<script src>`.

## Releasing

A release is a git tag and a GitHub Release, nothing more — there is no publish step. Every
release still needs notes: Dependabot renders them into the pull request it opens in three
repositories, and that pull request is the only thing telling someone there what changed.

A change to any synced file is at least a **minor** — it makes every site's committed copy
stale. Before tagging, set `version` in `package.json` to the tag: `design sync --check` in
every site compares the tag its pin names with the version of the package it installed and is
red when they differ, so a tag made without moving the field turns three sites red on their
next re-pin instead of drifting unread. A change needing a site edit beyond `npm run design` is a **major**. Dropping a file
from a group is also a **major** — `applySync` never deletes an orphan a site already has.

`assets/d3.v7.min.js` is one such synced file, but it is also pinned as a real npm
dependency in companygraph.io, whose own suite (`verify/instance.test.mjs`) asserts its
committed copy matches its `node_modules/d3`. The two only stay consistent if d3 moves here
first, tagged, and companygraph.io then takes that design release together with its own d3
Dependabot bump on one branch, running `npm run design` and re-vendoring by hand — a site
edit beyond `npm run design` alone, which by the rule above makes a d3 bump a major here
too, not a minor.

## `main` is protected

Three published sites pin this repository's tags, so a bad `main` is a bad release and a
release is what the sites take. The `protect-main` ruleset requires a pull request and one
green status check before anything lands, and it forbids deleting or force-pushing the
branch.

**The ruleset requires two checks, `test` and `conventions / conventions`, not `CI`.** A
ruleset names the *job id*. This repository's workflow is called `CI` and its single job is
`test` — the reverse of the three sites, whose job is `verify`. Rename that job and the branch
still looks protected while nothing ever reports again, which blocks every merge and hides the
missing gate behind it. If the job is ever renamed, update the ruleset in the same change. The
second check, `conventions / conventions`, is the shared job every member of the family runs,
called from robertblust/conventions at the pinned tag.

Everything else about the ruleset is byte-identical to the three sites' own `protect-main`,
deliberately: one shape to know, and a difference between them means one of them drifted
rather than one of them is special. The context is the only field that legitimately differs,
for the reason above. Repository admins can bypass, and all three merge methods are allowed,
because that is what the sites do — so the ruleset stops an accident, not a decision.

Two conventions it therefore does not enforce, which hold anyway:

- **Merge with a merge commit, never a squash.** GitHub re-authors a squash to whoever
  pressed the button, which quietly launders the commit author that the `includeIf` blocks in
  `~/.gitconfig` exist to get right. `allowed_merge_methods` permits all three; use `merge`.
- **Do not push straight to `main`.** The admin bypass makes that possible for the one person
  who commits here. Open the pull request anyway — the status check is the point.
