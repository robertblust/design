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
// A screenshot is pixels, so a slide's links did not survive it: the model a slide rests on, the
// lockup in its corner and the chat button were all drawn and none could be followed. So before
// each screenshot the page reports where every visible link and every chat opener sits, and each
// becomes a link annotation over the same rectangle on the PDF page — the look is still the
// screenshot's, and the rectangles are what a reader clicks. An address is resolved against the
// page's canonical, never against the server this run started, which no reader can reach. A chat
// opener is a button, not a link, so it gets the address that opens the chat where the reader
// is: this deck, on this slide, with `?chat=open` and the PDF's language. A link to a family site
// carries `lang` the way `blocks/lang.js` does at click time. A URI in a PDF is a string object,
// not a name, and pdf-lib's own `PDFString` is the only way to make one, so the caller passes it
// beside `PDFDocument`; a caller that does not gets the PDF it always got, without links.
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
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { serve } from "../cards/export.mjs";
import { FRAME, LANGS, HIDE, SETTLE, pdfOf, stamp as stampDeck } from "./recipe.mjs";

// The frame, the languages, the hide rule and the waits are recipe.mjs's, which hashes them.
const W = FRAME.width, H = FRAME.height;

const readIfThere = (file) => (fs.existsSync(file) ? fs.readFileSync(file) : null);

// What each page of a deck PDF holds, read from a document pdf-lib has loaded: the picture, as a
// digest of the bytes the PDF stores for it, and the links over it, each as the PDF writes it.
// Nothing but the document is used, so no class of pdf-lib's is needed beside the PDFDocument a
// caller already hands in: a dictionary is walked by its entries, and a name is compared as the
// string it prints. A page whose picture cannot be found has `picture: null`, which samePages
// never calls the same as anything, so a PDF some other tool made is written again rather than
// kept on the strength of two empty digests.
export function pagesOf(doc) {
  const ctx = doc.context;
  const named = (dict, name) => {
    for (const [key, value] of dict.entries()) if (String(key) === "/" + name) return ctx.lookup(value);
    return undefined;
  };
  return doc.getPages().map((page) => {
    const resources = named(page.node, "Resources");
    const xobjects = resources && named(resources, "XObject");
    const h = crypto.createHash("sha256");
    let pictures = 0;
    for (const [, ref] of xobjects ? xobjects.entries() : []) {
      const stream = ctx.lookup(ref);
      if (!stream || !stream.contents) continue;
      h.update(stream.contents);
      pictures += 1;
    }
    const annots = named(page.node, "Annots");
    return {
      picture: pictures ? h.digest("hex") : null,
      links: annots ? annots.asArray().map((ref) => String(ctx.lookup(ref)).replace(/\s+/g, " ")) : [],
    };
  });
}

// Exact, on purpose: a machine that rasterizes a slide differently writes the file again, which
// costs a commit and misleads nobody. A looser comparison could keep a file that had changed.
export function samePages(a, b) {
  return a.length === b.length && a.every((p, i) =>
    p.picture !== null && p.picture === b[i].picture &&
    p.links.length === b[i].links.length && p.links.every((l, k) => l === b[i].links[k]));
}

// Is the PDF on disk, page for page, the one just rendered? A file that is not there, or that
// cannot be read as a PDF — one a dead run left half written — is not, and is written again.
async function unchanged(PDFDocument, had, bytes, readPages) {
  if (had === null) return false;
  let before;
  try { before = readPages(await PDFDocument.load(had)); } catch (e) { return false; }
  return samePages(before, readPages(await PDFDocument.load(bytes)));
}

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
export async function exportDecks({ chromium, PDFDocument, PDFString, root, decks, base,
                                    log = console.log, write = fs.writeFileSync,
                                    read = readIfThere, stamp = stampDeck, readPages = pagesOf }) {
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
        const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: FRAME.deviceScaleFactor });
        await page.goto(`${siteBase}/${deck.dir}/`, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: HIDE });
        const count = await page.evaluate(() => document.querySelectorAll(".slide").length);

        for (const lang of LANGS) {
          // the decks have no keyboard shortcuts any more — click the transport's language
          // toggle. The rule above hides it, so click it through the DOM, not the pointer.
          await page.evaluate(l => document.getElementById(l === "de" ? "langDe" : "langEn").click(), lang);
          await page.waitForTimeout(SETTLE.language);

          const pdf = await PDFDocument.create();
          for (let i = 0; i < count; i++) {
            await page.evaluate(n => {
              const s = Array.from(document.querySelectorAll(".slide"));
              s.forEach((el, k) => el.classList.toggle("active", k === n));
            }, i);
            await page.waitForTimeout(SETTLE.slide);   // let the rise animation settle
            const links = PDFString ? await page.evaluate(linksOnSlide, { n: i, lang, W, H }) : [];
            const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
            const img = await pdf.embedPng(png);
            const p = pdf.addPage([W, H]);
            p.drawImage(img, { x: 0, y: 0, width: W, height: H });
            for (const l of links) p.node.addAnnot(pdf.context.register(pdf.context.obj(annotation(l, PDFString))));
          }
          const file = path.join(root, pdfOf(deck, lang));
          const bytes = await pdf.save();
          // A PDF whose every page holds the picture and the links the file on disk already
          // has is left alone: nearly every release of this package moves a file every deck
          // links, and writing each PDF again would put megabytes into a site's history for a
          // change most of them do not show.
          const kept = await unchanged(PDFDocument, read(file), bytes, readPages);
          if (kept) {
            log(`  = ${path.relative(root, file)}  (${count} slides, kept)`);
          } else {
            write(file, bytes);
            log(`  ✓ ${path.relative(root, file)}  (${count} slides)`);
          }
          written.push({ file, pages: count, kept });
        }
        // After both languages are decided and never before: a run that dies half way leaves
        // the deck reported stale. Written whether or not either file was, since the stamp says
        // what the PDFs were checked against, not when they were written.
        stamp(deck, root);
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

// Runs in the page, so it is plain browser code and names nothing from this module. It returns
// one entry per visible link or chat opener on slide `n` and the chrome around it, each a
// rectangle in CSS pixels, which are the PDF page's points because the viewport is the page.
// An element with no box — hidden by the rule above, or on a slide not shown — has none.
export function linksOnSlide({ n, lang, W, H }) {
  const FAMILY = /^(www\.)?(blust\.ch|companygraph\.io|guestgraph\.io)$/;
  const canon = document.querySelector('link[rel="canonical"]');
  const home = new URL(canon ? canon.getAttribute("href") : location.href, location.href);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    const w = Math.min(W, r.right) - x, h = Math.min(H, r.bottom) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };
  const out = [];
  for (const a of document.querySelectorAll("a[href]")) {
    const b = box(a);
    if (!b) continue;
    let u;
    try { u = new URL(a.getAttribute("href"), home); } catch (e) { continue; }
    if (!/^(https?|mailto):$/.test(u.protocol)) continue;
    if (FAMILY.test(u.hostname)) u.searchParams.set("lang", lang);
    out.push({ ...b, url: u.href });
  }
  const chat = new URL(home.href);
  chat.search = "";
  chat.searchParams.set("chat", "open");
  chat.searchParams.set("lang", lang);
  chat.hash = n === 0 ? "" : "#" + (n < 10 ? "0" : "") + n;
  for (const el of document.querySelectorAll(".rbchat-open, [data-chat-open]")) {
    const b = box(el);
    if (b) out.push({ ...b, url: chat.href });
  }
  return out;
}

// A link annotation over one rectangle, in the PDF's own coordinates: the origin is the page's
// bottom left, so a rectangle measured from the top is turned over. No border, because the
// screenshot already draws what the link looks like.
export function annotation({ x, y, w, h, url }, PDFString) {
  return {
    Type: "Annot", Subtype: "Link",
    Rect: [x, H - y - h, x + w, H - y],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  };
}
