// How a link to someone else's site is judged. Broken is a claim the checker makes about another
// site, so it is made only on an answer that says the page is gone: a 404 or a 410 to a GET, or a
// host name that no longer resolves. Every other refusal (a login wall, a rate limit, LinkedIn's 999
// to anything that is not a browser, a server having a bad day) says nothing about the page, and
// is reported as unverifiable rather than called broken.
const UA = "robertblust-design-links (+https://github.com/robertblust/design)";

export function verdict(status) {
  if (status >= 200 && status < 400) return "ok";
  if (status === 404 || status === 410) return "broken";
  return "unverifiable";
}

// The body is always canceled: Node 22's bundled undici can crash on a socket that ends with a
// body nobody read (see verify/http.mjs), and nothing here reads one.
async function ask(url, method, { fetchImpl, timeoutMs }) {
  const res = await fetchImpl(url, { method, redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
  await res.body?.cancel();
  return res.status;
}

function failed(err) {
  const code = err?.cause?.code ?? err?.code;
  if (code === "ENOTFOUND") return { kind: "broken", answer: "no such host" };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { kind: "unverifiable", answer: "timeout" };
  return { kind: "unverifiable", answer: code ?? String(err?.message ?? err) };
}

// HEAD first, because it is cheap for both sides; GET whenever HEAD did not say yes, because
// some hosts answer HEAD with a 403, a 404 or a 405 for a page a GET serves.
async function once(url, opts) {
  try {
    let status = await ask(url, "HEAD", opts);
    if (verdict(status) !== "ok") status = await ask(url, "GET", opts);
    return { kind: verdict(status), answer: String(status) };
  } catch (err) {
    return failed(err);
  }
}

export async function judge(url, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const first = await once(url, { fetchImpl, timeoutMs });
  return { url, ...(first.kind === "ok" ? first : await once(url, { fetchImpl, timeoutMs })) };
}

// Each host is one queue, asked in order, and at most `limit` queues are worked at once: one
// request per host at a time, so no host sees this checker as a burst, and `limit` overall.
export async function judgeAll(urls, { judgeOne, limit = 4 }) {
  const byHost = new Map();
  for (const url of urls) {
    const host = new URL(url).host;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }
  const queues = [...byHost.values()], out = [];
  let next = 0;
  const worker = async () => {
    while (next < queues.length) for (const url of queues[next++]) out.push(await judgeOne(url));
  };
  await Promise.all(Array.from({ length: Math.min(limit, queues.length) }, worker));
  return out.sort((a, b) => a.url.localeCompare(b.url));
}
