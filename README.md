# Robert Blust — Design

The design system shared by [blust.ch](https://blust.ch), [companygraph.io](https://companygraph.io) and [guestgraph.io](https://guestgraph.io).

## The rule

> If a visitor downloads it and every copy is the same, it is generated into the
> repository and committed.
> If only CI runs it, it is imported from the package.
> If a visitor downloads it but every copy legitimately differs, only its *shape* is
> shared — as an assertion, not as bytes.

The three sites are static, ship no external assets, and are served straight from their repository trees by GitHub Pages. So this package is **never a runtime dependency of a published page**. It is a `devDependency` that copies files into a site and lends that site's suite a few checks.

## In a site

```jsonc
// design.config.json
{ "groups": ["fonts", "stage"] }   // guestgraph.io takes ["fonts"] — it draws no graph
```

A page that draws a stage names the file it draws and loads three scripts in this order — `d3.v7.min.js`, `card.js`, `stage.js`. The file is named by a link the stage looks for, `<link rel="preload" as="fetch" href="…" data-stage crossorigin>`, and a page that carries none throws a message naming that markup rather than drawing an empty figure. `card.js` before `stage.js` is not a preference either: `card.js` owns the reader that finds that link and fetches it, `rbCard.data(who, cb)`, and `stage.js` calls it on load rather than only on the first click. A page that shows cards without drawing a graph reads the model with the same call and gets the same error message; that is why there is one reader and not one per page. A page that only shows cards, blust.ch's timeline, loads `card.js` alone and names no data.

Such a page has to be served over `http` rather than opened from disk, because `fetch` from a `file://` page is blocked and the stage draws nothing without its data. `npm run og` starts its own server for that reason; looking at a page by hand needs one too.

```jsonc
// package.json
"scripts": {
  "design": "design sync",
  "design:check": "design sync --check"
},
"devDependencies": { "@robertblust/design": "github:robertblust/design#v0.1.0" }
```

The ref is a tag, not a range, for the same reason the sites pin `"d3": "7.9.0"` exactly: this package's bytes end up committed in the consuming repository, so the version should be a visible, reviewable line, not a range that can move under a lockfile refresh. `npm ci` records the resolved commit SHA in the lockfile, so installs stay reproducible. The repository is public, so installing it needs no token, no login and no npm account.

`npm run design:check` runs in CI after `npm ci` and before `npm run verify`.

## The card harness

Four modules under `cards/`, imported rather than generated. The rule at the top of this file decides that: a visitor never downloads any of them, only CI and a developer run them.

```jsonc
"scripts": {
  "og":       "node export-og.mjs",
  "og:check": "node og-check.mjs",
  "test:og":  "node --test verify/og-recipe.test.mjs"
}
```

| module | what it is |
| --- | --- |
| `cards/recipe` | `sources`, `recipe`, `stampOf`, `state`, `stamp`, and `recipeFor(root)` which binds them |
| `cards/check` | `checkCards(recipeModule)` — staleness and the dark-background check; returns a count |
| `cards/export` | `exportCards({ chromium, recipe })` — the renderer; takes a `chromium`, never imports one |
| `cards/recipe-tests` | `checkRecipe(recipeModule)` — 32 shared assertions about a site's recipe |
| `decks/export` | `exportDecks({ chromium, PDFDocument, root, decks })` — renders each deck to a 16:9 PDF fallback; takes a `chromium` and a `PDFDocument`, never imports either |

A site keeps one file with real content — `og-recipe.mjs`, holding its `REPO_ROOT`, its frame, its hide rules and its card list — and three thin callers:

```js
// og-recipe.mjs — the data stays here, and so does REPO_ROOT
export const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const cards = [ /* this site's cards */ ];
export const { sources, recipe, stampOf, state, stamp } = recipeFor(REPO_ROOT);
```

**`REPO_ROOT` belongs to the site, and `root` is always a parameter here.** A package module that works out where it is resolves inside `node_modules`; that shipped once already, as `SITE_ROOT` in `verify/design.mjs`, and cost a release to undo.

**Bind through `recipeFor`, not `export * from`.** Re-exporting the raw functions leaves `root` unbound and `state()` throws for the site's own callers. And the specifier carries no `.mjs`: the `exports` map has no suffixed entry, so `…/cards/recipe.mjs` raises `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Copy each site's `FRAME` verbatim.** The recipe hashes every key of a card, so one added key moves every `og.sha` in that repository. No two sites' frames are interchangeable: blust.ch and companygraph.io carry `clipY` and no `deviceScaleFactor`, guestgraph.io the reverse.

**`og:check` and `test:og` run after `npm ci`.** They import this package, which is not on disk before that. They still run before `npx playwright install`, because `cards/check.mjs` imports only `node:` builtins and needs no browser — a property asserted by importing it from a child process in a directory with no `node_modules` above it, rather than by grepping for imports.

## Fences

Beside the whole files this package copies into a site, some of its blocks live *inside* a page: a fence is a pair of comment markers the page already carries — `design tokens`, `header contract`, `title contract`, `stage contract`, `prose reset`, `language`, `theme boot`, `theme`, `nav fit`, `prose footer`, `deck transport`, `deck lockup`, `deck fit`, `deck runtime`, `team`, `surfaces`, `surfaces lineage`, `principles` and `model card` — and the package owns everything between and including them, prose, version and CSS alike. That is the whole reason a fence is not just another synced file: a synced file is copied whole, but a fenced block sits in the middle of a page the tool never fully owns, so the markers are what tell it exactly where its part starts and stops.

Editing a fenced block by hand does nothing that lasts. The next `npm run design` reads the markers, finds the package's own version underneath, and overwrites whatever is between them — the block is generated, not maintained in place. The block to change is the one in `blocks/` in this repository; a page only ever carries a copy of it.

The `design tokens` fence is the one exception with a choice attached: its opening line carries a variant word, `page` or `deck`. A prose page closes its `:root` inside the fence, because nothing after it adds more tokens; a deck leaves the brace open, because the deck still has tokens of its own to declare once the shared ones end. That word is how the tool knows which shape to write back — it is read off the page, never guessed, so a page that forgets it or gets it wrong is an error, not a silent wrong render.

A site opts a page into a fence by putting the markers in it — there is no list of pages this package tracks or needs to know about. The absence of a fence is itself the only state that matters.

Taking a block out of the package works the same way in reverse: delete its fence from the page, and from then on the page owns that CSS outright. That is a visible decision, made in the page's own diff, to diverge from the shared copy — not a way to make a red `design:check` go quiet without deciding anything.

## The model pages

Principles, Team and Surfaces are pages generated from an instance's model rather than written by hand, wherever a site carries them. The exports below do the writing and the fences below carry the result into the page; a page opts into any of them the same way it opts into any fence, by carrying its markers, and a page carrying none of them is untouched.

| export | what it writes |
| --- | --- |
| `render/note` | `NOTE_EN` and `NOTE_DE` — the one sentence, shared by the writers below it, saying why the region it sits in does not translate |
| `render/principles` | `writePrinciples` — the vision and the values into `principles/index.html` |
| `render/team` | `writeTeam` — the note, the head rail, one board per process with its legend, and the phases in words into `team/index.html` |
| `render/surfaces` | `writeSurfaces` — the model, its makers and their surfaces into `surfaces/index.html` |

Each writer takes `(data, { check, root })`. `root` is the site's own root, required rather than guessed from where the package sits, and a writer called without it throws the reason why; `check` reports the files it would change without writing them, as `design sync --check` does for the whole page.

`team`, `surfaces` and `principles` are each one page's own CSS and nothing else. `surfaces lineage` and `model card` are behavior instead. `surfaces lineage` draws the lineage and holds Surfaces's card glue together, because the two share state: the card in the panel is whichever surface is chosen, and choosing one redraws the wires too. `model card` is Team's card glue — the rows behind a board and the one Open-all over them. Both need a value the page declares above them in the same script, `STAGE_PAGE`, ending in `/`: the page that draws the model on the stage, where the links in a card go, a seat's on Team and a surface's on Surfaces; `model card` also needs `MODEL_CARD`, the name `card.js` reports a failed read under, declared the same way.

## No parameters

Every substitution this package makes comes from a value it owns: the variant word from a fixed set `lib/fences.mjs` declares, the version from `versions.json`, a part from a file beside the block. Nothing comes from the site. `design.config.json` names the groups a site takes and nothing else, and a key it does not name is an error that names the file and the key.

The storage keys are the family's. `lang` and `theme`, the words the address already carries, are what every page on the three origins reads and writes, and they are written into the blocks rather than chosen per site: a storage key is a promise to every visitor, it is one promise across three origins, and a promise the package makes is one no site can quietly make differently. Renaming a storage key starts every visitor over, so a rename is a release whose notes say so, never a site's diff.

`FAMILY`, the regex naming the three domains a language rides between, is exported from `lib/family.mjs` and the sites import it: a site that could set its own would be a site that could quietly stop carrying the language to one of its siblings.

## Spelling

Everything here is American English — core's R14 applied to a package whose comments are copied into sixteen pages on three domains, where the sites' own rule is that every word of a page is en-US. `test/spelling.test.mjs` scans what ships (`blocks`, `lib`, `verify`, `cards`, `decks`, `bin`, `assets/stage.js`, this file) against a list of British forms and fails on the first hit. It is a list, not a dictionary: a false positive is a word to add to its allow list, never a reason to reword a sentence. German inside a block belongs to the block's `data-de` or `de:` branch and is not English at all; the scanner sees so little of it that no exception has been needed.

The sites' `translates` check — the one shared check that presses DE and reads the German — is here in `verify/pages.mjs` beside the rest, so the German half of every page in the family is seen by the same code. After the toggle it also holds the German `<title>` and meta description to WRITING.md's German marks, because those are script strings the cold scan in `typography` never sees; `typography` holds the English pair the same way, since both live in the head outside the body it reads. A spec's `shows` and `hides` sample three strings a page, so after the toggle the check also walks every element carrying `data-de` and every one carrying `data-de-aria` and names any that kept its English: a translation the list never quotes, or one a script rewrote after the switch, fails here instead of shipping. The `data-de-aria` labels are applied by the language block itself, which watches `<html lang>` and writes the label for the language into every such element, the English captured on load as `data-en-aria`; a page adds nothing to its own switch to get it.

## Crawlers

A site tells crawlers about its own changes in two ways, and both come from here so they cannot disagree about which page changed. A page is the `index.html` its sitemap URL is served from, and it changed when that file did or when the data its `<link data-stage>` names did. The second half matters because a stage page's markup never varies: a new model reaches the visitor while the page's HTML stays the same, and companygraph.io's `/example/` draws `example.json`, not the model.

`design sitemap` writes each URL's `<lastmod>` from git, the author date in UTC of the last commit that changed the page, and `design sitemap --check` fails when a date has moved. A crawler uses the date only while it stays accurate, and a date typed by hand is accurate on the day it is typed. A page edited and not yet committed is dated today, so the order is edit, `npm run sitemap`, commit both. The date is the commit's, not the merge's. The check refuses a shallow clone, where one commit would be every page's last change, so the site's `verify` job checks out with `fetch-depth: 0`, and it runs after `npm ci` because the command arrives from this package.

`design indexnow <base> <head>` sends the pages changed between two commits to IndexNow, which reaches Bing, Yandex, Seznam, Naver and Yep; Google does not take part. Only changed pages are sent, because an engine told about unchanged pages on every deploy learns to ignore the site, and a range that changes no page sends nothing. `--dry-run` prints the list and sends nothing.

What stays in the site is what differs per host: the key, a file at the root named for its own 32 hex characters and containing them, public by design and committed; and a workflow that runs when `pages-build-deployment` succeeds, not on push, so the engines never fetch the page being replaced. Every change reaches `main` as a merge commit, so the range is the merge's first parent to the merge.

```yaml
# .github/workflows/indexnow.yml
on:
  workflow_run: { workflows: [pages-build-deployment], types: [completed] }
  workflow_dispatch:
    inputs: { base: { required: true }, head: { required: true, default: main } }
permissions: { contents: read }
jobs:
  indexnow:
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v7
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - env:
          BASE: ${{ inputs.base || format('{0}^1', github.event.workflow_run.head_sha) }}
          HEAD: ${{ inputs.head || github.event.workflow_run.head_sha }}
        run: npx design indexnow "$BASE" "$HEAD"
```

## Links

A link either lands or it does not, and the checks above never ask: they forbid a shape of link or require a named one to be present. `design links` asks it of every link the site owns and fails the build when one does not land. `design links --external` asks it of every other link once a week and reports what it finds, because a dead page elsewhere is news and not a reason to stop a deploy.

What is read is what a visitor meets. The command crawls from `sitemap.xml` in a browser and follows every own page it reaches, so a deck linked from a talks index is read without the sitemap naming it. It reads every `href` and `src`, every `url()` in a stylesheet, and every absolute URL in a `<meta content>` and in JSON-LD. On every page carrying a `<link data-stage>` it opens the cards: each Open all is pressed, each surface on Surfaces is clicked, each node of a stage is focused by its hash. The data files those pages name are read for every absolute URL string in them.

A link is own when it is relative or on the host the site's `CNAME` names, and it lands when the checkout holds its file, or a folder's `index.html` for a path naming a folder, with or without the closing `/`, since GitHub Pages redirects the one to the other. **A fragment on a page that loads `stage.js` must name a node in that page's data** — an entity, the root, or a folder holding one — because a stage shown an id it does not hold draws its root and looks fine. A fragment anywhere else must name an element on the page after its scripts ran, or be `#top`, which a browser always finds. A run that loads no page or finds no own link fails too, since a check that read nothing has not passed.

An external link is asked with `HEAD`, then with `GET` whenever `HEAD` does not say yes, ten seconds each, one request per host at a time and four at once, with one retry. It is broken on a 404 or 410 to the `GET` or a host name that does not resolve, and unverifiable on anything else, a 401, 403, 429, 999, a 5xx, a timeout or a refused connection, which is how some hosts answer every script. The run keeps one issue titled "Broken external links": opened when something is broken, rewritten by every run, closed with a comment by the first run that finds nothing broken. It fails only when the check itself could not run.

Both modes drive the site's own Playwright, which the bin imports, and read the site served at `--base`, by default `http://127.0.0.1:8000`, where the site's CI already serves it. In `ci.yml`, after the step that runs `npm run verify`:

```yaml
      - name: Every own link resolves
        run: npx design links
```

And a workflow of its own, written by hand as `indexnow.yml` is, since a group only copies page assets:

```yaml
# .github/workflows/links.yml
name: links
on:
  schedule: [{ cron: "0 6 * * 1" }]
  workflow_dispatch:
permissions: { contents: read, issues: write }
jobs:
  links:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: python3 -m http.server 8000 > /dev/null 2>&1 &
      - env: { GITHUB_TOKEN: "${{ github.token }}" }
        run: npx design links --external
```

The last step needs no wait before it: the command waits for the server itself.

## A warning about `stage.js` and `card.js`

`stage.js` and `card.js` are the shared files no deck loads — a deck draws static SVG and has to open from `file://` with no network. **Never link a deck to `stage.js`, `card.js` or `stage.css`.** They are reached only by served prose pages, through a plain `<link>` and `<script src>`.

## Releasing

A release is a git tag and a GitHub Release, nothing more — there is no publish step. Every release still needs notes: Dependabot renders them into the pull request it opens in three repositories, and that pull request is the only thing telling someone there what changed.

A change to any synced file is at least a **minor** — it makes every site's committed copy stale. Before tagging, set `version` in `package.json` to the tag: `design sync --check` in every site compares the tag its pin names with the version of the package it installed and is red when they differ, so a tag made without moving the field turns three sites red on their next re-pin instead of drifting unread. A change needing a site edit beyond `npm run design` is a **major**. Dropping a file from a group is also a **major** — `applySync` never deletes an orphan a site already has.

`assets/d3.v7.min.js` is one such synced file, but it is also pinned as a real npm dependency in companygraph.io, whose own suite (`verify/instance.test.mjs`) asserts its committed copy matches its `node_modules/d3`. The two only stay consistent if d3 moves here first, tagged, and companygraph.io then takes that design release together with its own d3 Dependabot bump on one branch, running `npm run design` and re-vendoring by hand — a site edit beyond `npm run design` alone, which by the rule above makes a d3 bump a major here too, not a minor.

## `main` is protected

Three published sites pin this repository's tags, so a bad `main` is a bad release and a release is what the sites take. The `protect-main` ruleset requires a pull request and one green status check before anything lands, and it forbids deleting or force-pushing the branch.

**The ruleset requires two checks, `test` and `conventions / conventions`, not `CI`.** A ruleset names the *job id*. This repository's workflow is called `CI` and its single job is `test` — the reverse of the three sites, whose job is `verify`. Rename that job and the branch still looks protected while nothing ever reports again, which blocks every merge and hides the missing gate behind it. If the job is ever renamed, update the ruleset in the same change. The second check, `conventions / conventions`, is the shared job every member of the family runs, called from robertblust/conventions at the pinned tag.

Everything else about the ruleset is byte-identical to the three sites' own `protect-main`, deliberately: one shape to know, and a difference between them means one of them drifted rather than one of them is special. The context is the only field that legitimately differs, for the reason above. Repository admins can bypass, and all three merge methods are allowed, because that is what the sites do — so the ruleset stops an accident, not a decision.

Two conventions it therefore does not enforce, which hold anyway:

- **Merge with a merge commit, never a squash.** GitHub re-authors a squash to whoever
  pressed the button, which quietly launders the commit author that the `includeIf` blocks in
  `~/.gitconfig` exist to get right. `allowed_merge_methods` permits all three; use `merge`.
- **Do not push straight to `main`.** The admin bypass makes that possible for the one person
  who commits here. Open the pull request anyway — the status check is the point.
