# The file header names its content, not the release

Status: proposed, for a later release. Decided on 2026-09-23 against `robertblust/design` at v0.80.3, whose files were read that day and are the source of every fact below about what exists.

## The fault

Each of the five assembled files, `tokens.css`, `page.css`, `page.js`, `deck.css` and `deck.js`, opens with a comment that names the package and its release: `@robertblust/design v0.80.3 — page.css, assembled from the shared blocks`. `lib/assemble.mjs` writes it, in `cssHeader` and `jsHeader`, from `package.json`'s version. So every release rewrites all five files by one line each, whether or not any block in them changed, and a site that re-pins commits five changed files for a release that rendered nothing differently.

The cost does not stop at the diff. The card recipe hashes every local file a page names, so the share-card stamp of every page moves on every release, and `og:check` demands a browser run over every page before the re-pin can land. blust.ch's move from v0.80.1 to v0.80.2, a release that changed one check and nothing a page renders, rewrote all five files and moved eleven stamps. `stage.css` and `chat.css` carry no such header and have never done this: they change only when they change.

The release number is in the header because `tokenVersion` reads it. That check holds a page's fenced tokens block to the version the installed package ships, and when a page stopped carrying the fence, the check was taught to read the linked `tokens.css` instead, and the thing put there for it to read was the release. It was the number to hand, not the number the check wanted.

## What the header says instead

The header names the blocks the file was assembled from, each with its own version from `versions.json`, which is the number that moves when content moves and only then:

```
/* @robertblust/design — tokens.css, assembled from the shared blocks: tokens v11.
   Editing this file in a site does nothing: the next npm run design overwrites it. */
```

```
/* @robertblust/design — page.css, assembled from the shared blocks: reset v2 · header v14 ·
   title v1 · footer v1 · principles v1 · team v1 · surfaces v1.
   Editing this file in a site does nothing: the next npm run design overwrites it. */
```

A file's bytes then change exactly when a block in it changes, which is what a block's version already promised inside a fence. A release that touches only the checks, the exporters or the README leaves the five files as they are, the re-pin is the one line in `package.json` and its lockfile, and no stamp moves.

The sentence about editing the file stays: it is the reason the header exists for a reader, and the release number never was.

## What reads it

`tokenVersion`, for a page that links `tokens.css`, reads `tokens v11` from that file's header and compares it with the `tokens` entry of the installed package's `versions.json`, which is the same comparison it makes for a fenced page against the marker line `design tokens · v11`. The two forms are held to the same number by the same check, and the release number is read by nothing in a page.

`design sync --check` compares the file's bytes with what the installed package would write, as it does now; nothing there changes.

`pin:check` in each site already holds `package.json`'s pin to the installed package's version, so the release a site is on stays readable where it is meant to be read, the pin, and stops being repeated in five files.

## What it costs

One more rewrite. The release that ships this changes the header's form, so a site's next re-pin rewrites the five files and moves every stamp one last time. The notes say so, and after it the files move only with their blocks.

The header no longer says which release wrote the file. A reader who wants that reads the pin; a reader who wants what the file holds reads the header, which now answers that question and did not before.

## What this is not

It is not a hash. A hash of the body would change exactly when the bytes change too, but a reader could not tell from it what changed, while the block versions say `header v14` where the marker inside a fence said the same. The family reads block versions already; this keeps that, rather than adding a second kind of number.

It is not a change to the fences. A fenced page keeps its markers and its numbers, and `tokenVersion` keeps reading them there, until the fences go.

## Order

A patch release of the package, after all three sites have taken the files, so that the one extra rewrite lands once per site and not in the middle of a migration.
