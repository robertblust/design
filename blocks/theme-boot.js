  /* ─── theme boot · v4 · {{variant}} ────────────────────────────────────
     Set the theme before anything paints. Generated from @robertblust/design —
     editing it here does nothing, because the next `npm run design` overwrites it.

     This is the only script on these pages that runs in <head>, and it has to: every other
     script sits at the end of the body, which is after first paint. Language arriving late
     costs a flash of English; a palette arriving late repaints the whole page in the wrong
     one, on every navigation.

     It duplicates the storage key and the URL pattern that `theme` also carries. That is
     deliberate — nothing is in scope up here, and the block must stand alone. Both blocks are
     generated from the same package, so the duplicate cannot drift.

     It also sets `data-embed` on a framed page whose address asks for it, for the same reason
     it sets the theme here: the chat embeds a model page in its dialog, and that page must never
     paint its header and footer before the stage's rules hide them.

     Dark is the default and `prefers-color-scheme` is never read: dark is the design, and
     light is something a visitor asks for. A visitor whose system is set to light still
     arrives on dark until they say otherwise.
  */
  (function(){
    try {
      var m = /[?&]theme=(light|dark)(&|$)/.exec(location.search);
      var t = m ? m[1] : localStorage.getItem("theme");
      if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    } catch (e) {}
    // A page asked for `embed`, inside a frame, draws its stage alone, in the chat's dialog on
    // another page; the flag is set here so the page never paints its own header first. Its own
    // try, because the theme's storage read throws where site data is blocked and the flag must
    // not go with it; and only in a frame, because a page opened on its own is an ordinary page.
    try {
      if (window.top !== window && /[?&]embed(&|$)/.test(location.search)) document.documentElement.setAttribute("data-embed", "");
    } catch (e) {}
  })();
  /* ─── end theme boot ─────────────────────────────────────────────────── */
