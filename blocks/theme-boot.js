  /* ─── theme boot · v5 · {{variant}} ────────────────────────────────────
     Set the theme before anything paints. Generated from @robertblust/design —
     editing it here does nothing, because the next `npm run design` overwrites it.

     This is the one script this package puts in <head>, and it has to be there: the package's
     other scripts sit at the end of the body, and a page may paint before they have run.
     Language arriving late costs a flash of English; a palette arriving late repaints the
     whole page in the wrong one, on every navigation. A site may put a script of its own in
     <head> as well, as each site does to start its fonts loading right after its @font-face
     rules.

     It duplicates the storage key and the URL pattern that `theme` also carries. That is
     deliberate — nothing is in scope up here, and the block must stand alone. Both blocks are
     generated from the same package, so the duplicate cannot drift.

     It also sets `data-embed` on a framed page whose address asks for it, for the same reason
     it sets the theme here: the chat embeds a model page in its dialog, and that page must never
     paint its header and footer before the stage's rules hide them.

     And it marks a page arriving with the chat open, for the reason it sets the theme here too:
     the panel is built by chat.js, which runs after the page's other scripts, and a page may
     paint before it has. `data-chat-waiting` holds the host the panel's title bar names, and
     chat.css paints the panel's empty frame and title bar at its size from it, so the frame
     and the bar are there on the first paint and only the conversation arrives after.
     chat.js takes the mark off once the panel stands, or once it has found nothing to show.

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
    // A conversation the tab keeps open: the keys are chat.js's, `chat` and `chat-size`, read
    // the way it reads them. Never in a frame, which takes no chat of its own.
    try {
      var r = document.documentElement, c = JSON.parse(sessionStorage.getItem("chat") || "null");
      if (c && c.open && window.top === window) {
        r.setAttribute("data-chat-waiting", location.host);
        var z = JSON.parse(sessionStorage.getItem("chat-size") || "null");
        if (z && z.w && z.h) { r.style.setProperty("--rbchat-kept-w", z.w + "px"); r.style.setProperty("--rbchat-kept-h", z.h + "px"); }
      }
    } catch (e) {}
  })();
  /* ─── end theme boot ─────────────────────────────────────────────────── */
