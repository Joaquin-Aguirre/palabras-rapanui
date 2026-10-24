// aprenda.imita.cl: tocar para escuchar, cambiar la palabra del día, filtrar por lengua.
(function () {
  var nodo = document.getElementById("datos-aprende"); if (!nodo) return;
  var D; try { D = JSON.parse(nodo.textContent); } catch (_) { return; }
  var $ = function (id) { return document.getElementById(id); };
  var porK = {}; D.palabras.forEach(function (p) { porK[p.l + "/" + p.s] = p; });
  var audio = new Audio(), actual = null;
  function evento(p, t) { try { navigator.sendBeacon("/api/evento", JSON.stringify({ l: p.l, s: p.s, t: t })); } catch (_) {} }
  function limpiar() { document.querySelectorAll(".sonando").forEach(function (e) { e.classList.remove("sonando"); }); }
  audio.addEventListener("ended", limpiar);
  audio.addEventListener("error", function () { limpiar(); $("estado").textContent = "No se pudo cargar el audio. Revisa tu conexión."; });

  function sonar(k, el) {
    var p = porK[k]; if (!p) return;
    if (!p.a) { $("estado").textContent = "«" + p.w + "» todavía no tiene voz. Pronto."; return; }
    limpiar(); if (el) el.classList.add("sonando");
    $("estado").textContent = "";
    audio.src = p.a; audio.currentTime = 0; audio.play().catch(function () {});
    if (actual !== k) { actual = k; evento(p, "audio"); }
  }

  // Palabra del día
  var play = $("hoyPlay");
  if (play) {
    play.onclick = function () { sonar(play.dataset.k, play); };
    var conVoz = D.palabras.filter(function (p) { return p.a; });
    $("otra").onclick = function () {
      var lista = conVoz.length > 1 ? conVoz : D.palabras; if (lista.length < 2) return;
      var p; do { p = lista[Math.floor(Math.random() * lista.length)]; } while (p.l + "/" + p.s === play.dataset.k);
      var L = D.lenguas[p.l];
      play.dataset.k = p.l + "/" + p.s; play.setAttribute("aria-label", "Escuchar " + p.w);
      $("hoyPalabra").textContent = p.w; $("hoySig").textContent = p.es; $("hoyLengua").textContent = L.n; $("hoyVer").href = p.h;
      play.closest(".ap-hero").style.setProperty("--c", L.c || "#E07A5C");
      sonar(play.dataset.k, play);
    };
  }

  // Tarjetas
  var grid = $("grid");
  if (grid) grid.addEventListener("click", function (e) {
    var b = e.target.closest(".ap-card"); if (b) sonar(b.dataset.k, b);
  });

  // Filtro por lengua
  document.querySelectorAll(".ap-chip").forEach(function (c) {
    c.onclick = function () {
      document.querySelectorAll(".ap-chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      var l = c.dataset.l;
      if (grid) grid.querySelectorAll("li").forEach(function (li) { var k = li.firstChild.dataset.k; li.hidden = !!l && k.indexOf(l + "/") !== 0; });
    };
  });
})();
