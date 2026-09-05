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

Beside the whole files this package copies into a site, ten of its blocks live *inside* a
page: a fence is a pair of comment markers the page already carries — `design tokens`,
`header contract`, `stage contract`, `prose reset`, `language`, `prose footer`, `deck
transport`, `deck lockup`, `deck fit` and `deck runtime` — and the package owns everything
between and including them, prose, version and CSS alike. That is the whole reason a fence
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

## Parameters

Every substitution described above is one this package makes with values it already owns:
the variant word comes from a fixed set this file declares, the version comes from
`versions.json`. A fence can also declare a **parameter** — a value the *site* supplies,
through its own `design.config.json`, because the package has no way to know it and no
business deciding it.

`langKey` is the first. The language block reads and writes a visitor's saved language
under a `localStorage` key, and that key cannot be derived from anything the package has:
`blust.ch` stores it under `rb-lang`, and nothing about the domain, the fence or the page
yields that string. It has to come from the site.

It matters more than a typical setting, because a storage key is a promise made to every
past visitor. Changing it does not migrate anyone's saved language — it silently starts
everyone over, the same way renaming a cookie would. So `langKey` lives in
`design.config.json`, in the site's own repository, where changing it is a line in a diff
someone has to write and review, not a default this package could quietly change out from
under a site on its own release schedule.

Because of that, a page carrying the `language` fence with no `langKey` in the site's
config is an error — `design sync` exits 2 and names the page, the fence and the missing
key. It is deliberately not a default. An empty or made-up key would throw nowhere; it
would just give every visitor of that site the same nameless storage slot, quietly, with
nothing in `design:check` ever turning red to say so.

`FAMILY` — the regex naming the three domains a language rides between — looks like it
could be a parameter too, and isn't one. It is exported from `lib/family.mjs` instead, and
the sites import it rather than supplying it. The distinction is what a parameter is
*for*: `langKey` legitimately differs from one site to the next, and letting the package
pick it would be picking wrong. `FAMILY` is the same three domains everywhere, on purpose
— a site that could set its own would be a site that could quietly stop carrying the
language to one of its siblings. A parameter is for what a site is entitled to choose, not
for what merely happens, today, to be shared.

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
seen by the same code.

## A warning about `stage.js`

`stage.js` is the one shared file no deck loads — a deck draws static SVG and has to open
from `file://` with no network. **Never link a deck to `stage.js` or `stage.css`.** They
are reached only by served prose pages, through a plain `<link>` and `<script src>`.

## Releasing

A release is a git tag and a GitHub Release, nothing more — there is no publish step. Every
release still needs notes: Dependabot renders them into the pull request it opens in three
repositories, and that pull request is the only thing telling someone there what changed.

A change to any synced file is at least a **minor** — it makes every site's committed copy
stale. A change needing a site edit beyond `npm run design` is a **major**. Dropping a file
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
