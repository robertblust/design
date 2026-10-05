# The privacy page draws the model — design

> Each site's privacy page draws what its model holds about personal data — the keys a visitor's browser keeps, the processing activities, and the data processors each activity hands data to — as a lineage like /surfaces/, generated from the model at the commit the site pins. Every vendor, key, country and period then lives once, in the model, and a page that names less than the model holds stops the build.

Status: proposed. Written on 2026-10-05 against this repository at `70c1e74` (v0.140.0), from a prototype the owner approved the same day: companygraph.io's own privacy page, served locally, with the /surfaces/ lineage block filled from its `company.json`. It carries out the Data protection decision each of the three instances made on 2026-10-04, that its site's privacy page is built from the model; the types it reads are core 0.60.0's `data-processor`, `processing-activity` and `stored-item`.

---

## 1. The gap

The three privacy pages are written by hand, in two languages, and had drifted from what the sites and the chats do: none named Google Cloud, which runs every chat and keeps its questions, none named the `chat-facts` key that `chat.js` writes, and each said "That is everything that gets stored". The facts now live in each instance's model, and a page that restates them by hand is a second copy that drifts again.

**What the change buys is a privacy page that cannot name less than its model holds, and a check that fails when the code stores a key the model does not.**

## 2. What the page draws

A region of `privacy/index.html`, between `<!-- privacy:start -->` and `<!-- privacy:end -->`, under the heading "Where your data goes", in the /surfaces/ lineage's shape: a root node on the left, groups in the middle, entries on the right, the wires drawn by the browser from where the nodes landed.

- **The root** is the visit: the label "On <site>", the name "Your visit", and the model's commit, as /surfaces/' root carries "The model", its name and its commit.
- **The storage groups**, one per `mechanism` the model's stored items use, in a fixed order: "Kept in your browser" for `local-storage`, "Kept in this tab" for `session-storage`, and, should a site ever use them, "Cookies", "IndexedDB" and "Cache". The group line says how long it lasts — "until you clear it", "until the tab closes" — and that nothing in it is sent on its own. They are drawn with /surfaces/' hand line, the dashed wire, because nothing builds or sends them. Each entry is a stored item: its key as the name, its tagline as the line under it.
- **The activity groups**, one per processing activity in the order the model lists them: the activity's name, and under it its legal basis and a short retention — the number of days the retention states, in digits, as "90 days", and "in your tab only" where it states that the data stays in the tab; a retention that states neither is drawn as written. They are drawn with the build line. Each entry is a row of the activity's `## Processors`: the processor's name, and under it its country and the row's `Receives`.
- **A processor's country** is its `countries`, joined. Where the processor's `processing` field is `any`, the line reads "any country · stored" and the countries, so a processor that runs a request wherever it chooses is never drawn as if it ran it in one country (section 6).
- **Under the drawing**, as on /surfaces/: the hint "Choose an entry to follow its line and read its card", a caption saying what the three columns are, and the provenance line naming the repository, the commit and the three folders the region was read from.

Choosing an entry draws its line and opens its card under the drawing — the shared model card, styled by `stage.css` exactly as on /surfaces/. A page's own `.card` rule must not reach it; the privacy page's "Not used at all" box takes a class of its own (section 8).

On a phone the lineage stacks into its nested lists, as /surfaces/ does.

## 3. The renderer

`lib/render/privacy.mjs`, exported as `render/privacy`:

- `pathOf(data)` returns the root, the groups and their entries from a model artifact — the same `{ entities }` shape `writeSurfaces` reads — with no HTML in it, so a test can hold the grouping and the rules apart from the markup.
- `writePrivacy(data, { root, check, de, site })` writes the region into `privacy/index.html` under `root`, English in the markup and each string's German in its `data-de`; with `check` it writes nothing and fails where the page differs from what it would write, as every writer here does. `site` is the host the root names.
- `privacyStrings(data)` returns every English string the region draws that comes from the model, for the translator, as `strings(data)` does for the principles.

It throws, naming the entity's path, where a stored item names no surface, where an activity's `## Processors` row names a processor the artifact lacks, where an activity has no `legal-basis`, and where the artifact holds none of the three types, because a privacy page drawn from a model with nothing in it would say the site keeps and sends nothing.

## 4. German

The region is translated, as the principles are and the team and surfaces boards are not: a privacy page is where a German-speaking visitor most needs the German. Each site keeps `build/privacy.de.json`, an array of `{ en, de }`, loaded with the existing `loadGerman`, so a model change that leaves a string without its German stops `npm run pages` and `pages:check` with the string named. The German is made by the roles of `conventions/WRITING.md` from `design german privacy <artifact>`, a new subcommand beside `german questions` that prints `privacyStrings` as JSON. The fixed words the renderer writes — the group names, "until you clear it", "any country · stored", the hint, the caption — are the package's, with their German in the renderer, as `NOTE_DE` is.

## 5. The checks

**`path`** in `verify/model-pages`, beside `board` and `lineage`: a page opts in with `path: true` on Privacy. It reads the region against the site's model artifact — every stored item, activity and processor row present, in order, with its card reachable — and fails where the drawing draws no wire, as `lineage` does. It names no type's entity, only the three types.

**`storageKeys`**, rewritten in `verify/pages.mjs`. Today it records what a page writes to storage while it clicks the language and theme toggles, and looks for each key in the privacy page's prose; it never opens the chat, which is how `chat-facts` went unseen. It now opens the chat panel as well, sending nothing, records every key written to `localStorage` and `sessionStorage`, and fails on a key with no stored item of that key and mechanism in the site's model artifact. A stored item the run never sees written is reported and not failed, because some keys are written only after a visitor acts — `chat-pictures` after an answer draws a figure, `chat-size` after the panel is resized. The prose it used to read is gone, so the check reads the artifact the site names, which is the one place the keys are now promised.

## 6. One field in core

The renderer cannot tell from `countries` alone that Anthropic runs a request wherever it chooses: the field names where it stores what it keeps, and the tagline says the rest in prose no renderer should parse. This design asks meta-model for one optional field on `data-processor`, `processing`, an enum `fixed` or `any`: `fixed`, the default, says the processor processes where `countries` says; `any` says it may process in any country it chooses and `countries` names where it stores. Anthropic's page in the three instances sets `processing: any`. That is a core minor of its own, specified in meta-model and released before this design's release; the renderer reads the field where it is present and treats it as `fixed` where it is not, so a site on an older core still builds.

## 7. The design system

The blocks and documents the other generated pages have, written for this one:

- `blocks/privacy.css`, the region's own rules beyond what the lineage shares, carried in `page.css` as `principles`, `team` and `surfaces` are;
- the lineage's drawing in `blocks/surfaces.js`, made the shared `lineage` behavior both pages fence, rather than a copy: the wires, the choice by click or by address, the card in the panel;
- the fences `privacy` and `privacy path`, versioned in `versions.json`;
- the README's table of generated pages gains `render/privacy`, and its checks paragraph gains `path`;
- `docs/design-system/README.md` gains a row for the privacy path, and `docs/design-system/blocks.md` a section "Privacy path" with its contract, beside "Surfaces lineage".

## 8. Each site

In each of companygraph.io, blust.ch and guestgraph.io, in one pull request:

- the site takes this release; `build/pages.mjs` calls `writePrivacy` after `writeSurfaces`, with the site's host;
- `privacy/index.html` carries the region in a section "Where your data goes" and its page opts into `path: true`;
- the two storage boxes and the paragraph "That is everything that gets stored…" go; the section "The chat" goes, and three sentences no model page holds open "Where your data goes": nothing is sent until the visitor presses send, a message refused before the model is never sent on, and what the chat answers comes from the model, names its entries and can be wrong; the "Not used at all" box's third-party item names the chat as the exception and points down to the drawing;
- the headline reads "This site collects **nothing** until you ask the chat.";
- the "Not used at all" box takes a class of its own in place of `.card`, so the shared card keeps one style;
- the hand-written English is the Writer's and its German the roles', and `build/privacy.de.json` is made by the roles from `design german privacy`.

The sentence "TypeSafe does not train its models on what it receives", which only the old prose carried, moves into the model: TypeSafe's tagline in each instance gains it, an entry like any other.

## 9. Tests

- `test/render.test.mjs` gains the privacy renderer's cases against a fixture model: the groups and their order, the retention words, the `processing: any` line and its absence, each failure with the path it names, and the German lookup failing on a string `privacy.de.json` lacks.
- `path` is shown failing on a page whose region leaves out a processor row, then passing.
- `storageKeys` is shown failing on a fixture page that writes a key its artifact lacks — the shape `chat-facts` had — and passing once the artifact holds it.
- Each site runs `pages:check` and `verify` as today, with `path: true` on Privacy.

## 10. Release and order

1. meta-model: the `processing` field, a core minor, with Anthropic's pages set in the three instances.
2. This repository: the renderer, the blocks, the checks and the documents, released as a minor.
3. Each site: the re-pin and section 8, one pull request each, after its instance carries the TypeSafe tagline.

## Out of scope

A cookie banner or a consent dialog: the sites set no cookie and nothing that needs consent. A type for independent recipients, which GitHub would be, and so drawing GitHub in the path; the page keeps its one sentence about the host. The imprint. A privacy page for a site that carries no chat.
