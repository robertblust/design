// The link checker: `design links` and `design links --external`. A link on the site itself must
// land or the build fails; a link to someone else's site is checked on a schedule and reported,
// because a dead page elsewhere is news and not a reason to stop a deploy. What is read, what
// decides and what asks the web live in verify/links/; this file puts them together.
import { collect } from "./links/collect.mjs";
import { classify, shown, resolveOwn } from "./links/resolve.mjs";
import { judge, judgeAll } from "./links/judge.mjs";
import { syncIssue } from "./links/issue.mjs";

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
  // A check that resolved nothing has not passed, it has not run. collect() throws its own "no
  // page named by sitemap.xml" first today, since a page is only queued by an own link and an
  // empty sitemap queues none — so this guard is not reached by any fixture yet. It stays: the
  // floor holds on its own terms, not on collect's, so a future collect that queues a page some
  // other way still cannot pass a run that resolved no own link.
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

// Every link to another site, from the pages, the cards and the model, judged and reported. It
// returns whatever it finds: a dead page elsewhere is news, and the workflow that runs this never
// fails on it. It throws only when the check itself could not run, so a broken weekly job does not
// look like a clean one.
export async function checkExternal({
  root, base = BASE, chromium, env = process.env, fetchImpl = fetch, apiFetch = fetch,
  timeoutMs = 10_000, log = console.log, today = new Date().toISOString().slice(0, 10),
}) {
  const site = await collect({ root, base, chromium });
  const where = new Map();
  for (const [href, from] of site.found) {
    const c = classify(href, site);
    if (c.kind !== "external") continue;
    const all = where.get(c.url.href) ?? new Set();
    for (const x of from) all.add(x);
    where.set(c.url.href, all);
  }
  const verdicts = await judgeAll([...where.keys()], { judgeOne: (url) => judge(url, { fetchImpl, timeoutMs }) });
  const report = { ok: [], broken: [], unverifiable: [] };
  for (const v of verdicts) report[v.kind].push({ ...v, from: [...where.get(v.url)].sort() });
  for (const [kind, mark] of [["broken", "✗"], ["unverifiable", "?"]])
    for (const v of report[kind]) log(`  ${mark} ${v.url}  ${v.answer}\n      from ${v.from.join(", ")}`);
  log(`  ${report.ok.length} ok, ${report.broken.length} broken, ${report.unverifiable.length} unverifiable, of ${verdicts.length} external link(s).`);

  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_SERVER_URL: server, GITHUB_RUN_ID: runId, GITHUB_API_URL: api } = env;
  if (token && repo) {
    const runUrl = server && runId ? `${server}/${repo}/actions/runs/${runId}` : null;
    report.issue = await syncIssue({ report, repo, token, api: api || undefined, runUrl, date: today, apiFetch, log });
  } else {
    log("  No GITHUB_TOKEN and GITHUB_REPOSITORY in the environment, so no issue was touched.");
  }
  return report;
}
