  /* ─── surfaces lineage · v1 · {{variant}} ───────────────────────────────
     Generated from @robertblust/design — edit it there and run `npm run design`.

     The lineage's behavior on /surfaces/: the wires drawn from where the nodes landed, a
     surface chosen by click or by address, and its card in the panel under the drawing. It
     holds the page's card glue as well as its drawing, rather than leaving that to the
     `model card` block, because the two share state: the card shown is the surface chosen,
     and choosing one redraws the wires and fills the panel in one step. It moved here from
     /surfaces/ with one thing generalized and nothing else: where a card's links go.

     This block has a contract with the page around it that `design:check` cannot see, because
     the check only compares bytes between the markers. The page must load card.js before it
     and declare, above this fence in the same script:

       var STAGE_PAGE = "../model/";   // the page that draws this model on the stage

     and carry what lib/render/surfaces.mjs writes, the panel (`#lnpanel`, holding a card with
     `.cbody` and `.cfoot span`), the hint (`#lnhint`), and the provenance line (`#srclink`
     with its `data-src`, and `#srccommit`).
  */
  // The nodes are in the markup; the lines and the cards are not. A line is drawn from where two
  // nodes landed, which only the browser knows, and says nothing the nesting of the lists does not.
  // A card is rendered when its surface is chosen and again when the language changes, as a seat's
  // card is on /team/.
  (function(){
    var box = document.getElementById("lineage"), svg = document.getElementById("wires"),
        model = document.getElementById("lnmodel"), panel = document.getElementById("lnpanel"),
        hint = document.getElementById("lnhint"),
        btns = [].slice.call(document.querySelectorAll(".ln-s")), current = null, card = null;

    function at(el){
      var a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      return { l: a.left - b.left, r: a.right - b.left, y: a.top - b.top + a.height / 2 };
    }
    function curve(x1, y1, x2, y2){
      var m = (x1 + x2) / 2;
      return "M" + x1 + " " + y1 + "C" + m + " " + y1 + " " + m + " " + y2 + " " + x2 + " " + y2;
    }
    // Model to each maker, maker to each of its surfaces. The chosen surface's two segments take
    // --c-path, which is what that token names: the way back to the root.
    function draw(){
      if (getComputedStyle(svg).display === "none") return;
      var on = current && current.getAttribute("data-maker"), out = [], m = at(model);
      [].forEach.call(document.querySelectorAll(".ln-maker"), function(mk){
        var key = mk.getAttribute("data-maker"), a = at(mk), cls = key === "hand" ? "hand" : "";
        out.push('<path class="' + cls + (on === key ? " on" : "") + '" d="' + curve(m.r, m.y, a.l - 8, a.y) + '"/>');
        var right = at(mk.querySelector(".who")).r + 10;
        btns.forEach(function(b){
          if (b.getAttribute("data-maker") !== key) return;
          var s = at(b);
          out.push('<path class="' + cls + (b === current ? " on" : "") + '" d="' + curve(right, a.y, s.l, s.y) + '"/>');
        });
      });
      svg.innerHTML = out.join("");
    }
    function lang(){ return document.documentElement.lang === "de" ? "de" : "en"; }
    function show(){
      if (!current || !card) return;
      card(current.getAttribute("data-id"));
    }
    function select(b, address){
      current = b;
      btns.forEach(function(x){ x.setAttribute("aria-pressed", String(x === b)); });
      panel.hidden = !b; hint.hidden = !!b;
      show();
      if (address) history.replaceState(null, "", b ? "#" + b.id : location.pathname + location.search);
      draw();
    }
    btns.forEach(function(b){
      b.addEventListener("click", function(){ select(current === b ? null : b, true); });
    });
    // A link must land: arriving on /surfaces/#linkedin-profile chooses that surface.
    function fromHash(){
      var b = document.getElementById(location.hash.slice(1));
      if (b && b.classList.contains("ln-s")) select(b, false);
    }
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("resize", draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    new MutationObserver(function(){ show(); draw(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    fromHash();
    draw();

    rbCard.data("surfaces", function (data) {
      // The provenance line names the commit this was read from, as the timeline's does; the
      // markup carries HEAD only until the data arrives.
      var src = document.getElementById("srclink");
      src.href = "https://github.com/" + data.repo + "/tree/" + data.commit + "/" + src.getAttribute("data-src");
      document.getElementById("srccommit").textContent = data.commit.slice(0, 7);
      var byId = {};
      data.entities.forEach(function (e) { byId[e.id] = e; });
      function goLink(id){
        var a = document.createElement("a");
        a.className = "go"; a.textContent = byId[id].name;
        // Where a card links: the page that draws this model on the stage, which a site declares
        // for the reason the `model card` block gives.
        a.href = STAGE_PAGE + "?stage=expanded#" + id;
        return a;
      }
      card = function (id) {
        rbCard.render(byId[id], panel.querySelector(".cbody"), panel.querySelector(".cfoot span"),
          { data: data, lang: lang(), link: goLink });
      };
      show();
    });
  })();
  /* ─── end surfaces lineage ────────────────────────────────────────────── */
