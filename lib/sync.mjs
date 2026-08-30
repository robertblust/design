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
  return { groups };
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
