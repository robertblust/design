// Find a fenced block inside a page, and swap it for the one this package ships.
//
// Line-based on purpose. These are HTML documents carrying CSS inside a <style>, and the fences
// are comments; a regex over the whole document would be one greedy quantifier away from
// swallowing the page, and an HTML parser would be a dependency this package refuses to take.
// Working a line at a time means the worst failure is "found nothing", which throws.
//
// Nothing here writes a file or knows what a site is. That belongs to lib/sync.mjs.

export class FenceError extends Error {
  constructor(message) { super(message); this.name = "FenceError"; }
}

// Box-drawing runs vary in length between pages and nobody should have to count them, so the
// marker is matched by its words and the dashes are only required to be present.
const RULE = "─";                                   // ─
const open  = (name) => new RegExp(
  `^\\s*/\\*\\s*${RULE}+\\s*${escapeRe(name)}\\s*·\\s*(v\\d+)\\s*·\\s*(\\S+)`);
const close = (name) => new RegExp(`^\\s*/\\*\\s*${RULE}+\\s*end\\s+${escapeRe(name)}(?=\\s+${RULE})`);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A fence name can be a prefix of another ("stage" and "stage contract"), so the opening pattern
// anchors on the ` · ` that follows the name. `\S+` after the version is the variant slot: a
// block with variants puts one of its own declared words there, and a block without them gets
// whatever word `blockFor` substitutes for `null` ("shared"). This module reports that word
// verbatim, whichever it is — it reads a page, it does not know the fence manifest, so it has no
// list of allowed words to check against. Deciding whether the word is one a given fence actually
// declares belongs to lib/sync.mjs, which does know the manifest.

function splitLines(text) {
  // Preserve the document's line endings exactly: a page written with CRLF must come back with
  // CRLF, or the whole file shows as changed and the diff hides what actually moved.
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { lines: text.split(eol), eol };
}

export function findFence(text, name) {
  const { lines, eol } = splitLines(text);
  const o = open(name), c = close(name);
  for (let i = 0; i < lines.length; i++) {
    const m = o.exec(lines[i]);
    if (!m) continue;
    for (let j = i + 1; j < lines.length; j++) {
      if (!c.test(lines[j])) continue;
      return {
        start: i,
        end: j,
        version: m[1],
        variant: m[2] ?? null,
        body: lines.slice(i, j + 1).join(eol),
      };
    }
    throw new FenceError(
      `the fence "${name}" opens at line ${i + 1} and never closes — ` +
      `expected a line matching "/* ─── end ${name} ───"`);
  }
  return null;
}

export function replaceFence(text, name, block) {
  const found = findFence(text, name);
  if (!found)
    throw new FenceError(`this page carries no "${name}" fence to replace`);
  const { lines, eol } = splitLines(text);
  const replacement = block.split(/\r?\n/);
  return [...lines.slice(0, found.start), ...replacement, ...lines.slice(found.end + 1)]
    .join(eol);
}
