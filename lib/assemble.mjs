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

import { blockFor, FENCES } from "./fences.mjs";

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

// The header names the blocks a file was assembled from, each with its own version from
// versions.json, and not the package's release: a release that moves no block in a file then
// leaves the file's bytes, and every share-card stamp a site hashes from them, as they were.
// The release a site is on is read from its pin. `tokenVersion` in verify/design.mjs reads the
// `tokens vN` this writes into tokens.css.
const HEADER_WIDTH = 96;

function header(file, parts, open, cont, close) {
  // A block's name and its version wrap as one word, so no line ends on a name without its number.
  const blocks = parts.map(({ fence }, i) =>
    `${FENCES[fence].key}\u00a0${FENCES[fence].version}${i < parts.length - 1 ? "\u00a0·" : "."}`);
  const words = [...`@robertblust/design — ${file}, assembled from the shared blocks:`.split(" "), ...blocks]
    .map((w) => w.replaceAll("\u00a0", " "));
  const lines = [];
  let line = open;
  for (const word of words) {
    if (line !== open && line !== cont && line.length + 1 + word.length > HEADER_WIDTH) {
      lines.push(line);
      line = cont + word;
    } else line += (line === open || line === cont ? "" : " ") + word;
  }
  lines.push(line);
  lines.push(`${cont}Editing this file in a site does nothing: the next npm run design overwrites it.${close}`);
  return `${lines.join("\n")}\n\n`;
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
      { fence: "lines", variant: () => null },
      { fence: "prose footer", variant: (c, f) => requireVariant(f, c, "footer", ["credit", "plain"]) },
      { fence: "principles", variant: () => null },
      { fence: "team", variant: () => null },
      { fence: "surfaces", variant: () => null },
      { fence: "index", variant: () => null },
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
  // The lockup before the transport, the order a real deck's own page carries the two fences
  // in (talks/mental-model/index.html on blust.ch, commit 88e3391: `deck lockup` at line 441,
  // `deck transport` at line 490). That order is load-bearing, not cosmetic: both fences carry
  // a `.name` rule at equal specificity — the transport's inside a mobile media query, the
  // lockup's without one — so a media query adds nothing to break the tie and whichever part
  // this array emits *second* wins the cascade at a narrow viewport. Emitting the transport
  // second let its `.name{display:none}` beat the lockup's own display rule, which is the
  // mobile-collapse regression `verify/design.mjs`'s `lockupCollapses` check now renders for
  // rather than trusting a byte comparison to see. See test/assemble.test.mjs's own order test
  // for why the order is pinned to what the page carries rather than to a preference asserted
  // here with nothing to check it against.
  "deck.css": {
    kind: "css",
    parts: [
      { fence: "deck lockup", variant: (c, f) => requireVariant(f, c, "lockup", ["one", "two"]) },
      { fence: "deck transport", variant: () => null },
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
  const bodies = spec.parts.map(({ fence, variant }) => {
    const stripped = stripMarkersAndDedent(blockFor(fence, variant(config, name)));
    // stripMarkersAndDedent scans for the block's first "*/" to find where its opening comment
    // ends; a block with no closing marker anywhere finds none, and slice(start, end) with a
    // start past the end silently returns "" rather than throwing. A part that assembles to
    // nothing would ship an empty gap in the file with every other check green, so it is named
    // and refused here instead of shipped.
    if (!stripped.trim())
      throw new Error(
        `assemble("${name}", …): the "${fence}" part assembled to nothing — its block in ` +
        `${FENCES[fence].source} is missing the closing "*/" stripMarkersAndDedent looks for`);
    return stripped;
  });
  const head = spec.kind === "css"
    ? header(name, spec.parts, "/* ", "   ", " */")
    : header(name, spec.parts, "// ", "// ", "");
  const body = spec.kind === "js"
    ? `(function () {\n${bodies.join("\n\n")}\n})();\n`
    : `${bodies.join("\n\n")}\n`;
  return head + body;
}
