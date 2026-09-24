// Renders a site's team page from the artifact: the note, the head rail, one board per process
// with its legend, and the phases in words.
//
// The board is generated rather than drawn at runtime for the reason the principles page is:
// a crawler and an assistant have to read it without running anything, and a site's page check
// can fail the moment it falls behind the artifact it was written from. The cards under it are
// not generated — a card per seat at rest would be a copy of the model's own words for every
// seat, in a page whose site already serves the model as a file, and a page check that reads
// the body at rest would read them all.
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

// The processes the page draws. No process carries a rank in core, so the order is the site's
// to give: `order` names processes to draw first, in that order, and the rest follow in the order
// the artifact lists them. A name the model does not hold is an error rather than a board that
// quietly moves.
export function processesOf(data, order = []) {
  const all = data.entities.filter((e) => e.type === "process");
  if (!all.length) throw new Error("the model holds no process; the board would be empty");
  const named = order.map((n) => {
    const p = all.find((x) => x.name === n);
    if (!p) throw new Error(`the order names a process the model does not hold: ${n}`);
    return p;
  });
  return [...named, ...all.filter((p) => !named.includes(p))];
}

// Phase order is the rows of the process's Phases table, not the folder listing: the files sort
// alphabetically and the phases are a sequence. Core 0.30.0 made the section a table of names,
// one row per phase in order, and left its text empty, so the rows are the only place the order
// is written; the parser keeps them as they stand.
export function phasesOf(data, proc) {
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

// The seats a process names — its own owner and supported-by, and every phase's owner,
// executed-by, supported-by, gate-approvers and escalation-authority.
function rolesNamedBy(data, proc) {
  const names = new Set();
  const add = (v) => [].concat(v || []).forEach((n) => names.add(n));
  add(proc.fields.owner); add(proc.fields["supported-by"]);
  for (const ph of phasesOf(data, proc)) {
    const f = ph.fields || {};
    add(f.owner); add(f["executed-by"]); add(f["supported-by"]);
    add(f["gate-approvers"]); add(f["escalation-authority"]);
  }
  return names;
}

// The rows of one board, in the order the page argues: the seat that owns the process first, as
// the process's own file names it, then a person's seats, then the seats no profile holds —
// which a model says are held by a person — then an agent's. Within a profile the
// order is the profile's own. A seat no profile holds is drawn with no name beside it, because
// which person holds it is a fact the model does not carry.
//
// A role names nobody and any number of profiles may list it, so every row carries all of its
// holders, in the order the profiles stand in the model. A seat a person shares with an agent
// is a person's seat, and takes its place among them.
export function seatsOf(data, proc) {
  const named = rolesNamedBy(data, proc);
  const roleOf = (name) => data.entities.find((e) => e.type === "role" && e.name === name);
  const profiles = data.entities.filter((e) => e.type === "profile");
  const human = profiles.filter((p) => p.fields.nature === "human");
  const agent = profiles.filter((p) => p.fields.nature !== "human");
  const holdersOf = (name) => profiles.filter((p) => (p.fields.roles || []).includes(name));
  const seats = [], placed = new Set();
  const take = (p) => {
    for (const name of p.fields.roles || []) {
      if (!named.has(name) || placed.has(name)) continue;
      const role = roleOf(name);
      if (!role) throw new Error(`${p.path} holds a role the model does not hold: ${name}`);
      seats.push({ role, holders: holdersOf(name) }); placed.add(name);
    }
  };
  human.forEach(take);
  const held = new Set(profiles.flatMap((p) => p.fields.roles || []));
  for (const role of data.entities.filter((e) => e.type === "role")) {
    if (named.has(role.name) && !held.has(role.name)) { seats.push({ role, holders: [] }); placed.add(role.name); }
  }
  agent.forEach(take);
  if (!seats.length) throw new Error(`${proc.path} names no seat the model holds; its board would be empty`);
  const lead = seats.findIndex(({ role }) => role.name === proc.fields.owner);
  if (lead > 0) seats.unshift(...seats.splice(lead, 1));
  return seats;
}

export function marksOf(data, proc) {
  const phases = phasesOf(data, proc);
  const out = {};
  for (const { role } of seatsOf(data, proc)) out[role.name] = phases.map(() => []);
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

// The id prefix a process's board takes when a page draws more than one. Exported for the page
// check in verify/model-pages.mjs, which has to find each board by the id this file gives it.
export const procSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slug = procSlug;

// What a screen reader gets instead of a table: the row as a sentence. Giving a <summary>
// role="row" would replace the semantics that announce it as an expandable control, which is
// the one thing a reader arriving on it by keyboard needs, and a matrix read as a run of unlabeled
// cells is worse than no matrix.
function rowLabel(role, holders, phases, cells) {
  const did = (mark) => phases.filter((_, i) => cells[i].includes(mark)).map((p) => p.name);
  // A shared seat says who shares it, since its stacked mark says only that someone does.
  const who = holders.length > 1
    ? `, held by ${holders.slice(0, -1).map((p) => p.name).join(", ")} and ${holders.at(-1).name}` : "";
  const parts = [`${role.name}, ${natureOf(holders)}${who}`];
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
// A seat no profile holds is a person's: a model names no holder for a human seat when which
// person sits in it is not its to say, and an agent is always a profile of its own. A seat held
// by a person and an agent together is both, and a person's row.
const natureOf = (holders) => {
  if (!holders.length) return "human";
  const n = new Set(holders.map((p) => p.fields.nature === "human" ? "human" : "agent"));
  return n.size > 1 ? "human and agent" : [...n][0];
};
const isHuman = (holders) => natureOf(holders) !== "agent";
// Several holders draw two marks, one behind the other: form says "more than one" the way it
// says human or agent, with no second hue. A person's filled mark stands in front when there is
// one; the mark behind is another holder's. Two marks at most, since the names are the count.
const markFor = (holders) => {
  const one = (p) => (p.fields.nature === "human" ? MARK_HUMAN : MARK_AGENT);
  if (holders.length < 2) return holders.length ? one(holders[0]) : MARK_HUMAN;
  const front = holders.find((p) => p.fields.nature === "human") || holders[0];
  const back = holders.find((p) => p !== front && p.fields.nature !== front.fields.nature)
    || holders.find((p) => p !== front);
  return `<span class="stack">${one(back)}${one(front)}</span>`;
};

function renderBoard(data, proc, prefix) {
  const phases = phasesOf(data, proc), seats = seatsOf(data, proc), marks = marksOf(data, proc);
  // The rail's entries in the order their seats stand, so the seats no profile holds fall after
  // the people and before the agents, as their rows do. Profiles that hold exactly the same
  // seats on this board are one entry, so the counts on the rail add up to the board's; a
  // profile whose seats differ keeps its own, counting every seat it sits in, shared or not.
  const seatsHeldBy = (p) => seats.filter((s) => s.holders.includes(p)).map((s) => s.role.name).join("\n");
  const entries = [];
  for (const { holders } of seats) {
    if (!holders.length) {
      if (!entries.some((e) => !e.profiles.length)) entries.push({ profiles: [] });
      continue;
    }
    for (const p of holders) {
      if (entries.some((e) => e.profiles.includes(p))) continue;
      const same = entries.find((e) => e.profiles.length && seatsHeldBy(e.profiles[0]) === seatsHeldBy(p));
      if (same) same.profiles.push(p); else entries.push({ profiles: [p] });
    }
  }
  const out = [];


  out.push(`      <div class="hdrail"><div class="whos">`);
  for (const { profiles } of entries) {
    if (!profiles.length) {
      const held = seats.filter((s) => !s.holders.length).length;
      out.push(`        <div class="hw">${MARK_HUMAN}<div><div class="lbl">human · holds ${held} of ${seats.length}</div></div></div>`);
      continue;
    }
    const held = seats.filter((s) => s.holders.includes(profiles[0])).length;
    const nature = natureOf(profiles);
    const lbl = profiles.length > 1
      ? `${nature === "human and agent" ? nature : `${nature}s`} · share ${held} of ${seats.length}`
      : `${profiles[0].fields.nature} · holds ${held} of ${seats.length}`;
    out.push(`        <div class="hw">${markFor(profiles)}<div><div class="nm">${esc(profiles.map((p) => p.name).join(", "))}</div>` +
      `<div class="lbl">${esc(lbl)}</div></div></div>`);
  }
  out.push(`      </div><button class="openall" id="${prefix}openall" type="button" data-de="Alle öffnen">Open all</button></div>`);

  out.push(`      <div class="grid" id="${prefix}board">`);
  out.push(`        <div class="ghead"><span class="lbl">Seat</span>` +
    phases.map((p, i) => `<span><span class="phnum">${String(i + 1).padStart(2, "0")}</span>` +
      `<span class="phname">${esc(p.name)}</span></span>`).join("") + `</div>`);
  for (const { role, holders } of seats) {
    const cells = marks[role.name];
    const cls = isHuman(holders) ? ` class="human"` : "";
    out.push(`        <details${cls} id="${prefix}${slug(role.name)}" data-role="${esc(role.id)}">`);
    out.push(`          <summary aria-label="${esc(rowLabel(role, holders, phases, cells))}">` +
      `<span class="sname">${markFor(holders)}<span class="tw">${esc(role.name)}</span></span>` +
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

  // What each column is. The board names the phases and says who touches them, and until
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

function render(data, order) {
  const procs = processesOf(data, order);
  // One process draws exactly the board this renderer drew before a second process was
  // possible, ids and all, so a site with one process sees nothing change.
  if (procs.length === 1) return renderBoard(data, procs[0], "");
  // Several draw a board each under the process's own name. The ids take the process's slug,
  // because a seat that sits in two processes is two rows and one page cannot hold two elements
  // with one id.
  return procs.map((p) => [
    `      <section class="proc" id="${slug(p.name)}">`,
    `        <h3 class="procname">${esc(p.name)}</h3>`,
    p.tagline ? `        <p class="proctag">${esc(p.tagline)}</p>` : null,
    renderBoard(data, p, `${slug(p.name)}-`),
    `      </section>`,
  ].filter((l) => l !== null).join("\n")).join("\n");
}

export function writeTeam(data, { check = false, root, order = [] } = {}) {
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
    [START, END, "      ", () => render(data, order)],
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
