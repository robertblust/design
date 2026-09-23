// The five files a site copies whole, assembled from the same blocks the fences already read —
// the shape README.md's *Fences* section calls "the other side of the same mechanism": a fence
// bounds a gap inside a page this tool never fully owns, a file has no such gap and so needs no
// markers, only the bytes.
//
// assemble() calls blockFor() from lib/fences.mjs, the same function every fence already trusts,
// so a change to a block's content reaches both the fenced copies and these files from the one
// place. What it does beyond blockFor is the two things a fence never needed: it drops the
// marker comment — a whole file is not "a gap in a page" for a marker to bound — and it dedents
// the two spaces a block carries because it used to live inside a page's <style> or <script>.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { blockFor } from "./fences.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG_JSON = JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8"));

// A block's own first line is the fence's opening marker, and it is always the first line of
// one comment — sometimes the whole comment ("/* ─── end … ─── */" always is), sometimes the
// start of a longer one explaining the block, which closes with the first "*/" the block
// carries, whether that sits alone on its own line or at the end of a line of prose. Dropping
// only the physical first line and leaving the rest would strip the comment's own "/*" and hand
// a browser or Node an unterminated comment followed by a stray "*/" — exactly the silent
// swallow lib/sync.mjs's own otherVariantMatch comment warns about, with a real rule eaten by
// the next stray "{...}" the broken parse meets. So the whole opening comment goes, marker and
// all; the closing marker is always its own single, self-contained comment and is dropped the
// same way, as the block's last line.
function stripMarkersAndDedent(block) {
  const lines = block.split("\n");
  let start = 0;
  for (; start < lines.length; start++)
    if (lines[start].includes("*/")) { start++; break; }
  const end = lines.length - 1; // the "end <fence>" marker: always its own whole line
  return lines.slice(start, end)
    .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
    .join("\n");
}

function requireVariant(file, config, key, allowed) {
  const value = config[key];
  if (!allowed.includes(value))
    throw new Error(
      `assemble("${file}", …): "${key}" must be one of ${allowed.join(", ")} — got ` +
      `${value === undefined ? "nothing" : JSON.stringify(value)}`);
  return value;
}

function cssHeader(file) {
  return (
    `/* @robertblust/design v${PKG_JSON.version} — ${file}, assembled from the shared blocks\n` +
    `   and copied into this site by \`npm run design\`. Editing it here does nothing: the\n` +
    `   next \`npm run design\` overwrites it from the package. Change it there instead. */\n\n`
  );
}

function jsHeader(file) {
  return (
    `// @robertblust/design v${PKG_JSON.version} — ${file}, assembled from the shared blocks\n` +
    `// and copied into this site by \`npm run design\`. Editing it here does nothing: the\n` +
    `// next \`npm run design\` overwrites it from the package. Change it there instead.\n\n`
  );
}

// Every part is {fence, variant(config, file)}. `variant` gets the file name too, so a bad or
// missing key in the config names both — README's *No parameters* rule: a value nothing reads
// is a value someone still believes in, and here the reverse failure, a value nothing supplied,
// gets the same treatment.
//
// tokens.css always closes its own :root: that is the shape README's `design tokens` fence
// calls the "page" variant, and it is right for a deck too — a deck's own extra tokens, read off
// a real deck rather than guessed, turned out to be nothing but the brace that variant already
// closes; see the task report for the two lines read to confirm it. So deck.css carries no
// tokens of its own and links tokens.css exactly as a page does.
const FILES = {
  "tokens.css": {
    kind: "css",
    parts: [
      { fence: "design tokens", variant: () => "page" },
    ],
  },
  "page.css": {
    kind: "css",
    parts: [
      { fence: "prose reset", variant: () => null },
      { fence: "header contract", variant: () => null },
      { fence: "title contract", variant: () => null },
      { fence: "prose footer", variant: (c, f) => requireVariant(f, c, "footer", ["credit", "plain"]) },
      { fence: "principles", variant: () => null },
      { fence: "team", variant: () => null },
      { fence: "surfaces", variant: () => null },
    ],
  },
  "page.js": {
    kind: "js",
    parts: [
      { fence: "language", variant: () => "page" },
      { fence: "theme", variant: () => "page" },
      { fence: "nav fit", variant: () => "page" },
    ],
  },
  "deck.css": {
    kind: "css",
    parts: [
      { fence: "deck transport", variant: () => null },
      { fence: "deck lockup", variant: (c, f) => requireVariant(f, c, "lockup", ["one", "two"]) },
    ],
  },
  // No "language" part here: unlike every other file, deck.js does not read blockFor("language",
  // "deck") on its own. blocks/deck-runtime.js's fenced form already carries that block nested
  // inside it, byte for byte — see the "deck runtime" fence's own comment in lib/fences.mjs —
  // because a real deck page needs the language fence findable on its own for the sync tool
  // and also needs it inside the runtime, and both copies come from the one source so they
  // cannot drift. Assembling both parts here would write the language block into deck.js
  // twice: once as its own part and once nested inside "deck runtime"'s bytes. Dropping the
  // outer part is the fix, not editing blocks/deck-runtime.js, which still needs its nested
  // copy for the fenced form the sync tool writes.
  "deck.js": {
    kind: "js",
    parts: [
      { fence: "theme", variant: () => "deck" },
      { fence: "deck runtime", variant: () => null },
      { fence: "deck fit", variant: () => null },
    ],
  },
};

export const FILE_NAMES = Object.freeze(Object.keys(FILES));

export function assemble(name, config) {
  const spec = FILES[name];
  if (!spec)
    throw new Error(`assemble: no such file "${name}" — this package ships ${FILE_NAMES.join(", ")}`);
  const bodies = spec.parts.map(({ fence, variant }) =>
    stripMarkersAndDedent(blockFor(fence, variant(config, name))));
  const head = spec.kind === "css" ? cssHeader(name) : jsHeader(name);
  const body = spec.kind === "js"
    ? `(function () {\n${bodies.join("\n\n")}\n})();\n`
    : `${bodies.join("\n\n")}\n`;
  return head + body;
}
