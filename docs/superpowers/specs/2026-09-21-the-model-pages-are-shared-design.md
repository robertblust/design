# The model pages are shared — design

> Principles, Team and Surfaces are three pages generated from a model, and they exist only on blust.ch. A second instance now wants the same three pages. They move into this package the way the stage did: the renderers become exports, the page code becomes fences, and each site keeps the page shell — its title, its tagline, its German — around a region the package writes.

Status: proposed. Decided on 2026-09-21 against this repository at v0.67.0 and blust.ch at `b97bd1d`. Every number below was counted, not estimated.

---

## 1. What is true today, measured

| Fact | Value |
| --- | --- |
| Where the three renderers live | blust.ch `build/principles.mjs` (135 lines), `build/team.mjs` (204), `build/surfaces.mjs` (124), with `build/note.mjs` (11) shared by all three |
| How a renderer gets the model | `build/pages.mjs` reads `model.json` and passes the parsed data in; no renderer opens a file by name |
| Site-specific strings in the three pages' scripts | **none** — every mention of the family's names sits inside a fence this package already writes |
| Page script that is not one of this package's fences | Principles: **none**. Team: `ensure`, `fromHash`, `goLink`, `label`. Surfaces: `at`, `curve`, `draw`, `fromHash`, `goLink`, `select`, `show` |
| Script Team and Surfaces both carry today | `fromHash` and `goLink`, the card fetched on demand — the same logic twice in one repository |
| Fences each page already carries | the header, title, prose, language, theme and nav-fit fences; Team and Surfaces also carry the stage contract, for the card |
| `team.mjs` on a model with more than one process | throws: `the model holds N processes; the board draws one` |
| `team.mjs` on a seat no profile holds | the seat does not appear; the board is built from profiles that list roles, and throws when none do |
| `surfaces.mjs` without `repo` in the artifact | throws: `model.json names no repository to draw as the model` |

Three rows decide the work.

**The renderers are already model-generic.** They read types — `profile`, `role`, `phase`, `process`, `surface` — and never a name from any one model, and they are handed the artifact rather than reading it. Nothing about them is blust.ch's except where they happen to be kept.

**The page code that is not already shared is small and partly duplicated.** Principles carries no script of its own. What Team and Surfaces carry beyond the fences is the card fetched on demand, written twice, and the lineage drawn between the Surfaces nodes.

**Team cannot draw a second instance as it stands, twice over.** companygraph.io's instance has three processes, and it names a seat's holder only for the seats an agent holds — a seat no profile names is held by a person, by that instance's own rule. The first makes the renderer throw; the second would make it drop the people silently, which is the worse of the two.

## 2. What was decided

**The three renderers become exports of this package.**

```js
import { writePrinciples } from "@robertblust/design/render/principles";
import { writeTeam } from "@robertblust/design/render/team";
import { writeSurfaces } from "@robertblust/design/render/surfaces";
```

Each keeps the signature it has: `(data, { check })`, returning the files it would change. The artifact is whatever the site passes, so blust.ch goes on passing its `model.json` and companygraph.io passes `company.json`, because on that site `model.json` is the vocabulary rather than an instance. The one error message that names `model.json` names the artifact instead. The sentence saying why a generated region is not translated moves with them, as `@robertblust/design/render/note`, since it is already the same sentence on every page that carries it and one home is the point of it.

**The page code becomes fences, and the card logic is written once.** The code each page carries beyond the existing fences is inline today, in its own `<style>` and `<script>`, so it moves the way inline code already moves in this package: as fences, which `design sync` writes between markers a page carries and `design sync --check` holds to the package. Groups are the other mechanism — whole files copied to a site's root and linked from the page — and they would take code that is inline today out of the page into a request of its own, changing every page's shell to do it. A page opts into a fence by carrying its markers, so no site's `design.config.json` changes. The behavior lives in the fence and the model's data stays the page's, which is the boundary the stage and the deck runtime already keep. The card glue Team and Surfaces each carry today — the entity read from the address, and the link that focuses it — becomes one fence both pages carry, so the duplicate ends in the move rather than being copied into the package.

**Each site keeps its page shell.** The title, the tagline, the German, the nav and the region markers stay in the site's own page. The package writes between `<!-- principles:start -->` and its end marker, as blust.ch's renderers do today, and never outside it. What a page argues is the site's to write; how a model becomes that page is this package's.

**Team draws one board per process.** Each process in the model gets its own board — its phases as the columns, the seats that process names as the rows — stacked in the order the artifact lists them. No process carries a rank, so that order is the parser's, deterministic and the same on every build; a site cannot choose another without a field core does not declare, and inventing one here would be a ranking nobody wrote down. A model with one process draws the one board it draws today.

**Team draws a seat no profile holds as held by a person.** A seat named by a profile is drawn as it is today, with that profile's `nature`. A seat named by no profile is drawn as `human`, with no name beside it, because the only instance where that happens says so: what holds a seat is said by a profile listing it, and a seat no profile lists is held by a person. The board no longer throws when no profile holds a role; it throws only when the model holds no role at all.

**Surfaces reads `repo` from the artifact as it does today.** blust.ch's artifact carries it. companygraph.io's must, and the plan that builds it already says so.

## 3. What each consumer has to do

**blust.ch** re-pins to the release, puts the new fences' markers around the inline code its three pages carry today, deletes `build/principles.mjs`, `build/team.mjs`, `build/surfaces.mjs` and `build/note.mjs`, imports the three writers from the package in `build/pages.mjs`, and runs `npm run design` and `npm run pages`. Its generated regions must then come out byte-identical to what is committed today, and the code inside the new fences must be the code that was there before the markers went round it — see §6.

**companygraph.io** does nothing until it chooses to carry the pages. Adopting them is its own plan, which needs this release and its own instance artifact first.

**guestgraph.io** does nothing. It draws no model, so none of its pages carries these markers.

## 4. The release

A minor release, v0.68.0. Everything here is added: three exports and the fences, none of which a site receives until one of its pages carries the markers. A site that re-syncs without them gets nothing new, and blust.ch's switch to the shared code is a change it makes in its own repository after taking the release, not one the release makes for it.

The notes say what blust.ch has to do to adopt it and that nothing else needs to move.

## 5. What this does not change

- The stage. Team and Surfaces go on including its contract for the card, as they do now.
- `/model/` and `/timeline/` on blust.ch, and `/model/` and `/example/` on companygraph.io, which draw the stage and none of these three pages.
- How a page is checked. `pages:check` goes on comparing the generated regions against the committed HTML, and nothing in the page suites changes.
- What any page says. The titles, taglines and German stay each site's own and are not generated.

## 6. How it is verified

**The extraction is proven by blust.ch not changing.** After blust.ch adopts the release, `npm run pages:check` must pass against the pages committed today, before any of them is rebuilt. That compares every generated region byte for byte, so a renderer that moved and behaves differently fails there, without anyone reading a diff. It covers the renderers and nothing else; the page code is proven separately, below.

**The two new behaviors are proven by tests in this package, against fixtures.** A fixture model with two processes renders two boards, in model order, each holding only the seats its process names. A fixture with a seat no profile lists renders that seat as `human` with no name. A fixture with one process and every seat named renders exactly what blust.ch's board renders today, which is the same claim the byte-identical check makes from the other side.

**The fences are proven the way every fence is.** `test/fences.test.mjs` holds each new block to the version `versions.json` declares for it, `design sync --check` holds every copy to the package, and the spelling test that holds this package's shipped files to American English covers the new ones. That the move changed no behavior on the page is proven twice: the code inside each new fence on blust.ch is byte for byte the code that was inline there before the markers went round it, and blust.ch's own page suite, which clicks through the board, the lineage and the cards, passes unchanged.
