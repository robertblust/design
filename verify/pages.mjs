// The checks every prose page in the family gets, in one place. Each returns a string naming
// what is wrong, or null. `page` is a Playwright page — the package never imports Playwright,
// it only receives one, which is what keeps this dependency-free.
//
// A factory rather than a plain object because `seo` and `card` close over the site's own
// SITE and BASE. Threading those through nineteen signatures to serve two would have changed
// every body; closing over them once leaves all nineteen exactly as they were, which is what
// makes this a move and not a rewrite.
import { httpStatus } from "./http.mjs";
// carriesLang tests a link to a sibling domain against this pattern. The check imported it
// directly from the package in every site's check.mjs before this move, so importing it here
// keeps the same source of truth rather than inventing a sixth name to thread through the
// factory for a value that never varies per site.
import { FAMILY } from "../lib/family.mjs";
// Reused rather than reinvented: this is the exact fence-open/close grammar the package's
// own sync tool locates every block by, so a JSON-LD description that merely mentions "theme
// boot" in prose cannot be mistaken for the genuine, package-owned comment. See noFlash.
import { findFence } from "../lib/rewrite.mjs";
// readoutInvariant's scanner. See lcd-scan.mjs's own header for why this is imported rather
// than reimplemented: it is the exact brace-aware reader theme.test.mjs's ".lcd invariance"
// test in @robertblust/design is built from, moved so a site's served HTML can be scanned
// with it too, not just the package's own blocks/deck-transport.css.
import { lcdVarReferences } from "./lcd-scan.mjs";

export function pageChecks({ SITE, BASE }) {
  if (!SITE) throw new Error("pageChecks needs SITE, the site's canonical origin");
  if (!BASE) throw new Error("pageChecks needs BASE, the origin actually being tested");
  return {
    // A page that says it makes no third-party request must make none. `links` and
    // `internalLinks` cannot see this: they inspect markup, and a font, an analytics tag or
    // an embed is a request. Copied from guestgraph.github.io, where the same claim is made.
    async sameOrigin(page, spec) {
      const seen = [];
      page.on("request", r => seen.push(r.url()));
      await page.reload({ waitUntil: "networkidle" });
      const origin = new URL(spec.absolute).origin;
      const foreign = [...new Set(seen.filter(u => /^https?:/.test(u) && !u.startsWith(origin)))];
      return foreign.length ? "off-origin request(s): " + foreign.join(", ") : null;
    },
    async title(page, spec) {
      const t = await page.title();
      if (!spec.title.test(t)) return `title ${JSON.stringify(t)} does not match ${spec.title}`;
      if (t.length > 65) return `title is ${t.length} chars, over 65`;
      return null;
    },
    async lang(page, spec) {
      const l = await page.evaluate(() => document.documentElement.lang);
      return l === spec.lang ? null : `lang=${l}, expected ${spec.lang}`;
    },
    // The language declared before any JS runs. It used to be `de`, because the markup was
    // German and JS swapped it to English on load — which meant a crawler without JS read
    // German from a page whose og tags, share card and canonical content were all English.
    // The markup is English-first now, so this asserts the page tells the truth cold.
    //
    // `lang` is not this check. That one reads documentElement.lang *after* applyLang() has
    // run, so a page whose source said `de` would be corrected on load and pass anyway, while
    // a crawler that runs no JS still read German. Only this one is fetched cold, which is why
    // it belongs on every page and not just the decks.
    async sourceLang(page, spec) {
      const html = await (await fetch(spec.absolute)).text();
      const m = html.match(/<html lang="([a-z]+)"/);
      return m && m[1] === spec.sourceLang ? null : `static lang is ${m && m[1]}, expected ${spec.sourceLang}`;
    },
    async contains(page, spec) {
      const text = await page.evaluate(() => document.body.innerText);
      for (const s of spec.contains)
        if (!text.includes(s)) return `body text is missing ${JSON.stringify(s)}`;
      return null;
    },
    // Presence only. This used to assert `target="_blank" rel="noopener"` on every outbound link
    // as well; that half moved to noNewTab and inverted, because nothing opens in a new tab any
    // more. What is left is the one thing no other check does: fail when an absolute href is
    // simply wrong.
    async links(page, spec) {
      const found = await page.evaluate(() =>
        [...document.querySelectorAll("a[href^='http']")].map(a => a.href));
      for (const want of spec.links)
        if (!found.includes(want)) return `missing outbound link ${want}`;
      return null;
    },
    // One line runs through the middle of every word in the header — the wordmark, each nav
    // item, and both language segments. It did not before: nav is a flex row, its links
    // stretched to the row's height with their text at the top, and the language control sat
    // 5px lower than the words beside it.
    //
    // Measured on the text, not the boxes. A box can be centered while the text inside it is
    // not — that is exactly the bug this replaced, and a check comparing boxes would have
    // called it aligned.
    //
    // Two tolerances, because there are two fonts. The nav items and the language segments
    // are the same face at the same size, so they must agree to within half a pixel; that is
    // the pair the fix was about, and a loose bound there proved useless — with the link box
    // already symmetric, undoing `align-items:center` still landed inside 1px. The wordmark
    // is a different face, and where a line box falls inside its em box is the font's
    // business and the platform's, so it gets 1.5px and is judged against the row, not
    // against a single item of it.
    async headerBaseline(page) {
      return await page.evaluate(() => {
        const mid = el => {
          const n = [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim());
          const r = document.createRange(); r.selectNodeContents(n || el);
          const b = r.getBoundingClientRect(); return (b.top + b.bottom) / 2;
        };
        const row = [];
        document.querySelectorAll("nav a").forEach(a => row.push([a.textContent.trim(), mid(a)]));
        for (const id of ["lde", "len"]) {
          const el = document.getElementById(id);
          if (el) row.push([el.textContent.trim(), mid(el)]);
        }
        if (row.length < 2) return "the nav row has fewer texts than a row";
        const vals = row.map(r => r[1]);
        const base = vals.reduce((a, b) => a + b, 0) / vals.length;
        const spread = Math.max(...vals) - Math.min(...vals);
        if (spread > 0.5)
          return `nav texts are ${spread.toFixed(2)}px apart: ` +
            row.map(([n, v]) => `${n} ${(v - base >= 0 ? "+" : "") + (v - base).toFixed(2)}`).join(", ");
        const mark = document.querySelector(".brand b");
        if (mark) {
          const d = mid(mark) - base;
          if (Math.abs(d) > 1.5) return `the wordmark sits ${d.toFixed(2)}px off the nav row`;
        }
        return null;
      });
    },
    // Three domains, three localStorages, one preference. A visitor reading German on one
    // site and following a link to a sibling used to arrive in English, because an origin
    // cannot see what another origin stored. The language travels in the link instead.
    //
    // Three things have to hold, and the middle one is the reason the implementation looks
    // the way it does. A family link can live inside a data-de attribute, and switching
    // language replaces that element whole, so an href decorated at load would be thrown
    // away by the first toggle; decorating on mousedown survives it, and keeps the param
    // out of the served markup — nothing crawlable or copyable carries it.
    //
    // Driven with mousedown rather than click on purpose: it is the event that fires before
    // the browser follows a link, so it can be dispatched without navigating away.
    async carriesLang(page, spec) {
      const problems = [];
      await page.goto(spec.absolute + "?lang=de", { waitUntil: "networkidle" });
      const arrived = await page.evaluate(() => ({
        lang: document.documentElement.lang, search: location.search,
      }));
      if (arrived.lang !== "de")
        problems.push(`arriving with ?lang=de left the page in ${arrived.lang}`);
      if (/lang=/.test(arrived.search))
        problems.push(`the param stayed in the address bar as ${JSON.stringify(arrived.search)}`);

      const probe = await page.evaluate((src) => {
        const pick = test => [...document.querySelectorAll("a[href]")].find(a => {
          try { return test(new URL(a.href, location.href)); } catch (e) { return false; }
        });
        const press = a => {
          const before = a.getAttribute("href");
          a.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          return { before, after: a.getAttribute("href") };
        };
        const FAMILY = new RegExp(src);
        const out = { away: null, home: null };
        const away = pick(u => u.origin !== location.origin && FAMILY.test(u.hostname));
        if (away) out.away = press(away);
        const home = pick(u => u.origin === location.origin);
        if (home) out.home = press(home);
        return out;
      }, FAMILY.source);
      // A page with no link to a sibling domain simply has nothing to carry.
      if (probe.away && !/[?&]lang=de(&|$)/.test(probe.away.after))
        problems.push(`a link to ${probe.away.before} did not pick the language up: ${probe.away.after}`);
      if (probe.home && probe.home.after !== probe.home.before)
        problems.push(`a same-origin link was rewritten to ${probe.home.after}; it shares this storage already`);

      // Leave the page as this check found it, for whatever runs next.
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(spec.absolute, { waitUntil: "networkidle" });
      return problems.length ? problems.join("; ") : null;
    },
    // The row at phone widths. Every page in the three sites used to answer this its own way
    // — some wrapped the bar, some wrapped the nav, and the two whose `.bar` carried no
    // `flex-wrap` let the wordmark itself break, so "rb Robert Blust" arrived on two lines.
    //
    // Checked at 360px, which is narrower than the phones in the analytics and wide enough
    // that nothing here is a special case. The wordmark is measured against its own mark: if
    // the name has dropped below it the brand is twice the mark's height, and no tolerance is
    // needed to see it.
    //
    // The switcher is asserted visible on purpose. It would be easy to sweep it into the menu
    // with everything else, and for a bilingual audience that is the wrong trade — a language
    // control someone cannot find costs more than the tap it saves.
    //
    // The theme control is asserted the same way, guarded by `spec.noFlash`: that flag is the
    // page's own declaration that it carries a theme-boot fence and therefore the two controls
    // `#thLight`/`#thDark` a real visitor needs to work it, and only prose pages set it. Before
    // this, a page that lost `.seg.theme` — the whole control, not just one button — passed
    // every check: `storageKeys` clicked it present-or-skip, `navOrder` only cares that
    // `#langind` is last, and `design:check` cannot see site-owned markup at all. A page
    // silently missing the control it claims to have must fail somewhere, and this is that
    // somewhere.
    async mobileNav(page, spec) {
      const problems = [];
      await page.setViewportSize({ width: 360, height: 640 });
      try {
        await page.goto(spec.absolute, { waitUntil: "networkidle" });
        const shut = await page.evaluate(() => {
          const q = s => document.querySelector(s);
          // Boxes, not the display property: `display` does not inherit, so a button inside a
          // `display:none` parent still computes its own `inline-flex` and read as visible.
          // The theme control is hidden by its `.theme` wrapper as of contract v6, so the old
          // read would have reported it on the bar forever.
          const seen = el => el && el.getClientRects().length > 0;
          const brand = q(".brand").getBoundingClientRect().height;
          const mark = q(".brand svg").getBoundingClientRect().height;
          return {
            brand: Math.round(brand), mark: Math.round(mark),
            wide: document.documentElement.scrollWidth > window.innerWidth,
            links: seen(q("#navlinks")), burger: seen(q("#burger")), seg: seen(q("#langind")),
            theme: seen(q("#thLight")) && seen(q("#thDark")),
            // Where the language control sits with the menu shut, to compare with where it
            // sits once it is open. See below.
            langTop: Math.round(q("#lde").getBoundingClientRect().top),
          };
        });
        if (shut.brand > shut.mark)
          problems.push(`the wordmark broke: the brand is ${shut.brand}px against a ${shut.mark}px mark`);
        if (shut.wide) problems.push("the page scrolls sideways");
        if (shut.links) problems.push("the links are still in the row at 360px");
        if (!shut.burger) problems.push("there is no menu button");
        if (!shut.seg) problems.push("the language control is not on the bar");
        // The theme control is off the bar at this width as of header contract v7, and this
        // asserts the new shape rather than merely dropping the old assertion: three items and
        // two gaps do not fit 360px, so a theme control back on the bar means the row wraps
        // again and the header costs 61px above the fold on every phone page.
        if (spec.noFlash && shut.theme) problems.push("the theme control is still on the bar at 360px");

        // Only drive the button if it is there to be driven: clicking a hidden one waits the
        // full timeout and reports that instead of the thing actually wrong.
        if (shut.burger) {
        await page.click("#burger");
        const open = await page.evaluate(() => ({
          links: getComputedStyle(document.getElementById("navlinks")).display !== "none",
          flag: document.getElementById("burger").getAttribute("aria-expanded"),
          theme: document.getElementById("thLight").getClientRects().length > 0,
          // The theme control is positioned into the panel's top-right corner and the first
          // link sits at its top-left, so they share a row without either knowing about the
          // other. Whether they touch depends on how long that page's first link is — which
          // is site-owned markup this fence cannot see.
          collides: (() => {
            const t = document.getElementById("thmind")?.getBoundingClientRect();
            const a = document.querySelector("#navlinks a")?.getBoundingClientRect();
            if (!t || !a) return false;
            return t.left < a.right && t.right > a.left && t.top < a.bottom && t.bottom > a.top;
          })(),
          langTop: Math.round(document.getElementById("lde").getBoundingClientRect().top),
        }));
        if (!open.links) problems.push("pressing the button did not open the menu");
        if (open.flag !== "true") problems.push(`the button reports aria-expanded=${open.flag} while open`);
        // Off the bar is not the same as gone: opening the menu has to bring it back, or the
        // page has no way to change appearance on a phone at all.
        if (spec.noFlash && !open.theme)
          problems.push("opening the menu did not bring the theme control back");
        // And the bar must not reflow while it does. The first version of this put the control
        // back in flow, which pushed the language control onto a second row the moment the menu
        // opened — a control moving out from under the thumb reaching for it.
        if (open.langTop !== shut.langTop)
          problems.push(`opening the menu moved the language control ${open.langTop - shut.langTop}px`);
        if (open.collides) problems.push("the theme control overlaps the first menu link");

        await page.keyboard.press("Escape");
        const closed = await page.evaluate(() =>
          getComputedStyle(document.getElementById("navlinks")).display === "none");
        if (!closed) problems.push("Escape did not close the menu");
        }
      } finally {
        // Every other check runs at the desktop size; leave the page as they expect it.
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(spec.absolute, { waitUntil: "networkidle" });
      }
      return problems.length ? problems.join("; ") : null;
    },
    // The privacy page says "that is everything that gets stored" and then lists the keys. It
    // was true until the divider started remembering its width, and nothing noticed — the claim
    // is prose and the keys are in a script, so the two could only be compared by hand.
    //
    // This drives the page instead of reading it: every write to localStorage is recorded, the
    // page is then made to do the things that write — switch language, move the divider — and
    // each key that turns up must be named on the privacy page. A key the page does not declare
    // is the failure; a key it declares and never writes is not, because a claim to store
    // something is not a claim anyone is harmed by.
    async storageKeys(page, spec) {
      const declared = await (await fetch(new URL("/privacy/", spec.absolute).href)).text();
      await page.addInitScript(() => {
        window.__keys = [];
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { window.__keys.push(k); return real.call(this, k, v); };
      });
      await page.goto(spec.absolute, { waitUntil: "networkidle" });
      // The write paths this suite knows about, each present-or-skip: prose pages carry the
      // language control as #lde/#len, a deck carries the same control as #langDe/#langEn, the
      // theme control is #thLight/#thDark on either, and the model page's divider is #gutter.
      // A page matching none of these has nothing here to exercise its storage — the
      // zero-writes check below is what actually catches that, so this list is free to be
      // incomplete without the gap going silent again.
      if (await page.$("#lde")) { await page.click("#lde"); await page.click("#len"); }
      if (await page.$("#langDe")) { await page.click("#langDe"); await page.click("#langEn"); }
      if (await page.$("#thLight")) { await page.click("#thLight"); await page.click("#thDark"); }
      if (await page.$("#gutter")) { await page.focus("#gutter"); await page.keyboard.press("ArrowLeft"); }
      const written = await page.evaluate(() => [...new Set(window.__keys)]);
      // Leave the page as the rest of the suite expects it, storage included.
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(spec.absolute, { waitUntil: "networkidle" });
      // This is the other half of the check, and the one a page armed with storageKeys used to
      // have no way to fail: a page that writes nothing and a page whose trigger this check
      // failed to find are indistinguishable from the outside, and both used to return a clean
      // pass. Every page armed with storageKeys is here because it is known to write
      // rb-lang/cg-lang/gg-lang on its language control, so zero observed writes means the
      // control above was not found or not exercised — not that the page has nothing to declare.
      if (!written.length)
        return "no write path was exercised — none of #lde/#len, #langDe/#langEn, " +
               "#thLight/#thDark or #gutter produced a write on this page; add its control to the list above";
      const undeclared = written.filter((k) => !declared.includes(k));
      return undeclared.length
        ? `writes ${undeclared.join(", ")}, which /privacy/ does not name`
        : null;
    },
    // Every text token has to clear AA against the ground of the theme it belongs to. Read from
    // the live page rather than the package source, because what ships is what the page carries:
    // a stale generated copy is exactly the case worth catching.
    //
    // --ground is not the only surface text sits on. `.seg button[aria-pressed="true"]` paints
    // --c-mid on --press — the pressed EN and the pressed sun/moon, the only things telling a
    // reader which language and which theme is active — and that pair went unmeasured for a
    // whole release: the palette was validated token-against-page-background and never
    // token-against-token. --press is asserted here too, in both themes, because it is a pair
    // the pages actually paint.
    async contrast(page) {
      const bad = await page.evaluate(() => {
        const hex = (h) => { h = h.trim().replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
        const lum = (h) => { const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const out = [];
        for (const theme of ["dark", "light"]) {
          if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
          else document.documentElement.removeAttribute("data-theme");
          const cs = getComputedStyle(document.documentElement);
          const g = cs.getPropertyValue("--ground");
          for (const t of ["--ink", "--dim", "--c-mid", "--c-firm", "--c-flag"]) {
            const r = ratio(cs.getPropertyValue(t), g);
            if (r < 4.5) out.push(`${theme}: ${t} is ${r.toFixed(2)}:1 on --ground`);
          }
          const press = ratio(cs.getPropertyValue("--c-mid"), cs.getPropertyValue("--press"));
          if (press < 4.5) out.push(`${theme}: --c-mid is ${press.toFixed(2)}:1 on --press`);
        }
        document.documentElement.removeAttribute("data-theme");
        return out;
      });
      return bad.length ? bad.join("; ") : null;
    },
    // theme.test.mjs's "nothing that flips with the theme is painted inside .lcd" only ever
    // scans this package's own blocks/deck-transport.css. A `.lcd`-targeting rule a deck page
    // adds to its own CSS, outside the fence, is invisible to it — and invisible to
    // `design:check` too, which only compares bytes between the fence markers. So the readout
    // could be re-themed by a rule living entirely outside anything this package can see, and
    // nothing would fail. This check closes that gap by scanning the page's actual served
    // bytes rather than the package's source.
    //
    // It reuses the exact scanner that test is built from (lcdVarReferences, from
    // lcd-scan.mjs) rather than a second, weaker implementation — that reader survived five
    // rounds of a regex being defeated and is not something to reinvent per call site.
    //
    // "Which tokens flip" cannot be read from blocks/tokens.css at run time on a site — this
    // package has no filesystem access to a site's checkout, and a site's own copy of the
    // block could in principle drift from what it is pinned to anyway. So it is derived from
    // the served page itself: every prose and deck page carries both `:root` and
    // `:root[data-theme="light"]` inline, from the design-tokens fence, and a token whose
    // value differs between the two is exactly the set that must never appear inside `.lcd`.
    async readoutInvariant(page, spec) {
      const html = await (await fetch(spec.absolute)).text();
      const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
        .map((m) => m[1]).join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      // `:root\s*\{` only ever matches the bare rule: `:root[data-theme="light"]{` has a `[`
      // immediately after `:root`, which `\s*` (whitespace only) cannot cross into a `{`, so
      // the two selectors can never be confused for one another regardless of which one the
      // served document happens to write first.
      const rootBody = (re) => { const m = css.match(re); return m ? m[1] : null; };
      const dark = rootBody(/:root\s*\{([\s\S]*?)\}/);
      const light = rootBody(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/);
      if (!dark || !light)
        return 'no :root / :root[data-theme="light"] pair found in the page\'s own <style>';

      const tokenMap = (body) => Object.fromEntries(
        [...body.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
      const darkTokens = tokenMap(dark), lightTokens = tokenMap(light);
      const flipping = new Set(Object.keys(darkTokens)
        .filter((t) => t in lightTokens && lightTokens[t] !== darkTokens[t]));

      const bad = lcdVarReferences(css).filter((r) => flipping.has(r.token));
      return bad.length
        ? bad.map((r) => `${r.selector}'s ${r.prop} references --${r.token}, which differs between the two themes`).join("; ")
        : null;
    },
    // Structural, not temporal. An earlier version of this check drove a browser: seed
    // localStorage with a theme, navigate, and read data-theme at Playwright's "commit" —
    // the earliest event Playwright reports, picked so it would land after <head> but before
    // a deferred or module script had a chance to correct the attribute first. That reasoning
    // assumes the document is still being parsed when "commit" fires. On a loopback static
    // server it is not: `python3 -m http.server` (and Playwright's own webServer) hand back
    // the entire response in one write, so by the time Playwright reports the earliest
    // navigation event, every synchronous script on the page — <head>, mid-body, end-of-body
    // — has already run. A reviewer moved the real boot script below the page's <style>
    // block, ran the real suite the way CI runs it, and every check including this one came
    // back green: the temporal check was racing a clock that had already finished, so it
    // always observed the state *after* the mistake, never the mistake itself.
    //
    // The guarantee this check exists to prove was never about timing. A browser applies CSS
    // as it parses, in document order, so "the boot script runs before the stylesheet" is a
    // fact about byte position in the served HTML — provable by reading the bytes, not by
    // racing an event loop. Assert that directly and machine speed cannot fake it. Someone
    // will be tempted to "improve" this back into a browser-driven timing check; that is the
    // exact shape that shipped green while the page was genuinely broken. Don't.
    async noFlash(page, spec) {
      const html = await (await fetch(spec.absolute)).text();
      // Located the same way the package's own sync tool locates every fence — a
      // line-anchored comment matching the fence's exact "name · vN · variant" syntax —
      // rather than a bare substring search. Fix round 2: `html.indexOf("─── theme boot")`
      // returns the *first* raw-byte occurrence in the document, and a page's own prose (a
      // JSON-LD description, a <meta> tag) can mention the mechanism this literally — these
      // repositories now carry a growing body of text that does. A decoy occurrence earlier
      // in <head> made the old check walk backward to whatever <script> happened to precede
      // it (on every one of these pages, that is the JSON-LD block near the top) and judge
      // *that* element's position and form while the real, broken boot script sat further
      // down and unexamined. findFence's per-line pattern requires the exact three-part
      // comment — a JSON-LD string or a <meta> attribute cannot satisfy it by accident — so
      // it finds the one place in the document that is actually the fence, however much
      // prose about the mechanism surrounds it.
      let fence;
      try { fence = findFence(html, "theme boot"); }
      catch (e) { return `theme-boot fence: ${e.message}`; }
      if (!fence) return "no theme-boot fence found in the served HTML";

      // The character offset of the fence's own opening line — needed to find both what
      // precedes it (for position) and what encloses it (for form). Recomputed from the same
      // line split findFence uses internally, since findFence reports line indices, not byte
      // offsets, and reading its match position back out is simpler than exporting more of
      // its internals for a single caller.
      const eol = html.includes("\r\n") ? "\r\n" : "\n";
      const lines = html.split(eol);
      let at = 0;
      for (let i = 0; i < fence.start; i++) at += lines[i].length + eol.length;

      // Position: nothing that applies CSS may sit earlier in the document.
      const styleAt = html.indexOf("<style");
      const link = /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/i.exec(html);
      const sheetAt = Math.min(styleAt === -1 ? Infinity : styleAt, link ? link.index : Infinity);
      if (sheetAt !== Infinity && at > sheetAt)
        return "the theme-boot block appears after a stylesheet — a browser applies CSS as " +
          "it parses, so the theme must be set before the first <style> or stylesheet <link>";

      // Form: position alone proves nothing if the script carrying the block does not run
      // synchronously during parsing. A module, a deferred or async script, or one loaded
      // from src all execute after parsing — the same failure by a different door. The
      // enclosing <script> is found by walking back from the fence's own confirmed position,
      // not from a bare substring match, so this can only land on the element that actually
      // carries the boot code.
      const openTag = html.lastIndexOf("<script", at);
      if (openTag === -1) return "the theme-boot block is not inside a <script> element";
      const tag = html.slice(openTag, html.indexOf(">", openTag) + 1);
      const bad = [];
      if (/type\s*=\s*["']?\s*module/i.test(tag)) bad.push('type="module"');
      if (/\bdefer\b/i.test(tag)) bad.push("defer");
      if (/\basync\b/i.test(tag)) bad.push("async");
      if (/\bsrc\s*=/i.test(tag)) bad.push("src");
      if (bad.length)
        return `the theme-boot <script> carries ${bad.join(", ")} — that defers it past ` +
          "parsing, the same failure as running late";

      // The block should be wired to this site's own storage key, not merely present. Read
      // from the fence's own body, which findFence already scoped to exactly the confirmed
      // fence — not from the enclosing script, which could carry other content around it.
      if (spec.noFlash && !fence.body.includes(spec.noFlash))
        return `the theme-boot block does not reference ${JSON.stringify(spec.noFlash)}`;

      return null;
    },
    async navOrder(page) {
      const ORDER = ["Ideas", "Principles", "Model", "Example", "Talks", "Billing", "Privacy"];
      return await page.evaluate(order => {
        const nav = document.querySelector("nav");
        if (!nav) return "there is no nav";
        const items = [...nav.querySelectorAll("a")].map(a => a.textContent.trim());
        const unknown = items.filter(i => !order.includes(i));
        if (unknown.length) return "not named by the order rule: " + unknown.join(", ");
        const want = order.filter(i => items.includes(i));
        if (items.join(" ") !== want.join(" "))
          return `order is ${items.join(" · ")}; the rule is ${want.join(" · ")}`;
        // The switcher is the right-hand edge of the row, so nothing may follow it.
        const kids = [...nav.children];
        const sw = kids.findIndex(el => el.id === "langind" || el.classList.contains("langind"));
        if (sw === -1) return "the language switcher is not in the nav";
        if (sw !== kids.length - 1) return "something sits to the right of the language switcher";
        return null;
      }, ORDER);
    },
    async noNewTab(page) {
      const bad = await page.evaluate(() => {
        const live = [...document.querySelectorAll('a[target="_blank"]')]
          .filter(a => !a.closest(".slide"))
          .map(a => a.getAttribute("href"));
        // The rendered DOM is only ever one language. German rides in `data-de` as markup that
        // does not exist until a visitor switches, so a link check that trusts the DOM inspects
        // half the site. That is not hypothetical: the privacy page's German credit kept
        // `target='_blank'` — in single quotes, because it is nested inside an attribute — and
        // survived both a source-wide strip and this check until the attributes were parsed.
        const translated = [...document.querySelectorAll("[data-de]")].flatMap(el => {
          if (el.closest(".slide")) return [];
          const t = document.createElement("template");
          t.innerHTML = el.getAttribute("data-de");
          return [...t.content.querySelectorAll('a[target="_blank"]')]
            .map(a => `${a.getAttribute("href")} [de]`);
        });
        return [...live, ...translated];
      });
      return bad.length ? "must stay in this tab: " + bad.join(", ") : null;
    },
    async sameTab(page, spec) {
      const bad = await page.evaluate(hrefs =>
        [...document.querySelectorAll("a[href]")]
          .filter(a => hrefs.includes(a.getAttribute("href")))
          .filter(a => a.target === "_blank")
          .map(a => a.getAttribute("href")),
        spec.sameTab);
      return bad.length ? "must stay in this tab: " + bad.join(", ") : null;
    },
    // Decks open in the same tab now, which is only safe because the deck carries its own
    // way out. If that button ever disappears the same-tab links strand the reader on a
    // page with no exit — so the two rules are asserted together, deliberately.
    async wayOut(page, spec) {
      const found = await page.evaluate(href => {
        const links = [...document.querySelectorAll("a[href]")]
          .filter(a => a.getAttribute("href") === href);
        return links.map(a => ({
          inChrome: !!a.closest("#chrome"),
          named: !!(a.getAttribute("aria-label") || (a.textContent || "").trim()),
        }));
      }, spec.wayOut);
      if (!found.length) return `no link back to ${spec.wayOut} — a same-tab deck with no exit`;
      if (!found.some(l => l.inChrome)) return `the way back is not in the transport bar`;
      const unnamed = found.filter(l => !l.named).length;
      return unnamed ? `${unnamed} way-back link(s) without an accessible name` : null;
    },
    // A control that exists is not a control a visitor can reach. The theme control landed
    // beside the language one in the transport and nobody re-measured the mobile breakpoints
    // against the wider bar — at 414px `#thDark` and `#tUp` were entirely off-screen and at
    // 390px `#tNotes` was off-screen too, and no check caught it, because every existing check
    // asks whether a control exists in the markup, not whether it is on the screen.
    //
    // The obvious version of this check — mobileNav's own `scrollWidth > innerWidth` — does
    // not work here and must not be copied in: every deck sets `body{overflow:hidden}`, so an
    // overflowing transport never grows `scrollWidth` past `innerWidth` in the first place.
    // That assertion is permanently false on a deck regardless of how badly the bar overflows,
    // which is exactly how this went unseen. `elementFromPoint` does not have that blind spot:
    // it asks what is actually paintable at a point, which a hidden overflow cannot fake.
    //
    // Two independent failures are checked because either alone is not enough: a control can
    // sit fully inside the viewport's rectangle and still be unreachable if something else
    // paints over its center, and a control can be the true hit-target at its own center while
    // the rest of it is clipped past the edge — a corner a visitor's tap will miss more often
    // than it lands. `spec.transportFits` is the page's own list of widths to check, mirroring
    // how `spec.wayOut` and `spec.sameTab` let a page name what it is asserting rather than
    // this file guessing a width that happens to matter to one site and not another.
    async transportFits(page, spec) {
      const problems = [];
      const restore = page.viewportSize ? page.viewportSize() : null;
      try {
        for (const width of spec.transportFits) {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(spec.absolute, { waitUntil: "networkidle" });
          const bad = await page.evaluate(() => {
            const root = document.getElementById("transport");
            if (!root) return ["#transport is not on the page"];
            const controls = [...root.querySelectorAll("button, a")]
              .filter(el => getComputedStyle(el).display !== "none");
            const out = [];
            for (const el of controls) {
              const r = el.getBoundingClientRect();
              const within = r.left >= 0 && r.top >= 0 &&
                r.right <= window.innerWidth && r.bottom <= window.innerHeight;
              const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
              const hit = document.elementFromPoint(cx, cy);
              const reachable = !!hit && (hit === el || el.contains(hit));
              if (!within || !reachable) {
                const name = el.id || el.className || el.tagName.toLowerCase();
                const why = [!within && "off-screen", !reachable && "not the hit target at its own center"]
                  .filter(Boolean).join(", ");
                out.push(`${name} (${why})`);
              }
            }
            return out;
          });
          if (bad.length) problems.push(`${width}px: ` + bad.join(", "));
        }
      } finally {
        // Every other check runs at the desktop size; leave the page as they expect it.
        if (restore) await page.setViewportSize(restore);
        else await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(spec.absolute, { waitUntil: "networkidle" });
      }
      return problems.length ? problems.join("; ") : null;
    },
    // The footer carries two destinations now: the lockup to the site's landing page and
    // "Talks" to the index. wayOut covers only the second. Nothing else would notice the
    // brand pointing at a page that no longer exists — a relative href is invisible to the
    // `links` check, and a 404 on a deck's own chrome looks like a working deck until clicked.
    async landing(page, spec) {
      const found = await page.evaluate(href =>
        [...document.querySelectorAll("#chrome a[href]")]
          .filter(a => a.getAttribute("href") === href)
          .map(a => ({
            named: !!(a.getAttribute("aria-label") || (a.textContent || "").trim()),
            isLockup: !!a.querySelector(".namemark svg"),
          })), spec.landing);
      if (!found.length) return `no link to the landing page (${spec.landing}) in the transport bar`;
      if (!found.some(l => l.isLockup)) return `the landing link is not the brand lockup`;
      const unnamed = found.filter(l => !l.named).length;
      return unnamed ? `${unnamed} landing link(s) without an accessible name` : null;
    },
    async internalLinks(page) {
      const bad = await page.evaluate(() => {
        const out = [...document.querySelectorAll("[href], [src]")]
          .map(el => el.getAttribute("href") || el.getAttribute("src"))
          .filter(v => v && v.startsWith("/"));
        for (const sheet of document.styleSheets) {
          let rules;
          try { rules = sheet.cssRules; } catch (e) { continue; }  // unreadable: not ours
          const css = [...rules].map(r => r.cssText).join("\n");
          for (const m of css.matchAll(/url\(\s*["']?(\/[^"')]*)/g)) out.push(`url(${m[1]})`);
        }
        return out;
      });
      return bad.length ? "root-absolute internal path: " + bad.join(", ") : null;
    },
    // The footer is the same three links on every page, and it is copied by hand from a
    // sibling when a page is added. Both ways that copy goes wrong shipped together on
    // /principles/: the opening `<div class="shell">` was left behind, so the footer escaped
    // the content column and sat flush against the viewport, and the privacy link came from
    // the privacy page, where `./` is correct and `aria-current` is true — on any other page
    // it points at itself and lies about where the visitor is.
    //
    // Neither is visible to a check that only reads text. The links are all present, the page
    // renders, nothing 404s. What is wrong is where the footer sits and where one link goes,
    // so those are what this asserts.
    // The footer's entries, in the order the page renders them. `prose footer` in the package
    // owns this footer's CSS and design:check compares those bytes — but nothing looked at the
    // markup, so a rewrite that truncated the credit lockup at the nested </span> of .rbmark
    // passed design:check, verify, og:check and the og suite together: it dropped "Robert Blust"
    // and left an unclosed <a>, and the browser reparented every entry after it inside that <a>.
    // Direct children are therefore what this counts — nesting collapses the list to one.
    //
    // The mark's <svg> carries the letters "rb" as <text>, so svg is stripped before reading a
    // label. Otherwise the credit reads "rbRobert Blust" and the expected value has to encode a
    // rendering detail of the logo.
    async footer(page, spec) {
      const bad = await page.evaluate((want) => {
        const f = document.querySelector("footer");
        if (!f) return ["there is no footer"];
        const out = [];
        if (!f.closest(".shell")) out.push("footer is not inside .shell — it will not line up with the page");
        const spans = [...f.children].filter((el) => el.tagName === "SPAN");
        const label = (el) => {
          const c = el.cloneNode(true);
          c.querySelectorAll("svg").forEach((s) => s.remove());
          return c.textContent.replace(/\s+/g, " ").trim();
        };
        const got = spans.map(label);
        if (got.join(" · ") !== want.join(" · "))
          out.push(`reads "${got.join(" · ")}", expected "${want.join(" · ")}"`);
        // One link per entry: an unclosed anchor swallows its neighbors rather than dropping
        // them, so a correct-looking label list can still hide a broken entry.
        for (const el of spans) {
          const n = el.querySelectorAll("a").length;
          if (n !== 1) out.push(`entry "${label(el)}" holds ${n} links, expected exactly 1`);
        }
        const priv = [...f.querySelectorAll("a")]
          .find((a) => /^(privacy|datenschutz)$/i.test(a.textContent.trim()));
        if (!priv) out.push("footer has no privacy link");
        else {
          const here = new URL(location.href).pathname.replace(/\/+$/, "/");
          const to = new URL(priv.getAttribute("href"), location.href).pathname.replace(/\/+$/, "/");
          if (to !== "/privacy/") out.push(`privacy link goes to ${to}, not /privacy/`);
          const current = priv.hasAttribute("aria-current");
          if (current && here !== "/privacy/") out.push("privacy link claims aria-current on a page that is not /privacy/");
          if (!current && here === "/privacy/") out.push("privacy link is the current page and does not say so");
        }
        return out;
      }, spec.footer);
      return bad.length ? bad.join("; ") : null;
    },
    // The head Google reads, asserted as a contract rather than page by page. Three of these
    // were live failures before the check existed: a logo.svg this site has never served, an
    // isPartOf naming a #website node defined on another document, and /ideas/ advertising the
    // landing page's card. All three had shipped green.
    //
    // The canonical is compared against the page's own URL, not merely against og:url. Agreeing
    // with og:url proves only that two tags say the same thing; both can say the same wrong
    // thing, and a canonical pointing at another page removes this one from the index and hands
    // its signals over — quietly, and worse than anything above.
    async seo(page, spec) {
      const problems = [];
      const want = SITE + spec.path;
      const m = await page.evaluate(() => {
        const meta = (sel) => (document.querySelector(sel) || {}).content || null;
        return {
          canonical: (document.querySelector('link[rel="canonical"]') || {}).getAttribute?.("href") ?? null,
          ogUrl: meta('meta[property="og:url"]'),
          ogTitle: meta('meta[property="og:title"]'),
          ogDesc: meta('meta[property="og:description"]'),
          ogType: meta('meta[property="og:type"]'),
          image: meta('meta[property="og:image"]'),
          desc: meta('meta[name="description"]'),
          site: meta('meta[property="og:site_name"]'),
          locale: meta('meta[property="og:locale"]'),
          alt: meta('meta[property="og:image:alt"]'),
          twitter: meta('meta[name="twitter:card"]'),
          ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
        };
      });

      if (!m.canonical) problems.push("no canonical");
      else if (m.canonical !== want) problems.push(`canonical ${JSON.stringify(m.canonical)} should be ${want}`);
      if (m.ogUrl !== m.canonical) problems.push(`og:url ${m.ogUrl} != canonical ${m.canonical}`);

      // Every page renders its own card. A page pointing at another's previews the wrong page
      // on every share, looks perfectly healthy, and is what `card` below cannot see: it only
      // asks whether the image resolves at its declared size, and a borrowed card does.
      if (!m.image) problems.push("no og:image");
      else if (m.image !== want + "og.png") problems.push(`og:image ${m.image} is not this page's own card (${want}og.png)`);

      if (!m.desc) problems.push("no meta description");
      else if (m.desc.length > 200) problems.push(`description is ${m.desc.length} chars, over 200`);

      for (const [k, v] of [["og:site_name", m.site], ["og:locale", m.locale],
                            ["og:image:alt", m.alt], ["twitter:card", m.twitter],
                            ["og:title", m.ogTitle], ["og:description", m.ogDesc],
                            ["og:type", m.ogType]])
        if (!v) problems.push(`no ${k}`);
      if (m.ogType && !["website", "article"].includes(m.ogType))
        problems.push(`og:type ${m.ogType} is neither website nor article`);

      // Structured data has to resolve, not merely parse. Google reads @graph within one
      // document, so an @id referenced but defined elsewhere is a pointer to nothing — and a
      // URL inside it is a promise the site either keeps or does not.
      if (!m.ld.length) problems.push("no application/ld+json");
      const defined = new Set(), referenced = [], urls = new Set();
      for (const block of m.ld) {
        let data;
        try { data = JSON.parse(block); }
        catch (e) { problems.push("ld+json does not parse: " + e.message); continue; }
        const nodes = data["@graph"] || (Array.isArray(data) ? data : [data]);
        const walk = (o) => {
          if (Array.isArray(o)) {
            for (const v of o)
              if (typeof v === "string" && /^https?:\/\//.test(v)) urls.add(v); else walk(v);
            return;
          }
          if (!o || typeof o !== "object") return;
          for (const [k, v] of Object.entries(o)) {
            // A bare { "@id": ... } is a pointer; the same key alongside an @type defines the
            // thing pointed at. Both are registered here as well as from the top-level @graph
            // members, so a node inlined under a property satisfies references to it instead of
            // being reported dangling.
            if (k === "@id" && typeof v === "string") {
              if (o["@type"]) defined.add(v);   // a node inlined under a property still defines one
              else referenced.push(v);          // a bare { "@id": … } is a pointer that must land
            }
            else if (typeof v === "string" && /^https?:\/\//.test(v) && k !== "@context") urls.add(v);
            else walk(v);
          }
        };
        nodes.forEach(n => { if (n && n["@id"]) defined.add(n["@id"]); });
        nodes.forEach(walk);
      }
      for (const r of referenced)
        if (!defined.has(r)) problems.push(`ld+json references ${r}, which no node on this page defines`);

      // Fetched from Node against BASE, not in-page against location.origin: an origin carries
      // no path, and a BASE can (the sibling sites are served under one). Nothing about these
      // URLs needs a browser.
      for (const u of urls) {
        if (!u.startsWith(SITE)) continue;              // off-site URLs are not ours to keep
        let status = 0;
        try { status = await httpStatus(u.replace(SITE, BASE)); } catch { status = 0; }
        if (status !== 200) problems.push(`ld+json names ${u} → HTTP ${status}`);
      }

      return problems.length ? problems.join("; ") : null;
    },

    async card(page, spec) {
      const img = await page.evaluate(() =>
        (document.querySelector('meta[property="og:image"]') || {}).content);
      if (!img) return "no og:image";
      const declared = await page.evaluate(() => [
        (document.querySelector('meta[property="og:image:width"]')  || {}).content,
        (document.querySelector('meta[property="og:image:height"]') || {}).content]);
      // Rewrite the card's absolute URL onto whatever is being tested — BASE, not
      // location.origin. An origin carries no path, and a site served under one (a talks
      // subdirectory, say) loses that prefix: a card that serves perfectly then reports
      // "not fetchable" the first time the suite is pointed at production.
      const real = await page.evaluate(async ({ u, base, testBase }) => {
        const r = await fetch(base ? u.replace(base, testBase) : u.replace(/^https:\/\/[^/]+/, testBase));
        if (!r.ok) return null;
        const dv = new DataView(await r.arrayBuffer());
        return [String(dv.getUint32(16)), String(dv.getUint32(20))];   // PNG IHDR
      }, { u: img, base: spec.cardBase, testBase: BASE });
      if (!real) return `${img} is not fetchable`;
      if (real[0] !== declared[0] || real[1] !== declared[1])
        return `card is ${real.join("×")} but declared ${declared.join("×")}`;
      return null;
    },
    // The one check that clicks. Every other check in this file reads the page as it first
    // renders, which is English — German is markup in `data-de` that does not exist until a
    // visitor switches, so a toggle whose listener is gone, an `<h1>` whose `data-de` is
    // misspelled, or an `applyLang()` that stopped setting `documentElement.lang` all print
    // "all checks pass" without it. This was companygraph.io's own check, written by breaking
    // that page three ways and watching it catch each; blust.ch and guestgraph.io had no
    // equivalent, so their German halves had never been seen by a test. It is last in this
    // object because it is the only check that changes what the others read, and it puts the
    // page back before it returns.
    //
    // The spec says what German must appear (`shows`), what English must be gone (`hides`),
    // and optionally the German `<title>` (`title`), meta description (`desc`) and, on a talks
    // index, where the first `[data-de-href]` download must point in each language (`dlHref`).
    // Body text is `innerText`, so `text-transform: uppercase` nav labels are matched as the
    // visitor reads them — "VORTRÄGE", not "Vorträge".
    //
    // A page's segmented control is #lde/#len; a deck's transport carries the same control as
    // #langDe/#langEn, so a deck spec names `id` and `backId`. Going back is a different button,
    // not the same one pressed twice: pressing DE while already in German is correctly a no-op.
    async translates(page, spec) {
      const body = () => page.evaluate(() => document.body.innerText);
      const htmlLang = () => page.evaluate(() => document.documentElement.lang);
      const desc = () => page.evaluate(() => (document.getElementById("metadesc") || {}).content);
      const href = () => page.evaluate(() =>
        (document.querySelector("[data-de-href]") || {}).getAttribute?.("href"));
      const english = await body();
      const englishTitle = await page.title();
      const englishDesc = await desc();

      const toggle = "#" + (spec.translates.id || "lde");
      const back = "#" + (spec.translates.backId || "len");
      await page.click(toggle);
      const swapped = await htmlLang();
      if (swapped !== spec.translates.lang)
        return `after the toggle lang=${swapped}, expected ${spec.translates.lang}`;
      const german = await body();
      for (const s of spec.translates.shows || [])
        if (!german.includes(s)) return `German page is missing ${JSON.stringify(s)}`;
      for (const s of spec.translates.hides || [])
        if (german.includes(s)) return `German page still shows the English ${JSON.stringify(s)}`;
      // The <title> and the meta description are the page's word to a crawler or a tab strip;
      // nothing in `shows`/`hides` reaches either. A visitor who picks German under an English
      // title would sail past both.
      if (spec.translates.title) {
        const germanTitle = await page.title();
        if (germanTitle !== spec.translates.title)
          return `after the toggle title is ${JSON.stringify(germanTitle)}, expected ${JSON.stringify(spec.translates.title)}`;
      }
      if (spec.translates.desc) {
        const germanDesc = await desc();
        if (germanDesc !== spec.translates.desc)
          return `after the toggle meta description is ${JSON.stringify(germanDesc)}, expected ${JSON.stringify(spec.translates.desc)}`;
      }
      // The PDF exists in both languages and the link swaps with the toggle. A German reader
      // handed the English deck is a silent wrong answer: the page looks right, the download
      // works, and only the file is in the wrong language.
      if (spec.translates.dlHref) {
        const germanHref = await href();
        if (germanHref !== spec.translates.dlHref.de)
          return `after the toggle the download points at ${JSON.stringify(germanHref)}, expected ${JSON.stringify(spec.translates.dlHref.de)}`;
      }

      await page.click(back);
      const returned = await htmlLang();
      if (returned !== "en") return `toggling back left lang=${returned}, expected en`;
      if (await body() !== english) return "toggling back did not restore the English text";
      if (await page.title() !== englishTitle) return "toggling back did not restore the English title";
      if (await desc() !== englishDesc) return "toggling back did not restore the English meta description";
      if (spec.translates.dlHref) {
        const backHref = await href();
        if (backHref !== spec.translates.dlHref.en)
          return `toggling back left the download at ${JSON.stringify(backHref)}, expected ${JSON.stringify(spec.translates.dlHref.en)}`;
      }
      return null;
    },
  };
}
