// What this package hands to a site, and where each file belongs once it is there.
//
// The destination is relative to the site's root because GitHub Pages serves the repository
// tree: `stage.css` has to sit at `/stage.css` because that is the URL the pages link. There
// is no build step between the repository and the CDN, and this package does not introduce
// one — it copies files into the places the pages already name.
//
// A group is the unit a site opts into. guestgraph.io draws no graph, so it takes `fonts`
// and not `stage`; the day it grows one, it adds a word to its design.config.json.

export const GROUPS = {
  fonts: [
    ["assets/fonts/Bricolage-var.woff2",      "fonts/Bricolage-var.woff2"],
    ["assets/fonts/InstrumentSans-var.woff2", "fonts/InstrumentSans-var.woff2"],
    ["assets/fonts/PlexMono-400.woff2",       "fonts/PlexMono-400.woff2"],
    ["assets/fonts/PlexMono-600.woff2",       "fonts/PlexMono-600.woff2"],
  ],
  // stage.js is the one shared file that no deck loads — a deck draws static SVG. It is
  // reached only by served prose pages, through a plain <script src>. Nothing here may be
  // linked from a deck; see README.
  stage: [
    ["assets/stage.css",    "stage.css"],
    ["assets/stage.js",     "stage.js"],
    ["assets/d3.v7.min.js", "d3.v7.min.js"],
  ],
};

export const GROUP_NAMES = Object.freeze(Object.keys(GROUPS));
