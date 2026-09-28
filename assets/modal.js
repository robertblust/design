// The family's one modal. Every page that opens something over itself opens it here: the graph,
// whether the model page's own stage or the model page embedded on another page, and a
// picture's full screen. One look, the terminal's, one size, the model page's, one close that
// says its key, and a dimmed page behind that does not scroll while the modal has the attention.
// No page links this file: chat.js and stage.js fetch it from beside themselves on the first
// open, and it links modal.css from beside itself, so a visitor who opens nothing loads neither.
//
//   rbModal.open({ key, title, body, controls, opener, onClose }) → { el, title(text), close() }
//   rbModal.labels()                   every close relabeled in the page's language
//   rbModal.ready                      settles once modal.css has arrived
//
// `body` is a node or a list of them. A node that stands somewhere on the page is moved in, a
// comment left where it stood, and moved back in front of that comment on close, so it lands
// exactly where it was. A node that stands nowhere, made for the modal, stays in it. `key`
// names a modal that is kept and reused: the graph's iframe lives in one for the page's life,
// since moving an iframe reloads it. Two modals may be open at once, the graph over a picture,
// and each is addressed by the handle `open` returns. The close's words are the caller's, set
// on `window.rbModalWords` as `{ en, de }`, or these.
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
  // the root is held while any modal is open, and given back its place when the last one closes.
  var held = 0, was = null;
  function hold(){
    if (held++ === 0) { was = { y: window.scrollY, x: window.scrollX, overflow: document.documentElement.style.overflow }; document.documentElement.style.overflow = "hidden"; }
  }
  function release(){
    if (held > 0 && --held === 0 && was) {
      document.documentElement.style.overflow = was.overflow;
      window.scrollTo(was.x, was.y); was = null;
    }
  }

  // ─── The modal ────────────────────────────────────────────────────────────────────────────
  var all = [], keyed = {}, count = 0;
  function label(m){ var w = closeWord(); m.x.setAttribute("aria-label", w); m.x.setAttribute("data-tip", w); }
  function labels(){ all.forEach(label); }
  if (window.MutationObserver) new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function make(){
    var m = { marks: [], onClose: null, opener: null, shown: false };
    m.el = document.createElement("dialog"); m.el.className = "rbmodal";
    // A container, not a control: showModal() would otherwise focus the ×, and a page nobody
    // has clicked yet paints that focus as a ring, so the first thing seen is the way out, lit.
    m.el.tabIndex = -1;
    var head = document.createElement("div"); head.className = "rbmodal-head";
    m.title = document.createElement("span"); m.title.className = "rbmodal-title"; m.title.id = "rbmodal-title-" + (++count);
    m.controls = document.createElement("div"); m.controls.className = "rbmodal-controls";
    m.x = document.createElement("button"); m.x.type = "button"; m.x.className = "rbmodal-close"; m.x.textContent = "×";
    m.body = document.createElement("div"); m.body.className = "rbmodal-body";
    head.appendChild(m.title); head.appendChild(m.controls); head.appendChild(m.x);
    m.el.appendChild(head); m.el.appendChild(m.body);
    m.el.setAttribute("aria-labelledby", m.title.id);
    m.x.addEventListener("click", function(){ m.el.close(); });
    // A click on the backdrop lands on the dialog itself, nothing else being there to hit.
    m.el.addEventListener("click", function(ev){ if (ev.target === m.el) m.el.close(); });
    // One way out for all of them, the ×, Escape and the backdrop: the native close event. It
    // fires a moment after the dialog closes, so a close asked for by its handle settles at once
    // and the event finds nothing left to do.
    m.el.addEventListener("close", function(){ settle(m); });
    document.body.appendChild(m.el); all.push(m); label(m);
    return m;
  }

  // Everything the modal took is given back: the nodes to their places, the page its scrolling,
  // the caller its turn, and the focus to what opened it. Once per showing.
  function settle(m){
    if (!m.shown) return;
    m.marks.forEach(function(p){ if (p[1].parentNode) { p[1].parentNode.insertBefore(p[0], p[1]); p[1].parentNode.removeChild(p[1]); } });
    m.marks = []; m.shown = false; release();
    var then = m.onClose, back = m.opener; m.onClose = null; m.opener = null;
    if (then) then();
    if (back && back.focus && document.documentElement.contains(back)) back.focus({ preventScroll: true });
  }

  function open(o){
    o = o || {};
    var m = o.key && keyed[o.key] ? keyed[o.key] : make();
    if (o.key) keyed[o.key] = m;
    // The page's place is taken before anything leaves it, since what leaves shifts it.
    var first = !m.shown;
    if (first) { m.shown = true; hold(); }
    m.title.textContent = o.title || "";
    if (o.controls && o.controls.parentNode !== m.controls) { m.controls.textContent = ""; m.controls.appendChild(o.controls); }
    else if (!o.controls && !o.key) m.controls.textContent = "";
    [].concat(o.body || []).forEach(function(n){
      if (!n || n.parentNode === m.body) return;
      if (n.parentNode) { var mark = document.createComment("rbmodal"); n.parentNode.insertBefore(mark, n); m.marks.push([n, mark]); }
      m.body.appendChild(n);
    });
    m.onClose = o.onClose || null;
    m.opener = o.opener || document.activeElement;
    if (first) { m.el.showModal(); m.el.focus({ preventScroll: true }); }
    return {
      el: m.el,
      title: function(t){ m.title.textContent = t; },
      close: function(){ if (m.el.open) m.el.close(); settle(m); }
    };
  }

  window.rbModal = { open: open, labels: labels, ready: ready };
})();
