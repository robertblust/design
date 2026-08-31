// Copy whole files from this package into a site, and be able to say — without writing
// anything — whether the site's committed copies still match.
//
// Whole files only. The blocks that live inlined inside HTML need a fence rewriter, and that
// is a later release; nothing here parses markup. Keeping the two apart means this file can
// be trusted by inspection: it reads bytes, compares bytes, writes bytes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROUPS, GROUP_NAMES } from "./groups.mjs";
import { FENCE_NAMES, FENCES, blockFor } from "./fences.mjs";
import { findFence, replaceFence, FenceError } from "./rewrite.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const CONFIG_NAME = "design.config.json";

// What a site declares it takes. Deliberately tiny: a site should not be able to say
// anything here that changes what a file *contains*, only which files it wants.
export function readConfig(siteRoot) {
  const file = path.join(siteRoot, CONFIG_NAME);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(
      `no ${CONFIG_NAME} in ${siteRoot} — create one, e.g. {"groups":["fonts"]}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${e.message}`);
  }
  const groups = parsed.groups;
  if (!Array.isArray(groups) || groups.some((g) => typeof g !== "string"))
    throw new Error(`${file} must carry a "groups" array of strings`);
  if (groups.length === 0)
    throw new Error(
      `${file} has an empty "groups" array — a site that takes nothing from this package ` +
      `should not have a ${CONFIG_NAME} at all. Delete the file, or name the groups you want.`);
  for (const g of groups)
    if (!GROUP_NAMES.includes(g))
      throw new Error(
        `${file} names the group ${JSON.stringify(g)}, which this package does not ship. ` +
        `Known groups: ${GROUP_NAMES.join(", ")}`);

  // Everything else the config carries is a parameter — a value some fence's `params` will
  // read by name (paramsFor, below). This has to stay open-ended: `readConfig` does not know,
  // and should not need to know, which parameters exist — that list lives in fences.mjs and
  // grows every time a fence declares one. A closed whitelist here would silently drop any
  // parameter this function was not specifically told about, which is worse than useless: it
  // would tell an author to add config they had already added.
  //
  // Each is held to the standard "langKey" was held to before this generalised: optional — a
  // site with no fence that needs it supplies nothing — but if present it must be a real
  // value. Absent is legal; wrong-shaped isn't.
  const params = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "groups") continue;
    if (typeof value !== "string" || value.length === 0)
      throw new Error(`${file}'s "${key}" must be a non-empty string`);
    params[key] = value;
  }

  return { groups, ...params };
}

// Compare without writing. `state` is the entire vocabulary the CLI reports in.
export function planSync(siteRoot, config) {
  const entries = [];
  for (const group of config.groups)
    for (const [from, to] of GROUPS[group]) {
      const want = fs.readFileSync(path.join(PKG, from));
      const dest = path.join(siteRoot, to);
      let state;
      if (!fs.existsSync(dest)) state = "missing";
      else state = fs.readFileSync(dest).equals(want) ? "same" : "differs";
      entries.push({ from, to, state });
    }
  return entries.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
}

// Write only what is not already right, so a no-op run leaves every mtime alone and `git
// status` stays quiet.
export function applySync(siteRoot, entries) {
  const written = [];
  for (const e of entries) {
    if (e.state === "same") continue;
    const dest = path.join(siteRoot, e.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fs.readFileSync(path.join(PKG, e.from)));
    written.push(e.to);
  }
  return written.sort();
}

const SKIP_DIRS = new Set(["node_modules", ".git"]);

// Discovery rather than registration: a page that grows a fence is picked up with no list to
// keep in step. What this cannot see is a page that *should* carry a fence and does not — and
// that hole is already covered, by each site's own suite asserting the marker on every page in
// its PAGES list.
export function findPages(siteRoot) {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
      } else if (e.name.endsWith(".html")) {
        out.push(rel ? `${rel}/${e.name}` : e.name);
      }
    }
  };
  walk(siteRoot, "");
  return out.sort();
}

// Build the {param: value} object a fence's own declared `params` calls for, reading each value
// out of the site's config by the same name. Throws — naming the page, the fence, the missing
// key, and where it belongs — rather than defaulting a missing one to "", which would write
// silently and wrong.
function paramsFor(fence, config, page) {
  const spec = FENCES[fence];
  if (!spec.params) return {};
  const params = {};
  for (const key of spec.params) {
    const value = config[key];
    if (value === undefined)
      throw new FenceError(
        `${page}: the "${fence}" fence needs a "${key}" parameter, but ${CONFIG_NAME} has no ` +
        `"${key}" — add it to ${CONFIG_NAME}.`);
    params[key] = value;
  }
  return params;
}

// Whether `body` — apart from its own first line, where every fence template substitutes its
// variant word exactly once and nowhere else — matches a `candidates` entry other than the one
// named by `declaredVariant`. `candidates` is `{variant: fullText}` for every variant a fence
// declares. Returns the other variant's name, or null.
//
// A pure text comparison, independent of any specific fence and of `blockFor` itself, so the
// mechanism can be exercised directly with fabricated content — which matters, because today's
// fences cannot demonstrate it: the only thing that currently makes two variants differ by more
// than their label is the `:root`-brace logic below, gated on `closes`, and every `closes: null`
// fence's variants are therefore byte-identical outside the label. A future fence is expected to
// differ by more than a label with no brace involved, and this is the check that will cover it.
//
// A body that matches its OWN declared candidate is not ambiguous even if it also happens to
// match a different one — true of every fence whose variants are byte-identical outside the
// label, "language" among them, where every candidate matches every body. Reporting a mismatch
// there would be exactly the false confidence this guard exists to avoid, so a body is only
// reported against another variant when it does NOT already match its own.
export function otherVariantMatch(declaredVariant, body, candidates) {
  const strip = (t) => t.replace(/\r\n/g, "\n").split("\n").slice(1).join("\n");
  const bodyRest = strip(body);
  if (strip(candidates[declaredVariant]) === bodyRest) return null;
  for (const v of Object.keys(candidates))
    if (v !== declaredVariant && strip(candidates[v]) === bodyRest) return v;
  return null;
}

export function planFences(siteRoot) {
  // Read lazily, once, and only if a page actually carries a fence that declares params. A
  // site with no "language" fence anywhere needs no design.config.json at all for this
  // function's purposes — the same way it needed none before this fence existed.
  let config;
  const getConfig = () => (config ??= readConfig(siteRoot));
  const entries = [];
  for (const page of findPages(siteRoot)) {
    const text = fs.readFileSync(path.join(siteRoot, page), "utf8");
    for (const fence of FENCE_NAMES) {
      const found = findFence(text, fence);          // throws on an unterminated fence
      if (!found) continue;
      const variant = FENCES[fence].variants ? found.variant : null;
      // `findFence` reports the word verbatim, whatever it is — validating it is this
      // function's job, because this is where the fence's declared `variants` list lives. A
      // marker with no third segment at all reports `null` here; a marker naming a word this
      // fence does not declare reports that word. Both are the same mistake — the page's
      // opening line and the manifest disagree — so both are one check, and the message names
      // what the page said and what the fence allows, not just that something is wrong.
      if (FENCES[fence].variants && !FENCES[fence].variants.includes(variant))
        throw new FenceError(
          `${page}: the "${fence}" fence's opening line names ` +
          `${variant === null ? "no variant" : `"${variant}"`}, but this fence only knows ` +
          `${FENCES[fence].variants.join(", ")} — fix the variant word on the fence's opening line.`);

      const params = FENCES[fence].params ? paramsFor(fence, getConfig(), page) : {};

      // Consistency guard, not inference. The spec refused to *derive* a variant in order to
      // emit one — "the kind of cleverness that fails silently once" — and this is not that: the
      // variant is still read verbatim off the fence's opening line, never guessed. What this
      // does is check that declared word against a second, independent signal that is already in
      // `found.body` — whether the page's own committed content closes `:root` inside the fence
      // or leaves it open for the page to close later, after its own tokens. A deck mislabelled
      // "page" writes the page's self-closing block, prematurely closing `:root`: the deck's own
      // tokens and box reset (which live after the end marker, outside anything this tool writes)
      // become a stylesheet-level parse error that CSS error recovery swallows silently, and
      // design:check then reports "same" because the page now genuinely matches what the package
      // emits for "page". Both signals already exist; this only asserts they agree, and its whole
      // purpose is to fail loudly the moment they don't. Do not delete this believing it is the
      // inference above — it is the opposite of that.
      //
      // This is the special case, not the whole guard: it only fires for a fence that has a
      // `:root` brace to check, which is one fence out of the ones with `variants`. The general
      // form is below, and covers every fence with `variants` regardless of `closes` — this one
      // stays because it catches a mislabelled fence *before* any sync has ever run, purely from
      // the shape of content a site wrote by hand or seeded from another page — a case the
      // general check, which compares against what this package itself would emit, cannot reach.
      if (FENCES[fence].closes) {
        const bodyLines = found.body.split(/\r?\n/);
        const closesRoot = bodyLines[bodyLines.length - 2].trim() === "}";
        const other = FENCES[fence].variants.find((v) => v !== FENCES[fence].closes);
        const actual = closesRoot ? FENCES[fence].closes : other;
        if (actual !== variant)
          throw new FenceError(
            `${page}: the "${fence}" fence declares "${variant}", but its block ` +
            `${closesRoot ? "closes" : "does not close"} ":root", so it is a "${actual}" — ` +
            `fix the variant word on the fence's opening line.`);
      }

      const want = blockFor(fence, variant, params);
      // Compare on content, not line endings: findFence joins a CRLF page's body with the
      // document's own \r\n (deliberately — see lib/rewrite.mjs), but blockFor always returns
      // \n-joined text. Normalising only for this equality check keeps that asymmetry — the
      // write path still hands blockFor's \n text to replaceFence, which converts it to the
      // page's own EOL — while letting a CRLF page that already matches report "same".
      const bodyNormalized = found.body.replace(/\r\n/g, "\n");
      const same = bodyNormalized === want;

      // The general form of the guard above: it needs no `:root` brace, or any other
      // fence-specific signal — only that the fence declares `variants` at all. This is what
      // makes it apply to a fence like "language", which has neither a brace nor a `closes`, and
      // it will apply the same way to a future fence whose variants differ by more than a label
      // with no second signal of their own to lean on. See `otherVariantMatch` for the comparison
      // itself and for what "not a guarantee" means here.
      if (FENCES[fence].variants) {
        const candidates = Object.fromEntries(
          FENCES[fence].variants.map((v) => [v, v === variant ? want : blockFor(fence, v, params)]));
        const mismatch = otherVariantMatch(variant, bodyNormalized, candidates);
        if (mismatch)
          throw new FenceError(
            `${page}: the "${fence}" fence declares "${variant}", but its content matches what ` +
            `the "${mismatch}" variant emits — fix the variant word on the fence's opening line.`);
      }
      entries.push({ page, fence, variant, params, state: same ? "same" : "differs" });
    }
  }
  return entries.sort((a, b) =>
    a.page < b.page ? -1 : a.page > b.page ? 1 : a.fence < b.fence ? -1 : a.fence > b.fence ? 1 : 0);
}

export function applyFences(siteRoot, entries) {
  const touched = new Set();
  const byPage = new Map();
  for (const e of entries) {
    if (e.state === "same") continue;
    if (!byPage.has(e.page)) byPage.set(e.page, []);
    byPage.get(e.page).push(e);
  }
  for (const [page, list] of byPage) {
    const file = path.join(siteRoot, page);
    let text = fs.readFileSync(file, "utf8");
    for (const e of list)
      text = replaceFence(text, e.fence, blockFor(e.fence, e.variant, e.params ?? {}));
    fs.writeFileSync(file, text);
    touched.add(page);
  }
  return [...touched].sort();
}
