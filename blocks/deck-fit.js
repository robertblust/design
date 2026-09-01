  /* ─── deck fit · v1 · {{variant}} ────────────────────────────────────────
     Generated from @robertblust/design — edit it there and run `npm run design`.

     The canvas scaler, last script in every deck. It lays the slides out once at
     a fixed height and scales the whole plane to the screen, the way a
     presentation tool does it rather than the way a web page does: a slide can
     never scroll, because the canvas always fits, and the composition is
     identical on every screen, because there is only one composition.

     Only the height is pinned — the width follows the screen's own aspect, so
     the canvas covers the viewport exactly and there are never letterbox bars.
     Below the breakpoint the canvas is switched off and the deck reflows into
     the scrolling reading view it always had.
  */
  // Scale the fixed-height canvas to the screen. Below the breakpoint the deck reflows
  // into a scrolling reading view instead, so the transform is cleared there.
  // Two of these decks once described this canvas by a fixed 16:9 size instead —
  // the shape that letterboxed a 4:3 screen, not a design to restore.
  (function(){
    var CH = 900;
    var deck = document.getElementById("deck");
    var small = window.matchMedia("(max-width: 860px), (max-aspect-ratio: 4/5)");
    function fit(){
      if (small.matches) { deck.style.transform = ""; deck.style.width = ""; return; }
      // Height is the fixed dimension; width is whatever the screen's aspect asks
      // for. The canvas then covers the viewport exactly — no bars, any aspect.
      var s = window.innerHeight / CH;
      deck.style.width = (window.innerWidth / s) + "px";
      deck.style.transform = "scale(" + s + ")";
    }
    window.addEventListener("resize", fit);
    if (small.addEventListener) small.addEventListener("change", fit);
    fit();
  })();
  /* ─── end deck fit ───────────────────────────────────────────────────────── */
