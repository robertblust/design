  /* ─── language · v5 · {{variant}} ─────────────────────────────────────────────
     One language across three domains, and where it is remembered. Generated
     from @robertblust/design — editing it here does nothing, because the next
     `npm run design` overwrites it. Change it in the package.

     A fenced copy sits inside the page's own script and sees whatever the page declared above
     it; a copy loaded as `page.js` or `deck.js` is its own file and sees nothing of the page
     at all. So this block takes `lang` from `window.rbPage.lang` when a page declares one,
     falls back to a `lang` already in scope when a fenced page still declares its own, and
     defaults to `"en"` when neither exists — read with `typeof lang !== "undefined"`, never a
     bare `lang`, so the absence of either throws nothing. Once decided, it calls
     `window.rbPage.applyLang(lang)` when the page declared one, the same way guarded: a page
     with no `data-de` needs no `applyLang` and gets none called.

     The key is `lang`, the family's: one name on three origins, the same word the address
     carries. A storage key is a promise to every visitor, and this one is made once, for the
     family, by the package, so that no site can make it differently.
  */
  var LANG_KEY = "lang";
  function langStored(){ try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } }
  function langRemember(v){ try { localStorage.setItem(LANG_KEY, v); } catch (e) {} }
  var lang = (window.rbPage && typeof window.rbPage.lang !== "undefined") ? window.rbPage.lang
    : (typeof lang !== "undefined" ? lang : "en");
  if (window.rbPage && typeof window.rbPage.applyLang === "function") window.rbPage.applyLang(lang);

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
  /* `lang` above is read once, when this script runs. That is fine for the fenced form, where
     it is the page's own variable and the page's own toggle mutates it directly — but a copy
     loaded as `page.js` or `deck.js` runs inside its own closure, so its `lang` is a private
     snapshot nothing after load ever updates. A visitor who switches language after the file
     has already run kept having every family link decorated with the language the page
     arrived with, forever after — measured on blust.ch's /ideas/, where a link to a sibling
     site carried the stale value once the file shape shipped there.

     `document.documentElement.lang` is the live truth instead: every page's own `applyLang`
     sets it, fenced or filed, so reading it at click time sees a switch the instant it
     happens. The captured `lang` is kept only as a fallback, for the one case the attribute
     cannot answer — a page that has not called `applyLang` at all, or set the attribute to
     something outside the two languages the family carries. */
  function carryLang(e){
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin === location.origin || !FAMILY.test(u.hostname)) return;
    var docLang = document.documentElement.lang;
    var live = (docLang === "de" || docLang === "en") ? docLang : lang;
    u.searchParams.set("lang", live);
    a.href = u.toString();
  }
  // mousedown as well as click, so a middle-click or a cmd-click opening a new tab
  // carries the language too; both fire before the browser follows the href.
  document.addEventListener("mousedown", carryLang, true);
  document.addEventListener("click", carryLang, true);

  /* An aria-label is markup the switch cannot reach through innerHTML, so a label that had
     to be read in both languages was written bilingual, "Menü — menu", and put an em-dash
     into German. Every element that carries data-de-aria gets the label for the language
     whenever <html lang> changes; the English is captured here on load, as data-en-aria, and
     never written by hand. The block watches the attribute rather than being called, so a
     page adds nothing to its own applyLang and the contract above does not grow. */
  function ariaI18n(){ return Array.prototype.slice.call(document.querySelectorAll("[data-de-aria]")); }
  function applyAria(){
    var l = document.documentElement.lang === "de" ? "de" : "en";
    ariaI18n().forEach(function(el){
      if (!el.hasAttribute("data-en-aria")) el.setAttribute("data-en-aria", el.getAttribute("aria-label") || "");
      el.setAttribute("aria-label", el.getAttribute("data-" + l + "-aria"));
    });
  }
  function watchAria(){
    applyAria();
    if (window.MutationObserver)
      new MutationObserver(applyAria).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchAria); else watchAria();
  /* ─── end language ─────────────────────────────────────────────────── */
