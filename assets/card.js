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
    view: { en:"View this file on GitHub", de:"Diese Datei auf GitHub ansehen" },
    now:  { en:"present",                 de:"heute" }
  };
  // A date is drawn as prose, not as the ISO the model stores, so the months travel with the
  // script the way every other word here does. The three lengths are core's three precisions:
  // a year, a month, a day — written at the precision the model holds and never padded up.
  var MONTHS = {
    en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    de: ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
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
    function ref(name){ var id = resolve(data, name); return id && link ? link(id) : document.createTextNode(name); }
    clear(bodyEl); clear(footEl);
    bodyEl.appendChild(h("div", e.type + " · " + e.id, "eyebrow"));
    bodyEl.appendChild(h("h3", e.name));
    if (e.tagline) bodyEl.appendChild(h("p", e.tagline, "tag"));
    if (opts.note) bodyEl.appendChild(h("p", opts.note, "empty"));
    var keys = Object.keys(e.fields);
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
            if (id && link) td.appendChild(link(id));
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
    // Mono, so it is data: the file and the commit it is pinned at, which is what the link
    // resolves to. The phrasing a reader needs is on the label, not in the row.
    var a = h("a", e.path.slice(e.path.lastIndexOf("/") + 1) + " @ " + data.commit.slice(0, 7));
    a.href = "https://github.com/" + (data.repo || "companygraph/meta-model") + "/blob/" + data.commit + "/" + e.path;
    a.setAttribute("aria-label", STR.view[lang]);
    footEl.appendChild(a);
  }

  window.rbCard = { render: render, fmtPeriod: fmtPeriod, fmtDate: fmtDate };
})();
