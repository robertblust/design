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
import path from "node:path";
import { pathToFileURL } from "node:url";

// The vocabulary a card may use. Guestgraph's exporter threw unless every card was
// `from: "file"` / `settle: "wait:900"`. The intent is worth keeping and the assertion is not:
// against this union it asserts a limitation and would reject the very capabilities the other
// two sites have. What actually guarantees the exporter performs the render the recipe hashes
// is a fixed vocabulary — an unknown key is a knob that silently does nothing, which is exactly
// the failure og:check exists to prevent. `from` is deliberately absent: every page in the
// family renders from `file://` and nothing reads that key, so a card carrying it is hashing a
// distinction no render makes.
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

export async function exportCards({ chromium, recipe, log = console.log }) {
  const { cards, stamp, REPO_ROOT } = recipe;
  validate(cards);

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
      await page.addInitScript(() => { try { localStorage.setItem("rb-theme", "dark"); } catch (e) {} });
      // file://, like the decks themselves: every page in the family references its assets
      // relatively for exactly this reason, so no card needs a server and `npm run og` needs no
      // second terminal. A card may name the state it wants as a hash — companygraph's model page
      // reads one and focuses what it names, so the card renders that view rather than the page's
      // opening one.
      await page.goto(pathToFileURL(path.join(REPO_ROOT, c.dir, "index.html")).href + (c.hash || ""),
        { waitUntil: "networkidle" });
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
}
