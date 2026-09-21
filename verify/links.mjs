// The link checker: `design links` and `design links --external`. A link on the site itself must
// land or the build fails; a link to someone else's site is checked on a schedule and reported,
// because a dead page elsewhere is news and not a reason to stop a deploy. What is read, what
// decides and what asks the web live in verify/links/; this file puts them together.
import { collect } from "./links/collect.mjs";
import { classify, shown, resolveOwn } from "./links/resolve.mjs";

export const BASE = "http://127.0.0.1:8000";

// Every own link the site carries, resolved against the checkout. A link found in several places
// is reported once, with all of them.
export async function checkOwn({ root, base = BASE, chromium, log = console.log }) {
  const site = await collect({ root, base, chromium });
  const failures = new Map();
  const fail = (link, reason, from) => {
    const f = failures.get(link) ?? { link, reason, from: new Set() };
    for (const x of from) f.from.add(x);
    failures.set(link, f);
  };
  for (const p of site.problems) fail(p.link, p.reason, p.from);
  let resolved = 0;
  for (const [href, from] of site.found) {
    const c = classify(href, site);
    if (c.kind !== "own") continue;
    resolved++;
    const reason = resolveOwn(c.url, { root, pages: site.pages, idsOf: site.idsOf });
    if (reason) fail(shown(c), reason, from);
  }
  // A check that resolved nothing has not passed, it has not run.
  if (!resolved) throw new Error(`no own link was found on ${site.origin}, so nothing was checked`);
  const list = [...failures.values()]
    .map((f) => ({ link: f.link, reason: f.reason, from: [...f.from].sort() }))
    .sort((a, b) => a.link.localeCompare(b.link));
  if (!list.length) log(`  ✓ every own link resolves: ${resolved} link(s) from ${site.pages.size} page(s) and the model`);
  else {
    for (const f of list) log(`  ✗ ${f.link}  ${f.reason}\n      from ${f.from.join(", ")}`);
    log(`\n  ${list.length} own link(s) do not resolve.`);
  }
  return { failures: list, pages: site.pages.size, links: resolved };
}
