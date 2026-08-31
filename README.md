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
