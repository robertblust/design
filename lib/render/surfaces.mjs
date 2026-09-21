// Renders the lineage — the model, whoever makes each surface, and the surfaces — into
// surfaces/index.html from the artifact.
//
// The nodes are generated for the reason the team board is: a crawler and an assistant read them
// without running anything, and pages:check fails the moment they fall behind model.json. The
// lines between them are not. They are drawn by the page from where the nodes landed, because
// only the browser knows that, and they carry nothing the nesting of the lists does not already
// say. The cards are fetched on demand, as on /team/.
//
// No line is typed. A surface sits under the maker its own `production` and `built-by` name, so
// a surface that changes how it is made moves without anyone editing this file.
import fs from "node:fs";
import path from "node:path";
import { NOTE_EN, NOTE_DE } from "./note.mjs";

const START = "<!-- surfaces:start -->";
const END = "<!-- surfaces:end -->";
const NOTE_START = "<!-- surfaces-note:start -->";
const NOTE_END = "<!-- surfaces-note:end -->";
const GITHUB = "https://github.com/";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// What a visitor reads as the address: host and path, without the scheme or a trailing slash,
// the way the card writes a link out of the model.
export const hostOf = (url) => String(url).replace(/^https?:\/\//, "").replace(/^www\./, "")
  .replace(/\?.*$/, "").replace(/\/$/, "");

// The makers in the order the drawing stacks them: the hand first, because a person is the one
// maker nothing re-runs, then each build by the repository's name. Inside a maker, surfaces sort
// by name in English, one rule a reader can predict.
export function makersOf(data) {
  const surfaces = data.entities.filter((e) => e.type === "surface");
  if (!surfaces.length) throw new Error("the model holds no surface; the page would draw nothing");
  const byKey = new Map();
  for (const s of surfaces) {
    const f = s.fields || {};
    let key;
    if (f.production === "written") key = "hand";
    else if (f.production === "built") {
      if (!f["built-by"]) throw new Error(`${s.path} is built but names no built-by`);
      if (!f["built-by"].startsWith(GITHUB)) throw new Error(`${s.path} is built by something that is not a repository: ${f["built-by"]}`);
      key = f["built-by"];
    } else throw new Error(`${s.path} has a production this page does not draw: ${f.production}`);
    if (!f.url) throw new Error(`${s.path} names no url`);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a === "hand" ? -1 : b === "hand" ? 1 : a.localeCompare(b, "en")))
    .map(([key, list]) => ({
      key,
      hand: key === "hand",
      repo: key === "hand" ? null : key.slice(GITHUB.length),
      surfaces: list.sort((a, b) => a.name.localeCompare(b.name, "en")),
    }));
}

const slug = (s) => s.id.split("/").slice(1).join("-");

// The same two natures /team/ tells apart by form, never by a second hue: the pen is filled
// because a person holds it, the build is outlined because a machine runs it. The symbols are
// in the page.
const MARK_HAND = '<svg class="mk hand" aria-hidden="true"><use href="#m-hand"/></svg>';
const MARK_BUILD = '<svg class="mk build" aria-hidden="true"><use href="#m-build"/></svg>';

function render(data) {
  const makers = makersOf(data);
  const out = [];
  const name = String(data.repo || "").split("/")[1];
  if (!name) throw new Error(`the artifact names no repository to draw as the model: ${data.repo}`);

  out.push(`      <div class="lineage" id="lineage">`);
  out.push(`        <svg class="wires" id="wires" aria-hidden="true"></svg>`);
  out.push(`        <div class="ln-model" id="lnmodel"><div class="lbl" data-de="Das Modell">The model</div>` +
    `<div class="nm">${esc(name)}</div><div class="at mono">@${esc(data.commit.slice(0, 7))}</div></div>`);
  out.push(`        <ul class="ln-groups">`);
  for (const m of makers) {
    const who = m.hand
      ? `<span data-de="Der Owner">The owner</span><span class="how" data-de="von Hand">by hand</span>`
      : `${esc(m.repo.split("/").pop())}<span class="how" data-de="Build">build</span>`;
    out.push(`          <li class="ln-group${m.hand ? " hand" : ""}">`);
    out.push(`            <div class="ln-maker" data-maker="${esc(m.key)}">${m.hand ? MARK_HAND : MARK_BUILD}` +
      `<span class="who">${who}</span></div>`);
    out.push(`            <ul class="ln-surfaces">`);
    for (const s of m.surfaces) {
      out.push(`              <li><button class="ln-s" type="button" id="${esc(slug(s))}" data-id="${esc(s.id)}" ` +
        `data-maker="${esc(m.key)}" aria-pressed="false" aria-controls="lnpanel">` +
        `<span class="nm">${esc(s.name)}</span><span class="host">${esc(hostOf(s.fields.url))}</span></button></li>`);
    }
    out.push(`            </ul>`);
    out.push(`          </li>`);
  }
  out.push(`        </ul>`);
  out.push(`      </div>`);
  return out.join("\n");
}

export function writeSurfaces(data, { check = false, root } = {}) {
  if (!root) throw new Error("writeSurfaces needs the site's root: the page it writes is the site's, not this package's");
  const rel = "surfaces/index.html";
  const file = path.join(root, rel);
  const page = fs.readFileSync(file, "utf8");

  const regions = [
    [NOTE_START, NOTE_END, "    ",
     () => `      <p class="note" data-de="${esc(NOTE_DE)}">${esc(NOTE_EN)}</p>`],
    [START, END, "      ", () => render(data)],
  ];
  let next = page;
  for (const [start, end, indent, body] of regions) {
    const re = new RegExp(`${start}[\\s\\S]*?${end}`);
    if (!re.test(next)) throw new Error(`${rel} has no ${start} … ${end} block`);
    // The function form, so a `$&` in a surface's name is two characters and not a reference.
    next = next.replace(re, () => `${start}\n${body()}\n${indent}${end}`);
  }

  if (next === page) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
