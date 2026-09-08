// Render each share card from the page it advertises.
//
// `og.png` is not a banner someone drew: an index card is the page itself and a deck's card is
// its own title slide, so a link preview shows what the visitor is about to land on rather than
// something kept in step by hand. What each card is made of — the frame, the crop, the hide
// rules — is the site's own data and arrives in `recipe`; nothing here holds a knob, because a
// second copy of one could be edited without the recipe hash moving, which is the single failure
// `og:check` exists to make impossible.
//
// This module is the union of the three exporters it replaces, not the intersection. Each of
// the three sites had drifted into holding a capability the other two had lost — per-card
// `deviceScaleFactor` was only guestgraph's, reduced-motion settling and the URL `hash` were
// only companygraph's, an unconditional `document.fonts.ready` was only blust.ch's and
// guestgraph's, and the `if (c.hide)` guard was only companygraph's. Consolidating onto any one
// copy, or onto what all three agreed on, would delete working behavior from two sites and
// nothing would fail: every one of those losses renders a card that looks plausible. So every
// capability present in any copy is present here.
//
// Playwright is never imported. The package has no dependencies at all, and `og:check` runs in
// CI before `npm ci`; the site owns the browser and passes a `chromium` in.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

// The vocabulary a card may use. Guestgraph's exporter threw unless every card was
// `from: "file"` / `settle: "wait:900"`. The intent is worth keeping and the assertion is not:
// against this union it asserts a limitation and would reject the very capabilities the other
// two sites have. What actually guarantees the exporter performs the render the recipe hashes
// is a fixed vocabulary — an unknown key is a knob that silently does nothing, which is exactly
// the failure og:check exists to prevent. `from` is deliberately absent: no card in any of the
// three sites' recipes reads or sets it, so a card carrying it is hashing a distinction nothing
// acts on.
const KNOWN = new Set(["dir", "width", "height", "renderHeight", "deviceScaleFactor",
                       "clipY", "hide", "titleSlide", "settle", "hash"]);

const REQUIRED = ["dir", "width", "height", "renderHeight", "clipY"];

const SETTLE = /^wait:\d+$|^reduced-motion$/;

// Absent `settle` means blust.ch's behavior, which is what keeps its eight cards byte-identical
// across this move: none of them names a settle at all.
const DEFAULT_SETTLE = "wait:900";

export function validate(cards) {
  for (const c of cards) {
    for (const k of Object.keys(c)) {
      if (!KNOWN.has(k)) throw new Error(`card ${c.dir}: unknown key "${k}"`);
    }
    for (const k of REQUIRED) {
      if (c[k] === undefined) throw new Error(`card ${c.dir}: missing "${k}"`);
    }
    if (c.settle !== undefined && !SETTLE.test(c.settle)) {
      throw new Error(`card ${c.dir}: settle "${c.settle}" is neither wait:<ms> nor reduced-motion`);
    }
  }
}

// Served rather than opened from disk, because a page that fetches its own data cannot do it
// from file:// — the origin is opaque and both fetch and a JSON module import are blocked. The
// stated reason for file:// was that no card should need a server and `npm run og` should need
// no second terminal, and that survives: the exporter starts one itself and stops it when it is
// done. A card rendered this way was measured byte-identical to one rendered from disk, so no
// committed card moves.
//
// Types are named rather than guessed. A page whose script is served as the wrong type does not
// error — it silently does not run, which is the failure this whole family keeps finding.
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".xml": "application/xml", ".txt": "text/plain",
};

// Exported so the routing this run actually depends on — a type served wrong, a directory
// index, a 404, a path kept inside root — is verified by hitting a real listening server, not
// by re-deriving what its handler is supposed to do.
export function serve(root) {
  const rootResolved = path.resolve(root);
  const srv = http.createServer((req, res) => {
    try {
      // Decoding inside the try: a malformed escape (`%zz`) throws a URIError, and that must
      // become a 404 like any other bad request rather than an uncaught exception that takes
      // the whole export run down mid-render.
      const decoded = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
      let file = path.join(root, decoded);
      if (file.endsWith(path.sep)) file = path.join(file, "index.html");
      file = path.resolve(file);
      // path.join already collapses a `..` segment, but it collapses straight out of root — a
      // request for `/../secret.txt` or an encoded escape (`%2e%2e`, `..%2f`) resolves to a real
      // path outside it. The server only ever has one directory to answer from, so anything that
      // resolves outside root is a 404, not a read. The trailing separator on the prefix check
      // is what keeps a sibling directory that merely shares root's name (`/rootsibling/...`)
      // from passing as contained.
      if (file !== rootResolved && !file.startsWith(rootResolved + path.sep)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(fs.readFileSync(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  // Port 0 asks the OS for a free one, so two runs cannot collide and nothing has to be reserved.
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

export async function exportCards({ chromium, recipe, log = console.log }) {
  const { cards, stamp, REPO_ROOT } = recipe;
  validate(cards);

  // Started before the loop and closed in the outer finally below, so a card that throws does
  // not leave a listening socket behind.
  const srv = await serve(REPO_ROOT);
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const browser = await chromium.launch();
    // A card that throws mid-render used to leave this browser open forever: nothing downstream
    // of the throw ever reached browser.close(). The three sites all call this with no catch, so
    // the rejection reaches the top level and node exits in ~2s regardless — but a caller that
    // does catch (a future harness, a progress-reporting wrapper) was left with a live Chromium
    // process no exit was ever going to reap. The close must not swallow the error: a run that
    // failed still needs to say so.
    try {
      for (const c of cards) {
        const settle = c.settle ?? DEFAULT_SETTLE;
        const page = await browser.newPage({
          viewport: { width: c.width, height: c.renderHeight },
          // A card without its own scale renders 1:1, so the file is exactly the size its
          // `og:image:width` claims. Guestgraph is the only site that ever set this per card, and
          // it read `c.deviceScaleFactor` with no default — correct there because every one of its
          // cards names it, and `undefined` on a card that doesn't.
          deviceScaleFactor: c.deviceScaleFactor ?? 1,
          // The landing figures animate, and a render that merely waits "long enough" catches one
          // mid-draw. Emulating reduced motion draws the settled state the page's own @media block
          // defines, exactly, instead of racing a timer. Passed as a page option rather than through
          // `emulateMedia` because that is the form companygraph's cards were rendered with.
          ...(settle === "reduced-motion" ? { reducedMotion: "reduce" } : {}),
        });
        // Spec decision 5: cards are always dark, and pinned rather than inherited — a later change
        // to the default must not silently restyle twenty committed PNGs. `removeItem` clears the
        // key, which *inherits* whatever the boot script's default happens to be rather than pinning
        // anything; it only ever looked pinned because the default was already dark. `setItem` is
        // what actually pins it.
        await page.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch (e) {} });
        // Served rather than opened from disk — see the note on `serve` above. A card may name
        // the state it wants as a hash — companygraph's model page reads one and focuses what it
        // names, so the card renders that view rather than the page's opening one.
        await page.goto(`${base}/${c.dir}/${c.hash || ""}`, { waitUntil: "networkidle" });
        // A card rendered in the fallback face is a silent failure: nothing errors, and the type is
        // simply not the type the page declares. Awaited on every card, not only the ones that
        // settle by emulation — companygraph awaited it in the reduced-motion branch only, so its
        // wait:900 cards were racing font loading against a fixed timer.
        await page.evaluate(() => document.fonts.ready);
        // Playwright rejects an empty style tag outright, so a card with nothing to hide skips the
        // call rather than pass content it refuses.
        if (c.hide) await page.addStyleTag({ content: c.hide });
        if (c.titleSlide) {
          await page.evaluate(() => {
            const s = Array.from(document.querySelectorAll(".slide"));
            s.forEach((el, k) => el.classList.toggle("active", k === 0));
          });
        }
        // The emulation above *is* the settle for a reduced-motion card: the page is already drawing
        // its settled state, so there is nothing left to wait for.
        if (settle !== "reduced-motion") await page.waitForTimeout(Number(settle.slice("wait:".length)));

        const out = path.join(REPO_ROOT, c.dir, "og.png");
        await page.screenshot({ path: out, clip: { x: 0, y: c.clipY, width: c.width, height: c.height } });
        // Stamped after the screenshot, so a run that dies half way leaves the card reported stale
        // rather than reported current on a file it never wrote.
        stamp(c);
        log("  ✓ " + path.relative(REPO_ROOT, out) + ` ${c.width}×${c.height}`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise((resolveClose) => srv.close(resolveClose));
  }
}
