// Does each share card still show the page it was rendered from?
//
// It renders nothing and imports nothing outside node's standard library, so CI can run it
// before `npm ci` — a stale card is then caught by the cheapest step in the job rather than by
// whoever notices the preview. A site's `og:check` calls `checkCards` and exits on what it
// returns; this module never exits on its own — see the comment on `checkCards` for why.
//
// It over-reports and never under-reports, deliberately. Editing a comment in a page marks its
// card stale even though the render would be identical. Clearing that is `npm run og` and a
// commit — cheap, and the opposite error is a card nobody notices for days.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const WHY = {
  unstamped: "never stamped",
  stale: "the page has changed since it was rendered",
};

// A minimal PNG decoder: signature + IHDR for the shape, IDAT inflated with node's built-in
// zlib, then the standard five-filter unfilter. Chromium's screenshot() writes 8-bit,
// non-interlaced RGB or RGBA, which is what this supports — anything else is reported as an
// error rather than silently misread.
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let width, height, bitDepth, colorType;
  const idat = [];
  let offset = 8;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      if (data.readUInt8(12) !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 8 + len + 4;
  }
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} not supported`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`color type ${colorType} not supported`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos]; pos += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos + x];
      const a = x >= channels ? pixels[rowStart + x - channels] : 0;
      const b = y > 0 ? pixels[rowStart - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[rowStart - stride + x - channels] : 0;
      let value;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + a; break;
        case 2: value = rawByte + b; break;
        case 3: value = rawByte + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = rawByte + pr;
          break;
        }
        default: throw new Error(`unknown filter type ${filter}`);
      }
      pixels[rowStart + x] = value & 0xff;
    }
    pos += stride;
  }
  return { width, height, at: (x, y) => {
    const i = y * stride + x * channels;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  } };
}

// WCAG relative luminance, on 0–255 channels rather than the 0–1 ratio used elsewhere in this
// family — the check only needs light-vs-dark, not an accurate contrast ratio, so the simpler
// unnormalised form is enough.
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
// Dark ground (#0C0E13) is ~0.05; light ground (#FAF9F5) is ~0.98 — the midpoint is nowhere
// near either, so a threshold here cannot mistake one for the other.
const LIGHT_THRESHOLD = 0.5;
const INSET = 4; // pixels in from each edge, clear of anti-aliasing at the card's border

// Returns a count rather than exiting, for the reason runSuite does: a library that terminates
// its caller's process cannot be tested. The site's own og-check.mjs exits on what this returns.
export function checkCards({ cards, state, REPO_ROOT }, log = console.log) {
  let problems = 0;

  // `cards.map(state)` would hand map's index to `state`'s root parameter. It has to be a call
  // that passes one argument.
  const stale = cards.map((c) => state(c)).filter((s) => {
    log(s.state === "current" ? `  ✓ ${s.card}` : `  ✗ ${s.card}  ${WHY[s.state]}`);
    return s.state !== "current";
  });

  if (stale.length) {
    problems += stale.length;
    log(`\n  ${stale.length} card(s) no longer show their page — run: npm run og`);
    log("  then commit each og.png with the og.sha beside it.");
  } else {
    log("\n  every card matches the page it renders");
  }

  // The recipe hash above proves a card was rendered from the current page; it says nothing
  // about what the page rendered *as*. Spec decision 5 pins every card to dark deliberately, and
  // nothing before this checked that the pin actually held: an exporter that once cleared its
  // theme attribute instead of setting it inherits whatever the boot script's default happens to
  // be rather than pinning anything, and every card still rendered dark only because the default
  // was dark — the recipe hash has no way to see a color. This reads the committed PNGs
  // directly, the same way verify/pages.mjs's `card` check reads a PNG's IHDR directly, so it
  // stays dependency-free.
  const lightCards = [];
  const unreadable = [];
  for (const c of cards) {
    const rel = path.join(c.dir, "og.png");
    const file = path.join(REPO_ROOT, c.dir, "og.png");
    if (!fs.existsSync(file)) continue; // already reported unstamped/stale above

    // decodePNG throws a bare message with no path (bit depth, filter type, "not a PNG") — one
    // card Chromium never wrote in a shape this decoder reads used to take the whole run down
    // with it, so a site with 8 good cards and 1 bad one learned about none of them. A card we
    // cannot read is still a card we cannot vouch for, so it counts as a problem rather than
    // being skipped, but it must name itself and let the loop reach the cards after it.
    let png;
    try {
      png = decodePNG(fs.readFileSync(file));
    } catch (e) {
      log(`  ✗ ${rel}  could not be read: ${e.message}`);
      unreadable.push(rel);
      continue;
    }

    const corners = [
      [INSET, INSET], [png.width - 1 - INSET, INSET],
      [INSET, png.height - 1 - INSET], [png.width - 1 - INSET, png.height - 1 - INSET],
    ];
    const avg = corners.reduce((sum, [x, y]) => sum + luminance(png.at(x, y)), 0) / corners.length;
    const light = avg > LIGHT_THRESHOLD;
    log((light ? "  ✗ " : "  ✓ ") + rel + `  background luminance ${avg.toFixed(2)}`);
    if (light) lightCards.push(rel);
  }

  if (lightCards.length) {
    problems += lightCards.length;
    log(`\n  ${lightCards.length} card(s) render with a light background, not the ` +
      "pinned dark theme: " + lightCards.join(", "));
  } else {
    log("\n  every card renders dark");
  }

  if (unreadable.length) {
    problems += unreadable.length;
    log(`\n  ${unreadable.length} card(s) could not be read as PNG: ` + unreadable.join(", "));
  }

  return problems;
}
