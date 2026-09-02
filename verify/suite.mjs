import { httpStatus } from "./http.mjs";

// The suite's runner: the PAGES opt-in guards, the page loop, and the site-wide checks that
// are not about any one page. This was byte-identical in three repositories and sat outside
// the CHECKS object, which is the only reason the previous consolidation missed it — the tool
// that measured duplication only ever looked inside that object, so "no check body exists in
// more than one repository" was true of the object and false of the file.
//
// It takes a browser rather than launching one: this package has no dependencies and cannot
// import Playwright. It returns a failure count rather than exiting, because a function that
// terminates the process cannot be tested, and this one is.
export async function runSuite({ browser, SITE, BASE, PAGES, CHECKS, systemFaces }) {
  let failures = 0;

  // Two things the page loop cannot say about itself.
  //
  // Every page must opt into `seo`. The runner skips any check whose key is undefined, so
  // deleting one line from PAGES turns the contract off for that page and changes no output.
  {
    const off = PAGES.filter(p => !p.seo).map(p => p.path);
    if (off.length) { console.log("✗ PAGES  seo is not enabled on: " + off.join(", ")); failures++; }
  }
  // And every page must opt into tokenVersion, for the same reason. The deleted page-against-page
  // block below asserted every page in PAGES unconditionally; tokenVersion alone does not, because
  // the runner skips any check whose key is undefined — a page added to PAGES with neither a
  // `design tokens` fence nor `tokenVersion: true` is invisible to design:check (discovery only
  // finds fences that exist) and to this suite alike. This line is what restores that half of it.
  {
    const off = PAGES.filter(p => !p.tokenVersion).map(p => p.path);
    if (off.length) { console.log("✗ PAGES  tokenVersion is not enabled on: " + off.join(", ")); failures++; }
  }
  // And every page must opt into `fences`, for the same reason. Task 2 added the check that
  // fails a page whose fences no longer include `prose reset` — but not this line, so deleting
  // `fences: [...]` from a page's spec (or adding a page to PAGES without it) turns that check
  // off for that page and design:check only finds fences that exist, so the whole suite stays
  // green while the page silently loses every fence it should have been checked against.
  {
    const off = PAGES.filter(p => !p.fences).map(p => p.path);
    if (off.length) { console.log("✗ PAGES  fences is not enabled on: " + off.join(", ")); failures++; }
  }
  // And the suite must be talking to this site. A sibling repository left serving on :8000 is
  // not hypothetical — it happened during review, and the run reported six failures belonging
  // to a site nobody was testing.
  {
    const res = await fetch(BASE + "/sitemap.xml");
    const xml = res.ok ? await res.text() : "";
    if (!xml.includes(`<loc>${SITE}/</loc>`)) {
      console.log(`✗ ${BASE} is not serving ${SITE} — check what is on that port`);
      failures++;
    }
  }

  // The token block used to be compared page-against-page here, because there was no
  // recorded source to compare it against and a hash would have been a second thing to
  // keep in step. `design:check` is that source now: it asserts every page's fence
  // byte-for-byte against what @robertblust/design ships, which is strictly stronger than
  // pages merely agreeing with each other, and it reads the `page`/`deck` variant word off
  // each page rather than expecting every page to share one block. Keeping this check
  // alongside it would mean teaching a weaker check about every variant the stronger one
  // already handles for free — so it is deleted, not adjusted.

  for (const spec of PAGES) {
    const page = await browser.newPage();
    const jsErrors = [];
    page.on("pageerror", e => jsErrors.push(String(e)));
    // A request that fails leaves no trace in the DOM, so no per-page check can see it —
    // a missing font or image would otherwise pass every check the suite has. The listener
    // has to be attached before goto() below, or it misses every request the navigation
    // itself makes.
    const missing = [];
    page.on("requestfailed", r => missing.push(r.url().split("/").pop()));
    const problems = [];
    spec.absolute = BASE + spec.path;
    try {
      const res = await page.goto(BASE + spec.path, { waitUntil: "networkidle" });
      if (!res || !res.ok()) problems.push(`HTTP ${res ? res.status() : "no response"}`);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      for (const [name, fn] of Object.entries(CHECKS)) {
        if (spec[name] === undefined) continue;
        const problem = await fn(page, spec);
        if (problem) problems.push(`${name}: ${problem}`);
      }
    } catch (e) {
      problems.push(String(e));
    }
    if (jsErrors.length) problems.push("JS errors: " + jsErrors.join(" | "));
    if (missing.length) problems.push("failed requests: " + missing.join(", "));
    console.log((problems.length ? "✗" : "✓") + " " + spec.path +
      (problems.length ? "\n    " + problems.join("\n    ") : ""));
    failures += problems.length ? 1 : 0;
    await page.close();
  }

  // The crawl map is not a page, so it is checked separately: every URL a sitemap claims
  // must exist, or the sitemap is a list of promises the site does not keep.
  {
    const res = await fetch(BASE + "/sitemap.xml");
    if (!res.ok) { console.log(`✗ /sitemap.xml  HTTP ${res.status}`); failures++; }
    else {
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      const expected = PAGES.map(p => SITE + p.path);
      const missing = expected.filter(u => !locs.includes(u));
      const extra = locs.filter(u => !expected.includes(u));
      if (missing.length || extra.length) {
        console.log(`✗ /sitemap.xml  missing: ${missing} unexpected: ${extra}`); failures++;
      } else {
        let unreachable = 0;
        for (const u of locs) {
          const s = await httpStatus(u.replace(SITE, BASE));
          if (s !== 200) { console.log(`✗ sitemap URL ${u} → ${s}`); failures++; unreachable++; }
        }
        if (!unreachable) console.log("✓ /sitemap.xml  " + locs.length + " urls, all reachable");
      }
    }
    // The favicon is the one place the brand mark exists outside a page, so no DOM check can
    // reach it — and it is where the unavailable font name lived longest. It cannot @font-face
    // anything and inherits nothing, so every face it names has to be one a machine already has.
    const fav = await fetch(BASE + "/favicon.svg");
    if (!fav.ok) { console.log(`✗ /favicon.svg  HTTP ${fav.status}`); failures++; }
    else {
      const svg = await fav.text();
      const named = [...svg.matchAll(/font-family="([^"]+)"/g)]
        .flatMap(m => m[1].split(",").map(f => f.trim().replace(/^["']|["']$/g, "")))
        .filter(f => !systemFaces.has(f.toLowerCase()));
      if (named.length) {
        console.log(`✗ /favicon.svg  names a face it cannot load and cannot count on: ${named.join(", ")}`);
        failures++;
      } else console.log("✓ /favicon.svg");
    }

    // Presence of the string "sitemap.xml" was the whole of this check, which is a test that
    // the file mentions a sitemap rather than that it names one that exists. guestgraph.io
    // named three and two were 404 in production — the same block is now in all three suites.
    const rb = await fetch(BASE + "/robots.txt");
    if (!rb.ok) { console.log(`✗ /robots.txt  HTTP ${rb.status}`); failures++; }
    else {
      const named = [...(await rb.text()).matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1]);
      if (!named.length) { console.log("✗ /robots.txt  names no sitemap"); failures++; }
      else {
        const dead = [];
        for (const u of named) {
          const s = await httpStatus(u.replace(SITE, BASE));
          if (s !== 200) dead.push(`${u} → ${s}`);
        }
        if (dead.length) { console.log("✗ /robots.txt  names sitemap(s) that do not exist: " + dead.join(", ")); failures++; }
        else console.log(`✓ /robots.txt  ${named.length} sitemap(s), all reachable`);
      }
    }
  }

  console.log(failures ? `\n${failures} page(s) FAILED` : "\nall checks pass");
  return failures;
}
