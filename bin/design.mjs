#!/usr/bin/env node
// design sync          write this package's files into the site
// design sync --check  compare only; exit 1 if any copy has drifted
//
// `--check` is what CI runs. It never writes, so a red build cannot be made green by the
// build itself — someone has to run `design sync` and commit, which is the whole point: the
// bytes a visitor downloads are in the repository, and they got there deliberately.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readConfig, planSync, applySync, CONFIG_NAME, planFences, applyFences,
} from "../lib/sync.mjs";
import { findFence, FenceError } from "../lib/rewrite.mjs";
import { FENCES } from "../lib/fences.mjs";

const USAGE = `usage: design sync [--check] [--site <dir>]
       design sitemap [--check]
       design indexnow <base> <head> [--dry-run]
       design links [--external] [--base <url>]

  sync            copy this package's files into the site
  sync --check    compare only, exit 1 if a copy has drifted (this is what CI runs)
  --site <dir>    the site root (default: the current directory)
  sitemap         date each sitemap URL from its page's last commit
  sitemap --check compare only, exit 1 if a date has moved
  indexnow        send the pages changed between two commits to IndexNow
  links           resolve every link the site owns, exit 1 if one does not land
  links --external
                  check every link to another site and report it, exit 1 only if the check could not run
  --base <url>    where the site is served (default: http://127.0.0.1:8000)`;

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

const argv = process.argv.slice(2);

// The two crawler commands share nothing with sync but the binary, so they are handled and exit
// here, before anything reads design.config.json: a site's deploy workflow runs `indexnow` and
// has no reason to care whether its fences are in step.
if (argv[0] === "indexnow" || argv[0] === "sitemap") {
  const { indexnow, sitemapDates } = await import("../lib/crawl.mjs");
  const root = process.cwd();
  const [base, head] = argv.slice(1).filter((a) => !a.startsWith("--"));
  try {
    if (argv[0] === "indexnow") {
      if (!base || !head) fail(USAGE, 2);
      await indexnow({ root, base, head, dryRun: argv.includes("--dry-run") });
    } else {
      const { xml, dates, next } = sitemapDates({ root });
      const count = Object.keys(dates).length;
      if (!argv.includes("--check")) {
        if (next !== xml) fs.writeFileSync(path.join(root, "sitemap.xml"), next);
        console.log(`  ✓ sitemap.xml dated, ${count} URL(s)`);
      } else if (next === xml) {
        console.log(`  ✓ sitemap.xml dates match git, ${count} URL(s)`);
      } else {
        for (const [loc, d] of Object.entries(dates))
          if (!xml.includes(`<loc>${loc}</loc><lastmod>${d}</lastmod>`)) console.log(`  ✗ ${loc}  last changed ${d}`);
        console.log(`\n  Run: npm run sitemap, and commit sitemap.xml with the page.`);
        process.exit(1);
      }
    }
  } catch (e) {
    fail(`  ✗ ${e.message}`, 1);
  }
  process.exit(0);
}

// The link checker drives a browser, and the browser is the site's: every site already installs
// Playwright for its own suite, and this package ships no dependency to bring a second copy.
if (argv[0] === "links") {
  const at = argv.indexOf("--base");
  if (at !== -1 && (!argv[at + 1] || argv[at + 1].startsWith("--"))) fail(USAGE, 2);
  // Only --external, --base and the value that follows it are accepted; anything else, a typo
  // among them, is the usage and exit 2 rather than a check that silently ran without it.
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--external") continue;
    if (argv[i] === "--base") { i++; continue; }
    fail(USAGE, 2);
  }
  const { BASE, checkOwn, checkExternal } = await import("../verify/links.mjs");
  const base = at === -1 ? BASE : argv[at + 1];
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    fail("  ✗ design links drives a browser and needs Playwright in the site: npm install --save-dev playwright", 1);
  }
  try {
    if (argv.includes("--external")) {
      await checkExternal({ root: process.cwd(), base, chromium });
      process.exit(0);
    }
    const { failures } = await checkOwn({ root: process.cwd(), base, chromium });
    process.exit(failures.length ? 1 : 0);
  } catch (e) {
    fail(`  ✗ ${e.message}`, 1);
  }
}

if (argv[0] !== "sync") fail(USAGE, 2);

const check = argv.includes("--check");
const siteFlag = argv.indexOf("--site");
if (siteFlag !== -1 && !argv[siteFlag + 1]) fail(USAGE, 2);
const siteRoot = path.resolve(siteFlag === -1 ? process.cwd() : argv[siteFlag + 1]);

let config;
try {
  config = readConfig(siteRoot);
} catch (e) {
  fail(e.message, 2);
}

// planSync calls assemble() eagerly for every "files" entry, whether this run is a check or a
// write, and assemble() throws when a site's config names "files" without the "footer" or
// "lockup" key it needs — a raw stack trace out of the first command a site with a bad config
// runs, rather than the same clean config error every other bad design.config.json produces.
let entries;
try {
  entries = planSync(siteRoot, config);
} catch (e) {
  fail(e.message, 2);
}
const stale = entries.filter((e) => e.state !== "same");

let fenceEntries;
try {
  fenceEntries = planFences(siteRoot);
} catch (e) {
  if (e instanceof FenceError) fail(e.message, 2);
  throw e;
}
const staleFences = fenceEntries.filter((e) => e.state !== "same");

// The tag is the release and the sites pin the tag, so nothing read this package's own version
// field and it fell seven tags behind. A site holds both values, the tag in its pin and the
// version of the package it installed; they agree or the check is red, the same guard the
// conventions workflow runs between the release it declares and a member's pin. A site with no
// package.json, or none that pins this package by tag, is not judged.
const PKG_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function pinMismatch() {
  const sitePkg = path.join(siteRoot, "package.json");
  if (!fs.existsSync(sitePkg)) return null;
  let spec;
  try {
    const p = JSON.parse(fs.readFileSync(sitePkg, "utf8"));
    spec = { ...(p.dependencies || {}), ...(p.devDependencies || {}) }["@robertblust/design"];
  } catch { return null; }
  const m = spec && /#v(\d+\.\d+\.\d+)$/.exec(spec);
  if (!m) return null;
  const own = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")).version;
  return m[1] === own ? null : { pinned: m[1], own };
}
const mismatch = pinMismatch();

if (check) {
  if (mismatch) {
    console.log(
      `  ✗ package.json pins @robertblust/design v${mismatch.pinned}, but the installed package ` +
      `declares ${mismatch.own} — a release sets version in the package to its tag before tagging; ` +
      `if the pin is the newer one, re-install it.`);
    process.exit(1);
  }
  if (!stale.length && !staleFences.length) {
    console.log(
      `  ✓ ${entries.length} file(s) and ${fenceEntries.length} fence(s) match @robertblust/design`);
    process.exit(0);
  }
  for (const e of stale)
    console.log(`  ✗ ${e.to}  ${e.state === "missing" ? "missing" : "differs from the package"}`);
  for (const e of staleFences) {
    const text = fs.readFileSync(path.join(siteRoot, e.page), "utf8");
    const found = findFence(text, e.fence);
    if (found.version !== FENCES[e.fence].version) {
      console.log(
        `  ✗ ${e.page}  ${e.fence} is ${found.version}, this release ships ${FENCES[e.fence].version}`);
    } else {
      // Same version, different bytes: the version comparison above would print "is v4, this
      // release ships v4", which reads as nonsense for a block someone edited by hand without
      // touching the version marker. Name what actually happened instead.
      console.log(
        `  ✗ ${e.page}  ${e.fence} is ${found.version} but its content differs — this block is ` +
        `generated: edit it in robertblust/design and publish, or take the block out of the ` +
        `package if this site genuinely needs to differ.`);
    }
  }
  console.log(
    `\n  ${stale.length} file(s) and ${staleFences.length} fence(s) are not what @robertblust/design ` +
    `ships.` +
    `\n  Run: npm run design` +
    `\n  Then re-run the card check (npm run og) if any page changed, and commit.` +
    `\n\n  If this site genuinely needs its own copy, take the group out of ${CONFIG_NAME}` +
    `\n  and own the file — there is no per-file override.` +
    `\n\n  A fence is generated: a block edited by hand in a page will be overwritten on the next ` +
    `sync — change it in the package instead.`);
  process.exit(1);
}

const written = applySync(siteRoot, entries, config);
applyFences(siteRoot, fenceEntries);
if (!written.length && !staleFences.length) {
  console.log(
    `  ✓ already in step — ${entries.length} file(s), ${fenceEntries.length} fence(s), nothing to write`);
} else {
  for (const to of written) console.log(`  → ${to}`);
  for (const e of staleFences) console.log(`  → ${e.page}  ${e.fence}`);
  console.log(
    `\n  ${written.length} file(s) and ${staleFences.length} fence(s) written. Review the diff and commit.`);
}
