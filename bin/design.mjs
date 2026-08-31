#!/usr/bin/env node
// design sync          write this package's files into the site
// design sync --check  compare only; exit 1 if any copy has drifted
//
// `--check` is what CI runs. It never writes, so a red build cannot be made green by the
// build itself — someone has to run `design sync` and commit, which is the whole point: the
// bytes a visitor downloads are in the repository, and they got there deliberately.
import fs from "node:fs";
import path from "node:path";

import {
  readConfig, planSync, applySync, CONFIG_NAME, planFences, applyFences,
} from "../lib/sync.mjs";
import { findFence, FenceError } from "../lib/rewrite.mjs";
import { FENCES } from "../lib/fences.mjs";

const USAGE = `usage: design sync [--check] [--site <dir>]

  sync            copy this package's files into the site
  sync --check    compare only, exit 1 if a copy has drifted (this is what CI runs)
  --site <dir>    the site root (default: the current directory)`;

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

const argv = process.argv.slice(2);
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

const entries = planSync(siteRoot, config);
const stale = entries.filter((e) => e.state !== "same");

let fenceEntries;
try {
  fenceEntries = planFences(siteRoot);
} catch (e) {
  if (e instanceof FenceError) fail(e.message, 2);
  throw e;
}
const staleFences = fenceEntries.filter((e) => e.state !== "same");

if (check) {
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

const written = applySync(siteRoot, entries);
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
