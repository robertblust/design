# Every home page shows its vision — design

> companygraph.io and guestgraph.io take what blust.ch's home page took on Sep 27, 2026: under each site's own opening, the vision with three ways to check it, then the values beside the line each will not cross, both rendered from the site's model; and /principles/ reads in German, held to the model's English. What blust.ch built for itself becomes the package's, so the three sites share one renderer, one German loader, one set of rules and one check.

Status: scope approved by the owner in conversation on 2026-09-27 ("yes looks good. go"): each site keeps its opening as it is, the two sections come under it, /principles/ turns German on both, companygraph.io first. This spec awaits the owner's review.

---

## 1. What changes where

| Where | What |
| --- | --- |
| design | `render/home` accepts a company's "We never" beside a person's "I never"; the German loader moves into the package as `render/german`; the home sections' rules become a fence `home`; the `home` check joins the shared page checks; one minor release |
| companygraph.io | its /principles/ German, the two sections under the opening, the check, the re-pin |
| guestgraph.io | the same, after companygraph.io has landed |
| blust.ch | takes the release: its own copies of the loader, the rules and the check give way to the package's; no page changes |

## 2. The pages

Each site's opening stays as it is: the headline, the tagline, the buttons and, on companygraph.io, the model's graph drawn under them. A product site asks its visitor to act, so its buttons stay; blust.ch's rule against a call to action was that page's brief and not this one's.

Under the opening, two sections in the form blust.ch's page has:

1. **The vision.** The kicker "The vision" / "Die Vision", the vision's name turned at its comma with the second half in the accent, its tagline, then three tiles. *Ask* opens the site's chat by `data-chat-open`. *See the model* links `model/`. The third is the page each site offers a visitor to read the thing itself: *See the example*, linking `example/`, on companygraph.io, a fictional company described in CompanyGraph; *Read the API*, linking `api/`, on guestgraph.io, which answers the value "Everything the engine does is on its API".
2. **The values.** The kicker "What we hold to" / "Woran wir uns halten", the heading "{n} values, each with the thing *we never do*." with its number word written from the model (Three on companygraph.io, Seven on guestgraph.io), then one row per value: its name, linking its anchor on /principles/, beside its "We never" line.

There is no newest post: neither site has a blog. A talk is not put in its place, because the rule that a talk is named on its index holds on every site.

## 3. The design package

**The "We never" line.** `neverOf` accepts a closing paragraph that begins "I never" or "We never", and refuses any other with the value's id. A model says which it is by what it writes, so the renderer needs no option; the heading's words are the site's, in `heading.en` and `heading.de`, as they already are.

**The German loader.** blust.ch's `build/german.mjs` moves to the package as `render/german`, exporting `loadGerman(file)` and `strings(data)` unchanged, with its tests. A site calls it from its own `build/pages.mjs` and keeps its German in its own `build/principles.de.json`, because the German is the site's translation of the site's model.

**The rules.** The rules for `.sec`, `.kicker`, `.values` and `.tiles`, which blust.ch carries in its page's own style, become a block `home.css` fenced into `page.css`, so a change to the tiles is made once. Classes and values stay as they are.

**The check.** blust.ch's `home` check moves into the shared page checks. It reads the site's model from the path a spec names (`model.json` on blust.ch and guestgraph.io, `company.json` on companygraph.io), compares the vision's heading and every value row's name and link with it, opens the chat from the Ask tile, and holds the stacking at 390px. The newest-post comparison stays blust.ch's own, run only where a spec names a blog.

**Release.** One minor. blust.ch takes it in its own pull request, dropping its three copies.

## 4. The German

Each site's model words, the vision's name, tagline, first section and each value's name, tagline and paragraphs, are translated by the roles of `conventions/WRITING.md`, the owner choosing among the editor's flags, as blust.ch's were. The site words, the kickers, the tiles and the heading, go through the same roles after the owner has read the English on the rendered page. /principles/ then carries the translated note, as blust.ch's does.

## 5. Order

1. design: the four changes, their tests, the release.
2. blust.ch: takes the release and drops its copies.
3. companygraph.io: German of the model's words, /principles/ in German, the two sections in English for the owner's review, their German, the check, cards, sitemap, one pull request.
4. guestgraph.io: the same.

## 6. Left out on purpose

- No blog and no newest post on either site.
- No German in the models; each stays written in English.
- The openings are not touched, the graph on companygraph.io's included.
