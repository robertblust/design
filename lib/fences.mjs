// The blocks this package writes *inside* a page, as opposed to the whole files it copies.
//
// A fence is a pair of comment markers the HTML already carries. The package owns everything
// between and including them — the prose, the version, the CSS — so a site cannot half-adopt a
// block, and the version in the page is stamped from versions.json rather than typed.
//
// Why these four and not the other two the spec names: these are already byte-identical in
// every copy, so moving them is mechanical and the only question is whether the tool reproduces
// them — language included, now that its per-site parameter has a home in the site's own
// design.config.json. The deck footer bundles a contract with a component, and the prose kit is
// not a block yet. Each of those still needs a decision made before a tool can help, and each
// has its own plan.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const versions = JSON.parse(fs.readFileSync(path.join(PKG, "versions.json"), "utf8"));

export const FENCES = {
  // A prose page closes its :root inside the fence; a deck leaves it open and adds tokens of its
  // own after the end marker. The stored block stops before the brace, and `closes` names the
  // variant that gets it back — one line, and the only shape difference in the whole manifest.
  "design tokens": {
    key: "tokens", source: "blocks/tokens.css", version: versions.tokens,
    variants: ["page", "deck"], closes: "page",
  },
  "header contract": {
    key: "header", source: "blocks/header.css", version: versions.header,
    variants: null, closes: null,
  },
  "stage contract": {
    key: "stage", source: "blocks/stage.css", version: versions.stage,
    variants: null, closes: null,
  },
  // The first block whose substitution comes from the SITE rather than from this package.
  // `{{variant}}` is chosen from a set this file owns; `{{langKey}}` is not — blust.ch stores
  // under "rb-lang" and nothing about the domain yields that. It is also a constant with a
  // migration cost: changing a storage key silently discards every visitor's saved language.
  // So it lives in the site's design.config.json, where changing it is a visible act.
  "language": {
    key: "lang", source: "blocks/lang.js", version: versions.lang,
    variants: ["page", "deck"], closes: null, params: ["langKey"],
  },
};

export const FENCE_NAMES = Object.freeze(Object.keys(FENCES));

const VARIANT_SLOT = "{{variant}}";

export function blockFor(name, variant, params = {}) {
  const spec = FENCES[name];
  if (!spec) throw new Error(`no such fence: ${name}`);
  if (spec.variants && !spec.variants.includes(variant))
    throw new Error(
      `the "${name}" fence needs a variant, one of ${spec.variants.join(", ")} — got ` +
      `${variant === null ? "none" : JSON.stringify(variant)}`);
  if (!spec.variants && variant !== null)
    throw new Error(`the "${name}" fence takes no variant, but got ${JSON.stringify(variant)}`);

  if (spec.params) {
    for (const p of spec.params)
      if (params[p] === undefined)
        throw new Error(
          `the "${name}" fence needs a "${p}" parameter, supplied by the site's own ` +
          `design.config.json`);
    // Symmetric with the check above: a fence with no `params` already rejects anything
    // supplied (the `else` branch below). A fence *with* `params` was accepting undeclared
    // extras silently — a typo'd second parameter would be read by nothing and reported by
    // nothing. Any key the fence did not declare is an error, naming the fence and the key.
    for (const p of Object.keys(params))
      if (!spec.params.includes(p))
        throw new Error(`the "${name}" fence does not declare a "${p}" parameter`);
  } else {
    for (const p of Object.keys(params))
      throw new Error(`the "${name}" fence takes no parameters, but got "${p}"`);
  }

  let text = fs.readFileSync(path.join(PKG, spec.source), "utf8").replace(/\n$/, "");
  text = text.replace(VARIANT_SLOT, variant === null ? "shared" : variant);
  for (const [key, value] of Object.entries(params))
    text = text.split(`{{${key}}}`).join(value);

  if (spec.closes && variant === spec.closes) {
    // put the brace back, immediately before the end marker
    const lines = text.split("\n");
    lines.splice(lines.length - 1, 0, "  }");
    text = lines.join("\n");
  }
  return text;
}
