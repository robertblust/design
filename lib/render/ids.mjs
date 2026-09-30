// Writes one redirect page per entity at id/<uuid>/index.html, so the JSON-LD `@id` a site gives
// an entity, `<origin>/id/<uuid>`, is an address that lands. The id stays when an entity is
// renamed or moved and its readable address does not, so a crawler or an agent that kept the
// `@id` still reaches the entity: the page sends it on to where the entity sits now, its place
// on the site's stage, `<stage page>?stage=expanded#<address>`. One page serves both languages,
// because the English and the German page of an entity describe one entity and share one `@id`.
//
// A page is written only for an entity whose `id` is a UUID v7 and differs from its `address`.
// An entity the instance has not given a stable id yet carries its path as its id, and a page
// for it would publish an address as though it were an id. The id is matched against the UUID
// v7 shape before it becomes part of a path, because a path is never written from data nobody
// checked.
//
// The folder belongs to this renderer whole: whatever in id/ no entity names is removed, as an
// entity deleted from the model leaves its page behind otherwise, and `check` names it instead.
import fs from "node:fs";
import path from "node:path";

export const ID_DIR = "id";

// Lowercase, version 7, the RFC 9562 variant: the form the parser writes and an @id is compared in.
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/;
// Root-absolute, ending in `/`, made of plain path segments: `/model/`, or `/` where the home
// page draws the model.
const STAGE = /^\/(?:[A-Za-z0-9_~-][A-Za-z0-9._~-]*\/)*$/;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// An address as a URL fragment the stage reads back with decodeURIComponent. The slash stays, so
// the fragment reads as the address does; a quote is encoded too, since a refresh's url may be
// quoted and a browser strips a quote it meets there.
const fragment = (address) => encodeURIComponent(address).replace(/%2F/g, "/").replace(/'/g, "%27");

const stableId = (e) => typeof e?.id === "string" && e.id !== e.address && UUID_V7.test(e.id);

// The `@id` a site's JSON-LD gives an entity, or null where the entity has no stable id and so no
// page at that address.
export function idUrl(entity, origin) {
  return stableId(entity) ? `${origin}/${ID_DIR}/${entity.id}` : null;
}

function options({ origin, stage } = {}) {
  if (typeof origin !== "string" || !ORIGIN.test(origin)) {
    throw new Error(`id pages need the site's origin, a scheme and a host with no path or closing slash, such as https://blust.ch: ${origin}`);
  }
  if (typeof stage !== "string" || !STAGE.test(stage) || stage.split("/").some((s) => s === "." || s === "..")) {
    throw new Error(`id pages need the stage page, the path of the page that draws the model, starting and ending in /, such as /model/: ${stage}`);
  }
}

function page(e, { origin, stage }) {
  const address = e.address ?? e.id;
  const name = e.name || address;
  const at = `${stage.slice(1)}?stage=expanded#${fragment(address)}`;
  // Two folders down, id/<uuid>/, so the relative form works over http from any host the site is
  // served on; the canonical is absolute, as a canonical must be.
  const rel = `../../${at}`;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(name)}</title>`,
    '<meta name="robots" content="noindex">',
    `<link rel="canonical" href="${esc(`${origin}/${at}`)}">`,
    `<meta http-equiv="refresh" content="0; url=${esc(rel)}">`,
    "</head>",
    "<body>",
    `<p>Go on to <a href="${esc(rel)}">${esc(name)}</a>.</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// → [{ path, html }], one per entity with a stable id, in the model's order. `path` is relative
// to the site's root.
export function idPages(data, { origin, stage } = {}) {
  options({ origin, stage });
  const seen = new Set();
  const out = [];
  for (const e of data?.entities ?? []) {
    if (!stableId(e)) continue;
    if (seen.has(e.id)) throw new Error(`two entities carry the id ${e.id}; each would claim the page at ${ID_DIR}/${e.id}/`);
    seen.add(e.id);
    out.push({ path: `${ID_DIR}/${e.id}/index.html`, html: page(e, { origin, stage }) });
  }
  return out;
}

// Writes the pages into the site at `root` and removes what in id/ no entity names, or, with
// `check`, returns every path it would write or remove and touches nothing. The same shape as the
// other writers here, so a site lists it beside them in its build.
export function writeIdPages(data, { check = false, root, origin, stage } = {}) {
  if (!root) throw new Error("writeIdPages needs the site's root: the pages it writes are the site's, not this package's");
  const files = idPages(data, { origin, stage });
  const dir = path.join(root, ID_DIR);
  const stale = [];
  for (const f of files) {
    const at = path.join(root, f.path);
    if (fs.existsSync(at) && fs.readFileSync(at, "utf8") === f.html) continue;
    if (check) stale.push(f.path);
    else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, f.html); }
  }
  const wanted = new Set(files.map((f) => f.path.split("/")[1]));
  if (fs.existsSync(dir)) {
    // A dotfile, Finder's or an editor's, is never this renderer's, and is neither named nor removed.
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.startsWith(".")) continue;
      const at = path.join(dir, name);
      if (wanted.has(name) && fs.statSync(at).isDirectory()) {
        // Anything in an entity's folder beside its page is named and removed alone.
        for (const n of fs.readdirSync(at).sort()) {
          if (n.startsWith(".") || n === "index.html") continue;
          if (check) stale.push(`${ID_DIR}/${name}/${n}`);
          else fs.rmSync(path.join(at, n), { recursive: true, force: true });
        }
        continue;
      }
      if (check) stale.push(`${ID_DIR}/${name}`);
      else fs.rmSync(at, { recursive: true, force: true });
    }
    if (!check && !files.length && fs.readdirSync(dir).every((n) => n.startsWith("."))) fs.rmSync(dir, { recursive: true, force: true });
  }
  return stale;
}
