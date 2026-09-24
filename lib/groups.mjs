// What this package hands to a site, and where each file belongs once it is there.
//
// The destination is relative to the site's root because GitHub Pages serves the repository
// tree: `stage.css` has to sit at `/stage.css` because that is the URL the pages link. There
// is no build step between the repository and the CDN, and this package does not introduce
// one — it copies files into the places the pages already name.
//
// A group is the unit a site opts into. A site that draws no graph takes `fonts` and not
// `stage`; the day it grows one, it adds a word to its design.config.json.

export const GROUPS = {
  fonts: [
    ["assets/fonts/Bricolage-var.woff2",      "fonts/Bricolage-var.woff2"],
    ["assets/fonts/InstrumentSans-var.woff2", "fonts/InstrumentSans-var.woff2"],
    ["assets/fonts/PlexMono-400.woff2",       "fonts/PlexMono-400.woff2"],
    ["assets/fonts/PlexMono-600.woff2",       "fonts/PlexMono-600.woff2"],
    // Each face's license travels beside it, because the OFL lets a font be redistributed only
    // with its copyright notice and the license text in every copy, and a served site is a copy.
    ["assets/fonts/Bricolage.LICENSE.txt",      "fonts/Bricolage.LICENSE.txt"],
    ["assets/fonts/InstrumentSans.LICENSE.txt", "fonts/InstrumentSans.LICENSE.txt"],
    ["assets/fonts/PlexMono.LICENSE.txt",       "fonts/PlexMono.LICENSE.txt"],
  ],
  // stage.js is the one shared file that no deck loads — a deck draws static SVG. It is
  // reached only by served prose pages, through a plain <script src>. Nothing here may be
  // linked from a deck; see README.
  stage: [
    ["assets/card.js",      "card.js"],
    ["assets/stage.css",    "stage.css"],
    ["assets/stage.js",     "stage.js"],
    ["assets/d3.v7.min.js", "d3.v7.min.js"],
    ["assets/d3.LICENSE.txt", "d3.LICENSE.txt"],
  ],
  // The chat: a button at the foot of a prose page and the panel it opens over the site's chat
  // service. Two whole files and no fence, since the page adds one script tag and nothing inside
  // it. A site without a chat takes no group; a site with one names the endpoint on
  // the tag, `<script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/" defer>`.
  chat: [
    ["assets/chat.js",  "chat.js"],
    ["assets/chat.css", "chat.css"],
    // chat.js inlines GitHub's Octicon mark, and the MIT license asks for its notice in every copy.
    ["assets/octicons.LICENSE.txt", "octicons.LICENSE.txt"],
  ],
  // The five whole files lib/assemble.mjs writes from the same blocks the fences read, in
  // place of a fenced copy in every page. Not a [from, to] pair like the groups above: there
  // is no source file to copy, only a name to assemble and a destination equal to it, at the
  // site's root exactly as chat.css sits. lib/sync.mjs is what tells the two shapes apart.
  files: ["tokens.css", "page.css", "page.js", "deck.css", "deck.js"],
};

export const GROUP_NAMES = Object.freeze(Object.keys(GROUPS));
