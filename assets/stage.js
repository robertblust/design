// The stage: one drawing and one card, shared by every page that carries a data block —
// the example page's instance and the model page's vocabulary are the same shapes with
// different files behind them, so this is a file both link rather than a copy in each.
//
// Focus and context. The canvas never shows the whole graph: one focused node, its
// ancestors to the left (its path on disk), its children to the right, and its references in
// two dashed bands — targets below, sources above. Everything on the canvas is there because
// of the focus, so no dashed line can land on nothing. d3 moves survivors and fades the rest
// when the focus changes; under prefers-reduced-motion every transition is 0 ms, which is also
// the state the share card renders.
//
// Nothing in this script knows a name from either page. It reads types, entities and edges
// out of the page's data block — the one <script type="application/json"> the page marks
// data-stage, whatever its id — and derives every label, path and count from them; the only
// strings it carries are the two band eyebrows, the root/folder card's word for "pages", and
// the file link's aria-label, all of which the site's language toggle swaps through t().
(function(){
  var block = document.querySelector('script[type="application/json"][data-stage]');
  var data = JSON.parse(block.textContent);
  if (!data.entities) return;             // the page's data block is empty until npm run example

  // Which folder of the model repository this page's block was generated from. The page says
  // so on #srclink, because the page is the thing that knows: the example page reads
  // `example/`, the model page `core/`, and the script only pins the commit.
  var src = document.getElementById("srclink");
  // Which repository the block came from is the data's business, not this file's: the same
  // stage draws companygraph.io's example and vocabulary and blust.ch's own model, and they
  // are different repositories. The fallback is the one page whose builder does not emit
  // `repo` yet; remove it when it does.
  var repo = data.repo || "companygraph/meta-model";
  src.href = "https://github.com/" + repo + "/tree/" + data.commit + "/" +
             (src.getAttribute("data-src") || "example");
  document.getElementById("srccommit").textContent = data.commit.slice(0, 7);

  // ── the four strings this script owns ─────────────────────────────────────────────────
  // The static markup carries its German in data-de and the page's own toggle applies it.
  // What the figure draws is built after that pass has run, so these travel with the script
  // and re-render when <html lang> changes.
  var STR = {
    out:   { en:"refers to",   de:"Verweist auf" },
    "in":  { en:"referred by", de:"Verwiesen von" },
    pages: { en:"pages",       de:"Seiten" },
    view:  { en:"View this file on GitHub", de:"Diese Datei auf GitHub ansehen" },
    now:   { en:"present",     de:"heute" }
  };
  // A date is drawn as prose, not as the ISO the model stores, so the months travel with the
  // script the way every other word here does. The three lengths are core's three precisions:
  // a year, a month, a day — written at the precision the model holds and never padded up.
  var MONTHS = {
    en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    de: ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
  };
  function lang(){ return document.documentElement.lang === "de" ? "de" : "en"; }
  function t(k){ return STR[k][lang()]; }

  // The parser hands every entity that has one a `stamp` — its kind and its period, raw. It
  // does that so nothing here has to know that core calls those fields kind, start and end;
  // this file knows no core vocabulary and `rootId` is resolved upstream for the same reason.
  // What is left here is the part that is a drawing's business: how a date reads, and in
  // which language.
  function fmtDate(v){
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v || "");
    if (!m) return v || "";
    if (!m[2]) return m[1];
    var mon = MONTHS[lang()][+m[2] - 1];
    if (!m[3]) return mon + " " + m[1];
    // "May 4, 2012" and "4. Mai 2012". The page is en-US, so the English day follows the
    // month and a comma sets off the year; the German ordinal carries its point and comes
    // first. Day-month-year is what this used to print in English, which is neither.
    if (lang() === "de") return (+m[3]) + ". " + mon + " " + m[1];
    return mon + " " + (+m[3]) + ", " + m[1];
  }
  // Three shapes, and the model says which by what it holds. No end means still running. An
  // end equal to its start is a one-off — a talk, a certification — and printing it twice
  // would say a day lasted from itself to itself.
  function fmtPeriod(st){
    if (!st || !st.start) return "";
    if (!st.end) return fmtDate(st.start) + " – " + t("now");
    if (st.end === st.start) return fmtDate(st.start);
    return fmtDate(st.start) + " – " + fmtDate(st.end);
  }
  function stampOf(p){ return (p.node && p.node.entity && p.node.entity.stamp) || null; }
  // Everything secondary about a node goes on one line beneath its name: what an experience
  // was and when, what level a skill is claimed at, which field an edge came from. They used to
  // sit in two places — the period under the name, the level after it — which read as two
  // different kinds of fact when they are the same kind: a detail about the node above.
  //
  // After the name was also the expensive place. The arm is sized by the longest name in the
  // column plus whatever follows it, so a level pushed every node in the band further out; a
  // line underneath costs no width at all.
  function underText(p){
    var parts = [stampText(p), attrOf(p)].filter(function(x){ return x; });
    return parts.join(" · ");
  }
  // Kind first, then when: the category is the shorter and the more scannable of the two, so
  // a column of these reads down its left edge.
  function stampText(p){
    var st = stampOf(p); if (!st) return "";
    var when = fmtPeriod(st);
    return st.kind && when ? st.kind + " · " + when : (st.kind || when);
  }

  // ── model ─────────────────────────────────────────────────────────────────────────────
  // Node ids are paths, because that is what they are on disk: "<folder>" is a folder,
  // "<folder>/<entity>" a page, "<folder>/<entity>/<owned folder>" a folder a page owns. The
  // one invented id is "root", which has no path of its own.
  var byId = {}; data.entities.forEach(function(e){ byId[e.id] = e; });
  // The root and the identity entity are one thing: the company. Drawing both would put the
  // same name on the canvas twice, and the root would carry a page count where the entity has
  // a tagline, contact and prose to show.
  var rootEntity = data.rootId ? byId[data.rootId] : null;
  // A singular type is one entity in the container and has no folder (core 0.4.0, R6/R13),
  // so it hangs off the root directly. Everything else reaches the root through its folder.
  var rootTypes = data.types.filter(function(t){ return !t.owner && t.folder; });
  var singularTypes = data.types.filter(function(t){ return !t.owner && !t.folder; });
  function isSingular(type){ return singularTypes.some(function(t){ return t.type === type; }); }
  // A folder node is named for its type, so what kind of thing it is reads off the canvas. A
  // singular entity is named for itself and sits among those folders, so its type would be the
  // one thing on the level nothing states — this puts it back.
  function typeOf(d){
    var e = d.node.entity;
    if (!e) return "";
    // A node reached through its folder needs no label: it is standing under `skills` and is
    // obviously a skill. A node in a band was not reached that way. "refers to · 1
    // experience-kind · 11 skills · 1 source" counts the types and then draws thirteen names
    // with nothing saying which is which, so the one node that is not a skill looks exactly
    // like the eleven that are.
    if (d.role === "out" || d.role === "in") return e.type;
    // A singular type is named for itself and sits among folders, so its type is the one thing
    // on that level nothing states.
    return isSingular(e.type) ? e.type : "";
  }
  function ownedTypes(type){ return data.types.filter(function(t){ return t.owner === type; }); }

  var cache = {};
  function keep(n){ return cache[n.id] || (cache[n.id] = n); }
  function nRoot(){ return keep({ kind:"root", id:"root", label:data.root, entity:rootEntity }); }
  function nFolder(id, type, ownerId){ return keep({ kind:"folder", id:id, type:type, ownerId:ownerId, label:id.slice(id.lastIndexOf("/") + 1) }); }
  function nEntity(e){ return keep({ kind:"entity", id:e.id, label:e.name, entity:e }); }
  function folderIdOf(id){ return id.slice(0, id.lastIndexOf("/")); }

  function parentOf(n){
    if (n.kind === "root") return null;
    if (n.kind === "folder") return n.ownerId ? nEntity(byId[n.ownerId]) : nRoot();
    var e = n.entity;
    if (isSingular(e.type)) return nRoot();
    return nFolder(folderIdOf(e.id), e.type, e.owner);
  }
  function childrenOf(n){
    if (n.kind === "root") return data.entities
      .filter(function(e){ return isSingular(e.type) && e !== rootEntity; })
      .map(nEntity)
      .concat(rootTypes.map(function(t){ return nFolder(t.folder, t.type, null); }));
    if (n.kind === "folder") return data.entities
      .filter(function(e){ return e.type === n.type && e.owner === n.ownerId; })
      .map(nEntity);
    return ownedTypes(n.entity.type).map(function(t){ return nFolder(n.id + "/" + t.folder, t.type, n.id); });
  }
  function ancestorsOf(n){ var out = [], p = parentOf(n); while (p) { out.unshift(p); p = parentOf(p); } return out; }
  // The node an id names — a folder's or an entity's — found by walking down from the root
  // through the same childrenOf() the canvas uses. An id is a path on disk, so every prefix
  // of it is a node, and the walk needs no second index and no name from either page.
  // Returns null for an id no page here holds, which is what a hand-edited hash looks like.
  function nodeById(id){
    if (!id) return null;
    if (rootEntity && id === rootEntity.id) return nRoot();
    if (byId[id]) return nEntity(byId[id]);
    var n = nRoot();
    for (;;) {
      var kids = childrenOf(n), next = null;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].id === id) return kids[i];
        if (id.indexOf(kids[i].id + "/") === 0) { next = kids[i]; break; }
      }
      if (!next) return null;
      n = next;
    }
  }
  function pathOf(n){ return n.kind === "root" ? [] : n.id.split("/"); }
  // Pages held: for the root every entity, for a folder everything filed beneath it — an
  // entity and the folder it owns both count as pages of the folder that holds the entity.
  function pagesUnder(n){
    if (n.kind === "root") return data.entities.length;
    return data.entities.filter(function(e){ return e.id.indexOf(n.id + "/") === 0; }).length;
  }
  function refsOut(n){ return n.kind !== "entity" ? [] : data.edges.filter(function(x){ return x.from === n.id; })
    .map(function(x){ return { node:nEntity(byId[x.to]), attrs:x.attrs, label:x.label, edge:x }; }); }
  // A proficiency level has no "referred by" band and an experience kind does. That is the
  // model, not a gap here, and it has been asked about: a kind is a field in an experience's
  // frontmatter, so R4 makes a real edge experience → kind; a level is a cell in a row of the
  // profile's Skills table, and R4 makes one edge per row from its FIRST resolving cell — the
  // skill. The level is left in that edge's `attrs`, already resolved to an id, which is why
  // `attrText` below can dereference it with `byId`.
  //
  // So a level qualifies a claim, where a kind is a property of a thing, and matching `attrs`
  // here would not fix the asymmetry so much as hide it: every row that names a level comes
  // from the one profile, so the band would read "referred by · 1 profile" on every level.
  // What a reader actually wants — the skills claimed at that level — is the OTHER end of
  // those rows, and no skill refers to a level. Left absent deliberately.
  function refsIn(n){ return n.kind !== "entity" ? [] : data.edges.filter(function(x){ return x.to === n.id; })
    .map(function(x){ return { node:nEntity(byId[x.from]), attrs:x.attrs, label:x.label, edge:x }; }); }

  // An attribute value is worth putting on the canvas only if it is short enough to read
  // beside a label — a Level is, a paragraph of evidence is not. The card carries the rest.
  function attrText(attrs){
    var out = [];
    Object.keys(attrs || {}).forEach(function(k){
      var v = attrs[k];
      if (typeof v !== "string") return;
      var shown = byId[v] ? byId[v].name : v;
      if (shown.length <= 24) out.push(shown);
    });
    return out.join(" · ");
  }

  // What a band points at, counted and named: "refers to · 58 skills · 1 source". The model
  // supplies both words — the type is the singular and its folder is the plural (R7), which
  // is why a count of one reads "1 source" and not "1 sources", and why these are the same
  // words the canvas prints on the folders themselves.
  //
  // Broken down by type rather than totaled, because the honest answer usually is mixed: a
  // profile refers to its skills and to the source that masters it, and "59" alone tells the
  // reader neither what is down there nor that the last one is a different kind of thing.
  // Past three types the breakdown is longer than the thing it labels, so it gives up and
  // says how many.
  var folderOf = {};
  data.types.forEach(function(ty){ folderOf[ty.type] = ty.folder || ty.type; });
  function noun(list){
    var counts = {};
    list.forEach(function(p){
      if (p.node && p.node.entity) counts[p.node.entity.type] = (counts[p.node.entity.type] || 0) + 1;
    });
    var ks = Object.keys(counts).sort();
    if (!ks.length) return String(list.length);
    if (ks.length > 3) return String(list.length);
    return ks.map(function(k){ return counts[k] + " " + (counts[k] === 1 ? k : folderOf[k]); }).join(" · ");
  }

  function neighbourhood(f){
    var nodes = [], links = [];
    var anc = ancestorsOf(f);
    anc.forEach(function(a, i){ nodes.push({ node:a, role:"ancestor", i:i }); });
    nodes.push({ node:f, role:"focus", i:0 });
    childrenOf(f).forEach(function(c, i){ nodes.push({ node:c, role:"child", i:i }); });
    refsOut(f).forEach(function(r, i){ nodes.push({ node:r.node, role:"out", i:i, attrs:r.attrs, label:r.label }); });
    refsIn(f).forEach(function(r, i){ nodes.push({ node:r.node, role:"in", i:i, attrs:r.attrs, label:r.label }); });
    anc.concat([f]).forEach(function(n, i, all){ if (i) links.push({ from:all[i-1].id, to:n.id, kind:"own", spine:true }); });
    nodes.filter(function(p){ return p.role === "child"; })
         .forEach(function(p){ links.push({ from:f.id, to:p.node.id, kind:"own" }); });
    nodes.filter(function(p){ return p.role === "out"; })
         .forEach(function(p){ links.push({ from:f.id, to:p.node.id, kind:"ref", attrs:p.attrs }); });
    nodes.filter(function(p){ return p.role === "in"; })
         .forEach(function(p){ links.push({ from:p.node.id, to:f.id, kind:"ref", attrs:p.attrs }); });
    return { nodes:nodes, links:links };
  }

  // ── geometry ──────────────────────────────────────────────────────────────────────────
  // Three relations, three shapes, so the eye separates them before it reads a word:
  //   the path on disk climbs as a ladder on the left, the way a file tree is drawn;
  //   what the focus owns hangs as a column on the right;
  //   what refers, and what is referred to, sit in two dashed bands outside both.
  var STEP = 54, ROW = 54, ROW_STAMP = 66, BAND = 96, EYE = 28;
  var R_FOCUS = 16, R_NODE = 12;                    // half-widths of the marks
  var GAP = 12;                                     // mark to its label
  var CH_MONO = 6.9, CH_TEXT = 6.9, CH_ROOT = 8.6;  // width per character, for the fit only
  // The camera's floor, shared with the zoom's scaleExtent. It is a legibility limit, not a
  // fitting one: a profile that claims 59 skills has a reference band taller than any frame,
  // and scaling until it fits produced labels too small to read AND a neighbourhood still
  // running off the edge — the worst of both. Below this the drawing stops being worth
  // looking at, so the camera stops here and the reader moves instead.
  var K_MIN = 0.8;                                  // the camera's floor, one with the zoom's

  function markW(p){ return p.role === "focus" ? R_FOCUS : R_NODE; }
  // Half the mark's height, which is not half its width for a folder: a folder's box is drawn
  // 4px taller than a page's square so the two read as different shapes, and the spine has to
  // stop at the edge that is actually there. It used a flat R_NODE for both ends, so a line
  // into the focus — 4px wider and 2px taller again — ran six pixels inside its box, and a
  // line out of any folder started two pixels inside that one.
  function markH(p){ return markW(p) + (p.node.kind === "entity" ? 0 : 2); }
  function nameW(p){
    var per = p.node.kind === "root" ? CH_ROOT : p.node.kind === "folder" ? CH_MONO : CH_TEXT;
    return p.node.label.length * per;
  }
  // What is written in mono beside a referenced node. An edge that carries a label draws the
  // label and nothing else — the field the reference is written in, which is what the model
  // page labels every line with, and which already names what the edge's attributes restate;
  // its attributes stay in the card, where there is room to read them. An edge with no label
  // draws its short attributes, as an assessment's Level is drawn today, so a block whose
  // edges carry none draws exactly what it drew before.
  function attrOf(p){
    if (p.role !== "out" && p.role !== "in") return "";
    if (typeof p.label === "string" && p.label) return p.label;
    return attrText(p.attrs);
  }
  // The widest of the three stacked lines, not their sum. The type can be longer than the name
  // it labels — `experience-kind` over `Role` — so leaving it out of the fit clipped the band
  // it was meant to explain.
  function labelW(p){
    return Math.max(nameW(p), underText(p).length * CH_MONO, typeOf(p).length * CH_MONO);
  }

  function layout(neigh, w){
    // The two arms narrow with the canvas. A phone's canvas is a third of a desktop's, and
    // holding the desktop offsets there would either run the path off the left edge or shrink
    // the whole drawing past reading size — both of which the fixed stage exists to prevent.
    var LEFT = Math.min(230, Math.max(118, w * 0.36));
    var RIGHT = Math.min(210, Math.max(106, w * 0.33));
    var anc = neigh.nodes.filter(function(p){ return p.role === "ancestor"; });
    var kids = neigh.nodes.filter(function(p){ return p.role === "child"; });
    var out  = neigh.nodes.filter(function(p){ return p.role === "out"; });
    var inn  = neigh.nodes.filter(function(p){ return p.role === "in"; });
    var n = anc.length;
    // The path climbs the left edge and turns in at the bottom, the way a file tree is
    // drawn. Every ancestor sits above the focus's row, so the segment that carries the
    // eye back into the focus runs under the labels rather than through them.
    anc.forEach(function(p){ p.x = -LEFT; p.y = -(n - p.i) * STEP; });
    neigh.nodes.filter(function(p){ return p.role === "focus"; }).forEach(function(p){ p.x = 0; p.y = 0; });
    var top = n ? -n * STEP : 0;
    // A stamped node carries a second line under its name, so its row has to open to hold it
    // — but only that group's. Fifty-eight skills carry no stamp and stay at the tight row
    // they have always had; opening every row for a folder that never draws one would make
    // the commonest view taller to serve the rarest.
    function rowOf(list){
      for (var i = 0; i < list.length; i++) if (underText(list[i])) return ROW_STAMP;
      return ROW;
    }
    var kidRow = rowOf(kids), outRow = rowOf(out), inRow = rowOf(inn);
    kids.forEach(function(p){ p.x = RIGHT; p.y = (p.i - (kids.length - 1) / 2) * kidRow; });
    var below = kids.length ? kids[kids.length - 1].y : 0;
    var outTop = below + BAND;
    out.forEach(function(p){ p.x = RIGHT; p.y = outTop + p.i * outRow; });
    var inTop = top - BAND - (inn.length - 1) * inRow;
    inn.forEach(function(p){ p.x = -LEFT; p.y = inTop + p.i * inRow; });
    var bands = [];
    // The eyebrow carries the count and, when it can, the word for what is being pointed at:
    // "refers to · 59 skills". A band can be taller than the canvas — a profile claiming 59
    // skills has one — and a bare number leaves the reader unable to tell whether two more
    // sit below the edge or fifty, while a number with a noun says what the drag is for.
    //
    // The noun is the type's folder, which R7 makes the plural of the type, so it is the same
    // word the canvas already prints on the folder itself. A band whose targets are of more
    // than one type gets the bare count: naming them all would be a list, and naming one
    // would be wrong.
    // The eyebrow clears the first node by EYE. A node in a band now names its type on a line
    // above its own name, so that clearance has to grow by a line or the eyebrow sits on it —
    // two mono lines fourteen pixels apart, which reads as one crowded block rather than a
    // heading over a list.
    function eyeOf(list){ return list.length && typeOf(list[0]) ? EYE + 14 : EYE; }
    if (out.length) bands.push({ key:"out", x:RIGHT - R_NODE, y:outTop - eyeOf(out), anchor:"start", text:t("out") + " · " + noun(out) });
    if (inn.length) bands.push({ key:"in",  x:-LEFT - R_NODE - GAP, y:inTop - eyeOf(inn), anchor:"end", text:t("in") + " · " + noun(inn) });
    neigh.bands = bands;
    return neigh;
  }

  // The camera. Everything above is laid out around the focus at (0,0) and knows nothing
  // about the canvas; this is what makes it fit. A neighbourhood four folders deep with a
  // long page name is wider than the stage, so the view scales down to hold it rather than
  // letting the far end of the path run off the edge — the one thing the fixed stage must
  // never do. Shallow neighbourhoods sit at 1:1 and never grow to fill the frame.
  function fit(neigh, w, h){
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    neigh.nodes.forEach(function(p){
      var m = markW(p), w = GAP + labelW(p);
      x0 = Math.min(x0, p.x - m - (p.role === "in" ? w : 0));
      x1 = Math.max(x1, p.x + m + (p.role === "in" ? 0 : w));
      y0 = Math.min(y0, p.y - m - (p.role === "focus" ? 34 : 0)); y1 = Math.max(y1, p.y + m);
    });
    neigh.bands.forEach(function(b){
      y0 = Math.min(y0, b.y - 12);
      // Both eyebrows, both directions. Only the left one was measured, which was harmless
      // while the right one read "refers to" and started running off the canvas as soon as
      // it read "refers to · 58 skills · 1 source".
      x0 = Math.min(x0, b.x - (b.anchor === "end" ? b.text.length * CH_MONO : 0));
      x1 = Math.max(x1, b.x + (b.anchor === "start" ? b.text.length * CH_MONO : 0));
    });
    var k = Math.max(K_MIN, Math.min(1, (w * 0.92) / (x1 - x0), (h * 0.9) / (y1 - y0)));
    // Center what fits; anchor on the focus what does not. Centering the whole bounding box is
    // right until one band is taller than any frame — a profile claiming 59 skills has one —
    // and then the box's middle is somewhere inside that band and the focused node itself is
    // off the canvas. The reader is left looking at a list with nothing to say what it hangs
    // from. Per axis, because the overflow is usually vertical and the horizontal path still
    // deserves centering. The layout puts the focus at (0,0), which is what makes this a
    // translate to the middle of the frame and nothing more.
    var overflowX = k * (x1 - x0) > w, overflowY = k * (y1 - y0) > h;
    // Horizontally, hold the left edge: the path climbs in from the left and the focus sits
    // after it, so reading order is what should survive the clip, and the focus is never the
    // thing that falls off. Centering instead pushed the right-hand eyebrow past the edge —
    // the canvas is only as wide as the card leaves it.
    // Vertically, hold the focus: a band overflows in both directions at once and there is no
    // edge worth preferring, only the node the band hangs from.
    var tx = overflowX ? w * 0.04 - k * x0 : w / 2 - k * (x0 + x1) / 2;
    var ty = overflowY ? h / 2 : h / 2 - k * (y0 + y1) / 2;
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  }

  // ── the stage ─────────────────────────────────────────────────────────────────────────
  var svg = d3.select("#fig");
  var scene = svg.append("g");
  var gLink = scene.append("g"), gBand = scene.append("g"), gNode = scene.append("g");
  var pathLine = document.getElementById("path");
  var cbody = document.getElementById("cbody"), cfoot = document.getElementById("cfootlink");
  var modal = document.getElementById("stagemodal"), expandBtn = document.getElementById("expand");
  // Expand moves the stage itself into the dialog rather than rendering a copy into it, so
  // every handler bound to #fig, #card and its links keeps working unchanged.
  //
  // A marker holds the place. It used to reinsert both elements before #figcap, on the
  // reasoning that the caption never moves — true, but it assumed nothing else sits between
  // the stage and the caption, and the moment a page put a line there (how to drag the
  // drawing) the stage came back on the wrong side of it. A comment node left where the
  // stage was cannot be wrong about what the page contains, because it is not a claim about
  // the page at all.
  var stageHead = document.getElementById("stagehead"), stageEl = document.getElementById("stage");
  var stageHome = stageHead.parentNode, stageMark = document.createComment("stage");
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var first = true;
  function dur(){ return (first || (reduce && reduce.matches)) ? 0 : 400; }

  // A plain wheel over the canvas must keep scrolling the page — only ctrl/⌘+wheel zooms — and
  // dblclick is left to the browser rather than jumping the camera to 2× on whatever it hit.
  // The closed hand appears when the drawing actually moves and not before: on the pointer
  // move that pans, never on the press. A press that does not move is a click on a node, and
  // showing a grab for it would promise the wrong thing. Wheel and programmatic transitions
  // carry no source event, so neither touches the cursor.
  var zoom = d3.zoom().scaleExtent([K_MIN, 2])
    .filter(function(ev){ return ev.type === "wheel" ? (ev.ctrlKey || ev.metaKey) : ev.type !== "dblclick"; })
    .on("zoom", function(ev){
      scene.attr("transform", ev.transform);
      var src = ev.sourceEvent;
      if (src && /move/.test(src.type)) svg.classed("panning", true);
    })
    .on("end", function(){ svg.classed("panning", false); });
  svg.call(zoom);
  var home = d3.zoomIdentity;

  var focused = null;

  function size(){
    var r = document.getElementById("fig").getBoundingClientRect();
    return { w: r.width || 620, h: r.height || 520 };
  }

  // Every label is painted with a halo of the canvas's own color behind it, so a line that
  // has to pass under a name does not cut through it. Inline styles rather than attributes,
  // because a presentation attribute cannot carry a var() and the color is a token.
  function halo(sel){
    return sel.style("paint-order", "stroke").style("stroke", "var(--raise)")
              .style("stroke-width", "3.5px").style("stroke-linejoin", "round");
  }

  var linkH = d3.linkHorizontal().x(function(d){ return d[0]; }).y(function(d){ return d[1]; });
  // Two line shapes, because two of the three relations are not the same kind of thing.
  // Owning downward and referring both fan out of the focus, so they are curves that leave
  // and arrive horizontally, trimmed to the marks so nothing is drawn inside a box. The
  // path climbs as a right angle instead: a ladder is what a folder chain looks like.
  function shape(l, a, b){
    if (l.spine) {
      var x = a.x;
      if (a.x === b.x) return "M" + x + " " + (a.y + markH(a)) + "V" + (b.y - markH(b));
      return "M" + x + " " + (a.y + markH(a)) + "V" + (b.y - 10) +
             "Q" + x + " " + b.y + " " + (x + 10) + " " + b.y +
             "H" + (b.x - markW(b));
    }
    var s = [a.x + markW(a), a.y], e = [b.x - markW(b), b.y];
    return linkH({ source:s, target:e });
  }

  function render(){
    var dim = size(), D = dur();
    var neigh = layout(neighbourhood(focused), dim.w);
    var pos = {}; neigh.nodes.forEach(function(p){ pos[p.node.id] = p; });

    var links = neigh.links.filter(function(l){ return pos[l.from] && pos[l.to]; });
    // path:not(.gone) — an exiting path is marked .gone the moment it exits so a link that
    // re-enters before its fade finishes is never re-bound to the still-fading exit copy.
    var lsel = gLink.selectAll("path:not(.gone)").data(links, function(d){ return d.from + "→" + d.to; });
    lsel.exit().classed("gone", true).style("pointer-events", "none")
        .transition().duration(D).style("opacity", 0).remove();
    lsel.enter().append("path")
        .attr("data-from", function(d){ return d.from; })
        .attr("data-to", function(d){ return d.to; })
        .attr("d", function(d){ return shape(d, pos[d.from], pos[d.to]); })
        .style("opacity", 0).transition().duration(D).style("opacity", 1);
    // An update always drives opacity/pointer-events back to their settled state, so an enter
    // fade interrupted by a second click within the transition window still finishes instead
    // of leaving the survivor translucent and unclickable.
    // `spine` reaches the DOM now — it was set on the ancestor chain when the neighbourhood
    // was built, used for geometry, and thrown away before it was drawn, so the path from the
    // root to the focus looked like any other ownership line.
    //
    // Classed on the update, not on the enter. A link keyed from→to survives a click, and
    // whether it is part of the spine depends on where the focus now is: the link into a
    // folder is an ordinary line until you descend through it, at which point it becomes the
    // path. Setting the class only where a path is created leaves every survivor wearing the
    // answer to a question asked one focus ago.
    lsel.merge(gLink.selectAll("path:not(.gone)"))
        .attr("class", function(d){ return d.kind === "own" ? (d.spine ? "own spine" : "own") : "ref"; });
    lsel.style("pointer-events", null).transition().duration(D)
        .style("opacity", 1).attr("d", function(d){ return shape(d, pos[d.from], pos[d.to]); });

    var bsel = gBand.selectAll("text:not(.gone)").data(neigh.bands, function(d){ return d.key; });
    bsel.exit().classed("gone", true).transition().duration(D).style("opacity", 0).remove();
    halo(bsel.enter().append("text")).attr("class", "eyebrow")
        .attr("x", function(d){ return d.x; }).attr("y", function(d){ return d.y; })
        .attr("text-anchor", function(d){ return d.anchor; })
        .text(function(d){ return d.text; })
        .style("opacity", 0).transition().duration(D).style("opacity", 1);
    bsel.text(function(d){ return d.text; }).attr("text-anchor", function(d){ return d.anchor; })
        .transition().duration(D).style("opacity", 1)
        .attr("x", function(d){ return d.x; }).attr("y", function(d){ return d.y; });

    var nsel = gNode.selectAll("g.n").data(neigh.nodes, function(d){ return d.node.id; });
    // An exiting node keeps its marks so it can fade, but loses the class the page and the
    // suite select on: a node that is on its way out is no longer on the canvas.
    nsel.exit().classed("n", false).attr("tabindex", null).style("pointer-events", "none")
        .transition().duration(D).style("opacity", 0).remove();

    var enter = nsel.enter().append("g")
      .attr("class", "n").attr("role", "button").attr("tabindex", 0)
      .attr("data-id", function(d){ return d.node.id; })
      .attr("data-kind", function(d){ return d.node.kind; })
      .attr("transform", function(d){ return "translate(" + d.x + " " + d.y + ")"; })
      .style("opacity", 0)
      .on("click", function(ev, d){ focus(d.node); })
      .on("keydown", function(ev, d){ if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); focus(d.node); } });
    enter.append("rect");
    halo(enter.append("text")).attr("class", "label");
    halo(enter.append("text")).attr("class", "typelab");
    halo(enter.append("text")).attr("class", "stamp");
    enter.transition().duration(D).style("opacity", 1);

    var all = enter.merge(nsel);
    all.classed("focus", function(d){ return d.role === "focus"; })
       .classed("ancestor", function(d){ return d.role === "ancestor"; })
       .attr("aria-current", function(d){ return d.role === "focus" ? "true" : null; });
    all.select("rect")
       .attr("class", function(d){ return d.node.kind === "entity" ? "sq" : "box"; })
       .attr("x", function(d){ return -markW(d); })
       .attr("y", function(d){ return -markW(d) - (d.node.kind === "entity" ? 0 : 2); })
       .attr("width", function(d){ return markW(d) * 2; })
       .attr("height", function(d){ return markW(d) * 2 + (d.node.kind === "entity" ? 0 : 4); })
       .attr("rx", function(d){ return d.node.kind === "entity" ? 0 : 4; });
    // The focus is the one node whose name also fills the card, so it carries its label
    // above the mark: nothing then sits between it and the column it owns.
    // Every run of text a node carries hangs off one baseline, so the block moves as a block.
    //
    // The focus writes its name *above* its mark rather than beside it, and a line beneath the
    // name therefore lands on the mark — which is exactly what it did. The whole block lifts by
    // a line's height when there is a line to make room for, and sits where it always sat when
    // there is not.
    function textX(d){ return d.role === "focus" ? -markW(d) : d.role === "in" ? -markW(d) - GAP : markW(d) + GAP; }
    function anchorOf(d){ return d.role === "in" ? "end" : null; }
    function baseY(d){
      if (d.role !== "focus") return 0;
      return -markW(d) - 16 - (underText(d) ? 15 : 0);
    }
    all.select("text.label")
       .attr("class", function(d){ return "label " + (d.node.kind === "root" ? "root" : d.node.kind === "folder" ? "folder" : ""); })
       .attr("x", textX).attr("y", baseY).attr("text-anchor", anchorOf)
       .text(function(d){ return d.node.label; });
    // Rides above the label, at the label's own x and anchor, so it reads as one block.
    all.select("text.typelab")
       .attr("x", textX).attr("y", function(d){ return baseY(d) - 14; }).attr("text-anchor", anchorOf)
       .text(typeOf);
    // And one line under the name for everything secondary — the period, the level, the field
    // an edge came from. It costs no width, which is what a canvas has least of.
    all.select("text.stamp")
       .attr("x", textX).attr("y", function(d){ return baseY(d) + 15; }).attr("text-anchor", anchorOf)
       .text(underText);
    nsel.transition().duration(D).style("opacity", 1)
        .attr("transform", function(d){ return "translate(" + d.x + " " + d.y + ")"; });

    home = fit(neigh, dim.w, dim.h);
    if (D) svg.transition().duration(D).call(zoom.transform, home);
    else svg.call(zoom.transform, home);
  }

  // ── the card ──────────────────────────────────────────────────────────────────────────
  function h(tag, text, cls){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  function goLink(id){
    var a = h("a", byId[id].name, "go");
    a.href = "#" + id;
    a.addEventListener("click", function(ev){ ev.preventDefault(); focus(nEntity(byId[id])); });
    return a;
  }
  // A link out of the model. `url` on an entry and every URL in a References table point at
  // the web rather than at another node, so they are not `goLink`s — that one focuses a node
  // and never leaves the page. This one is an ordinary href, in the same tab as everything
  // else here: nothing on this site opens a new one.
  //
  // The scheme is dropped from what is shown and kept in what is followed. A card column is
  // narrow, `https://` is eight characters of no information, and the family already writes
  // these as "wiki.eclipse.org/…" wherever it writes them in prose.
  var URL_RE = /^https?:\/\/\S+$/;
  function extLink(url){
    var a = h("a", url.replace(/^https?:\/\//, "").replace(/\/$/, ""), "ext");
    a.href = url;
    return a;
  }
  function resolve(text){ for (var i = 0; i < data.entities.length; i++) if (data.entities[i].name === text) return data.entities[i].id; return null; }
  // Markdown inline code — the one span-level mark the model's fixed shape uses. A field
  // name, a file path, a `ref → type`: every one of them a string quoted out of a file,
  // which is exactly what this system's mono face is for, so a card that printed the
  // backticks was showing the markup instead of the data. Appended as text nodes and
  // elements, never as innerHTML: these strings come out of the data block, and the day a
  // name in the model contains a "<" an innerHTML assignment would start parsing it as
  // markup. A backtick with no partner stays the character it is.
  function inline(el, text){
    String(text).split(/`([^`]+)`/).forEach(function(part, i){
      if (!part) return;
      if (i % 2) { el.appendChild(h("code", part, "mono")); return; }
      // A URL in a sentence is as followable as one in a field, and a card that linked the one
      // and not the other was drawing the same fact two ways. Split on the URL rather than the
      // whole part, so the prose either side of it stays prose. Backticks are handled above, so
      // a URL written as code stays code.
      part.split(/(https?:\/\/[^\s)\]]+)/).forEach(function(bit, j){
        if (!bit) return;
        el.appendChild(j % 2 ? extLink(bit.replace(/[.,;:]+$/, "")) : document.createTextNode(bit));
      });
    });
    return el;
  }
  function para(text, cls){ return inline(h("p", null, cls), text); }

  // Renders the focused node into the card's (body, foot) pair. Expand no longer copies this
  // into a second element — it moves the card itself into the dialog — so there is exactly
  // one target, and a .go link clicked inside it updates the same #cbody/#cfoot whether the
  // dialog is open or not.
  function renderInto(n, bodyEl, footEl){
    clear(bodyEl); clear(footEl);
    // The root carries an entity where the instance names its company, so it renders as one:
    // a tagline, the fields and the prose, rather than a name over a page count.
    if (n.kind !== "entity" && !n.entity) {
      // Not empty, and the same shape as an entity's card so the panel never jumps: the
      // path in mono where the entity puts its type and path, then one line of what is
      // focused and how many pages are filed under it. Both come out of the block.
      if (n.kind === "folder") {
        bodyEl.appendChild(h("div", n.id, "eyebrow"));
        bodyEl.appendChild(h("p", pagesUnder(n) + " " + t("pages"), "empty"));
      } else {
        // The root's label is a name, not a path, so it is set in prose and carries the card.
        bodyEl.appendChild(h("h3", n.label));
        bodyEl.appendChild(h("p", pagesUnder(n) + " " + t("pages"), "empty"));
      }
      return;
    }
    var e = n.entity;
    bodyEl.appendChild(h("div", e.type + " · " + e.id, "eyebrow"));
    bodyEl.appendChild(h("h3", e.name));
    if (e.tagline) bodyEl.appendChild(h("p", e.tagline, "tag"));
    // The root is the company and the container both, so its card keeps the count the folder
    // cards carry: what this is, and how much is filed under it.
    if (n.kind === "root") bodyEl.appendChild(h("p", pagesUnder(n) + " " + t("pages"), "empty"));
    var keys = Object.keys(e.fields);
    if (keys.length) {
      var dl = h("dl");
      keys.forEach(function(k){
        dl.appendChild(h("dt", k));
        var dd = h("dd"), v = e.fields[k];
        // A list is drawn as a list. Comma-joined, every entry was a link with a comma
        // between two underlines, and three skills read as one run-on sentence rather than
        // three things — the model wrote a list and the card turned it back into prose.
        // One entry per line also gives each link an edge a pointer can find.
        if (Array.isArray(v)) {
          var ul = h("ul", null, "items");
          v.forEach(function(name){
            var li = h("li"), id = resolve(name);
            li.appendChild(id ? goLink(id) : document.createTextNode(name));
            ul.appendChild(li);
          });
          dd.appendChild(ul);
        }
        else if (URL_RE.test(v)) dd.appendChild(extLink(v));
        else dd.textContent = v;
        dl.appendChild(dd);
      });
      bodyEl.appendChild(dl);
    }
    // Every table the section holds, in the order the file wrote them — one section of the
    // fixed shape can declare a table and then the columns of another, so a section is a
    // list of tables, not one. A caption addresses the table under it and is quoted from
    // the file, so it is mono: it is data, not this page's prose. A section with a single
    // uncaptioned table renders exactly what it rendered when `table` was the only one.
    e.sections.forEach(function(s){
      bodyEl.appendChild(h("h4", s.heading));
      (s.tables || []).forEach(function(tab){
        if (tab.caption) bodyEl.appendChild(para(tab.caption, "caption mono"));
        var tbl = h("table"), thead = h("thead"), hr = h("tr");
        tab.columns.forEach(function(c){ hr.appendChild(h("th", c)); });
        thead.appendChild(hr); tbl.appendChild(thead);
        var tb = h("tbody");
        tab.rows.forEach(function(row){
          var tr = h("tr");
          row.forEach(function(cell){
            var td = h("td"), id = resolve(cell);
            if (id) td.appendChild(goLink(id));
            else if (URL_RE.test(cell)) td.appendChild(extLink(cell));
            else inline(td, cell);
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        tbl.appendChild(tb); bodyEl.appendChild(tbl);
      });
      // A block whose lines each open with "- " is a list in the file, and is drawn as one. It
      // used to be a paragraph per item with the "- " still in the text: the marker the file
      // writes to mean "list" was being shown as if it were a word, and the items had no
      // hanging indent, so a wrapped one ran back under its own dash.
      if (s.text) s.text.split(/\n\n+/).forEach(function(par){
        if (/^-\s/.test(par)) {
          var ul = h("ul", null, "prose");
          par.split(/\n(?=-\s)/).forEach(function(item){
            ul.appendChild(inline(h("li"), item.replace(/^-\s+/, "").replace(/\n\s*/g, " ")));
          });
          bodyEl.appendChild(ul);
        } else bodyEl.appendChild(para(par.replace(/\n/g, " ")));
      });
    });
    // Mono, so it is data: the file and the commit it is pinned at, which is what the link
    // resolves to. The phrasing a reader needs is on the label, not in the row.
    var a = h("a", e.path.slice(e.path.lastIndexOf("/") + 1) + " @ " + data.commit.slice(0, 7));
    a.href = "https://github.com/" + repo + "/blob/" + data.commit + "/" + e.path;
    a.setAttribute("aria-label", t("view"));
    footEl.appendChild(a);
  }

  // The card always renders in place — there is nothing else to keep in sync, since the
  // dialog holds the same #card, not a copy of it.
  function showCard(n){ renderInto(n, cbody, cfoot); }

  // Re-fit after the dialog has actually laid out: showModal() changes the box #fig sits in,
  // but getBoundingClientRect() inside render()/fit() won't see the new size until the
  // browser has done that layout pass, hence two rAFs rather than calling render() inline.
  function refit(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ if (focused) render(); });
    });
  }

  expandBtn.addEventListener("click", function(){
    // Drop the marker where the stage stands before taking it away, so close has somewhere
    // exact to put it back — in front of whatever followed it, not in front of the caption.
    stageHome.insertBefore(stageMark, stageHead);
    modal.append(stageHead, stageEl);
    modal.showModal();
    // The stage has changed boxes, so it changes memories with it.
    setCard(storedCard(), false);
    refit();
  });
  document.getElementById("modalclose").addEventListener("click", function(){ modal.close(); });
  // Escape is native to <dialog> and needs no handler here. A click on the backdrop lands
  // with the dialog itself as the event target — nothing else is there to hit — which is
  // what tells it apart from a click on the content the dialog contains.
  modal.addEventListener("click", function(ev){ if (ev.target === modal) modal.close(); });
  // One handler for every way the dialog closes — ×, Escape, backdrop click — because all
  // three end in the native "close" event. Both go back in front of the marker, in order,
  // which puts them exactly where they were whatever else the page has around them.
  modal.addEventListener("close", function(){
    stageHome.insertBefore(stageHead, stageMark);
    stageHome.insertBefore(stageEl, stageMark);
    if (stageMark.parentNode) stageMark.parentNode.removeChild(stageMark);
    setCard(storedCard(), false);
    refit();
    expandBtn.focus();
  });

  // ── focus ─────────────────────────────────────────────────────────────────────────────
  function focus(n){
    focused = n;
    var segs = pathOf(n);
    pathLine.innerHTML = segs.map(function(s, i){
      var esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return i === segs.length - 1 ? "<b>" + esc + "</b>" : esc;
    }).join(" / ");
    // Every focus but the root is a place, so every focus but the root has a URL. It used to
    // be entities only, which made a folder unlinkable and unshareable and left Back landing
    // on the root from halfway down a path — and the share card, which asks for a state by
    // URL and nothing else, had no way to ask for an opened folder at all.
    var hash = n.kind === "root" ? "" : "#" + n.id;
    if (hash) location.hash = hash;
    else if (location.hash) { try { history.replaceState(null, "", location.pathname + location.search); } catch (err) { location.hash = ""; } }
    render();
    showCard(n);
  }

  document.getElementById("recenter").addEventListener("click", function(){
    var D = (reduce && reduce.matches) ? 0 : 400;
    if (D) svg.transition().duration(D).call(zoom.transform, home); else svg.call(zoom.transform, home);
  });

  // The site's language toggle rewrites every [data-de] node and sets <html lang>; the two
  // eyebrows and the folder card are built here, after that pass, so they follow the flag.
  new MutationObserver(function(){ if (focused) { render(); showCard(focused); } })
    .observe(document.documentElement, { attributes:true, attributeFilter:["lang"] });

  // ── the divider ───────────────────────────────────────────────────────────────────────
  // The details pane is fixed at 360px, which is right for a folder's card and wrong for a
  // profile claiming fifty-eight skills. A drag handle is what every two-pane tool a visitor
  // already uses puts between them, so it is what this uses: drag, double-click to reset,
  // arrow keys when focused.
  //
  // The width is remembered, and clamped on the way back in. A number dragged wide on a large
  // monitor would otherwise swallow the canvas on a laptop, and the same clamp handles a
  // window resized after the page loaded. The key is a constant here rather than the page's:
  // this file is byte-identical on every site that draws a stage and knows none of their
  // names, and localStorage is per-origin, so one name cannot collide with another site's.
  // Two memories, because there are two boxes. The page gives the stage a ~980px column and
  // the dialog gives it nearly the whole window, so a width that is right in one is wrong in
  // the other: one number would be clamped to the page's maximum every time the dialog closed,
  // and the reader's choice in the wider box would be lost on the way back. The default
  // differs for the same reason.
  var CARD = { page: { key: "stage-card" }, modal: { key: "stage-card-modal" } };
  var CARD_MIN = 280, CANVAS_MIN = 320;
  function cardMode(){ return modal.contains(stageEl) ? CARD.modal : CARD.page; }
  // Nothing stored means half the box, not a fixed width: the two panes start equal and the
  // reader decides from there. It is computed from the box in hand rather than carried as a
  // number, so the page and the dialog each open even without either knowing the other's size.
  function evenCard(){
    var stage = stageEl.getBoundingClientRect().width;
    var chrome = stage - stageEl.querySelector(".canvas").getBoundingClientRect().width - cardWidth();
    return (stage - chrome) / 2;
  }
  function storedCard(){
    var n = null;
    try { n = parseInt(localStorage.getItem(cardMode().key), 10); } catch (e) {}
    return n || evenCard();
  }
  var gutter = document.getElementById("gutter");
  function cardWidth(){ return stageEl.querySelector(".card").getBoundingClientRect().width; }
  function cardLimit(){
    var stage = stageEl.getBoundingClientRect().width;
    var canvas = stageEl.querySelector(".canvas").getBoundingClientRect().width;
    // Everything between and around the two panes — the handle and the grid's gaps — measured
    // rather than assumed. Subtracting a hard-coded handle width left the canvas 16px under
    // its floor, because the grid has two gaps and the arithmetic knew about neither.
    var chrome = stage - canvas - cardWidth();
    // On a narrow box the floor wins and this collapses to one legal value, which is the
    // honest answer rather than a negative one.
    return Math.max(CARD_MIN, stage - CANVAS_MIN - chrome);
  }
  function setCard(px, remember){
    var w = Math.round(Math.min(cardLimit(), Math.max(CARD_MIN, px)));
    stageEl.style.setProperty("--card-w", w + "px");
    if (remember) { try { localStorage.setItem(cardMode().key, String(w)); } catch (e) {} }
    return w;
  }
  if (gutter) {
    setCard(storedCard(), false);

    var dragFrom = 0, dragWidth = 0;
    gutter.addEventListener("pointerdown", function(ev){
      dragFrom = ev.clientX; dragWidth = cardWidth();
      gutter.setPointerCapture(ev.pointerId);
      gutter.classList.add("dragging");
      ev.preventDefault();
    });
    gutter.addEventListener("pointermove", function(ev){
      if (!gutter.classList.contains("dragging")) return;
      // The details pane is on the right, so dragging left widens it.
      setCard(dragWidth - (ev.clientX - dragFrom), false);
      render();
    });
    function endDrag(){
      if (!gutter.classList.contains("dragging")) return;
      gutter.classList.remove("dragging");
      setCard(cardWidth(), true);
    }
    gutter.addEventListener("pointerup", endDrag);
    gutter.addEventListener("pointercancel", endDrag);
    // Double-click restores the default and forgets the stored one, the way a devtools split
    // does — otherwise the only way back to the original is to drag until it looks right.
    gutter.addEventListener("dblclick", function(){
      try { localStorage.removeItem(cardMode().key); } catch (e) {}
      setCard(evenCard(), false); render();
    });
    gutter.addEventListener("keydown", function(ev){
      var step = ev.key === "ArrowLeft" ? 16 : ev.key === "ArrowRight" ? -16 : 0;
      if (!step) return;
      ev.preventDefault();
      setCard(cardWidth() + step, true); render();
    });
    // On resize, re-apply what was asked for rather than what is currently shown: a width
    // clamped down on a narrow window should come back when the window has room again. The
    // stored number is the preference; the rendered one is only what last fitted.
    window.addEventListener("resize", function(){ setCard(storedCard(), false); });
  }

  window.addEventListener("resize", function(){ if (focused) render(); });
  window.addEventListener("hashchange", function(){
    var id = decodeURIComponent(location.hash.slice(1));
    // An empty hash — Back past the last focus — means the root, not "do nothing", and so
    // does one naming nothing this page holds: focus() writes a hash for every node but the
    // root, so a bare or unrecognized hash is exactly what the root looks like.
    var n = nodeById(id);
    if (!n) { if (!focused || focused.kind !== "root") focus(nRoot()); return; }
    if (!focused || focused.id !== id) focus(n);
  });

  var initial = decodeURIComponent(location.hash.slice(1));
  focus(nodeById(initial) || nRoot());
  first = false;
})();
