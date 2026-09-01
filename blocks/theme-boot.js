  /* ─── theme boot · v1 · shared ───────────────────────────────────────
     Set the theme before anything paints. Generated from @robertblust/design —
     editing it here does nothing, because the next `npm run design` overwrites it.

     This is the only script on these pages that runs in <head>, and it has to: every other
     script sits at the end of the body, which is after first paint. Language arriving late
     costs a flash of English; a palette arriving late repaints the whole page in the wrong
     one, on every navigation.

     It duplicates the storage key and the URL pattern that `theme` also carries. That is
     deliberate — nothing is in scope up here, and the block must stand alone. Both blocks are
     generated from the same package, so the duplicate cannot drift.

     Dark is the default and the operating system's own colour preference is never consulted:
     dark is the design, and light is something a visitor asks for. A visitor whose system is
     set to light still arrives on dark until they say otherwise.
  */
  (function(){
    try {
      var m = /[?&]theme=(light|dark)(&|$)/.exec(location.search);
      var t = m ? m[1] : localStorage.getItem("{{themeKey}}");
      if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    } catch (e) {}
  })();
  /* ─── end theme boot ─────────────────────────────────────────────────── */
