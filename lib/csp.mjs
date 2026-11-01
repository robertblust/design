// The content policy a page carries in its own head, so a script that was never written into the
// page cannot run on it. The sites are served by GitHub Pages, which sends no header a site can
// choose, and the chat keeps a signed-in reader's token in the origin's storage: a script injected
// into any page of the origin could read it. A `<meta http-equiv="Content-Security-Policy">` is the
// one place left to say which scripts are the page's own.
//
// The policy is computed from the page and written back into it, never kept beside it. Every inline
// script the page runs is named by its SHA-256, so an edit to one is a policy that no longer
// matches, which `design sync --check` reports like any other drift. Scripts from files are the
// origin's own and allowed as such. Where the page's chat tag names a chat host and an identity
// service, those two origins are the only others a script may send to, so even a script that ran
// could not post what it read anywhere else. A page that runs no script at all carries no policy:
// there is nothing on it to steal with, and the redirect pages a writer owns whole stay its own.
//
// A meta policy cannot say `frame-ancestors` or where to report, and applies only to what follows
// it, so it is written as the first thing after the page's `<meta charset>`.
import crypto from "node:crypto";

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SRC = /\bsrc\s*=/i;
const TYPE = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
// What a browser runs as a classic script or a module; a JSON or JSON-LD block is data and needs
// no hash.
const RUNS = new Set(["", "module", "text/javascript", "application/javascript"]);
const META = /\n?<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/i;
const CHARSET = /<meta\s+charset\s*=\s*"?[^">]*"?\s*\/?>/i;
const CHAT_TAG = /<script\b[^>]*\bsrc="[^"]*\bchat\.js"[^>]*>/i;

function typeOf(attrs) {
  const m = TYPE.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3]).trim().toLowerCase() : "";
}

function attr(tag, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1] : null;
}

function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

// The hash a browser computes for an inline script: over its text as the parser hands it on, and
// the parser has already turned every CRLF and lone CR into LF.
export function scriptHash(body) {
  const text = body.replace(/\r\n?/g, "\n");
  return `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

// The policy a page needs, or null for a page that runs no script.
export function policyFor(html) {
  const hashes = new Set();
  let runs = false;
  for (const m of html.matchAll(SCRIPT)) {
    const attrs = m[1];
    if (!RUNS.has(typeOf(attrs))) continue;
    runs = true;
    if (!SRC.test(attrs)) hashes.add(scriptHash(m[2]));
  }
  if (!runs) return null;
  const connect = new Set(["'self'"]);
  const chat = CHAT_TAG.exec(html);
  if (chat)
    for (const name of ["data-chat", "data-issuer"]) {
      const origin = originOf(attr(chat[0], name));
      if (origin) connect.add(origin);
    }
  return [
    "default-src 'self'",
    `script-src 'self'${[...hashes].sort().map((h) => " " + h).join("")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${[...connect].join(" ")}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// The policy the page carries now, or null for one that carries none.
export function policyIn(html) {
  const m = META.exec(html);
  return m ? /content="([^"]*)"/i.exec(m[0])[1] : null;
}

// The page with the policy it needs, in its place: replaced where the page carries one, written
// after `<meta charset>` where it does not, and taken out of a page that no longer runs a script.
export function withPolicy(html) {
  const want = policyFor(html);
  const without = html.replace(META, "");
  if (!want) return without;
  const tag = `<meta http-equiv="Content-Security-Policy" content="${want}">`;
  const charset = CHARSET.exec(without);
  if (!charset)
    throw new Error("a page that runs a script needs a <meta charset> for its content policy to follow");
  const at = charset.index + charset[0].length;
  const first = without.search(/<script\b/i);
  if (first !== -1 && first < at)
    throw new Error("a script stands before <meta charset>, where no content policy can reach it — move it after");
  return without.slice(0, at) + "\n" + tag + without.slice(at);
}
