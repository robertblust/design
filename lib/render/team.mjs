// Renders the head rail, the board and the legend into team/index.html from the artifact.
//
// The board is generated rather than drawn at runtime for the reason the principles page is:
// a crawler and an assistant have to read it without running anything, and pages:check fails
// the moment it falls behind model.json. The cards under it are not generated — eight cards
// at rest would be eight copies of the model's own words in a page that already serves the
// model as a file, and this site's checks read the body at rest.
//
// No mark is typed. A cell is read off the phase's own owner, executed-by, supported-by and
// gate-approvers, so a phase that gains a seat gains a mark without anyone editing this file.
import fs from "node:fs";
import path from "node:path";
import { NOTE_EN, NOTE_DE } from "./note.mjs";

const START = "<!-- team:start -->";
const END = "<!-- team:end -->";
// The note sits in the title block, under the tagline, where /model/ and /principles/ put
// theirs — above the section label rather than under it, because it is about the page and
// not about the figure. It is still written from here rather than typed into the page: it is
// one sentence with one home, and a note explaining why a page does not translate is the
// note that must not say two different things on two pages.
const NOTE_START = "<!-- team-note:start -->";
const NOTE_END = "<!-- team-note:end -->";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The process the board draws. One process today; a second would need a decision about which
// one a page called /team/ shows, so this throws rather than picking.
function processOf(data) {
  const all = data.entities.filter((e) => e.type === "process");
  if (all.length !== 1) throw new Error(`the model holds ${all.length} processes; the board draws one`);
  return all[0];
}

// Phase order is the rows of the process's Phases table, not the folder listing: the files sort
// alphabetically and the phases are a sequence. Core 0.30.0 made the section a table of names,
// one row per phase in order, and left its text empty, so the rows are the only place the order
// is written; the parser keeps them as they stand.
export function phasesOf(data) {
  const proc = processOf(data);
  const sec = (proc.sections || []).find((s) => /^Phases$/i.test(s.heading));
  if (!sec) throw new Error(`${proc.path} has no Phases section`);
  const table = (sec.tables || []).find((t) => t.columns.includes("Phase"));
  const names = table ? table.rows.map((r) => r[table.columns.indexOf("Phase")]).filter(Boolean) : [];
  if (!names.length) throw new Error(`${proc.path}'s Phases section lists no phase`);
  // A phase's name is unique within its process only (core 0.31.0), so the row is read there.
  return names.map((n) => {
    const p = data.entities.find((e) => e.type === "phase" && e.owner === proc.id && e.name === n);
    if (!p) throw new Error(`${proc.path} names a phase the model does not hold: ${n}`);
    return p;
  });
}

// Roles in the order the profiles hold them, the human profile's first: the board's first row
// is the seat that approves every gate, and that is the page's argument rather than a sort.
export function seatsOf(data) {
  const profiles = data.entities.filter((e) => e.type === "profile")
    .sort((a, b) => (a.fields.nature === "human" ? -1 : b.fields.nature === "human" ? 1 : 0));
  const seats = [];
  for (const p of profiles) {
    for (const name of p.fields.roles || []) {
      const role = data.entities.find((e) => e.type === "role" && e.name === name);
      if (!role) throw new Error(`${p.path} holds a role the model does not hold: ${name}`);
      if (!seats.some((s) => s.role.id === role.id)) seats.push({ role, profile: p });
    }
  }
  if (!seats.length) throw new Error("no profile in the model holds a role; the board would be empty");
  return seats;
}

export function marksOf(data) {
  const phases = phasesOf(data);
  const out = {};
  for (const { role } of seatsOf(data)) out[role.name] = phases.map(() => []);
  phases.forEach((p, i) => {
    const f = p.fields || {};
    // A phase with no executed-by is executed by the seat that owns it. The model writes both
    // forms and means the same thing by them.
    const exec = f["executed-by"] || (f.owner ? [f.owner] : []);
    const put = (names, mark) => {
      for (const n of names || []) {
        if (out[n] && !out[n][i].includes(mark)) out[n][i].push(mark);
      }
    };
    put(exec, "ex");
    put(f["supported-by"], "su");
    put(f["gate-approvers"], "ga");
  });
  return out;
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// What a screen reader gets instead of a table: the row as a sentence. Giving a <summary>
// role="row" would replace the semantics that announce it as an expandable control, which is
// the one thing a reader arriving on it by keyboard needs, and a matrix read as five unlabeled
// cells is worse than no matrix.
function rowLabel(role, profile, phases, cells) {
  const did = (mark) => phases.filter((_, i) => cells[i].includes(mark)).map((p) => p.name);
  const parts = [`${role.name}, ${profile.fields.nature}`];
  const ex = did("ex"), su = did("su"), ga = did("ga");
  if (ex.length) parts.push(`executes ${ex.join(", ")}`);
  if (su.length) parts.push(`supports ${su.join(", ")}`);
  parts.push(ga.length ? `approves the gate of ${ga.join(", ")}` : "approves no gate");
  return `${parts.join(". ")}.`;
}

// Human is filled, agent is outlined, and neither is a second hue: tokens.css allows one hue at
// four brightnesses and refuses a second in writing, so the two natures are told apart by form,
// the way the timeline tells its five kinds apart by shape. The symbols are in the page.
const MARK_HUMAN = '<svg class="mk human" aria-hidden="true"><use href="#m-human"/></svg>';
const MARK_AGENT = '<svg class="mk agent" aria-hidden="true"><use href="#m-agent"/></svg>';
const markFor = (p) => (p.fields.nature === "human" ? MARK_HUMAN : MARK_AGENT);

function render(data) {
  const phases = phasesOf(data), seats = seatsOf(data), marks = marksOf(data);
  const profiles = [...new Set(seats.map((s) => s.profile))];
  const out = [];


  out.push(`      <div class="hdrail"><div class="whos">`);
  for (const p of profiles) {
    const held = seats.filter((s) => s.profile === p).length;
    out.push(`        <div class="hw">${markFor(p)}<div><div class="nm">${esc(p.name)}</div>` +
      `<div class="lbl">${esc(p.fields.nature)} · holds ${held} of ${seats.length}</div></div></div>`);
  }
  out.push(`      </div><button class="openall" id="openall" type="button" data-de="Alle öffnen">Open all</button></div>`);

  out.push(`      <div class="grid" id="board">`);
  out.push(`        <div class="ghead"><span class="lbl">Seat</span>` +
    phases.map((p, i) => `<span><span class="phnum">${String(i + 1).padStart(2, "0")}</span>` +
      `<span class="phname">${esc(p.name)}</span></span>`).join("") + `</div>`);
  for (const { role, profile } of seats) {
    const cells = marks[role.name];
    const cls = profile.fields.nature === "human" ? ` class="human"` : "";
    out.push(`        <details${cls} id="${slug(role.name)}" data-role="${esc(role.id)}">`);
    out.push(`          <summary aria-label="${esc(rowLabel(role, profile, phases, cells))}">` +
      `<span class="sname">${markFor(profile)}<span class="tw">${esc(role.name)}</span></span>` +
      cells.map((c) => `<span>${c.map((g) => `<i class="g ${g}"></i>`).join("")}</span>`).join("") +
      // The same row again, for a width with no columns to put it in. Both forms are in the
      // markup and the stylesheet shows one, so a rotation re-renders nothing and never loses
      // what was open — the rule the timeline's gutter already follows. aria-hidden, because
      // the summary's own label says the row in words, and two readings of one row is what
      // the tooltip was removed for.
      `</summary>`);
    out.push(`          <div class="drawer"><div class="card"><div class="cbody"></div>` +
      `<div class="cfoot"><span></span></div></div></div>`);
    out.push(`        </details>`);
  }
  out.push(`      </div>`);

  out.push(`      <div class="legend">` +
    `<span><i class="g ex"></i> <span data-de="führt die Phase aus">executes the phase</span></span>` +
    `<span><i class="g su"></i> <span data-de="unterstützt sie">supports it</span></span>` +
    `<span><i class="g ga"></i> <span data-de="gibt ihr Gate frei">approves its gate</span></span>` +
    `<span>${MARK_HUMAN} <span data-de="Mensch">human</span></span>` +
    `<span>${MARK_AGENT} <span data-de="Agent">agent</span></span></div>`);

  // What each column is. The board names the five phases and says who touches them, and until
  // this block the page said nowhere what any of them is for — the tooltip that would have
  // carried it was taken off this page, and a heading is not a place for a sentence. The
  // taglines are the model's own words, so they stay English here for the reason the note
  // above the board gives, while the numbers and the heading are the page's.
  out.push(`      <dl class="phases">`);
  phases.forEach((p, i) => {
    out.push(`        <dt><span class="phnum">${String(i + 1).padStart(2, "0")}</span>` +
      `<span class="phname">${esc(p.name)}</span></dt>`);
    out.push(`        <dd>${esc(p.tagline || "")}</dd>`);
  });
  out.push(`      </dl>`);
  return out.join("\n");
}

export function writeTeam(data, { check = false, root } = {}) {
  if (!root) throw new Error("writeTeam needs the site's root: the page it writes is the site's, not this package's");
  const rel = "team/index.html";
  const file = path.join(root, rel);
  const page = fs.readFileSync(file, "utf8");

  // Two regions, one renderer: the note in the title block and the board in the figure
  // section. They are written together because they are read from the same artifact, and a
  // page carrying one marker and not the other is a page half-generated.
  const regions = [
    [NOTE_START, NOTE_END, "    ",
     () => `      <p class="note" data-de="${esc(NOTE_DE)}">${esc(NOTE_EN)}</p>`],
    [START, END, "      ", () => render(data)],
  ];
  let next = page;
  for (const [start, end, indent, body] of regions) {
    const re = new RegExp(`${start}[\\s\\S]*?${end}`);
    if (!re.test(next)) throw new Error(`${rel} has no ${start} … ${end} block`);
    // The replacement carries the model's own prose, and a `$&` in a tagline would be read as
    // a reference to the match rather than as two characters. The function form has no such
    // reading, which is why principles.mjs and jsonld.mjs write their blocks the same way.
    next = next.replace(re, () => `${start}\n${body()}\n${indent}${end}`);
  }

  if (next === page) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
