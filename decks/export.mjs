// Render each deck to a 16:9 PDF fallback, one slide per page, in both languages.
//
// Screenshots each slide exactly as shown on screen — dark theme, SVG diagrams — then assembles
// the PNGs into a PDF. What varies between sites is which decks there are and what their files
// are called; that arrives in `decks`. Nothing else varies: all three sites this replaces used
// the same frame, the same waits, the same hide rule and the same clip, which is why this module
// is the three of them and not a union of them.
//
// Playwright and pdf-lib are never imported. The package has no dependencies at all; the site
// owns both and passes them in, the same way cards/export.mjs takes a `chromium`.
//
// A deck used to open with `page.goto(pathToFileURL(...))`, because `deck.css` and
// `deck-runtime.js` were fenced blocks copied straight into the page and nothing it drew
// depended on being served. Both are now files a deck can link instead — `tokens.css` always,
// per README's "Whole files" section — and a linked stylesheet opened over file:// is read
// through a CSSOM Chromium refuses: every file:// resource gets its own opaque origin, even
// one sitting beside the page in the same directory. Serving the page the way a browser
// actually meets it in production, rather than opening it as a local file, is what makes the
// screenshot this module takes worth trusting. `serve` is reused from cards/export.mjs rather
// than reimplemented, exactly as its own comment there already invites: the routing this run
// depends on — a type served wrong, a path kept inside root — is a static-file server this
// package already ships and already tests, not a second copy of one.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { serve } from "../cards/export.mjs";

const W = 1280, H = 720;
const LANGS = ["de", "en"];

// The vocabulary a deck may use. Borrowed from cards/export.mjs and for the same reason: an
// unknown key is a knob that silently does nothing, and a deck list is edited by hand.
const KNOWN = new Set(["dir", "slug"]);

export function validate(decks) {
  for (const deck of decks) {
    for (const key of Object.keys(deck)) {
      if (!KNOWN.has(key)) {
        throw new Error(`deck ${JSON.stringify(deck)}: unknown key "${key}"`);
      }
    }
    for (const key of KNOWN) {
      if (typeof deck[key] !== "string" || deck[key] === "") {
        throw new Error(`deck ${JSON.stringify(deck)}: missing "${key}"`);
      }
    }
  }
}

// `write` is injected for the same reason `log` is: these tests drive the module with a fake
// browser and must not touch a filesystem to do it. It defaults to the real thing, so every
// caller in the family passes neither.
//
// `base` is new and optional. Both real callers, blust.ch's and companygraph.io's
// export-pdf.mjs, call this with `{ chromium, PDFDocument, root, decks }` and nothing else —
// the default below is what keeps them working untouched, by having the exporter serve `root`
// itself exactly as `npm run og` already does for cards, and close that server when the run
// ends. A caller that already has a server running (this package's own tests, or a future one)
// may pass its base directly instead, but never a `file://` one: that is the one shape this
// module used to open and no longer can, for the reason in the comment above the imports.
export async function exportDecks({ chromium, PDFDocument, root, decks, base,
                                    log = console.log, write = writeFileSync }) {
  validate(decks);
  if (typeof base === "string" && base.startsWith("file://")) {
    throw new Error("exportDecks serves root over http itself now and no longer opens a " +
      "deck from file:// — pass no base at all, or the base of a server already serving root");
  }
  const written = [];
  const ownServer = base === undefined;
  const srv = ownServer ? await serve(root) : null;
  const siteBase = ownServer ? `http://127.0.0.1:${srv.address().port}` : base;
  try {
    const browser = await chromium.launch();
    try {
      for (const deck of decks) {
        const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
        await page.goto(`${siteBase}/${deck.dir}/`, { waitUntil: "networkidle" });
        // Hide the controls, not the credit: .name lives inside .chrome, and hiding the whole
        // bar took the byline off every printed page. A transport in a PDF advertises buttons
        // that do nothing; a byline is the one part of that bar a printed page still wants.
        await page.addStyleTag({ content: `.transport,.bar,.notes{display:none!important}\n     /* a still image should not be waiting out a transition it does not want */\n     .slide.active > *{animation:none!important}` });
        const count = await page.evaluate(() => document.querySelectorAll(".slide").length);

        for (const lang of LANGS) {
          // the decks have no keyboard shortcuts any more — click the transport's language
          // toggle. The rule above hides it, so click it through the DOM, not the pointer.
          await page.evaluate(l => document.getElementById(l === "de" ? "langDe" : "langEn").click(), lang);
          await page.waitForTimeout(400);

          const pdf = await PDFDocument.create();
          for (let i = 0; i < count; i++) {
            await page.evaluate(n => {
              const s = Array.from(document.querySelectorAll(".slide"));
              s.forEach((el, k) => el.classList.toggle("active", k === n));
            }, i);
            await page.waitForTimeout(500);        // let the rise animation settle
            const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
            const img = await pdf.embedPng(png);
            const p = pdf.addPage([W, H]);
            p.drawImage(img, { x: 0, y: 0, width: W, height: H });
          }
          const file = path.join(root, deck.dir, `${deck.slug}-${lang}.pdf`);
          write(file, await pdf.save());
          log(`  ✓ ${path.relative(root, file)}  (${count} slides)`);
          written.push({ file, pages: count });
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    // Started before the browser launches and closed here regardless of how the run ends, the
    // same shape cards/export.mjs already uses `serve` under: a run that throws mid-deck must
    // not leave a listening socket behind either.
    if (ownServer) {
      await new Promise((resolveClose) => {
        srv.close(resolveClose);
        srv.closeAllConnections?.();
      });
    }
  }
  return written;
}
