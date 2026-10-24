// Página de una palabra: escuchar (una o varias voces), compartir y crear la imagen para historias.
(function () {
  var nodo = document.getElementById("datos-pagina"); if (!nodo) return;
  var P; try { P = JSON.parse(nodo.textContent); } catch (_) { return; }
  if (P.slug === "_") {   // portada de una lengua: solo cuenta la visita
    try { navigator.sendBeacon("/api/evento", JSON.stringify({ l: P.lengua, s: "_", t: "visita" })); } catch (_) {}
    return;
  }
  var $ = function (id) { return document.getElementById(id); };
  var toast = $("toast");
  function say(t) { if (toast) toast.textContent = t; }

  // Estadísticas: escaneo de QR, visita, reproducción, compartida
  function evento(t) {
    try { var d = JSON.stringify({ l: P.lengua, s: P.slug, t: t }); if (!(navigator.sendBeacon && navigator.sendBeacon("/api/evento", d))) fetch("/api/evento", { method: "POST", body: d, keepalive: true }); } catch (_) {}
  }
  var desdeQR = /(^|[?&])qr(=|&|$)/.test(location.search.slice(1));
  evento(desdeQR ? "qr" : "visita");
  if (desdeQR && history.replaceState) history.replaceState(null, "", location.pathname);
  var yaSono = false, yaCompartio = false;
  function compartida() { if (!yaCompartio) { yaCompartio = true; evento("compartir"); } }

  // Audio
  var play = $("play"), slow = $("slow"), a = null;
  function sonar(url) {
    if (!a) {
      a = new Audio(); a.preload = "auto";
      a.addEventListener("play", function () { document.body.classList.add("playing"); });
      a.addEventListener("ended", function () { document.body.classList.remove("playing"); });
      a.addEventListener("error", function () { say("No se pudo cargar el audio. Revisa tu conexión y vuelve a intentar."); document.body.classList.remove("playing"); });
    }
    if (a.src.indexOf(url) < 0) a.src = url;
    a.currentTime = 0;
    a.playbackRate = slow && slow.getAttribute("aria-pressed") === "true" ? 0.7 : 1;
    a.play().catch(function () {});
    if (!yaSono) { yaSono = true; evento("audio"); }
  }
  if (play && P.audios && P.audios.length) {
    play.onclick = function () { sonar(P.audios[0].url); };
    slow.onclick = function () { slow.setAttribute("aria-pressed", slow.getAttribute("aria-pressed") === "true" ? "false" : "true"); };
    document.querySelectorAll(".voz[data-i]").forEach(function (b) {
      b.onclick = function () { var x = P.audios[+b.dataset.i]; if (x) sonar(x.url); };
    });
  }

  // Copiar link
  var copy = $("copy");
  var wa = $("wa"); if (wa) wa.addEventListener("click", compartida);
  if (copy) copy.onclick = function () {
    compartida();
    if (navigator.clipboard) navigator.clipboard.writeText(P.url).then(function () { say("Link copiado."); }, function () { say(P.url); });
    else say(P.url);
  };

  // Imagen para historias
  var story = $("story");
  if (story) story.onclick = function () {
    story.disabled = true; say("Preparando la imagen…"); compartida();
    var listo = window.Imagenes ? Promise.resolve() : new Promise(function (r, j) {
      var s = document.createElement("script"); s.src = "/assets/imagenes.js"; s.onload = r; s.onerror = j; document.head.appendChild(s);
    });
    listo.then(function () {
      return window.Imagenes.historia({ palabra: P.palabra, es: P.es, tipo: P.tipo, imagen: P.imagen, marca: P.marca, enlace: P.url.replace(/^https?:\/\//, ""), slug: P.slug, acento: P.acento });
    }).then(function (c) { return window.Imagenes.aBlob(c); }).then(function (blob) {
      var file = new File([blob], P.slug + "-historia.png", { type: "image/png" });
      var msg = '¿Sabes cómo se dice "' + P.es + '"? Es ' + P.palabra + ". Escúchala: " + P.url;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: msg }).then(function () {
          say("Listo. En la historia agrega el link con un sticker de enlace para que la escuchen.");
        });
      }
      var u = URL.createObjectURL(blob), d = document.createElement("a");
      d.href = u; d.download = file.name; document.body.appendChild(d); d.click(); d.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      say("Imagen descargada. Súbela a tu historia y agrega el link con un sticker de enlace.");
    }).catch(function (e) {
      say(e && e.name === "AbortError" ? "" : "No se pudo crear la imagen en este navegador.");
    }).then(function () { story.disabled = false; });
  };
})();
