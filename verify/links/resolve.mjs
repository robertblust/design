// Which links a site owns, and whether an own link lands. Nothing here touches the network or a
// browser: every answer comes from the checkout and from what collect.mjs read off the served
// pages, so the part of the link checker that decides is tested with plain `node --test`.
import fs from "node:fs";
import path from "node:path";

// An absolute http(s) URL and nothing else, the form a model's references and Also at rows take.
export const URL_STRING = /^https?:\/\/\S+$/;

function isFile(root, rel) {
  return fs.statSync(path.join(root, rel), { throwIfNoEntry: false })?.isFile() ?? false;
}

function decoded(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Own: on the origin the site is served from, which is where the browser resolved every relative
// link, or on the host its CNAME names. External: any other http(s) URL. Skip: mailto:, tel:,
// javascript:, data: and anything else that is not a page on the web.
export function classify(href, { host, origin }) {
  let url;
  try { url = new URL(href); } catch { return { kind: "skip" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "skip" };
  if (url.origin === origin || url.hostname === host) return { kind: "own", url };
  return { kind: "external", url };
}

// How a link is named in a report: an own link by its path, so the served origin and the domain
// spell the same link the same way; an external one in full.
export function shown(c) {
  return c.kind === "own" ? c.url.pathname + c.url.search + c.url.hash : c.url.href;
}

// The page a path is, keyed the way the crawl keys what it loaded, or null for a file that is not
// a page. `/about` is the page `/about/` when that folder has an index.html, because GitHub Pages
// redirects the one to the other.
export function pageKey(pathname, root) {
  const p = decoded(pathname);
  if (p.endsWith("/")) return p;
  if (p.endsWith("/index.html")) return p.slice(0, -"index.html".length);
  if (p.endsWith(".html")) return p;
  if (isFile(root, `${p.slice(1)}/index.html`)) return `${p}/`;
  return null;
}

// Whether the checkout holds the file a page key is served from.
export function pageExists(key, root) {
  return isFile(root, key.endsWith("/") ? `${key.slice(1)}index.html` : key.slice(1));
}

// Every id a stage finds a node for in its data: each entity, the root, and every leading part of
// an entity's id, which the stage draws as the folder holding it. assets/stage.js walks an id down
// from the root one segment at a time, so every prefix of an id is a node.
export function stageIds(data) {
  const ids = new Set();
  if (data?.rootId) ids.add(data.rootId);
  for (const e of data?.entities ?? []) {
    ids.add(e.id);
    const parts = e.id.split("/");
    for (let i = 1; i < parts.length; i++) ids.add(parts.slice(0, i).join("/"));
  }
  return ids;
}

// Every absolute URL string in a model file, with where it was found: the file, and the id of the
// nearest object around it that has one, which in a model is the entity. Generic on purpose: the
// model's shape is the parser's to change, and a URL is a URL wherever it sits.
export function modelUrls(data, file) {
  const out = [];
  (function walk(v, where) {
    if (typeof v === "string") { if (URL_STRING.test(v)) out.push({ url: v, from: where }); return; }
    if (!v || typeof v !== "object") return;
    const here = !Array.isArray(v) && typeof v.id === "string" ? `${file} · ${v.id}` : where;
    for (const x of Object.values(v)) walk(x, here);
  })(data, file);
  return out;
}

// Why an own link does not land, or null when it does. `pages` maps a page key to what the crawl
// read off that page: its element ids after its scripts ran, whether it loads stage.js, and the
// data file its <link data-stage> names as a path from the root. `idsOf` gives stageIds for a file.
//
// A stage page is judged by its data, not its markup, because a stage shown an id it does not hold
// draws its root and looks fine: the one place a wrong link cannot be seen by looking at it.
export function resolveOwn(url, { root, pages, idsOf }) {
  const p = decoded(url.pathname);
  if (p.endsWith("/")) {
    if (!isFile(root, `${p.slice(1)}index.html`)) return "no page here";
  } else if (!isFile(root, p.slice(1)) && !isFile(root, `${p.slice(1)}/index.html`)) {
    return "no file here";
  }
  const id = decoded(url.hash.slice(1));
  if (!id) return null;
  const key = pageKey(url.pathname, root);
  if (!key) return null;
  const page = pages.get(key);
  if (!page) return `${key} was never loaded, so #${id} could not be looked for`;
  if (page.stage) {
    if (!page.data) return `${key} draws a stage and names no data, so #${id} cannot be drawn`;
    return idsOf(page.data).has(id) ? null : `no node ${id} in ${page.data}`;
  }
  return id === "top" || page.ids.has(id) ? null : `no element with id ${id} on ${key}`;
}
