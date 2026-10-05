// Renders "Where your data goes" into privacy/index.html from the artifact: the visit, the keys
// the browser keeps grouped by how long they last, each processing activity with the data
// processors it hands data to, in the lineage /surfaces/ draws, so the same block draws its wires
// and opens each entry's card. The model's words carry their German from the site's
// build/privacy.de.json, held to the exact English by loadGerman, because a privacy page is where
// a German-speaking visitor most needs the German; the words this file writes itself carry theirs
// here, as NOTE_DE does.
//
// No line is typed. A key sits under its mechanism and a processor under each activity whose
// Processors table names it, so a model that changes moves the page on the next build, and a page
// that names less than the model holds fails pages:check.
import fs from "node:fs";
import path from "node:path";

const START = "<!-- privacy:start -->";
const END = "<!-- privacy:end -->";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const trimDot = (s) => String(s).trim().replace(/\.$/, "");

// The mechanisms in the order the drawing stacks them, each with the words its group line carries.
const MECHANISMS = [
  ["local-storage", { en: "Kept in your browser", de: "In Ihrem Browser gehalten" }, { en: "until you clear it · never sent", de: "bis Sie ihn löschen · nie gesendet" }],
  ["session-storage", { en: "Kept in this tab", de: "In diesem Tab gehalten" }, { en: "until the tab closes · never sent", de: "bis der Tab schliesst · nie gesendet" }],
  ["cookie", { en: "Cookies", de: "Cookies" }, { en: "never sent on their own", de: "nie von sich aus gesendet" }],
  ["indexeddb", { en: "IndexedDB", de: "IndexedDB" }, { en: "never sent on its own", de: "nie von sich aus gesendet" }],
  ["cache", { en: "Cache", de: "Cache" }, { en: "never sent on its own", de: "nie von sich aus gesendet" }],
];

const BASIS = {
  "consent": { en: "consent", de: "Einwilligung" },
  "contract": { en: "contract", de: "Vertrag" },
  "legal-obligation": { en: "legal obligation", de: "rechtliche Pflicht" },
  "vital-interests": { en: "vital interests", de: "lebenswichtige Interessen" },
  "public-task": { en: "public task", de: "öffentliche Aufgabe" },
  "legitimate-interests": { en: "legitimate interests", de: "berechtigte Interessen" },
};

const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

// A retention in the words of the group line: its number of days in digits where it states one,
// "in your tab only" where it keeps the data in the tab, and otherwise the retention as written.
export function retentionWords(retention) {
  const r = String(retention || "");
  const m = r.match(/\b(\d+|[a-z]+)\s+days?\b/i);
  const n = m && (/^\d+$/.test(m[1]) ? Number(m[1]) : NUMBERS[m[1].toLowerCase()]);
  if (n) return { en: `${n} days`, de: `${n} Tage`, fixed: true };
  if (/\btab\b/i.test(r)) return { en: "in your tab only", de: "nur in Ihrem Tab", fixed: true };
  return { en: trimDot(r), de: null, fixed: false };
}

const rowsOf = (activity) => {
  const s = (activity.sections || []).find((x) => x.heading === "Processors");
  return s && s.tables && s.tables[0] ? s.tables[0].rows : [];
};

export function pathOf(data, { site } = {}) {
  const items = data.entities.filter((e) => e.type === "stored-item");
  const activities = data.entities.filter((e) => e.type === "processing-activity");
  const processors = data.entities.filter((e) => e.type === "data-processor");
  if (!items.length && !activities.length && !processors.length)
    throw new Error("the model holds no stored item, processing activity or data processor; the page would say the site keeps and sends nothing");
  const byName = new Map(processors.map((p) => [p.name, p]));
  const groups = [];
  for (const [mechanism, who, how] of MECHANISMS) {
    const mine = items.filter((i) => i.fields.mechanism === mechanism)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const i of mine) if (!(i.fields.surfaces || []).length) throw new Error(`${i.address} names no surface`);
    if (!mine.length) continue;
    groups.push({ key: mechanism, hand: true, who: { ...who }, how: { ...how },
      entries: mine.map((i) => ({ id: i.id, slug: `key-${slugify(i.name)}`, name: i.name, line: { en: trimDot(i.tagline), de: null, model: true } })) });
  }
  for (const a of activities) {
    const basis = BASIS[a.fields["legal-basis"]];
    if (!basis) throw new Error(`${a.address} has no legal-basis this page can draw: ${a.fields["legal-basis"]}`);
    const ret = retentionWords(a.fields.retention);
    const entries = rowsOf(a).map(([name, receives]) => {
      const p = byName.get(name);
      if (!p) throw new Error(`${a.address} names ${name} in its Processors, and the model holds no such data processor`);
      const countries = (p.fields.countries || []).join(", ");
      const any = p.fields.processing === "any";
      return { id: p.id, slug: `${slugify(a.name)}-${slugify(p.name)}`, name: p.name,
        line: { prefix: { en: `${any ? "any country · stored " : ""}${countries} · `, de: `${any ? "jedes Land · gespeichert " : ""}${countries} · ` },
          en: `${any ? "any country · stored " : ""}${countries} · ${trimDot(receives)}`, receives: trimDot(receives), de: null, model: true } };
    });
    groups.push({ key: `activity:${a.id}`, hand: false,
      who: { en: a.name, de: null, model: true },
      how: { en: `${basis.en} · ${ret.en}`, basis, ret },
      entries });
  }
  return { root: { site, commit: String(data.commit).slice(0, 7) }, groups };
}

export function privacyStrings(data) {
  const p = pathOf(data, { site: "" });
  const out = [];
  for (const g of p.groups) {
    if (g.who.model) out.push(g.who.en);
    if (g.how.ret && !g.how.ret.fixed && g.how.ret.en) out.push(g.how.ret.en);
    for (const e of g.entries) out.push(e.line.receives ?? e.line.en);
  }
  return [...new Set(out)];
}

// One attribute: the German beside the English where the caller translates, nothing otherwise.
const deAttr = (de) => (de == null ? "" : ` data-de="${esc(de)}"`);

const MARK_HAND = '<svg class="mk hand" aria-hidden="true"><use href="#m-hand"/></svg>';
const MARK_BUILD = '<svg class="mk build" aria-hidden="true"><use href="#m-build"/></svg>';

function render(p, de) {
  const t = (en) => (de ? de(en) : null);
  const out = [];
  out.push(`      <div class="lineage" id="lineage">`);
  out.push(`        <svg class="wires" id="wires" aria-hidden="true"></svg>`);
  out.push(`        <div class="ln-model" id="lnmodel"><div class="lbl"${deAttr(de ? `Auf ${p.root.site}` : null)}>On ${esc(p.root.site)}</div>` +
    `<div class="nm"${deAttr(de ? "Ihr Besuch" : null)}>Your visit</div><div class="at mono">@${esc(p.root.commit)}</div></div>`);
  out.push(`        <ul class="ln-groups">`);
  for (const g of p.groups) {
    let who, how;
    if (g.hand) {
      who = `<span${deAttr(de ? g.who.de : null)}>${esc(g.who.en)}</span>`;
      how = `<span class="how"${deAttr(de ? g.how.de : null)}>${esc(g.how.en)}</span>`;
    } else {
      const retDe = g.how.ret.fixed ? g.how.ret.de : t(g.how.ret.en);
      who = `<span${deAttr(t(g.who.en))}>${esc(g.who.en)}</span>`;
      how = `<span class="how"${deAttr(de ? `${g.how.basis.de} · ${retDe}` : null)}>${esc(`${g.how.basis.en} · ${g.how.ret.en}`)}</span>`;
    }
    out.push(`          <li class="ln-group${g.hand ? " hand" : ""}">`);
    out.push(`            <div class="ln-maker" data-maker="${esc(g.key)}">${g.hand ? MARK_HAND : MARK_BUILD}<span class="who">${who}${how}</span></div>`);
    out.push(`            <ul class="ln-surfaces">`);
    for (const e of g.entries) {
      const lineEn = e.line.en;
      const lineDe = de ? (e.line.prefix ? `${e.line.prefix.de}${t(e.line.receives)}` : t(e.line.en)) : null;
      out.push(`              <li><button class="ln-s" type="button" id="${esc(e.slug)}" data-id="${esc(e.id)}" data-maker="${esc(g.key)}" ` +
        `aria-pressed="false" aria-controls="lnpanel"><span class="nm">${esc(e.name)}</span><span class="host"${deAttr(lineDe)}>${esc(lineEn)}</span></button></li>`);
    }
    out.push(`            </ul>`);
    out.push(`          </li>`);
  }
  out.push(`        </ul>`);
  out.push(`      </div>`);
  return out.join("\n");
}

export function writePrivacy(data, { check = false, root, site, de } = {}) {
  if (!root) throw new Error("writePrivacy needs the site's root: the page it writes is the site's, not this package's");
  if (!site) throw new Error("writePrivacy needs the site's host, which the drawing's root names");
  const rel = "privacy/index.html";
  const file = path.join(root, rel);
  const page = fs.readFileSync(file, "utf8");
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(page)) throw new Error(`${rel} has no ${START} … ${END} block`);
  const body = render(pathOf(data, { site }), de);
  // The function form, so a `$&` in a model string is two characters and not a reference.
  const next = page.replace(re, () => `${START}\n${body}\n      ${END}`);
  if (next === page) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
