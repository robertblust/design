// What a site tells crawlers about its own changes: the pages a deploy changed, sent to IndexNow,
// and the day each page last changed, written into the sitemap as <lastmod>.
//
// Both answer one question, which page changed, and they answer it the same way so that the
// ping and the date can never disagree. A page is the index.html its sitemap URL is served from,
// and it changes when that file does or when the data it draws does: a page that draws a stage
// names its data in a `<link data-stage>` whose markup never varies, so a new model reaches the
// visitor while the page's own HTML stays byte for byte the same.
//
// It reads the site's CNAME, sitemap.xml and git, and nothing the site configures. All three sites
// are GitHub Pages sites with one index.html per sitemap URL, and a site that stops being one is
// a site that needs its own tool rather than a parameter here.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ENDPOINT = "https://api.indexnow.org/indexnow";

// The URLs a sitemap names, in order.
export function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

// The file a sitemap URL is served from.
export function pageFile(loc) {
  return path.posix.join(new URL(loc).pathname.slice(1), "index.html");
}

// The data file a page draws, as a path from the site root, or null. Only a relative href is
// the site's own file; anything with a scheme or a leading slash is not a file in this checkout.
export function stageData(file, html) {
  const tag = html.match(/<link\b[^>]*\bdata-stage\b[^>]*>/)?.[0];
  const href = tag?.match(/\bhref="([^"]+)"/)?.[1];
  if (!href || /^[a-z]+:|^\//i.test(href)) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), href));
}

// The files whose change is a change to the page at `loc`.
export function pageInputs(loc, html) {
  const file = pageFile(loc);
  const data = html == null ? null : stageData(file, html);
  return data ? [file, data] : [file];
}

// Which URLs a set of changed files touches, in sitemap order. `inputs` maps each URL to its
// pageInputs.
export function changedUrls({ changed, inputs }) {
  const touched = new Set(changed);
  return Object.keys(inputs).filter((loc) => inputs[loc].some((f) => touched.has(f)));
}

// The sitemap with each URL's lastmod set from `dates`, keyed by URL. A URL missing from `dates`
// is left without one; a lastmod already there is replaced, never doubled.
export function withLastmod(xml, dates) {
  return xml.replace(/<url>([\s\S]*?)<\/url>/g, (_, inner) => {
    const loc = inner.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    const stripped = inner.replace(/<lastmod>[^<]*<\/lastmod>/, "");
    if (!loc || !dates[loc]) return `<url>${stripped}</url>`;
    return `<url>${stripped.replace(/<\/loc>/, `</loc><lastmod>${dates[loc]}</lastmod>`)}</url>`;
  });
}

// The IndexNow key is the one root file named for its own contents. It is public by design, which
// is why it is committed: an engine trusts a ping because the same key is served from the host.
export function findKey(root) {
  const keys = readdirSync(root).filter((name) => {
    const m = name.match(/^([0-9a-f]{32})\.txt$/);
    return m && readFileSync(path.join(root, name), "utf8").trim() === m[1];
  });
  if (keys.length !== 1) throw new Error(`expected one IndexNow key file at the site root, found ${keys.length}`);
  return keys[0].slice(0, -4);
}

const gitIn = (root) => (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, TZ: "UTC" } }).trim();

// Tells the IndexNow engines which pages changed between two commits. Only changed pages are
// sent: an engine told about unchanged pages on every deploy learns to ignore the site, so a
// range that touches no page sends nothing at all. Returns the URLs it sent, or would send.
export async function indexnow({ root, base, head, dryRun = false, fetchImpl = fetch, log = console.log }) {
  const git = gitIn(root);
  const host = readFileSync(path.join(root, "CNAME"), "utf8").trim();
  const key = findKey(root);
  const at = (rev, file) => { try { return git("show", `${rev}:${file}`); } catch { return null; } };

  // A page removed in the range is still worth reporting, so both sides' sitemaps count, and a
  // page's inputs are read from whichever side still has it.
  const locs = [...new Set([...sitemapLocs(at(base, "sitemap.xml") ?? ""), ...sitemapLocs(at(head, "sitemap.xml") ?? "")])];
  const inputs = Object.fromEntries(locs.map((loc) => [loc, pageInputs(loc, at(head, pageFile(loc)) ?? at(base, pageFile(loc)))]));
  const changed = git("diff", "--name-only", base, head).split("\n").filter(Boolean);
  const urlList = changedUrls({ changed, inputs });

  if (!urlList.length) {
    log(`No page changed between ${base} and ${head}; nothing sent.`);
    return urlList;
  }
  log(`${urlList.length} changed:\n${urlList.map((u) => `  ${u}`).join("\n")}`);
  if (dryRun) return urlList;

  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
  });
  // 200 is accepted, 202 accepted while the key is still being checked. Anything else is a
  // refusal worth reading: 403 a key the engine could not fetch, 422 a URL not on this host.
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
  }
  log(`IndexNow answered ${res.status}.`);
  return urlList;
}

// Each sitemap URL's lastmod, from git: the author date in UTC of the last commit that changed
// one of the page's inputs. Author date because a rebase leaves it alone. A page with uncommitted
// changes is dated `today`, so the order is edit, write the dates, commit both together.
export function sitemapDates({ root, today = new Date().toISOString().slice(0, 10) }) {
  const git = gitIn(root);
  // A shallow clone names its one commit as every file's last change, which would make every
  // date agree with itself and every check pass.
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    throw new Error("sitemap dates need full history — check out with fetch-depth: 0");
  }
  const xml = readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const dates = {};
  for (const loc of sitemapLocs(xml)) {
    const inputs = pageInputs(loc, readFileSync(path.join(root, pageFile(loc)), "utf8"));
    const dirty = git("status", "--porcelain", "--", ...inputs);
    dates[loc] = dirty ? today : git("log", "-1", "--format=%ad", "--date=format-local:%Y-%m-%d", "--", ...inputs);
  }
  return { xml, dates, next: withLastmod(xml, dates) };
}
