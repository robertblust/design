// How far the site's data pin has fallen behind what it points at.
//
// A site pins its model by commit SHA in `source.json`, and that pin is editorial: it says
// which state of the model the page publishes, so moving it is a person's decision and never
// a bot's. Nothing here changes a pin. It reports the distance and passes.
//
// That is also why it never fails the build. A pin ten commits behind is not a broken site —
// it is a site publishing an older model on purpose, or a site whose owner has not looked
// lately, and only a person can tell those apart. A check that went red would teach everyone
// to ignore it by the second week.
//
// It reads nothing from disk but `source.json`, and takes its `fetch` so the tests can drive
// it without a network.
import { readFileSync } from "node:fs";
import path from "node:path";

const API = "https://api.github.com";

export async function pinDrift({ root, fetchImpl = fetch, env = process.env }) {
  const { repo, commit } = JSON.parse(readFileSync(path.join(root, "source.json"), "utf8"));
  const headers = { "user-agent": "pin drift check", accept: "application/vnd.github+json" };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const meta = await fetchImpl(`${API}/repos/${repo}`, { headers });
  if (!meta.ok) return { repo, commit, unreachable: `HTTP ${meta.status} asking for ${repo}` };
  const branch = (await meta.json()).default_branch;

  const cmp = await fetchImpl(`${API}/repos/${repo}/compare/${commit}...${branch}`, { headers });
  // A pin the upstream no longer holds — a force-push, a rewritten history — is a 404 here and
  // is worth saying out loud rather than reporting as "current".
  if (!cmp.ok) return { repo, commit, branch, unreachable: `HTTP ${cmp.status} comparing ${commit.slice(0, 7)}...${branch}` };
  const body = await cmp.json();
  return { repo, commit, branch, behind: body.ahead_by ?? 0, compare: body.html_url,
           newest: body.commits?.length ? body.commits[body.commits.length - 1] : null };
}

// GitHub renders `::notice::` on the run and in the pull request's checks. Everything this
// prints is one line, because a check nobody reads is a check that does not exist.
export function pinReport(d, log = console.log) {
  const at = d.commit.slice(0, 7);
  if (d.unreachable) {
    log(`::notice title=Model pin::could not be checked — ${d.unreachable}`);
    return 0;
  }
  if (!d.behind) {
    log(`  ✓ the model pin is current — ${d.repo}@${at}`);
    return 0;
  }
  const what = d.behind === 1 ? "1 commit" : `${d.behind} commits`;
  const subject = d.newest ? ` Newest: ${d.newest.commit.message.split("\n")[0]}` : "";
  log(`::notice title=Model pin is ${what} behind::${d.repo}@${at} → ${d.branch}.${subject} ${d.compare}`);
  log(`  ℹ the model pin is ${what} behind ${d.repo}@${d.branch} — ${d.compare}`);
  return d.behind;
}
