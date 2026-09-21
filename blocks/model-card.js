  /* ─── model card · v1 · {{variant}} ─────────────────────────────────────
     Generated from @robertblust/design — edit it there and run `npm run design`.

     The card glue for a board of seats: a seat's card is rendered by card.js the first time
     its row opens, again when the language has changed since, and on arrival at a seat's
     address. It moved here from /team/ with four things generalized and nothing else: where a
     card's links go, the rows it wires (every board's, not one board's), the Open-all button
     (one per board), and the name it gives card.js.

     This block has a contract with the page around it that `design:check` cannot see, because
     the check only compares bytes between the markers. The page must load card.js before it
     and declare, above this fence in the same script:

       var STAGE_PAGE = "../model/";   // the page that draws this model on the stage
       var MODEL_CARD = "team";        // the name card.js reports a failed read under

     and carry what lib/render/team.mjs writes, plus the provenance line
     (`#srclink` with its `data-src`, and `#srccommit`) that every model page has.
  */
  // The seats are in the markup; the cards are not. A card per seat at rest would be a copy of
  // the model's own words for every seat, in a page whose site already serves the model as a
  // file, and a page check that reads the body at rest would read them all. So a card is rendered
  // the first time its row opens, and again when the language has changed since — the way the
  // timeline renders an experience and the stage renders a card on focus.
  (function(){
    function lang(){ return document.documentElement.lang === "de" ? "de" : "en"; }
    rbCard.data(MODEL_CARD, function (data) {
      // The provenance line names the commit this was read from, as the timeline's does; the
      // markup carries HEAD only until the data arrives.
      var src = document.getElementById("srclink");
      src.href = "https://github.com/" + data.repo + "/tree/" + data.commit + "/" + src.getAttribute("data-src");
      document.getElementById("srccommit").textContent = data.commit.slice(0, 7);
      var byId = {};
      data.entities.forEach(function (e) { byId[e.id] = e; });
      // The href the timeline already builds: a visitor who clicked a skill wants to read it with
      // its references around it, and the stage's dialog is where one node is read.
      function goLink(id){
        var a = document.createElement("a");
        a.className = "go"; a.textContent = byId[id].name;
        // Where a seat links: the page that draws this model on the stage. A site declares it,
        // because on one site that is /model/ and on another the landing page, and a shared file
        // carrying either would send the other site's visitors to the wrong page.
        a.href = STAGE_PAGE + "?stage=expanded#" + id;
        return a;
      }
      var seen = {};
      function ensure(d){
        var id = d.getAttribute("data-role"), L = lang();
        if (seen[id] === L) return;
        rbCard.render(byId[id], d.querySelector(".cbody"), d.querySelector(".cfoot span"),
          { data: data, lang: L, link: goLink });
        seen[id] = L;
      }
      // Every board's rows. One process draws one board and a model with several draws one per
      // process, each a .grid; a card opens the same way on any of them.
      var rows = [].slice.call(document.querySelectorAll(".grid details"));
      rows.forEach(function (d) {
        d.addEventListener("toggle", function(){ if (d.open) ensure(d); });
      });
      // A link must land: arriving on /team/#reviewer opens that seat rather than scrolling to a
      // shut row whose name is all the visitor sees.
      function fromHash(){
        var id = location.hash.slice(1); if (!id) return;
        var d = document.getElementById(id);
        if (d && d.tagName === "DETAILS") { d.open = true; ensure(d); }
      }
      window.addEventListener("hashchange", fromHash);
      fromHash();
      // Re-render what is open when the language changes, and leave what is shut alone: a shut
      // row renders on its next open, in whatever language is current then.
      new MutationObserver(function(){
        rows.forEach(function (d) { if (d.open) ensure(d); });
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

      function label(shut){
        return shut ? (lang() === "de" ? "Alle schliessen" : "Close all")
                    : (lang() === "de" ? "Alle öffnen" : "Open all");
      }
      // One Open-all per board, and it opens its own board only. The renderer writes each board's
      // head rail immediately before its grid, so the rail's next sibling is the board it heads.
      [].slice.call(document.querySelectorAll(".openall")).forEach(function (all) {
        var board = all.closest(".hdrail").nextElementSibling;
        var mine = [].slice.call(board.querySelectorAll("details"));
        all.addEventListener("click", function(){
          var shut = mine.some(function (d) { return !d.open; });
          mine.forEach(function (d) { d.open = shut; if (shut) ensure(d); });
          all.textContent = label(shut);
          all.setAttribute("data-de", shut ? "Alle schliessen" : "Alle öffnen");
        });
      });
    });
  })();
  /* ─── end model card ──────────────────────────────────────────────────── */
