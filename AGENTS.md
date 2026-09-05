<!-- conventions · v1.4.0 -->
Shared conventions of the robertblust, guestgraph and companygraph organizations live in
`conventions/`, vendored from robertblust/conventions at the release `conventions.json`
names. Read them before writing or committing anything here.

- `conventions/WRITING.md` — how we write: one voice, three registers, English and German.
- `conventions/WORKING.md` — how we work with git and GitHub.
- `conventions/REPOSITORIES.md` — the family: what each repository is and what pins what.

Everything below this block is this repository's own. `sh conventions/conventions-sync check`
says whether the copy matches the release, `sync` brings it to the release the pin names, and
`sh conventions/conventions-check` holds this repository's own Markdown to `WRITING.md`. Edit
a shared file in robertblust/conventions, never here.
<!-- end conventions -->

# robertblust/design — working conventions

The design system shared by the three sites: tokens, chrome, page checks, cards and deck
export, taken by each site as a pinned tag and written into its pages by `npm run design`.
Everything about what ships, how a fence is changed and how a release is made is in
`README.md`, which is the manual; this file is only what an agent needs before touching
anything here.

## Checks

Two jobs, both required by the ruleset on `main`: `test`, this repository's own suite, and
`conventions`, called from robertblust/conventions at the pinned tag and shown by GitHub as
`conventions / conventions`. The suite includes `test/spelling.test.mjs`, which holds what the
package ships — blocks, scripts, comments — to American English; the shared prose check reads
Markdown only, so the two do not overlap and both stay. The prose check leaves out
`.superpowers`, tooling scratch. Everything about how to write and how to work with git is in
`conventions/`.

## What every change here costs downstream

A change to any synced file is at least a minor release, and three sites re-sync from it. Read
*Releasing* in the README before editing a block, and never edit a fence in a site.
