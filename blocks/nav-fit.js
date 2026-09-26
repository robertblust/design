  /* ─── nav fit · v2 · {{variant}} ──────────────────────────────────────
     Whether the header row fits, measured rather than declared. Generated from
     @robertblust/design — editing it here does nothing, because the next `npm run design`
     overwrites it. Change it in the package.

     The header contract used to collapse at a width. A width cannot be right for three sites
     whose navs hold three, four and six items: measured, the German row needed 720px on
     guestgraph.io, 900 on companygraph.io and 1000 on blust.ch, so one number gave two of them
     a menu button where a row would have read perfectly well. And a number set from today's
     nav is a number that is wrong the day an item is added, which is exactly how blust.ch came
     to wrap on every page from 641px up without anything noticing.

     So the page asks the question instead of answering it in advance. `data-nav="compact"` on
     the root is what the contract keys off; this is the only thing that sets it.

     Measuring has to happen in the wide state, because in the compact one the row holds a
     button where the links were and the theme control is gone — measure that and the answer is
     always "it fits", which is the state it is already in. So the attribute comes off, the row
     is read, and the attribute goes back on, all in one synchronous run: the browser paints
     once, at the end of the task, and never shows the intermediate row.

     `flex-wrap` comes off for the read too. The bar wraps by rule, and a wrapped child reports
     the width it was given rather than the width it wants, so a wrapped row measures as
     fitting. With `nowrap` the overflow is real and `scrollWidth` is the width the row needs.

     It runs on load, on resize, when the fonts arrive — a row measured in the fallback face is
     measured at the wrong width — and when `<html lang>` changes, which is the case that
     started this: the same six links are 561px in German and 428 in English.

     Between the wide row and the button there is a tight row, `data-nav="tight"`: the same
     links with a smaller gap and less letter-spacing. Eight labels in German need more than
     blust.ch's shell gives at any width, so without this step every desktop visitor reading
     German got a menu button where the row would have read perfectly well tightened. The
     tight row is tried first and kept if it fits; the button is for a row that does not fit
     even tightened. A row that fits wide is never tightened, so nothing that fits today moves.
  */
  (function(){
    var root = document.documentElement, bar = document.querySelector(".bar");
    // Loud, because the quiet version cost an afternoon. This fence belongs at the end of the
    // body, beside `theme`; put in the head beside `theme boot` — one marker's worth of
    // difference, and `end theme` is a prefix of `end theme boot` — the row is not in the DOM
    // yet, and a block that returned here would leave every page uncollapsed with nothing
    // anywhere saying why. An uncaught exception is reported by every suite's pageerror
    // listener, which is the difference between a wasted hour and a red check.
    if (!bar) {
      throw new Error("nav fit: this page has no .bar yet. The block belongs at the end of " +
        "the body, after the theme fence, not in the head beside theme boot.");
    }
    var pending = false;
    function fit(){
      pending = false;
      root.removeAttribute("data-nav");
      var wrap = bar.style.flexWrap;
      bar.style.flexWrap = "nowrap";
      var over = bar.scrollWidth > bar.clientWidth;
      if (over) {
        root.setAttribute("data-nav", "tight");
        over = bar.scrollWidth > bar.clientWidth;
      }
      bar.style.flexWrap = wrap;
      if (over) root.setAttribute("data-nav", "compact");
    }
    // One read per frame at most: a drag across the breakpoint fires resize continuously, and
    // each run forces layout twice.
    function soon(){ if (!pending) { pending = true; requestAnimationFrame(fit); } }
    window.addEventListener("resize", soon);
    // The language switch rewrites the links through innerHTML, so the row's width changes
    // without anything resizing. Watching the attribute rather than being called keeps this
    // block out of every page's own applyLang.
    new MutationObserver(soon).observe(root, { attributes: true, attributeFilter: ["lang"] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    fit();
  })();
  /* ─── end nav fit ─────────────────────────────────────────────────────── */
