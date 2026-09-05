# Page typography — design

> `WRITING.md` says how German and English are set. The pages were written before it said
> so, and no check reads the German half of a page at all. One shared page check, one line
> in `stage.js`, and one sweep per site, with the narration clips that follow from it.

Status: proposed. Adds a `typography` check to `verify/pages.mjs`, required on every page the
way `seo` is; changes `fmtPeriod` in `assets/stage.js`. Lands as **v0.28.0**. Each site then
takes it in one pull request: the sync, `typography: true` on every page, the sweep of its
German and English text, the regenerated German clips, the PDFs and cards, and one rule in its
agent file. The rule itself is `conventions/WRITING.md`, sections *English* and *German*; this
file restates none of it.

---

## 1. The finding

Measured on 2026-09-05 across the 20 pages of the three sites, inside every `data-de` and
`data-notes-de` value:

| | blust.ch | guestgraph.io | companygraph.io | family |
|---|---|---|---|---|
| German „…“ pairs, where the rule says «…» | 16 | 4 | 2 | 22 |
| German em-dashes, where the rule says a spaced en-dash | 47 | 52 | 64 | 163 |
| German speaker notes touched by either | 11 of 12 | 11 of 12 | 12 of 12 | 34 of 36 |
| English spaced en-dashes, where the rule says a spaced em-dash | 81 | 0 | 0 | 81 |

ß does not occur, and every German page addresses the reader as Sie. Nothing holds any of
this: the family's prose check reads Markdown, and this text is HTML attribute values that only
the sites' Playwright suites reach, which have no typography check. The Markdown rule is
enforced in every member; the page rule is enforced nowhere.

## 2. What was decided

**The check lives in design, the rule in conventions.** Conventions owns the words and points
nowhere downstream; design owns the mechanisms the sites run. `typography` joins the shared page
checks in `verify/pages.mjs` beside `translates`, and every site runs it from the pinned
release.

**The British stems are read from the vendored script, not copied.** Every site carries
`conventions/conventions-check`, whose `STEMS=` line is the family's one list. The page check
parses that line at run time and fails when the file or the line is absent: a site without a
vendored conventions is not a member and has no business passing. One list, no drift.

**Required on every page.** The runner refuses a `PAGES` entry without `typography: true`, the
way it refuses one without `seo`, so a page cannot opt out by omission.

**Both halves, each from where it lives.** English is read from the body's `textContent` with
code, scripts and styles removed, every slide of a deck included, not only the one shown.
English speaker notes are `data-notes` values the DOM never shows either, so they are read from
the same cold source as the German, with the English rules. German is read from the
cold-fetched source, every `data-de` and `data-notes-de` value, the way `sourceLang` and
`noNewTab` reach the half the DOM never shows. `<code>` and `<pre>` content is dropped on both
sides: mono means data, and a record value or a URL is not prose.

**The sweep is mechanical where it can be and read where it cannot.** Quotes and dashes are
mechanical inside attributes. The serial comma stays a reading task, as the family decided.

**The clips regenerate.** A note's clip caches on a hash of its text; 34 of 36 German notes
change, so 34 German clips are regenerated. On blust.ch, 49 English notes carry a spaced
en-dash, so their 49 English clips regenerate too.

**The agent files' quote rule changes with the pages.** Each site's rule *German quotes must be
typographic, „…“* becomes guillemets, with the same reason: nothing in «…» can end an
attribute.

## 3. The check

`typography(page, spec)` in `verify/pages.mjs`, placed before `translates`, which is the one
check that changes what the others read.

**English.** `document.body.innerText` after `<code>`, `<pre>` and `<script>` are removed from
a clone of the body. Fails on a spaced en-dash, ` – `; on „, « or »; and on any British stem
from the vendored list, matched case-insensitively as a JavaScript regular expression — the
list's `([^a-z]|$)` anchors are ERE that JavaScript reads the same way.

**The cold source.** `fetch(spec.absolute)` for the raw source, every `data-de`, `data-notes-de`
and `data-notes` value, each value stripped of `<code>` and tags first and decoded second,
because a decoded `&lt;` would read as a tag and take the prose after it along; each value is
scanned on its own so a hit's context stays inside the attribute it came from, and `data-notes`
takes the English rules where the other two take the German rules. Fails on ß; on any of „ “ ”;
on an em-dash; and on a du-form, `du`, `dich`, `dir`, `dein` with its endings, as whole words.

**The stem list.** Read once per check from `conventions/conventions-check` at the site's root
with `fetch`, the line matching `^STEMS='(.*)'$`. Missing file or line: the check fails with
`no vendored conventions-check — this site is not a member`.

**Messages.** One entry per hit, joined by `; ` as the other checks join theirs, `[en]` or `[de]`, the offending character or word, and forty
characters of context on each side, because a report that says only *typography failed* sends
the reader on the search the check exists to end. All hits are listed, not the first.

**The runner.** `verify/suite.mjs` gains the guard: every entry in `PAGES` must carry
`typography: true`, or the suite fails naming the pages that do not.

**`stage.js`.** `fmtPeriod` sets the range dash per language: `May 2012–Oct 2016` closed in
English, `Mai 2012 – Okt 2016` spaced in German, and an open range closes or spaces the same
way, `May 2012–now` and `Mai 2012 – heute`, because the English rule has no exception for an
open end. `fmtDate` is unchanged since 0.26.0, and German months keep the three-letter form it
has always printed; the period WRITING.md gives them is a date change, and dates are out of
scope here.

**Tests.** In `test/verify-pages.test.mjs`: `typography` is in the exported set and sits
before `translates`; its source reads the stems from `conventions/conventions-check` and not
from a literal; it reads German from `fetch(spec.absolute)` and English from the clone's
`textContent`; and English notes from the same cold source; it drops `<code>`. In
`test/suite.test.mjs`: a `PAGES` entry without
`typography` fails the run. Inline fixture strings with one hit of each kind prove each
message once; there is no fixture file.

## 4. The sweep, per site

In each site's pull request, after `npm run design` and `typography: true` on every page:

- **German quotes.** Every „…“ pair inside a `data-de` or `data-notes-de` becomes «…»; a quote
  nested inside one becomes ‹…›. 22 pairs in the family.
- **German dashes.** Every em-dash inside those attributes becomes a spaced en-dash; a closed
  em-dash gains its spaces. 163 in the family.
- **English dashes.** Every spaced en-dash in English page text and in `data-notes` becomes a
  spaced em-dash, except a numeric or date range, which becomes a closed en-dash. 81, all on
  blust.ch.
- **The serial comma.** A reading pass over the English page text, on the order of eighty
  lists, corrected by hand and reviewed in the diff.
- **Narration.** `./tts/generate.py --dry-run` names every clip whose text moved, German and
  English; `generate.py` writes them, with `ELEVENLABS_API_KEY` pulled in as the site's agent
  file says. On blust.ch the English clips move because their notes carried spaced en-dashes; a
  dry run naming an English clip on the other two sites, where none is expected, is the sign
  that English text was touched by mistake.
- **PDFs and cards.** `npm run pdf` and `npm run og`, both files committed with the pages.
- **The agent file.** The quote rule rewritten for guillemets; the section on notes living in
  attributes keeps its other two rules.
- **Green.** `npm run verify` with the new check on every page, `og:check`, `design:check`,
  and the narration dry run reporting nothing to write.

Order: blust.ch, guestgraph.io, companygraph.io, as `REPOSITORIES.md` lists the sites.

## 5. Release

v0.28.0. `stage.js` is a synced file and the check is new, which makes it a minor by the
README's rule; every site also has to add `typography: true` to each `PAGES` entry, which the
README calls a major, and in 0.x that is the minor with notes that name the edit. The notes
list the sweep a site does when it takes the release, and the number of clips it regenerates.

## 6. What this is not

Not a rule: every rule here is `WRITING.md`'s. Not a change to conventions, whose prose check
keeps reading Markdown only. Not a language-aware scan of Markdown, which stays `exclude`'s job.
Not an automated serial comma. Not a change to dates, which have read en-US since 0.26.0.
