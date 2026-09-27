// The German of the model's words, held to the exact English it was made from. The model is
// written in English and stays so; a site's own `principles.de.json` is its translation of it.
// An entry is looked up by its English, so a sentence reworded in the model finds no German and
// stops the build, and the entry made for the old sentence is reported as unused rather than kept
// as dead German. The German is made by the roles of conventions/WRITING.md, never edited here by
// hand alone. This loader is the package's rather than one site's own, because every site needs
// the same lookup and the same failure shape; it names the file each caller passed it, relative
// to the working directory the build ran from, rather than assuming any one site's path.
import fs from "node:fs";
import path from "node:path";

import { valuesOf, paragraphs } from "./principles.mjs";

export function loadGerman(file) {
  const label = path.relative(process.cwd(), file);
  const entries = JSON.parse(fs.readFileSync(file, "utf8"));
  const map = new Map();
  for (const { en, de } of entries) {
    if (map.has(en)) throw new Error(`${label} holds the English twice: "${en}"`);
    map.set(en, de);
  }
  const asked = new Set();
  return {
    de(en) {
      if (!map.has(en)) throw new Error(`no German for: "${en}" — add it to ${label}`);
      asked.add(en);
      return map.get(en);
    },
    unused: () => [...map.keys()].filter((en) => !asked.has(en)),
  };
}

// What the translator is given: every English string the home page and /principles/ translate.
export function strings(data) {
  const v = data.entities.find((e) => e.type === "vision");
  const out = [v.name, v.tagline];
  for (const s of v.sections.slice(0, 1)) out.push(s.heading, ...paragraphs(s.text));
  for (const x of valuesOf(data)) out.push(x.name, x.tagline, ...paragraphs(x.sections[0].text));
  return [...new Set(out)];
}
