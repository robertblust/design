// A page's pictures, drawn once when the site builds rather than in every visitor's browser.
//
// The team page carries one picture per process board, written by lib/render/team.mjs as a
// figure with the picture as JSON. chat.js can draw it, and does for a page built without its
// pictures, but that fetches Mermaid, several megabytes, once the figure nears the screen, and
// grows the page when the picture arrives. The picture changes only when the model does, and the
// site is built exactly then, so the site draws it then: `drawPictures` opens each page in the
// site's own Chromium, lets the site's own chat.js draw every figure, and writes what it drew
// beside the page, one SVG per picture with a stamp of what went into it. writeTeam inlines a
// picture whose stamp still matches and leaves the box empty, for chat.js to draw, where not.
//
// One SVG serves both themes and the modal. Mermaid writes fixed colors into what it draws, so
// the picture is drawn with a placeholder color on each token it reads, and every placeholder in
// the result is written back as the token. A color Mermaid derives from a token is no
// placeholder, and a picture that paints one is refused: read off what each element paints, not
// off the SVG's text, since Mermaid's style block carries rules for elements a picture does not
// have, and those paint nothing.
//
// The stamp is the share cards' answer to the same problem: Mermaid measures text with the fonts
// where it runs, so a picture drawn on one machine differs from one drawn on another by a pixel
// here and there, and a check that drew again and compared would fail at random. The stamp hashes
// the inputs instead — the picture's source and nodes and the two files that draw it, the site's
// own copies of chat.js and mermaid.min.js — so pages:check needs no browser.
//
// The package never imports Playwright; the site hands its `chromium` in, as it does for cards.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { serve } from "../cards/export.mjs";

// The tokens a picture reads, as chat.js's mermaidConfig reads them, each with a placeholder no
// page uses and Mermaid would never arrive at on its own.
export const PLACEHOLDERS = {
  "--ground": [10, 1, 2], "--raise": [10, 1, 3], "--press": [10, 1, 4],
  "--ink": [10, 1, 5], "--c-mid": [10, 1, 6], "--dim": [10, 1, 7],
};
const hex = ([r, g, b]) => "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

// What went into a picture. The same function answers for writeTeam and for drawPictures, so
// the two cannot disagree about when a picture is stale.
export function pictureStamp(picture, root) {
  const h = crypto.createHash("sha256");
  h.update(JSON.stringify({ mermaid: picture.mermaid, nodes: picture.nodes || [] }));
  for (const f of ["chat.js", "mermaid.min.js"]) {
    h.update("\0" + f + "\0");
    try { h.update(fs.readFileSync(path.join(root, f))); } catch { h.update("missing"); }
  }
  return h.digest("hex");
}

// Where a page's picture lives: beside the page, in a folder of its own, named for its board.
export const picturePath = (page, name) => path.join(path.dirname(page), "pictures", `${name}.svg`);
const stampPath = (svg) => svg.replace(/\.svg$/, ".sha");

// The picture as drawn, if its stamp still matches what would go into it; null otherwise.
export function keptPicture(root, page, name, picture) {
  const svg = path.join(root, picturePath(page, name));
  try {
    if (fs.readFileSync(stampPath(svg), "utf8").trim() !== pictureStamp(picture, root)) return null;
    return fs.readFileSync(svg, "utf8").trim();
  } catch { return null; }
}

// The drawn markup with every placeholder written back as its token, and the ids Mermaid gave it
// renamed for the board, so two pictures on a page, or one the chat draws later, never share one.
export function tokenized(html, id, name) {
  let out = html.split(id).join(`rbchat-picture-${name}`);
  for (const [token, rgb] of Object.entries(PLACEHOLDERS)) {
    const [r, g, b] = rgb;
    out = out.split(hex(rgb)).join(`var(${token})`).split(hex(rgb).toUpperCase()).join(`var(${token})`);
    out = out.replace(new RegExp(`rgba?\\(\\s*${r},\\s*${g},\\s*${b}\\s*(?:,\\s*([\\d.]+)\\s*)?\\)`, "g"), (m, a) =>
      a === undefined || Number(a) === 1 ? `var(${token})` : `color-mix(in srgb, var(${token}) ${Math.round(Number(a) * 100)}%, transparent)`);
  }
  return out;
}

// In the page: every color an element of the drawn pictures paints, where it is not one of the
// placeholders. A shape's fill and stroke, the color of an element that holds text of its own, a
// background that is not transparent, and any filter at all, since a filter paints a color the
// placeholders cannot reach.
function unnamedPaint(placeholders) {
  const ok = (v) => placeholders.some(([r, g, b]) => new RegExp(`^rgba?\\(${r}, ${g}, ${b}(, [\\d.]+)?\\)$`).test(v));
  const bad = [];
  const shape = /^(rect|path|circle|polygon|ellipse|line|polyline|text|tspan)$/i;
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  for (const e of document.querySelectorAll("figure[data-diagram] .rbchat-diagram-box svg *")) {
    if (/^(style|title|desc)$/i.test(e.tagName)) continue;
    const cs = getComputedStyle(e), where = e.tagName.toLowerCase() + (e.getAttribute("class") ? "." + e.getAttribute("class").split(" ")[0] : "");
    if (cs.filter && cs.filter !== "none") bad.push(`${where} filter ${cs.filter}`);
    if (shape.test(e.tagName)) {
      for (const p of ["fill", "stroke"]) {
        const v = cs.getPropertyValue(p);
        if (v === "none" || (p === "stroke" && parseFloat(cs.strokeWidth) === 0) || ok(v)) continue;
        bad.push(`${where} ${p} ${v}`);
      }
    }
    if (ownText(e) && !ok(cs.color)) bad.push(`${where} color ${cs.color}`);
    const bg = cs.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && !ok(bg)) bad.push(`${where} background ${bg}`);
  }
  return [...new Set(bad)];
}

// Draws every picture of the named pages and writes each beside its page. The pages are the
// site's own, served from its root, so what draws them is the site's own chat.js at the version
// it pins; a picture already inlined is taken out first, so it is drawn afresh.
export async function drawPictures({ chromium, root, pages = ["team/index.html"], log = console.log }) {
  const srv = await serve(root);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const placeholders = Object.values(PLACEHOLDERS);
  const written = [];
  try {
    const browser = await chromium.launch();
    try {
      for (const page of pages) {
        if (!fs.existsSync(path.join(root, page))) continue;
        const tab = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        await tab.addInitScript((tokens) => {
          document.addEventListener("DOMContentLoaded", () => {
            const s = document.createElement("style");
            s.textContent = "figure[data-diagram]{" + tokens.map(([k, [r, g, b]]) => `${k}:rgb(${r},${g},${b})`).join(";") + "}";
            document.head.appendChild(s);
            for (const box of document.querySelectorAll("figure[data-diagram] .rbchat-diagram-box[data-drawn]")) { box.removeAttribute("data-drawn"); box.textContent = ""; }
          });
        }, Object.entries(PLACEHOLDERS));
        await tab.goto(base + "/" + page.replace(/index\.html$/, ""));
        const figures = await tab.$$("figure[data-diagram][data-picture]");
        for (const f of figures) await f.scrollIntoViewIfNeeded();
        await tab.waitForFunction((n) => document.querySelectorAll("figure[data-diagram][data-picture] .rbchat-diagram-box svg").length === n, figures.length, { timeout: 30000 });
        const bad = await tab.evaluate(unnamedPaint, placeholders);
        if (bad.length) throw new Error(`${page}: a picture paints a color that is no token, so it would be wrong in one theme:\n  ${bad.join("\n  ")}`);
        const drawn = await tab.$$eval("figure[data-diagram][data-picture]", (fs) => fs.map((f) => ({
          name: f.getAttribute("data-picture"),
          picture: JSON.parse(f.querySelector('script[type="application/json"]').textContent),
          id: f.querySelector(".rbchat-diagram-box svg").id,
          html: f.querySelector(".rbchat-diagram-box").innerHTML,
        })));
        for (const d of drawn) {
          const file = path.join(root, picturePath(page, d.name));
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, tokenized(d.html, d.id, d.name) + "\n");
          fs.writeFileSync(stampPath(file), pictureStamp(d.picture, root) + "\n");
          written.push(path.relative(root, file));
        }
        await tab.close();
      }
    } finally { await browser.close(); }
  } finally { srv.close(); }
  log(`  drew ${written.length} picture(s): ${written.join(", ") || "none"}${written.length ? " — now run: npm run pages" : ""}`);
  return written;
}
