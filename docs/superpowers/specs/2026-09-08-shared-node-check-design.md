# A node is identical wherever its @id appears — design

> One site-wide check in the shared suite: two pages of a site may not describe the same
> `@id` differently. Plus two places in the stage, a comment in `assets/stage.js` and a failure
> message in `verify/stage.mjs`, that name one site's build command in files three sites take.
> One minor release, three re-pins.

Status: proposed. Decided on 2026-09-08 against the three sites in production and this
repository at `main`. Every number below was counted, not estimated.

---

## 1. What is true today, measured

Counted against the live sites on 2026-09-08, after blust.ch and companygraph.io began
generating their JSON-LD.

| Site | Pages | Nodes appearing on more than one page | Held by |
|---|---|---|---|
| blust.ch | 9 | 27 — `#person`, `#model`, `#website`, nine each | `pages:check`, byte for byte, against one definition |
| companygraph.io | 7 | 14 — `#organization`, `#website`, seven each | nothing |
| guestgraph.io | 5 | 10 — `#organization`, `#website`, five each | nothing |

Two of those rows decide the work. **Twenty-four nodes are written by hand on more than one
page with nothing comparing the copies**, and the failure that produces is not hypothetical:
blust.ch published two descriptions of one person until 2026-09-08, because seven pages were
written from the model and two were typed, and no check could see across pages to notice. How
long that had stood was not measured; that it stood until someone counted the nodes by hand
was.

The third row is why this check is the weaker half of a pair, and the reason has to be written
down. `verify/suite.mjs` already deleted a page-against-page check — the token block used to be
compared page to page here, and `design:check` replaced it because asserting every page against
what this package ships is stronger than pages merely agreeing with each other. That reasoning
holds. It says to prefer a source when a site has one, not that agreement is worthless: blust.ch
has such a source now and will pass this check without it ever doing any work, while the two
sites that write these nodes by hand have no source to be checked against and no check at all.

## 2. What was decided

**A node is identical wherever its `@id` appears.** That is the rule, and it needs no
configuration, because the sites already encode the distinction themselves: a node belonging to
one page carries a page-specific id — `https://companygraph.io/model/#webpage` — while a node
describing the person, the site or the organization carries one id on every page. So the id is
the key, and a second shape under one key is a contradiction rather than a variant. The rule was
measured rather than reasoned, and measured twice, because the first count read only the
top-level `@graph` and the walk that shipped registers strictly more nodes than that: it was
re-run against the three sites under the shipped walk. Under that walk, every `@id` appearing on
more than one page of any of the three sites carries one shape today, so the check lands green
everywhere and with no false positive.

**It lives in `verify/suite.mjs`, in the block that runs after the page loop.** That block
already holds the checks which are not about any one page — the sitemap, the favicon, the
`robots.txt` sitemap references — and the file's own header names it as such. The page loop
gains one line, collecting each page's `ld+json` text; nothing else about the loop changes.

**Comparison is on a canonical form**, keys sorted recursively and arrays sorted by their own
canonical form, so what is compared is the node rather than its formatting. A JSON-LD list of
values is a set, so order is formatting too, and both hand-maintained sites carry a `sameAs` on
every repeated node. A node reached by two pages that differ only in key order or in list order
is the same node and this is not the check to fail it; a node whose `sameAs` gained an address
on one page is a different node after both sides are sorted and is what this exists to catch.

**A node without both `@id` and `@type` is skipped.** A bare `{ "@id": … }` is a pointer, not
a description, and `verify/pages.mjs` already requires every pointer to resolve within its own
document. Comparing pointers here would report the same thing twice in different words.

**A node inlined in part counts as a second shape, and that is deliberate.** An `author` block
carrying `@type`, `@id` and a name, beside a fuller node under that `@id` on another page, is
ordinary JSON-LD that every consumer merges — and it is reported here as a split, because
nothing in the documents tells an abbreviation from a disagreement and a comparison that
guessed would stop catching the drift this exists for. No page on the three sites does it today:
their cross-references are bare pointers, which are skipped. The remedy when it happens is on
the page, where the partial inline becomes a bare `{ "@id": … }` pointer at the one full
description, and the check's comment and its failure line both say so.

**The comment in `suite.mjs` says why this is the weaker half.** Eight lines above it sits the
note explaining why the token block's page-against-page check was deleted, and a reader who
finds that note and not this one will reasonably delete this check for the same reason. So the
new block states its own scope: where a site generates its graph from a source, that check is
stronger and this one is redundant; it earns its place where the nodes are written by hand.

**The stage stops naming a build command, in two files.** `assets/stage.js`'s comment reads
"the page's data block is empty until npm run example", which is companygraph.io's command from
before that site renamed it, and was never blust.ch's; `verify/stage.mjs`'s `graph` check hands
the same words to whoever meets an empty data block, in a failure message rather than a comment.
The bug is not the stale name: it is that a file three sites take names any one site's command.
Both become "the site's build has not written it", which is true everywhere and cannot go stale
again.

## 3. What each consumer has to do

The two halves cost different things, and the difference is worth stating because it decides
what a re-sync pull request contains.

**The check costs a re-pin and nothing else.** `verify/` is imported from `node_modules` rather
than copied into a site, and `runSuite`'s signature does not change — it still takes
`{ browser, SITE, BASE, PAGES, CHECKS, systemFaces }` and collects what it needs from the pages
it already loads. No site edits a check file, a spec or a page.

**The two comments cost `npm run design` and four share cards, the same as one would.**
`verify/stage.mjs` is imported from `node_modules` like the rest of `verify/`, so the second
file costs a re-pin and no card re-render: no page names it and no card hash reads it. The whole
cost is `assets/stage.js`, a file this package copies, listed in `lib/groups.mjs`, so a site
takes it by syncing. That changes the file's bytes, and this family's card recipe hashes every
local file a page names, so every page loading the stage reports its card stale. Four pages do:
blust.ch's `/model/` and `/timeline/`, companygraph.io's `/model/` and `/example/`.
guestgraph.io loads the stage on no page and takes only the check.

The cards re-render to the same picture — nothing visible changes — so what moves is each
`og.sha` stamp beside an unchanged `og.png`.

## 4. The release

One minor release, **v0.54.0**. `WORKING.md` makes any change another repository builds from at
least a minor, and this is one; nothing here asks a site to do more than re-pin and re-sync, so
it is not a major.

**No `versions.json` entry moves.** That file versions the fenced blocks this package writes
inside a page, and `"stage": "v2"` is `blocks/stage.css`'s contract. `assets/stage.js` is a
copied file with no fence and no version marker, and `verify/suite.mjs` is shipped code rather
than either.

Then three re-sync pull requests in the order `REPOSITORIES.md` gives: design first, then the
three sites.

## 5. What this does not change

`runSuite`'s signature, so no site's `verify/check.mjs` is touched. The `CHECKS` object and
every per-page check in `verify/pages.mjs`, including the `@id` resolution it already does
within a document. The fences, the tokens, the header contract, the cards' recipe. No page's
markup on any site.

Two things are deliberately out of scope. **The check cannot see across sites**, because a suite
runs against one `BASE`, and the four shapes of `https://blust.ch/#person` that were live across
the three sites this morning were a cross-site disagreement rather than a within-site one. That
was closed by making each site's copy minimal, not by a check, and no per-site check could have
found it. And **the siblings are not given a generator**: their repeated nodes are static
constants, and a renderer plus a committed definition plus a CI restructure is more machinery
than six lines of constants per node deserve.

## 6. How it is verified

The check is unit-tested against `test/suite.test.mjs`'s existing fake browser, which is why
this is testable at all: `runSuite` returns a failure count rather than exiting. One thing about
that harness has to change — `fakePage().evaluate()` returns `null` today, so the collection has
to tolerate a page that answers nothing, and the fake needs a way to answer with a graph so the
comparison can be exercised.

Seven cases: a site whose repeated nodes agree passes; a site where one page's copy of a node
differs fails and names the `@id`, the keys they differ on and the disagreeing pages; a node
appearing on one page only is ignored; a bare pointer is not compared against the node it points
at; a node inlined under a property is compared like any other, which is the case that proves
the walk reaches inside a property; a `sameAs` listed in a different order passes; and a
`sameAs` that gained an entry still fails.

Then the check is run against all three sites as they stand, where it must report no failure —
if it fails on a site today, either the rule is wrong or a site has drift nobody knew about, and
both are worth knowing before this ships.
