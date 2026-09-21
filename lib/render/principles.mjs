// Renders the vision and the values into principles/index.html from the artifact.
//
// The page is derived, never written. That is the claim the vision itself makes: everything
// public about this work comes from one model, and when a surface disagrees the model is what
// gets corrected. A hand-copied page would be a surface free to drift, which is the failure this
// idea exists to prevent.
//
// Rendered to HTML rather than to a data block: a crawler and an assistant have to read this
// without running JS, which is the entire reason the page exists.
//
// It reads entities rather than Markdown. It used to carry its own parser for the vision and
// value files — eighteen lines that enforced none of the numbered rules and answered to no
// version — while the pinned parser was already producing the same fields for the same files.
// One reading of the model is the point of the artifact, and this was the second one.
import fs from "node:fs";
import path from "node:path";

import { NOTE_EN, NOTE_DE } from "./note.mjs";

const START = "<!-- principles:start -->";
const END = "<!-- principles:end -->";

// A section's text is one string: paragraphs separated by a blank line, hard-wrapped inside.
// The page wants one <p> per paragraph with the wrapping undone.
export function paragraphs(text) {
  return text.split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).join(" ").trim())
    .filter(Boolean);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// `code` and em-dashes survive; nothing else in these files needs markup.
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code class="mono">$1</code>');

// The connective words are the page's, not the model's: the heading over the values, and the
// note that says why these blocks do not switch language with the rest of the site. The model
// owns the statements; this owns the frame around them. The note itself lives in note.mjs,
// because the team page writes the same sentence and two copies would drift.

// The title pages here all break the headline the same way: a muted first clause, then the rest
// in weight and its last word in the accent. The split is presentation, not content, so it is
// derived from the string rather than stored beside it — at the first comma, which is where this
// kind of sentence turns. A headline without one keeps its whole self in the second half, which
// is the same treatment with an empty first clause rather than a different one.
function headline(name) {
  const i = name.indexOf(",");
  const head = i === -1 ? "" : name.slice(0, i + 1);
  const rest = (i === -1 ? name : name.slice(i + 1)).trim();
  const words = rest.split(" ");
  const last = words.pop();
  const lead = words.length ? esc(words.join(" ")) + " " : "";
  return (head ? `<span class="r70">${esc(head)}</span>` : "") +
         `<span class="rcl">${lead}<em>${esc(last)}</em></span>`;
}

// Provenance, generated so it cannot go stale: which repository, which commit, and what that
// repository is an instance of. The CompanyGraph link is the disambiguation — the name invites
// the reading that it resolves company records, and it does not.
//
// The page's own words are bilingual like the rest of the site; only the model's stay in the
// one language it is written in, which is what the note above says. Static links inside
// `data-de` are the site's existing pattern — what must not go in there is anything a script
// rewrites, because the translated copy is one the script never reaches.
// Nested markup inside `data-de` uses single quotes — the site's convention for every
// translated attribute — and the attribute escapes only what would end it. Running the German
// through `esc` turned its tags into `&lt;a href=&quot;…`, which the browser decodes and
// renders identically, but which no search for the href or for `<a ` ever finds.
function derived(data) {
  const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const link = `<a href="https://github.com/${data.repo}">${data.repo}</a>@${data.commit.slice(0, 7)}`;
  const linkDE = `<a href='https://github.com/${data.repo}'>${data.repo}</a>@${data.commit.slice(0, 7)}`;
  const cg = `<a href="https://companygraph.io/">CompanyGraph</a>`;
  const cgDE = `<a href='https://companygraph.io/'>CompanyGraph</a>`;
  const derivedEN = `Generated from ${link} — <code class="mono">model/vision.md</code> and ` +
    `<code class="mono">model/values/</code>. That repository is an instance of ${cg}, ` +
    `a meta-model for describing a company as a graph of Markdown.`;
  const derivedDE = `Erzeugt aus ${linkDE} – <code class='mono'>model/vision.md</code> und ` +
    `<code class='mono'>model/values/</code>. Dieses Repository ist eine Instanz von ${cgDE}, ` +
    `einem Meta-Modell, das ein Unternehmen als Graph aus Markdown beschreibt.`;
  return `<p class="derived" data-de="${escAttr(derivedDE)}">${derivedEN}</p>`;
}

function render(data) {
  const v = data.entities.find((e) => e.type === "vision");
  if (!v) throw new Error("the model holds no vision entity");
  // Ordered by path, which is the file name, which is the order the folder listing gave before
  // the artifact existed. The page's order is therefore unchanged and stays a property of the
  // model rather than of this file.
  const values = data.entities.filter((e) => e.type === "value")
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const out = [];
  out.push(`    <div class="title">`);
  out.push(`      <h1>${headline(v.name)}</h1>`);
  out.push(`      <p class="tagline">${inline(v.tagline)}</p>`);
  out.push(`      <p class="note" data-de="${esc(NOTE_DE)}">${esc(NOTE_EN)}</p>`);
  out.push(`    </div>`);
  out.push(``);
  out.push(`    <section>`);
  out.push(`      <h2>${inline(v.sections[0].heading)}</h2>`);
  for (const p of paragraphs(v.sections[0].text)) out.push(`      <p class="lede">${inline(p)}</p>`);
  out.push(`    </section>`);
  out.push(``);
  out.push(`    <section>`);
  out.push(`      <h2 data-de="Werte">Values</h2>`);
  for (const x of values) {
    out.push(`      <article class="value">`);
    out.push(`        <h3>${inline(x.name)}</h3>`);
    out.push(`        <p class="tagline">${inline(x.tagline)}</p>`);
    for (const p of paragraphs(x.sections[0].text)) out.push(`        <p>${inline(p)}</p>`);
    out.push(`      </article>`);
  }
  out.push(`    </section>`);
  out.push(``);
  out.push(`    ${derived(data)}`);
  return out.join("\n");
}

export function writePrinciples(data, { check = false, root } = {}) {
  if (!root) throw new Error("writePrinciples needs the site's root: the page it writes is the site's, not this package's");
  const rel = "principles/index.html";
  const file = path.join(root, rel);
  const page = fs.readFileSync(file, "utf8");
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(page)) throw new Error(`${rel} has no ${START} … ${END} block`);
  // The replacement carries the model's own prose, and a `$&` in a value's text would be read as
  // a reference to the match rather than as two characters — writing the start marker into the
  // paragraph, and leaving a block that re-expands against itself on every later run. The
  // function form has no such reading, which is why `jsonld.mjs` writes its block the same way.
  const next = page.replace(re, () => `${START}\n${render(data)}\n    ${END}`);
  if (next === page) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
