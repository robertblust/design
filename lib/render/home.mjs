// Renders the vision and the values into a site's home page from the artifact: the vision as
// the heading over the ways to check it, each value beside the line it will not cross.
//
// Derived for the reason /principles/ is: the home page is the surface most people read, and a
// hand-copied value is the first thing to drift. The page's own words — the kickers, the tiles,
// the heading's frame — stay the site's; the heading's number is written here from the model,
// because a count typed by hand goes stale without a sound.
import fs from "node:fs";
import path from "node:path";

import { valuesOf, slugOf, addressOf, paragraphs, inline, inlineDe, escAttr, esc } from "./principles.mjs";

const WORDS = {
  en: ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"],
  de: ["", "", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn", "Elf", "Zwölf"],
};

// The heading reads as a plural, so one value would need a sentence of its own; that is a
// decision for the day it happens, not a form to guess now.
export function numberWord(n, lang) {
  if (!(n >= 2 && n <= 12)) throw new Error(`the heading is written for between two and twelve values, and the model has ${n}`);
  return WORDS[lang][n];
}

// The line a value will not cross is the last paragraph of its first section — the section
// /principles/ renders and blust.ch's German lookup carries — and it begins "I never" for a
// person or "We never" for a company. A value reworded so that it ends otherwise stops the
// build rather than put another sentence on the page.
export function neverOf(v) {
  if (!v.sections.length) throw new Error(`${v.id}: has no sections`);
  const last = paragraphs(v.sections[0].text).at(-1) || "";
  if (!/^(I|We) never\b/.test(last)) throw new Error(`${v.id}: its last paragraph does not begin "I never" or "We never"`);
  return last;
}

// The name turns at its first comma: the clause after it is the accent.
function turned(name, escape) {
  const i = name.indexOf(",");
  if (i === -1) throw new Error(`the vision's name has no comma to turn at: ${name}`);
  return `${escape(name.slice(0, i + 1))} <em>${escape(name.slice(i + 1).trim())}</em>.`;
}

function vision(data, de) {
  const v = data.entities.find((e) => e.type === "vision");
  if (!v) throw new Error("the model holds no vision entity");
  return [
    `      <h2 data-de="${escAttr(turned(de(v.name), esc))}">${turned(v.name, esc)}</h2>`,
    `      <p class="lede" data-de="${escAttr(inlineDe(de(v.tagline)))}">${inline(v.tagline)}</p>`,
  ].join("\n");
}

function values(data, de, heading) {
  const vs = valuesOf(data);
  const en = heading.en.replace("{n}", numberWord(vs.length, "en"));
  const hde = heading.de ? ` data-de="${escAttr(heading.de.replace("{n}", numberWord(vs.length, "de")))}"` : "";
  const out = [`      <h2${hde}>${en}</h2>`, `      <div class="values">`];
  for (const v of vs) {
    const never = neverOf(v);
    out.push(`        <a href="principles/#${slugOf(addressOf(v))}"><b data-de="${escAttr(inlineDe(de(v.name)))}">${inline(v.name)}</b>` +
      `<span data-de="${escAttr(inlineDe(de(never)))}">${inline(never)}</span></a>`);
  }
  out.push(`      </div>`);
  return out.join("\n");
}

function region(page, name, body) {
  const start = `<!-- ${name}:start -->`, end = `<!-- ${name}:end -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!re.test(page)) throw new Error(`index.html has no ${start} … ${end} block`);
  return page.replace(re, () => `${start}\n${body}\n      ${end}`);
}

export function writeHome(data, { check = false, root, de, heading } = {}) {
  if (!root) throw new Error("writeHome needs the site's root");
  if (!de) throw new Error("writeHome needs de: the home page is bilingual, the model's words included");
  if (!heading || !heading.en) throw new Error("writeHome needs the values heading, with {n} for the count");
  const rel = "index.html";
  const file = path.join(root, rel);
  const page = fs.readFileSync(file, "utf8");
  const next = region(region(page, "vision", vision(data, de)), "values", values(data, de, heading));
  if (next === page) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
