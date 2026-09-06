// The card: one entity of a data block, rendered into a body and a foot. Two pages draw it —
// the stage beside its drawing, and a ledger under one of its rows — and the day it lived
// inside stage.js a second page could only copy it, which it did, and drifted in seven places
// within a day. So it is a file of its own, synced whole, loaded before whichever script
// calls it, and it knows no page: what it cannot read off the entity it takes from `opts`.
//
//   rbCard.render(entity, bodyEl, footEl, { data, lang, link, note })
//     data   the parsed block: entities for resolving a reference, commit and repo for the foot
//     lang   "en" or "de" — the caller reads <html lang>; this file never does
//     link   (id) → Element: what a resolved reference becomes. The stage hands back a link
//            that focuses the node; the timeline hands back one that opens the model page on it.
//     note   optional; one line appended after the tagline as p.empty — the stage's page count
//            on the root
//   rbCard.fmtPeriod(stamp, lang), rbCard.fmtDate(value, lang)
//     how a date reads, in which language. Moved here because a ledger's stamps and a stage's
//     have to read the same, and one copy is the only way that stays true.
(function(){
  var STR = {
    view:   { en:"View this file on GitHub", de:"Diese Datei auf GitHub ansehen" },
    now:    { en:"present",                 de:"heute" },
    skills: { en:"Skills",                  de:"Fähigkeiten" },
    other:  { en:"Other",                   de:"Weitere" }
  };
  // A date is drawn as prose, not as the ISO the model stores, so the months travel with the
  // script the way every other word here does. The German list carries the period where
  // German abbreviates and none where it does not, the list WRITING.md sets; the English
  // stays three letters without a period, which is that language's rule. The three lengths are core's three precisions:
  // a year, a month, a day — written at the precision the model holds and never padded up.
  var MONTHS = {
    en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    de: ["Jan.","Febr.","März","Apr.","Mai","Juni","Juli","Aug.","Sept.","Okt.","Nov.","Dez."]
  };
  function fmtDate(v, lang){
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v || "");
    if (!m) return v || "";
    if (!m[2]) return m[1];
    var mon = MONTHS[lang][+m[2] - 1];
    if (!m[3]) return mon + " " + m[1];
    // "May 4, 2012" and "4. Mai 2012". The page is en-US, so the English day follows the
    // month and a comma sets off the year; the German ordinal carries its point and comes
    // first.
    if (lang === "de") return (+m[3]) + ". " + mon + " " + m[1];
    return mon + " " + (+m[3]) + ", " + m[1];
  }
  // Three shapes, and the model says which by what it holds. No end means still running. An
  // end equal to its start is a one-off — a talk, a certification — and printing it twice
  // would say a day lasted from itself to itself.
  function fmtPeriod(st, lang){
    if (!st || !st.start) return "";
    var dash = lang === "de" ? " – " : "–";
    if (!st.end) return fmtDate(st.start, lang) + dash + STR.now[lang];
    if (st.end === st.start) return fmtDate(st.start, lang);
    // A range between two dates, or from one date to now: English closes the en-dash,
    // German spaces it, and an open end is no exception — "now" stands where a date would.
    return fmtDate(st.start, lang) + dash + fmtDate(st.end, lang);
  }

  function h(tag, text, cls){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  // A link out of the model. `url` on an entry and every URL in a References table point at
  // the web rather than at another node, so they are ordinary hrefs, in the same tab as
  // everything else here: nothing on these sites opens a new one. The scheme is dropped from
  // what is shown and kept in what is followed — a card column is narrow and `https://` is
  // eight characters of no information.
  var URL_RE = /^https?:\/\/\S+$/;
  function extLink(url){
    var a = h("a", url.replace(/^https?:\/\//, "").replace(/\/$/, ""), "ext");
    a.href = url;
    return a;
  }
  function resolve(data, text){ for (var i = 0; i < data.entities.length; i++) if (data.entities[i].name === text) return data.entities[i].id; return null; }
  // Markdown inline code — the one span-level mark the model's fixed shape uses — becomes
  // code.mono; a URL inside a sentence becomes a link. Appended as nodes, never as innerHTML:
  // these strings come out of the data block, and the day a name contains a "<" an innerHTML
  // assignment would start parsing it as markup.
  function inline(el, text){
    String(text).split(/`([^`]+)`/).forEach(function(part, i){
      if (!part) return;
      if (i % 2) { el.appendChild(h("code", part, "mono")); return; }
      part.split(/(https?:\/\/[^\s)\]]+)/).forEach(function(bit, j){
        if (!bit) return;
        el.appendChild(j % 2 ? extLink(bit.replace(/[.,;:]+$/, "")) : document.createTextNode(bit));
      });
    });
    return el;
  }
  function para(text, cls){ return inline(h("p", null, cls), text); }

  function render(e, bodyEl, footEl, opts){
    var data = opts.data, lang = opts.lang === "de" ? "de" : "en", link = opts.link;
    function ref(name){
      var id = resolve(data, name);
      if (!id || !link) return document.createTextNode(name);
      var a = link(id), ent = entityOf(data, id);
      if (ent && a.setAttribute) describe(a, ent.type, ent.name, ent.tagline || "");
      return a;
    }
    clear(bodyEl); clear(footEl);
    // Who claims this entity's skills at a level, and which levels there are — read once per
    // card, before the chips that use them are drawn.
    var owner = levelOwner(data, e), lvls = levelsOf(data, owner);
    // The type alone. The path used to follow it, and it was the longest line on the card
    // for the least information: the foot names the file, and on the model page the path
    // line above the drawing already says where you are.
    bodyEl.appendChild(h("div", e.type, "eyebrow"));
    bodyEl.appendChild(h("h3", e.name));
    if (e.tagline) bodyEl.appendChild(h("p", e.tagline, "tag"));
    if (opts.note) bodyEl.appendChild(h("p", opts.note, "empty"));
    // Two fields are not drawn in the list. `source` says where the page is mastered, and
    // in an instance that masters itself it reads the same on every page — machinery, not a
    // fact a reader came for. `skills` is a list of references out of the file, and it is
    // the card's last section, grouped, rather than a field row: see below.
    var keys = Object.keys(e.fields).filter(function(k){ return k !== "source" && k !== "skills"; });
    if (keys.length) {
      var dl = h("dl");
      keys.forEach(function(k){
        dl.appendChild(h("dt", k));
        var dd = h("dd"), v = e.fields[k];
        // A list is drawn as a list, one entry per line, each link with an edge a pointer
        // can find; comma-joined, three skills read as one run-on sentence.
        if (Array.isArray(v)) {
          var ul = h("ul", null, "items");
          v.forEach(function(name){ var li = h("li"); li.appendChild(ref(name)); ul.appendChild(li); });
          dd.appendChild(ul);
        }
        else if (URL_RE.test(v)) dd.appendChild(extLink(v));
        else dd.textContent = v;
        dl.appendChild(dd);
      });
      bodyEl.appendChild(dl);
    }
    // Every table the section holds, in the order the file wrote them; a caption is quoted
    // from the file and is mono, because it is data, not the page's prose.
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
            var td = h("td"), id = resolve(data, cell);
            if (id && link) { var cellA = link(id), cellE = entityOf(data, id); if (cellE && cellA.setAttribute) describe(cellA, cellE.type, cellE.name, cellE.tagline || ""); td.appendChild(cellA); }
            else if (URL_RE.test(cell)) td.appendChild(extLink(cell));
            else inline(td, cell);
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        tbl.appendChild(tb); bodyEl.appendChild(tbl);
      });
      // A block whose lines each open with "- " is a list in the file, and is drawn as one,
      // with the marker stripped and a hanging indent.
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
    // Skills last, and grouped. Each skill file names a `group`, and the card reads it off
    // the entity a name resolves to. A group is a closed disclosure — its name and its count
    // on the line, its skills as chips when opened — so a role claiming forty-five skills is
    // ten lines rather than forty-five. Alphabetical at both levels, the groups and the chips
    // inside them: one rule a reader can predict, and one that knows no name from any page,
    // where the file's own order would put a different group first on every card. A skill whose file
    // names no group, or that resolves to no file, is filed under "Other", last; a model
    // whose skills carry no groups at all gets the flat list under the heading.
    var skills = e.fields.skills;
    if (Array.isArray(skills) && skills.length) {
      bodyEl.appendChild(h("h4", STR.skills[lang]));
      var groups = [], byGroup = {}, any = false;
      skills.forEach(function(name){
        var id = resolve(data, name), ent = id && data.entities.filter(function(x){ return x.id === id; })[0];
        var g = ent && ent.fields && ent.fields.group;
        if (g) any = true; else g = null;
        var key = g || "\u0000other";
        if (!byGroup[key]) { byGroup[key] = []; groups.push(key); }
        byGroup[key].push(name);
      });
      if (!any) {
        var flat = h("ul", null, "items");
        skills.forEach(function(name){ var li = h("li"); li.appendChild(ref(name)); flat.appendChild(li); });
        bodyEl.appendChild(flat);
      } else {
        var grps = h("div", null, "grps");
        groups.filter(function(k){ return k !== "\u0000other"; }).sort(function(x, y){ return x.localeCompare(y, "en"); })
          .concat(byGroup["\u0000other"] ? ["\u0000other"] : []).forEach(function(key){
          var d = h("details", null, "grp"), s = h("summary", key === "\u0000other" ? STR.other[lang] : key);
          s.appendChild(h("span", String(byGroup[key].length), "n"));
          var chips = h("div", null, "chips");
          byGroup[key].slice().sort(function(x, y){ return x.localeCompare(y, "en"); })
            .forEach(function(name){ chips.appendChild(withLevel(ref(name), name)); });
          d.appendChild(s); d.appendChild(chips); grps.appendChild(d);
        });
        bodyEl.appendChild(grps);
      }
    }
    // A chip carries the level the owner claims the skill at, as marks: one small square per
    // level the model defines, filled up to the claimed one. The square is the figure's mark
    // for a page, and the count is the model's, so the scale is the model's and not this
    // file's. The owner is the nearest entity above this one on disk that holds a table with
    // a Level column — a profile, in the vocabulary that has one — and a skill it does not
    // claim, or a model with no levels, draws a plain chip. The hover and the label say the
    // level's name; the hover adds its one line, because four filled of four needs no key.
    function withLevel(a, name){
      if (!a.setAttribute || !lvls.length || !owner) return a;
      var claimed = claimedLevel(owner, name), at = -1;
      lvls.forEach(function(l, i){ if (l.name === claimed) at = i; });
      if (at < 0) return a;
      var marks = h("span", null, "lv"); marks.setAttribute("aria-hidden", "true");
      lvls.forEach(function(l, i){ marks.appendChild(h("i", null, i <= at ? "on" : "")); });
      a.appendChild(marks);
      a.setAttribute("aria-label", name + ", " + claimed);
      describe(a, lvls[at].type, lvls[at].name, lvls[at].tagline || "");
      return a;
    }
    // Mono, so it is data: the file and the commit it is pinned at, which is what the link
    // resolves to. The phrasing a reader needs is on the label, not in the row.
    var a = h("a", e.path.slice(e.path.lastIndexOf("/") + 1) + " @ " + data.commit.slice(0, 7));
    a.href = "https://github.com/" + (data.repo || "companygraph/meta-model") + "/blob/" + data.commit + "/" + e.path;
    a.setAttribute("aria-label", STR.view[lang]);
    footEl.appendChild(a);
  }

  function entityOf(data, id){ for (var i = 0; i < data.entities.length; i++) if (data.entities[i].id === id) return data.entities[i]; return null; }
  // The levels a model defines, lowest first: every entity of the type the owner's Level
  // column names, in the order of the rank their files carry. Read off the claim rather than
  // off a type name, so this file learns no word from any vocabulary; a model whose claims
  // resolve to nothing draws no marks anywhere.
  function levelsOf(data, owner){
    var tab = owner && levelTable(owner), li = tab ? tab.columns.indexOf("Level") : -1, type = null;
    if (tab) for (var i = 0; i < tab.rows.length && !type; i++) { var id = resolve(data, tab.rows[i][li]), ent = id && entityOf(data, id); if (ent) type = ent.type; }
    if (!type) return [];
    return data.entities.filter(function(x){ return x.type === type; })
      .sort(function(x, y){ return (+(x.fields && x.fields.rank) || 0) - (+(y.fields && y.fields.rank) || 0); });
  }
  function levelTable(ent){
    var found = null;
    (ent.sections || []).forEach(function(sec){ (sec.tables || []).forEach(function(tab){ if (!found && tab.columns.indexOf("Level") >= 0) found = tab; }); });
    return found;
  }
  // The entity that claims levels for this one: itself, or the nearest entity above it on
  // disk whose card holds a table with a Level column.
  function levelOwner(data, e){
    if (levelTable(e)) return e;
    var best = null;
    data.entities.forEach(function(x){
      if (e.id.indexOf(x.id + "/") === 0 && levelTable(x) && (!best || x.id.length > best.id.length)) best = x;
    });
    return best;
  }
  function claimedLevel(owner, name){
    var tab = levelTable(owner), si = tab.columns.indexOf("Skill"), li = tab.columns.indexOf("Level");
    if (si < 0) si = 0;
    for (var i = 0; i < tab.rows.length; i++) if (tab.rows[i][si] === name) return tab.rows[i][li];
    return null;
  }

  // ── the tooltip ─────────────────────────────────────────────────────────────────────
  // A hover on a thing in the model shows that thing's card in miniature: its type in the
  // eyebrow, its name, its one line. One element for the whole page, moved to whatever is
  // hovered or focused, fixed to the viewport so a card that scrolls inside itself cannot
  // clip it, and pointer-events none so it never catches the pointer that summoned it. It
  // carries role=tooltip and the target points at it with aria-describedby, so a keyboard
  // and a screen reader get what a pointer gets. No element keeps a title beside it: a
  // browser box under a designed one is two answers to one question. Anything on any page
  // may use it — the stage's transport does — by setting the three data-tip attributes.
  function describe(el, kind, name, text){
    el.setAttribute("data-tip-kind", kind || ""); el.setAttribute("data-tip-name", name || ""); el.setAttribute("data-tip", text || "");
    el.removeAttribute("title");
  }
  var tip = null, tipK, tipN, tipD, held = null, tipTimer = 0;
  function tipEl(){
    if (tip) return tip;
    tip = h("div", null, "tip"); tip.id = "tip"; tip.setAttribute("role", "tooltip"); tip.setAttribute("aria-hidden", "true");
    tipK = h("span", null, "k"); tipN = h("span", null, "n"); tipD = h("span", null, "d");
    tip.appendChild(tipK); tip.appendChild(tipN); tip.appendChild(tipD);
    document.body.appendChild(tip);
    return tip;
  }
  function placeTip(el){
    var t = tipEl(), r = el.getBoundingClientRect(); t.style.left = "0px"; t.style.top = "0px";
    var w = t.offsetWidth, hgt = t.offsetHeight, gap = 8;
    var x = Math.round(r.left + r.width / 2 - w / 2); x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    var y = Math.round(r.top - hgt - gap); if (y < 8) y = Math.round(r.bottom + gap);
    t.style.left = x + "px"; t.style.top = y + "px";
  }
  // An open <dialog> is in the browser's top layer, above everything that is not, and no
  // z-index climbs into it; a tooltip left in the body sits under the expanded stage. So the
  // tooltip moves into whichever dialog holds its target and back out to the body when the
  // target is on the page — position:fixed reads the same from either parent.
  function showTip(el){
    if (held === el) return;
    hideTip(); held = el; tipEl();
    var home = (el.closest && el.closest("dialog[open]")) || document.body;
    if (tip.parentNode !== home) home.appendChild(tip);
    tipK.textContent = el.getAttribute("data-tip-kind") || ""; tipN.textContent = el.getAttribute("data-tip-name") || ""; tipD.textContent = el.getAttribute("data-tip") || "";
    el.setAttribute("aria-describedby", "tip");
    tipTimer = setTimeout(function(){ tip.setAttribute("aria-hidden", "false"); placeTip(el); tip.classList.add("show"); }, 120);
  }
  function hideTip(){
    clearTimeout(tipTimer);
    if (tip) { tip.classList.remove("show"); tip.setAttribute("aria-hidden", "true"); }
    if (held) held.removeAttribute("aria-describedby");
    held = null;
  }
  function tipTarget(node){ return node && node.closest ? node.closest("[data-tip-name]") : null; }
  document.addEventListener("mouseover", function(ev){ var el = tipTarget(ev.target); if (el) showTip(el); else if (held && !held.contains(ev.target)) hideTip(); });
  document.addEventListener("mouseout", function(ev){ if (held && ev.relatedTarget && !held.contains(ev.relatedTarget) && !tipTarget(ev.relatedTarget)) hideTip(); });
  document.addEventListener("focusin", function(ev){ var el = tipTarget(ev.target); if (el) showTip(el); else hideTip(); });
  document.addEventListener("focusout", function(ev){ if (held && ev.target === held) hideTip(); });
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape") hideTip(); });
  document.addEventListener("scroll", function(){ if (held && tip && tip.classList.contains("show")) placeTip(held); }, true);
  window.addEventListener("resize", function(){ if (held) placeTip(held); });

  window.rbCard = { render: render, fmtPeriod: fmtPeriod, fmtDate: fmtDate, describe: describe };
})();
