  /* ─── language · v2 · {{variant}} ─────────────────────────────────────────────
     One language across three domains, and where it is remembered. Generated
     from @robertblust/design — editing it here does nothing, because the next
     `npm run design` overwrites it. Change it in the package.

     This block has a contract with the page around it that `design:check` cannot see, because
     the check only compares bytes between the markers. The page must declare a `lang` variable
     in scope before this fence, and must call `langStored()` and `langRemember(v)` from
     wherever it reads and writes the visitor's saved choice. Rename `lang` or drop those calls
     and the fence still matches byte for byte — every check stays green — while a click throws
     ReferenceError and the language silently stops crossing domains.
  */
  var LANG_KEY = "{{langKey}}";
  function langStored(){ try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } }
  function langRemember(v){ try { localStorage.setItem(LANG_KEY, v); } catch (e) {} }

  /* One language across three domains. Each origin keeps its own localStorage, so a
     visitor reading German here and following a link to a sibling site would arrive in
     English — three copies of one preference, none of which can see the others. The
     language rides along instead: a link to a family domain gets ?lang= at the moment it
     is clicked, and a page that arrives with one adopts it, stores it, and takes it back
     out of the address bar.

     Decorated at click time, never at load. A family link can sit inside a data-de
     attribute, and switching language replaces that element whole — an href rewritten at
     load would be discarded by the first toggle. It also means no link in the served
     markup carries the param, so nothing crawlable, copyable or bookmarkable does either;
     the address bar is cleaned by replaceState the moment the page reads it. */
  var FAMILY = /^(www\.)?(blust\.ch|companygraph\.io|guestgraph\.io)$/;
  function langFromUrl(){
    var m = /[?&]lang=(de|en)(&|$)/.exec(location.search);
    if (!m) return null;
    try {
      var q = location.search.replace(/([?&])lang=(de|en)(&|$)/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) {}
    return m[1];
  }
  function carryLang(e){
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin === location.origin || !FAMILY.test(u.hostname)) return;
    u.searchParams.set("lang", lang);
    a.href = u.toString();
  }
  // mousedown as well as click, so a middle-click or a cmd-click opening a new tab
  // carries the language too; both fire before the browser follows the href.
  document.addEventListener("mousedown", carryLang, true);
  document.addEventListener("click", carryLang, true);
  /* ─── end language ─────────────────────────────────────────────────── */
