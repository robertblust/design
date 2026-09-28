// The family's one modal. Every page that opens something over itself opens it here: the graph,
// whether the model page's own stage or the model page embedded on another page, and a
// picture's full screen. One look, the terminal's, one size, the model page's, one close that
// says its key, and a dimmed page behind that does not scroll while the modal has the attention.
// No page links this file: chat.js and stage.js fetch it from beside themselves on the first
// open, and it links modal.css from beside itself, so a visitor who opens nothing loads neither.
//
//   rbModal.open({ key, kind, title, body, controls, opener, onClose }) → { el, showing(), title(text), close() }
//   rbModal.labels()                   the close relabeled in the page's language
//   rbModal.ready                      settles once modal.css has arrived
//
// There is one modal at a time. An open while the modal is shown replaces what it shows, the
// graph opened from a node of a picture's full screen, so one close always ends it; the handle
// `open` returns speaks for that showing only, and `showing()` says whether it still is.
// `body` is a node or a list of them. A node that stands somewhere on the page is moved in, a
// comment left where it stood, and moved back in front of that comment when it is closed or
// replaced, so it lands exactly where it was. A node that stands nowhere, made for the modal,
// is dropped then, unless `key` names it: a keyed node stays in the modal, hidden, to be shown
// again, since the graph's iframe would reload if it moved. The close's words are the caller's,
// set on `window.rbModalWords` as `{ en, de }`, or these.
(function(){
  if (window.rbModal) return;

  // ─── The stylesheet ───────────────────────────────────────────────────────────────────────
  // `ready` settles once the stylesheet has arrived, loaded or not, so a caller that measures
  // what it puts in the modal, a picture fitted to the sheet, measures the modal it will see.
  var here = document.currentScript && document.currentScript.src, ready = Promise.resolve();
  if (here && !document.querySelector("link[data-rbmodal]")) {
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = new URL("modal.css", here).href; css.setAttribute("data-rbmodal", "");
    ready = new Promise(function(done){ css.onload = done; css.onerror = done; });
    document.head.appendChild(css);
  }

  // ─── The words ────────────────────────────────────────────────────────────────────────────
  var WORDS = { en: "Close · Esc", de: "Schliessen · Esc" };
  function closeWord(){
    var w = window.rbModalWords || WORDS;
    return document.documentElement.lang === "de" ? (w.de || WORDS.de) : (w.en || WORDS.en);
  }

  // ─── The page behind ──────────────────────────────────────────────────────────────────────
  // The dimmed page says the modal has the attention, so the page does not scroll under it:
  // the root is held while the modal is open, and given back its place when it closes.
  // A page that shows a scrollbar keeps the room it took, so the page does not shift sideways
  // when the bar goes; a page drawn with overlay scrollbars has no room to keep.
  var held = 0, was = null;
  function hold(){
    if (held++ === 0) {
      var root = document.documentElement, bar = window.innerWidth - root.clientWidth;
      was = { y: window.scrollY, x: window.scrollX, overflow: root.style.overflow, pad: root.style.paddingRight };
      if (bar > 0) root.style.paddingRight = (parseFloat(getComputedStyle(root).paddingRight) || 0) + bar + "px";
      root.style.overflow = "hidden";
    }
  }
  function release(){
    if (held > 0 && --held === 0 && was) {
      document.documentElement.style.overflow = was.overflow;
      document.documentElement.style.paddingRight = was.pad;
      window.scrollTo(was.x, was.y); was = null;
    }
  }

  // ─── The modal ────────────────────────────────────────────────────────────────────────────
  // One dialog for the page, made on the first open. What it shows at a time is a showing: an
  // open while it is shown replaces the showing rather than stacking a second modal, so there
  // is always one modal and one close. The showing replaced gives back what it took, as a
  // close would, and hears its onClose; the page stays held and the dialog stays open.
  var d = null, now = null, opener = null, count = 0;
  function label(){ if (d) { var w = closeWord(); d.x.setAttribute("aria-label", w); d.x.setAttribute("data-tip", w); } }
  function labels(){ label(); }
  if (window.MutationObserver) new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function make(){
    d = {};
    d.el = document.createElement("dialog"); d.el.className = "rbmodal";
    // A container, not a control: showModal() would otherwise focus the ×, and a page nobody
    // has clicked yet paints that focus as a ring, so the first thing seen is the way out, lit.
    d.el.tabIndex = -1;
    var head = document.createElement("div"); head.className = "rbmodal-head";
    d.title = document.createElement("span"); d.title.className = "rbmodal-title"; d.title.id = "rbmodal-title-" + (++count);
    d.controls = document.createElement("div"); d.controls.className = "rbmodal-controls";
    d.x = document.createElement("button"); d.x.type = "button"; d.x.className = "rbmodal-close"; d.x.textContent = "×";
    d.body = document.createElement("div"); d.body.className = "rbmodal-body";
    head.appendChild(d.title); head.appendChild(d.controls); head.appendChild(d.x);
    d.el.appendChild(head); d.el.appendChild(d.body);
    d.el.setAttribute("aria-labelledby", d.title.id);
    // Every way out, the ×, Escape, the backdrop and a handle, closes and settles at once, so
    // whatever the modal took is back in its place the moment the modal is gone. Escape is
    // taken from the browser for that: its own close lands a task later.
    d.x.addEventListener("click", shut);
    // A click on the backdrop lands on the dialog itself, nothing else being there to hit.
    d.el.addEventListener("click", function(ev){ if (ev.target === d.el) shut(); });
    d.el.addEventListener("cancel", function(ev){ ev.preventDefault(); shut(); });
    // Any other close still settles, once the browser says so, unless the modal was opened again
    // in the meantime.
    d.el.addEventListener("close", function(){ if (!d.el.open) settle(); });
    document.body.appendChild(d.el); label();
  }

  // A showing gives back what it took: a node that stood on the page goes back in front of the
  // comment left where it stood; a node made for the modal stays in it, hidden, when it has a
  // key to be shown by again, the graph's frame, which a move would reload, and goes otherwise.
  function giveBack(sh){
    sh.nodes.forEach(function(n){
      var mark = sh.marks.get(n);
      if (mark) { if (mark.parentNode) { mark.parentNode.insertBefore(n, mark); mark.parentNode.removeChild(mark); } }
      else if (sh.key) n.classList.add("rbmodal-away");
      else if (n.parentNode === d.body) d.body.removeChild(n);
    });
    var then = sh.onClose; sh.onClose = null;
    if (then) then();
  }

  function shut(){ if (d && d.el.open) d.el.close(); settle(); }

  // Everything the modal took is given back: the nodes to their places, the page its scrolling,
  // the caller its turn, and the focus to what opened the modal first. Once per opening.
  function settle(){
    if (!now) return;
    var sh = now; now = null;
    giveBack(sh); release();
    var back = opener; opener = null;
    if (back && back.focus && document.documentElement.contains(back)) back.focus({ preventScroll: true });
  }

  function open(o){
    o = o || {};
    if (!d) make();
    var same = now && o.key && now.key === o.key;
    if (now && !same) giveBack(now);
    // The page's place is taken before anything leaves it, since what leaves shifts it.
    var first = !now;
    if (first) { hold(); opener = o.opener || document.activeElement; }
    var sh = same ? now : { key: o.key || null, nodes: [], marks: new Map(), onClose: null };
    now = sh;
    // What the modal holds, named on it, so a page's rules and its tests can tell two apart.
    d.el.className = "rbmodal" + (o.kind ? " rbmodal-" + o.kind : "");
    d.title.textContent = o.title || "";
    if (o.controls) { if (o.controls.parentNode !== d.controls) { d.controls.textContent = ""; d.controls.appendChild(o.controls); } }
    else if (!same) d.controls.textContent = "";
    [].concat(o.body || []).forEach(function(n){
      if (!n) return;
      if (sh.nodes.indexOf(n) < 0) sh.nodes.push(n);
      if (n.parentNode === d.body) { n.classList.remove("rbmodal-away"); return; }
      if (n.parentNode) { var mark = document.createComment("rbmodal"); n.parentNode.insertBefore(mark, n); sh.marks.set(n, mark); }
      d.body.appendChild(n);
    });
    sh.onClose = o.onClose || null;
    if (!d.el.open) { d.el.showModal(); d.el.focus({ preventScroll: true }); }
    // A handle speaks for its own showing only: once another has replaced it, it neither
    // retitles nor closes what the modal shows now.
    return {
      el: d.el,
      showing: function(){ return now === sh && d.el.open; },
      title: function(t){ if (now === sh) d.title.textContent = t; },
      close: function(){ if (now === sh) shut(); }
    };
  }

  window.rbModal = { open: open, labels: labels, ready: ready };
})();
