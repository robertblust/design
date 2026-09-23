# The links in an answer

Status: approved by the owner on 2026-09-23 from a rendered sample of both variants, the decisions below taken; the build waits until the files design, `2026-09-23-shared-css-as-files-design.md`, has landed on blust.ch and companygraph.io. Decided on 2026-09-23 against `robertblust/design` at v0.80.0, `companygraph/chat-server` at v0.6.1, `robertblust/robertblust.github.io` and `companygraph/companygraph.github.io` as read that day, which are the source of every fact below about what exists.

## Why now

The owner read an answer of the chat on blust.ch and saw two kinds of link that do not agree with each other or with the site. The names in the text are white with an underline, which is no link the family draws: a page sets `a{color:inherit}` and then styles every link by its place, the nav dim with a hairline on hover, the footer in the accent with an underline on hover, a card's model links in the accent over a faint rule. `chat.css` has no rule for a link inside `.rbchat-body`, so a name in the text falls through to the browser's default over the page's inherited ink. The line under the answer, "From the model", follows the footer's pattern and so looks like another thing.

The two are two things by the chat server's design, and the difference is worth keeping but not worth showing twice. A `cite` is an entity the answer was read from whole, one call of `get_entity`, `fetch` or `find_evidence`, and it carries the file's URL on GitHub at the commit the host serves; it is the receipt for the rule that every claim comes from a tool's answer, and it is absent when an answer was written from lists alone. A `name` is an entity a list answer mentioned, linked where the text writes it, with an id and a title and no URL. The server keeps the two sets disjoint, so a cited entity's title can stand plain in the prose above the line that cites it, which a reader sees as an inconsistency and not as a distinction.

And the URL was going unused. Every cite names the file at the commit, the one address that lets a reader check the answer against its source without trusting the chat, and the widget threw it away.

## The shape

Three changes to the `chat` group, and nothing outside it in this package.

**One link, the card's.** A link in `.rbchat-body` and a title on the cite line take the treatment of a card's model link, `.cbody a.go` in `stage.css`: the accent, no underline, a bottom border in `--c-weak`, and on hover or focus the firm accent with the border in `--c-mid`. It is the nearest sibling, a body of prose linking into the model, and it is the same in both themes because it is written in tokens.

**A cited entity is linked in the text too.** `nameLinks` walks the answer for the cites as well as the names, so no title stands plain above the line that cites it. A cite links to where a name links, the model page with the id as the hash and the stage expanded, which `link()` already builds.

**The line under the answer.** The words "From the model" give way to the site's own icon, read from the page's `<link rel="icon">` and drawn at sixteen pixels; the words become the icon's accessible name and its tooltip, in both languages. Each cite keeps its title as a link to the model page, and gains after it the GitHub mark, at fourteen pixels in `--dim` and in `--ink` on hover, linking to the cite's `url`; its accessible name and tooltip are the title, the words "on GitHub" and the commit's first seven characters, read from the URL's `blob/<sha>/` segment. A cite whose `url` is null gets no mark. A page that declares no icon keeps the words, so the line is never a bare list. The icon stands once, at the head of the line: it labels the whole line, and a line that repeated it before every title was drawn and declined for the width it costs in a panel that is twenty-six rem on a desk and the whole screen on a phone.

The mark is GitHub's own, the Octicon `mark-github`, inlined as SVG in `chat.js` the way the widget's other glyphs are, so the page loads nothing. Octicons are MIT and GitHub's guidelines allow the mark for a link to GitHub, which is the one thing it does here.

## What has to change with it

**companygraph.io names its home page.** The widget links a cite into the page its tag names in `data-model`, and both companygraph.io pages that carry the tag say `/model/`. On that site `/model/` draws the meta-model's vocabulary from its own file, while the stage that draws the company's instance, the one `mcp.companygraph.io` serves, is the home page. So every cite there opens the wrong graph today. The site sets `data-model="/"` on every page that carries the tag, in its own pull request, and its page check proves that a cite's address opens the card on the home stage. blust.ch's `/model/` is right as it is.

**The README** says, in the chat paragraph, what the line shows and that the icon is the page's own, so a site that wants one there declares one in its head and adds nothing to the tag.

**The strings** gain the two labels in English and, as drafts for the translator, in German, beside "From the model" and "Aus dem Modell", which stay as the icon's name.

**The tests** in `test/chat.test.mjs` hold the pure parts, and `citeLine` becomes one: exported on `rbChat` beside `nameLinks`, taking the cites, the model page, the icon's address or null and a document, so it runs on the stub. The cases: the line opens with the icon where the page has one and with the words where it has none; every cite has a title link to `link(model, id)`; a cite with a URL has a mark whose address is that URL and whose name carries the title and the seven-character commit, and a cite whose URL is null has none; `nameLinks` links a cite's title in the text as it links a name's. The rendering check in the review looks at the panel on both sites in both themes, at the desk's width and the phone's.

## What this is not

Not a change to the chat server or the MCP server: the cite already carries the URL, and nothing here needs a field that is not there. Not a GitHub mark on every name in the text, which the owner considered and set aside: a name carries no URL, so the mark would need one from the chat server and, for a list's entries and an edge's ends, from the MCP server's shapes, and two glyphs after every name in running prose would cost the panel its width on a phone. If the owner wants it later, that is a spec in the two servers first. Not a change to what a cite or a name is.

## The order

After the files design has landed on the two sites that run the chat, so that their re-pins do not interleave; this package's change touches `chat.js`, `chat.css`, the README and one test file, which that design leaves as they are. Then one release of this package, the next minor after whatever `main` carries, additive for a site: blust.ch re-pins; companygraph.io re-pins and sets its attribute. Merging, the tag and the re-pins each wait for the owner's word.

## Decisions

Taken by the owner on 2026-09-23 from the sample: the icon once at the head of the line rather than before every title; the line stays, as the receipt, rather than folding into the text; no icons in the text; the GitHub mark on names deferred to the servers.
