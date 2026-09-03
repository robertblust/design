// What went into a share card, and how to tell whether it still shows it.
//
// `og.png` is not a banner someone drew: it is the page itself, rendered. The cost of that is a
// copy that has to be re-rendered whenever the page moves, and nothing about a stale card looks
// wrong — it advertises the site as it read some commits ago while every check passes. A site's
// `og:check` and its exporter agree on what "current" means by both calling into this module.
//
// The comparison is the recipe, never the pixels. Two machines rasterize the same text
// differently, so a card compared by its bytes reports which machine rendered it. Re-deriving a
// hash of what went *into* the card needs no browser and no server, which is why the check can
// run in CI before `npm ci`.
//
// This module carries no card list, no frame, no hide rules — those are a site's own data,
// passed in as the `card` argument. Keeping a second copy of a knob here as well would let it be
// edited without the hash moving, which is the one failure this mechanism exists to prevent.
//
// `root` is required on every function below, never derived from `import.meta.url`. A module
// that works out where it is by its own location points inside `node_modules` once it ships as a
// dependency rather than living in the site's repository — the site owns REPO_ROOT, not this.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Everything a page pulls in from its own repository: the fonts it declares, the images it
// shows. A font swap changes every card while no HTML changes at all, so hashing the page alone
// would call a card current that no longer looks like its page.
//
// Quoted spans are consumed whole, so a `>` inside an attribute value cannot end a tag early and
// drop the references after it — a deck can keep prose in `data-notes`, where that character is
// ordinary. The attribute pattern admits `?` and `#` so the split below can strip them: excluding
// them from the character class instead means a reference carrying either fails to match at all
// and drops out of the recipe silently, which is under-reporting.
const TAG = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR = /(?:src|href)="([^"]+)"/g;
const CSSURL = /url\((['"]?)([^)'"]+)\1\)/g;

export function sources(dir, root) {
  const page = path.join(dir, "index.html");
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const found = new Set([page]);
  const refs = [];
  for (const [, tag, attrs] of html.matchAll(TAG)) {
    // An `<a>` names somewhere else to go, not something to draw. A talks index links each
    // deck's multi-megabyte PDF, so hashing link targets reported that card stale on every
    // `npm run pdf`, over a page that had not moved a pixel.
    if (tag.toLowerCase() === "a") continue;
    for (const m of attrs.matchAll(ATTR)) refs.push(m[1]);
  }
  for (const m of html.matchAll(CSSURL)) refs.push(m[2]);
  for (const raw of refs) {
    const ref = raw.split(/[?#]/)[0];
    // absolute, inline and protocol-relative references leave this repository, and the card's
    // own og:image is one of them — hashing it would key the card on itself.
    if (!ref || /^(https?:)?\/\/|^data:|^mailto:/.test(ref)) continue;
    const rel = path.normalize(path.join(dir, ref));
    if (rel.startsWith("..")) continue;
    const abs = path.join(root, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) found.add(rel);
  }
  return [...found].sort();
}

// Key order in a card literal is not a change to the card, and a knob added to a card later is.
// Sorting the keys and hashing all of them means a new knob enters the recipe by existing,
// rather than by someone remembering to list it here as well.
const canonical = (card) =>
  JSON.stringify(Object.fromEntries(Object.entries(card).sort(([a], [b]) => (a < b ? -1 : 1))));

export function recipe(card, root) {
  const h = crypto.createHash("sha256");
  h.update("og-recipe/1\n" + canonical(card) + "\n");
  for (const rel of sources(card.dir, root)) {
    h.update(rel + "\0");
    h.update(fs.readFileSync(path.join(root, rel)));
  }
  return h.digest("hex");
}

export const stampOf = (dir, root) => path.join(root, dir, "og.sha");

export function state(card, root) {
  const stamp = stampOf(card.dir, root);
  const want = recipe(card, root);
  const have = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf8").trim() : "";
  return {
    dir: card.dir,
    card: path.join(card.dir, "og.png"),
    want,
    have,
    state: !have ? "unstamped" : have === want ? "current" : "stale",
  };
}

// Written after the screenshot, so an exporter that dies half way leaves its card reported
// stale rather than reported current on a file it never wrote.
export function stamp(card, root) {
  fs.writeFileSync(stampOf(card.dir, root), recipe(card, root) + "\n");
}

// Every site's og-recipe.mjs calls these with no root, and the shared test suite calls them
// with a throwaway tmp root. So the bound form defaults the parameter rather than closing over
// it — a binder that swallowed `root` would break every test that builds a fake tree.
export function recipeFor(defaultRoot) {
  return {
    sources: (dir, root = defaultRoot) => sources(dir, root),
    recipe: (card, root = defaultRoot) => recipe(card, root),
    stampOf: (dir, root = defaultRoot) => stampOf(dir, root),
    state: (card, root = defaultRoot) => state(card, root),
    stamp: (card, root = defaultRoot) => stamp(card, root),
  };
}
