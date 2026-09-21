(function () {
  var link = document.querySelector("link[data-stage]");
  var card = document.getElementById("card");
  if (!link || !link.getAttribute("href")) return;
  fetch(link.href).then(function (r) { return r.json(); }).then(function (data) {
    var byId = {};
    data.entities.forEach(function (e) { byId[e.id] = e; });
    function show() {
      var e = byId[decodeURIComponent(location.hash.slice(1))];
      card.innerHTML = "";
      if (e) e.see.forEach(function (id) {
        var a = document.createElement("a"); a.href = "#" + id; a.textContent = id; card.appendChild(a);
      });
    }
    window.addEventListener("hashchange", show);
    show();
  });
})();
