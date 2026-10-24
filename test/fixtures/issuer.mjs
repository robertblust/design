// A stand-in for ZITADEL's three endpoints the chat's sign-in uses, on its own port and so its
// own origin, as id.blust.ch is to a site. The authorize endpoint sends the browser back to
// `redirect_uri` with a code and the `state` it was given, as the hosted login does once the
// reader has signed in; the token endpoint takes that code once, only with the verifier whose
// S256 challenge the authorize request carried, and answers with an access token and an ID token
// signed by a key made for the run, never one kept in a file; the end-session endpoint sends the
// browser to `post_logout_redirect_uri`. The token endpoint answers a cross-origin page, as the
// real one does for a registered origin. `set()` says what the next tokens hold: the roles claim,
// the reader's name, how many seconds the access token lives, below zero for one already lapsed,
// and `deny`, for a login the reader cancels.
import http from "node:http";
import crypto from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ROLES = "urn:zitadel:iam:org:project:roles";

export async function startIssuer() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const codes = new Map();
  const seen = { authorize: [], token: [], endSession: [] };
  let next = { roles: {}, name: "Tëst Reader", username: "reader@example.test", lives: 3600 };
  let serial = 0;

  function sign(claims) {
    const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test" }));
    const body = b64url(JSON.stringify(claims));
    return `${head}.${body}.${b64url(crypto.sign("sha256", Buffer.from(`${head}.${body}`), privateKey))}`;
  }
  // An access token as the site would hold it, for a test that needs one the endpoint did not
  // issue, such as one that has lapsed.
  function mint(lives) {
    const now = Math.floor(Date.now() / 1000);
    return sign({ iss: issuer.url, sub: "reader-1", aud: ["project-1"], iat: now, exp: now + lives, [ROLES]: next.roles, jti: String(++serial) });
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const cors = { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" };
    if (u.pathname === "/oauth/v2/authorize") {
      const q = Object.fromEntries(u.searchParams);
      seen.authorize.push(q);
      if (q.response_type !== "code" || q.code_challenge_method !== "S256" || !q.code_challenge || !q.redirect_uri || !q.client_id) { res.writeHead(400); res.end("bad authorize"); return; }
      const back = new URL(q.redirect_uri);
      // A reader who cancels at the login comes back with an error and the state, and no code.
      if (next.deny) {
        back.searchParams.set("error", "access_denied");
        back.searchParams.set("error_description", "The reader canceled.");
        back.searchParams.set("state", q.state);
        res.writeHead(302, { location: back.href }); res.end();
        return;
      }
      const code = "code-" + crypto.randomBytes(8).toString("hex");
      codes.set(code, { challenge: q.code_challenge, redirect: q.redirect_uri, client: q.client_id });
      back.searchParams.set("code", code);
      back.searchParams.set("state", q.state);
      res.writeHead(302, { location: back.href }); res.end();
      return;
    }
    if (u.pathname === "/oauth/v2/token") {
      if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
      let raw = "";
      req.on("data", (c) => { raw += c; });
      req.on("end", () => {
        const f = Object.fromEntries(new URLSearchParams(raw));
        seen.token.push({ form: f, type: req.headers["content-type"], origin: req.headers.origin });
        const held = codes.get(f.code);
        codes.delete(f.code);
        const good = held && f.grant_type === "authorization_code" && f.redirect_uri === held.redirect && f.client_id === held.client
          && typeof f.code_verifier === "string" && b64url(crypto.createHash("sha256").update(f.code_verifier).digest()) === held.challenge;
        if (!good) { res.writeHead(400, { ...cors, "content-type": "application/json" }); res.end(JSON.stringify({ error: "invalid_grant" })); return; }
        const now = Math.floor(Date.now() / 1000);
        const id = sign({ iss: issuer.url, sub: "reader-1", aud: [held.client], iat: now, exp: now + 3600, name: next.name, preferred_username: next.username, [ROLES]: next.roles });
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ access_token: mint(next.lives), id_token: id, token_type: "Bearer", expires_in: next.lives }));
      });
      return;
    }
    if (u.pathname === "/oidc/v1/end_session") {
      const q = Object.fromEntries(u.searchParams);
      seen.endSession.push(q);
      res.writeHead(302, { location: q.post_logout_redirect_uri }); res.end();
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const issuer = {
    url: `http://127.0.0.1:${server.address().port}`,
    seen,
    mint,
    set(o) { next = { ...next, ...o }; },
    reset() { seen.authorize.length = 0; seen.token.length = 0; seen.endSession.length = 0; next = { roles: {}, name: "Tëst Reader", username: "reader@example.test", lives: 3600 }; },
    close: () => new Promise((r) => server.close(r))
  };
  return issuer;
}
