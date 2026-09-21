// What a site links to, read the way a visitor's browser meets it: every page the sitemap names
// and every own page those pages reach, loaded and run, its cards opened, and the model files its
// pages read searched for the URLs they carry. The browser is a parameter, as it is in
// cards/export: this module never imports Playwright, and the bin hands it the site's own.
import fs from "node:fs";
import path from "node:path";

import { sitemapLocs } from "../../lib/crawl.mjs";
import { classify, pageKey, pageExists, stageIds, modelUrls } from "./resolve.mjs";

const NO_OPENER = "carries a <link data-stage> and none of #openall, .openall, .ln-s or #stage, so its cards cannot be opened";

// Runs in the page, so it is self-contained: Playwright sends it as source. It reads every link a
// visitor's browser would follow or fetch, the head included, since that is what crawlers and link
// previews read, and what the resolver needs to know about the page itself.
function readPage() {
  const links = [];
  const add = (raw, base) => {
    if (raw == null || !raw.trim()) return;
    try { links.push(new URL(raw.trim(), base).href); } catch {}
  };
  const isUrl = (s) => /^https?:\/\/\S+$/.test(s);
  for (const el of document.querySelectorAll("[href], [src]")) {
    add(el.getAttribute("href"), document.baseURI);
    add(el.getAttribute("src"), document.baseURI);
  }
  for (const m of document.querySelectorAll("meta[content]")) {
    const c = m.getAttribute("content").trim();
    if (isUrl(c)) add(c, document.baseURI);
  }
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try { parsed = JSON.parse(s.textContent); } catch { continue; }
    (function walk(v) {
      // A JSON-LD URL string is sometimes an "@id" such as "https://blust.ch/#person": an
      // identifier for the node, not an anchor a visitor's browser would follow. Its fragment is
      // dropped so the resolver is asked about the page the path names, not an element on it; the
      // path itself still has to land.
      if (typeof v === "string") { if (isUrl(v)) add(v.replace(/#.*$/, ""), document.baseURI); }
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    })(parsed);
  }
  // A rule's own declarations are read from its style, and a rule that holds rules is walked into:
  // a style rule can do both once CSS nests, and an @font-face's src is only in its style.
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    const base = sheet.href || document.baseURI;
    (function walk(list) {
      for (const r of list) {
        const text = r.style ? r.style.cssText : (r.cssRules ? "" : r.cssText);
        for (const m of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) add(m[2], base);
        if (r.cssRules) walk(r.cssRules);
      }
    })(rules);
  }
  const stageLink = document.querySelector("link[data-stage]");
  return {
    links,
    ids: [...document.querySelectorAll("[id]")].map((e) => e.id),
    hasDataStage: !!stageLink,
    data: stageLink ? stageLink.getAttribute("href") : null,
    stage: [...document.scripts].some((s) => s.src && /\/stage\.js$/.test(new URL(s.src).pathname)),
  };
}

// Runs in the page: opens every card the page offers and returns the links the cards wrote that
// were not on the page before. Team and the timeline have an Open all, one per board on Team, and
// each is pressed once; Surfaces opens a card per surface; a stage opens one per node, by the hash
// it reads. Null when the page offers none of these.
async function openCards({ ids, settleMs, stepMs }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hrefs = () => [...document.querySelectorAll("a[href]")]
    .map((a) => { try { return new URL(a.getAttribute("href"), document.baseURI).href; } catch { return null; } })
    .filter(Boolean);
  const before = new Set(hrefs()), out = new Set();
  const take = () => { for (const h of hrefs()) if (!before.has(h)) out.add(h); };
  const alls = [...document.querySelectorAll("#openall, .openall")];
  const items = [...document.querySelectorAll(".ln-s")];
  if (alls.length) { alls.forEach((b) => b.click()); await wait(settleMs); take(); }
  else if (items.length) for (const b of items) { b.click(); await wait(stepMs); take(); }
  else if (document.getElementById("stage")) for (const id of ids) { location.hash = id; await wait(stepMs); take(); }
  else return null;
  return [...out];
}

// The served copy has to answer before a browser is pointed at it. CI starts the server in the
// background a step earlier, so this waits for it the way the sites' own wait step does.
async function waitFor(origin, { tries = 20, delayMs = 500 } = {}) {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(`${origin}/`); await res.body?.cancel(); return; }
    catch { await new Promise((r) => setTimeout(r, delayMs)); }
  }
  throw new Error(`nothing answers at ${origin}; serve the site there first`);
}

export async function collect({ root, base, chromium, settleMs = 150, stepMs = 25 }) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  let host, sitemap;
  try { host = read("CNAME").trim(); sitemap = read("sitemap.xml"); }
  catch (e) { throw new Error(`the link checker reads CNAME and sitemap.xml at the site root: ${e.message}`); }
  const origin = new URL(base).origin;
  await waitFor(origin);

  // A data file a page names but the checkout lacks is not read here: the link naming it is in
  // `found` like any other, and the resolver reports it missing.
  const parsed = new Map();
  const model = (file) => {
    if (!parsed.has(file)) {
      if (!fs.existsSync(path.join(root, file))) parsed.set(file, null);
      else {
        try { parsed.set(file, JSON.parse(read(file))); }
        catch (e) { throw new Error(`could not read ${file}, the data a page names: ${e.message}`); }
      }
    }
    return parsed.get(file);
  };
  const nodes = new Map();
  const site = {
    host, origin, pages: new Map(), found: new Map(), problems: [],
    idsOf: (file) => { if (!nodes.has(file)) nodes.set(file, stageIds(model(file))); return nodes.get(file); },
  };

  const queue = [], queued = new Set();
  const found = (href, from) => {
    if (!site.found.has(href)) site.found.set(href, new Set());
    site.found.get(href).add(from);
    const c = classify(href, site);
    if (c.kind !== "own") return;
    const key = pageKey(c.url.pathname, root);
    if (key && !queued.has(key) && pageExists(key, root)) { queued.add(key); queue.push(key); }
  };
  for (const loc of sitemapLocs(sitemap)) found(loc, "sitemap.xml");

  const models = new Set();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    while (queue.length) {
      const key = queue.shift();
      await page.goto(origin + encodeURI(key), { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(settleMs);
      const got = await page.evaluate(readPage);
      const named = got.data ? new URL(got.data, origin + encodeURI(key)) : null;
      const data = named && named.origin === origin ? decodeURIComponent(named.pathname.slice(1)) : null;
      site.pages.set(key, { ids: new Set(got.ids), stage: got.stage, data });
      for (const href of got.links) found(href, key);
      if (data && !models.has(data)) {
        models.add(data);
        for (const m of modelUrls(model(data), data)) found(m.url, m.from);
      }
      if (got.hasDataStage) {
        const ids = data ? (model(data)?.entities ?? []).map((e) => e.id) : [];
        const cards = await page.evaluate(openCards, { ids, settleMs, stepMs });
        if (cards === null) site.problems.push({ link: key, reason: NO_OPENER, from: [key] });
        else for (const href of cards) found(href, `${key} (card)`);
      }
    }
  } finally {
    await browser.close();
  }
  if (!site.pages.size) throw new Error(`no page named by sitemap.xml is in this checkout, so nothing was loaded from ${origin}`);
  return site;
}
