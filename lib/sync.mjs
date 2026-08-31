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

  // langKey is optional — a site with no language fence needs none — but if present it must
  // be a real value, the same standard "groups" is held to. Absent is legal; wrong-shaped isn't.
  const langKey = parsed.langKey;
  if (langKey !== undefined && (typeof langKey !== "string" || langKey.length === 0))
    throw new Error(`${file}'s "langKey" must be a non-empty string`);

  return langKey === undefined ? { groups } : { groups, langKey };
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
      if (FENCES[fence].variants && variant === null)
        throw new FenceError(
          `${page}: the "${fence}" fence declares no variant. Its opening line must name one of ` +
          `${FENCES[fence].variants.join(", ")} — a prose page uses "page", a deck uses "deck".`);

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

      const params = FENCES[fence].params ? paramsFor(fence, getConfig(), page) : {};
      const want = blockFor(fence, variant, params);
      // Compare on content, not line endings: findFence joins a CRLF page's body with the
      // document's own \r\n (deliberately — see lib/rewrite.mjs), but blockFor always returns
      // \n-joined text. Normalising only for this equality check keeps that asymmetry — the
      // write path still hands blockFor's \n text to replaceFence, which converts it to the
      // page's own EOL — while letting a CRLF page that already matches report "same".
      const same = found.body.replace(/\r\n/g, "\n") === want;
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
