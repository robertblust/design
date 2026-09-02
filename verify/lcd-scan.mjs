// A hand-written, brace-aware CSS reader that answers one question: which `var(--x)`
// references appear inside a rule that targets `.lcd`? Not a general parser — just enough
// structure to answer that without a dependency (this package ships zero, in devDependencies
// too). Built over several rounds against a regex version that a reviewer defeated five
// separate ways: a var() with a plain fallback (`var(--x, #fff)`, which a naive capture group
// required to end at the `)` right after the name); a decoy fallback (`var(--x, var(--y))`,
// which real CSS always resolves to `--x`, but a flat regex matched the *inner* var() and
// never saw the outer one); a pseudo-class, compound class or ancestor prefix on the selector
// (`.lcd:hover`, `.lcd.open`, `.transport .lcd`), which literal string equality against `.lcd`
// doesn't recognise as targeting `.lcd` at all; a rule nested inside `@media`, which a flat
// regex reads as belonging to the `@media` prelude and never reaches; and a declaration whose
// value wraps onto a second line, silently dropped by a regex with no `s` flag. Four rounds of
// patching one regex produced four more ways around it — a class of bug, not a series of
// them — so this walks the structure instead of matching around it.
//
// Two callers share this module rather than each carrying their own copy: the package's own
// theme test, which reads it out of `blocks/deck-transport.css` to prove the block itself
// never paints a themed token inside `.lcd`, and `verify/pages.mjs`'s `readoutInvariant`
// check, which reads it out of a site's served HTML to catch the same mistake landing in a
// page's own CSS, outside any fence this package can see. One reader, not two — a second,
// weaker implementation of "does this touch .lcd" is exactly the kind of drift this project
// already paid for once.

// Splits `css` (comments already stripped by the caller) into every {selector, body} leaf
// block, at any nesting depth, via a single brace-depth walk. An at-rule's own prelude
// (`@media (...)`) is emitted exactly like a real selector's — it is never special-cased —
// but it can never match `targetsLcd` below, so it is simply inert rather than filtered out
// structurally. This is what lets a rule nested inside `@media` reach the same scan as a
// top-level one, with no separate handling.
export function leafBlocks(css) {
  const blocks = [];
  const stack = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") { stack.push(buf); buf = ""; }
    else if (ch === "}") {
      const selector = stack.pop();
      if (selector !== undefined && selector.trim()) blocks.push({ selector: selector.trim(), body: buf });
      buf = "";
    } else buf += ch;
  }
  return blocks;
}

// A selector "targets" .lcd when the literal class `lcd` appears in any of its comma-
// separated clauses — `.lcd`, `.lcd:hover`, `.lcd.open`, `.transport .lcd` and `.lcd .clip`
// all qualify. Only dot-led class tokens are read, which excludes pseudo-classes and pseudo-
// elements (`:hover`, `::before`) automatically — they are never dot-prefixed — and a
// lookalike like `.lcdx` correctly does not qualify, since its one class is "lcdx", not "lcd".
export function targetsLcd(selector) {
  return selector.split(",").some((clause) =>
    [...clause.matchAll(/\.([a-zA-Z_-][\w-]*)/g)].some((m) => m[1] === "lcd"));
}

// Declarations, split on `;` at paren depth zero, so a value's own `;` inside a function call
// can't be mistaken for the end of the declaration. Newlines are joined to spaces first: a
// value that wraps onto a second line with no `;` before the break is one declaration, not
// one silently dropped by a regex that only looked at a single line.
export function declarations(body) {
  const joined = body.replace(/\n/g, " ");
  const out = [];
  let depth = 0, cur = "";
  for (const ch of joined) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === ";" && depth === 0) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// Every `--token` named inside `value`'s var() calls, walked with real paren balancing (so a
// fallback that is itself a var() doesn't truncate the outer call at the wrong `)`) and
// recursively, so a fallback naming another var() also gets read — `var(--a, var(--b))`
// yields both `a` and `b`. The fallback is collected on the same standard as the primary, but
// never as a substitute for it: a fallback only applies when the custom property is genuinely
// undefined, so a decoy fallback naming an invariant token must never be allowed to stand in
// for a flipping primary.
export function varTokens(value) {
  const tokens = [];
  let i = 0;
  while (true) {
    const start = value.indexOf("var(", i);
    if (start === -1) break;
    let depth = 1, j = start + 4;
    while (j < value.length && depth > 0) {
      if (value[j] === "(") depth++;
      else if (value[j] === ")") depth--;
      j++;
    }
    const inner = value.slice(start + 4, j - 1);
    const m = inner.match(/^\s*--([a-zA-Z0-9-]+)\s*(?:,([\s\S]*))?$/);
    if (m) {
      tokens.push(m[1]);
      if (m[2] !== undefined) tokens.push(...varTokens(m[2]));
    }
    i = j;
  }
  return tokens;
}

// Every {selector, prop, token} triple any .lcd-targeting rule in `css` references, built
// from the four functions above rather than one regex trying to do all their jobs at once.
// `css` must already have its comments stripped by the caller — this module has no opinion
// about what a comment looks like in CSS versus in a source page's inline <style>.
export function lcdVarReferences(css) {
  const referenced = [];
  for (const { selector, body } of leafBlocks(css)) {
    if (!targetsLcd(selector)) continue;
    for (const decl of declarations(body)) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      if (!prop) continue;
      for (const token of varTokens(value))
        referenced.push({ selector: selector.replace(/\s+/g, " "), prop, token });
    }
  }
  return referenced;
}
