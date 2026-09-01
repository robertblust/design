  /* ─── theme · v1 · shared ────────────────────────────────────────────
     One theme across three domains, and where it is remembered. Generated from
     @robertblust/design — editing it here does nothing.

     This block has a contract with the page that `design:check` cannot see, because the check
     only compares bytes between the markers. The page must declare a `theme` variable in scope
     before this fence, and must carry two controls, `#thLight` and `#thDark`. Rename either and
     the fence still matches byte for byte — every check stays green — while the control stops
     working. `storageKeys` is what actually holds this contract: it clicks both.
  */
  var THEME_KEY = "{{themeKey}}";
  function themeStored(){ try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function themeRemember(v){ try { localStorage.setItem(THEME_KEY, v); } catch (e) {} }

  /* Each origin keeps its own localStorage, so a visitor reading in light who followed a link
     to a sibling site would arrive in dark — three copies of one preference, none of which can
     see the others. The theme rides along instead, on the same terms as the language: the param
     is added at click time, never at load, so no link in the served markup carries it and
     nothing crawlable or bookmarkable does either. */
  var THEME_FAMILY = /^(www\.)?(blust\.ch|companygraph\.io|guestgraph\.io)$/;
  function themeFromUrl(){
    var m = /[?&]theme=(light|dark)(&|$)/.exec(location.search);
    if (!m) return null;
    try {
      var q = location.search.replace(/([?&])theme=(light|dark)(&|$)/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) {}
    return m[1];
  }
  function carryTheme(e){
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin === location.origin || !THEME_FAMILY.test(u.hostname)) return;
    u.searchParams.set("theme", theme);
    a.href = u.toString();
  }
  // mousedown as well as click, so a middle-click or cmd-click into a new tab carries it too.
  // This runs alongside the language block's identical pair; the second listener reads the href
  // the first rewrote, so the two compose into ?lang=de&theme=light rather than racing.
  document.addEventListener("mousedown", carryTheme, true);
  document.addEventListener("click", carryTheme, true);

  function applyTheme(){
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    var l = document.getElementById("thLight"), d = document.getElementById("thDark");
    if (l) l.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    if (d) d.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
  function setTheme(v){ theme = v; themeRemember(v); applyTheme(); }
  /* ─── end theme ──────────────────────────────────────────────────────── */
