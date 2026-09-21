// The one issue a site keeps about its external links: opened when a run finds a link broken,
// rewritten by every run while it stays open, closed with a comment by the first run that finds
// none. One issue and not one a week, because a reader who has to compare issues to learn what
// changed stops reading them. It speaks to GitHub's REST API with fetch and the workflow's token.
export const ISSUE_TITLE = "Broken external links";

const esc = (s) => String(s).replace(/\|/g, "\\|");

function table(items) {
  return [
    "| Link | Answer | Found on |",
    "| --- | --- | --- |",
    ...items.map((v) => `| ${esc(v.url)} | ${esc(v.answer)} | ${v.from.map(esc).join("<br>")} |`),
  ].join("\n");
}

export function issueBody({ broken, unverifiable }, { runUrl, date }) {
  const run = runUrl ? ` ([the run](${runUrl}))` : "";
  const out = [
    `The weekly check of every link this site carries to another site, run on ${date}${run}. Every run rewrites this issue and the first run that finds nothing broken closes it, so an edit made here does not last.`,
    "",
    "## Broken",
    "",
    "Each of these answered a GET with 404 or 410, or its host name does not resolve.",
    "",
    table(broken),
  ];
  if (unverifiable.length) {
    out.push(
      "",
      "## Unverifiable",
      "",
      "Each of these answered in a way that says nothing about the page — 401, 403, 429, 999, a 5xx, a timeout or a refused connection — and is listed to be looked at, not because it is known to be wrong.",
      "",
      table(unverifiable),
    );
  }
  return `${out.join("\n")}\n`;
}

export async function syncIssue({ report, repo, token, api = "https://api.github.com", runUrl, date, apiFetch = fetch, log = console.log }) {
  const call = async (method, p, body) => {
    const res = await apiFetch(`${api}/repos/${repo}${p}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${method} ${p}: ${await res.text()}`);
    return res.json();
  };
  const open = (await call("GET", "/issues?state=open&per_page=100"))
    .find((i) => i.title === ISSUE_TITLE && !i.pull_request);
  if (report.broken.length) {
    const body = issueBody(report, { runUrl, date });
    if (open) {
      await call("PATCH", `/issues/${open.number}`, { body });
      log(`  Issue #${open.number} rewritten.`);
      return { action: "updated", number: open.number };
    }
    const made = await call("POST", "/issues", { title: ISSUE_TITLE, body });
    log(`  Issue #${made.number} opened.`);
    return { action: "opened", number: made.number };
  }
  if (!open) return { action: "none" };
  const run = runUrl ? ` ([the run](${runUrl}))` : "";
  await call("POST", `/issues/${open.number}/comments`, { body: `The run of ${date}${run} found no external link broken.` });
  await call("PATCH", `/issues/${open.number}`, { state: "closed", state_reason: "completed" });
  log(`  Issue #${open.number} closed.`);
  return { action: "closed", number: open.number };
}
