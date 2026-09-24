// A page's German values by stable id. The German of a page lives in attributes and in one
// script object, and an agent that reads German without the English, or writes German back
// without touching the markup around it, needs each value addressed by something that does
// not move when the text does: its position among the page's German values.
//
// Ids: a<n> for the n-th data-de, data-notes-de or data-de-aria attribute in source order,
// and js.title / js.desc for the de:{ title, desc } object a page or a deck declares.

const ATTR = /\b(data-de|data-notes-de|data-de-aria)=(["'])([\s\S]*?)\2/dg;
const JS_DE = /de:\s*\{\s*title:\s*(["'])([\s\S]*?)\1\s*,\s*desc:\s*(["'])([\s\S]*?)\3/d;
const JS_EN = /en:\s*\{\s*title:\s*(["'])([\s\S]*?)\1\s*,\s*desc:\s*(["'])([\s\S]*?)\3/;
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const plain = (html) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

// Every start tag with its span and, for an element that closes, the span of its content.
// Quotes are honored inside a tag, because a data-de value carries markup whose > would
// otherwise end the tag; a script's or a style's text is skipped whole, because code holds <.
function tags(src) {
  const out = [], stack = [];
  let i = 0;
  while ((i = src.indexOf("<", i)) !== -1) {
    if (src.startsWith("<!--", i)) { i = src.indexOf("-->", i); if (i === -1) break; continue; }
    const close = src[i + 1] === "/";
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(src.slice(i + (close ? 2 : 1)));
    if (!nameMatch) { i++; continue; }
    const name = nameMatch[0].toLowerCase();
    let j = i + 1, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break;
    }
    const end = j + 1;
    if (close) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name === name) { stack[k].inner = [stack[k].end, i]; stack.length = k; break; }
      }
    } else {
      const t = { name, start: i, end, head: src.slice(i, end) };
      out.push(t);
      if (RAW.has(name)) {
        const stop = src.toLowerCase().indexOf(`</${name}`, end);
        t.inner = [end, stop === -1 ? src.length : stop];
        i = stop === -1 ? src.length : stop;
        continue;
      }
      if (!VOID.has(name) && !src.slice(i, end).endsWith("/>")) stack.push(t);
    }
    i = end;
  }
  return out;
}

const attr = (head, name) => {
  const m = new RegExp(`\\s${name}=(["'])([\\s\\S]*?)\\1`).exec(head);
  return m ? m[2] : "";
};

export function germanValues(html) {
  const all = tags(html);
  // The tag whose start tag opens no later than pos and whose span still holds it: the
  // innermost start tag an attribute match falls inside, found by walking in source order
  // and keeping the last one that still qualifies.
  const owner = (pos) => {
    let found = null;
    for (const t of all) { if (t.start > pos) break; if (pos < t.end) found = t; }
    return found;
  };
  const out = [];
  let n = 0;
  for (const m of html.matchAll(ATTR)) {
    const t = owner(m.index);
    if (!t || RAW.has(t.name)) continue;
    const kind = m[1];
    let en = "";
    if (kind === "data-de") en = t.name === "meta" ? decode(attr(t.head, "content")) : t.inner ? plain(html.slice(...t.inner)) : "";
    else if (kind === "data-notes-de") en = decode(attr(t.head, "data-notes"));
    else en = decode(attr(t.head, "aria-label"));
    const [start] = m.indices[3];
    out.push({ id: `a${n++}`, kind, tag: t.name, en, de: m[3], start, end: start + m[3].length, quote: m[2] });
  }
  const de = JS_DE.exec(html), en = JS_EN.exec(html);
  if (de) {
    const [t] = de.indices[2], [d] = de.indices[4];
    out.push({ id: "js.title", kind: "title", tag: "js", en: en ? en[2] : "", de: de[2], start: t, end: t + de[2].length, quote: de[1] });
    out.push({ id: "js.desc", kind: "description", tag: "js", en: en ? en[4] : "", de: de[4], start: d, end: d + de[4].length, quote: de[3] });
  }
  return out;
}

export function applyGerman(html, edits) {
  const byId = new Map(germanValues(html).map((e) => [e.id, e]));
  // An id the page does not have, or a value that would close its own attribute early, are
  // both refused before anything is written, so a caller sees every problem at once rather
  // than a partial write followed by a second refusal.
  const bad = Object.keys(edits).filter((id) => !byId.has(id) || edits[id].includes(byId.get(id).quote));
  if (bad.length) throw new Error(`refused: ${bad.join(", ")}`);
  let out = html;
  // Written back to front, by descending start, so an earlier edit's offset never shifts a
  // later one's span.
  for (const id of Object.keys(edits).sort((a, b) => byId.get(b).start - byId.get(a).start)) {
    const e = byId.get(id);
    out = out.slice(0, e.start) + edits[id] + out.slice(e.end);
  }
  return out;
}
