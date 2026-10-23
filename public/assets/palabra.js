// Página de una palabra: escuchar, compartir y crear la imagen para historias.
(function () {
  var P = window.PALABRA; if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var toast = $("toast");
  function say(t) { if (toast) toast.textContent = t; }

  // Audio
  var play = $("play"), slow = $("slow");
  if (play && P.audio) {
    var a = new Audio(); a.preload = "auto"; a.src = P.audio;
    a.addEventListener("error", function () {
      var box = play.parentNode; box.outerHTML = '<div class="noaudio">No se pudo cargar el audio. Revisa tu conexión y recarga la página.</div>';
    });
    play.onclick = function () { a.currentTime = 0; a.playbackRate = slow.getAttribute("aria-pressed") === "true" ? 0.7 : 1; a.play().catch(function () {}); };
    slow.onclick = function () { slow.setAttribute("aria-pressed", slow.getAttribute("aria-pressed") === "true" ? "false" : "true"); };
    a.addEventListener("play", function () { document.body.classList.add("playing"); });
    a.addEventListener("ended", function () { document.body.classList.remove("playing"); });
  }

  // Copiar link
  var copy = $("copy");
  if (copy) copy.onclick = function () {
    if (navigator.clipboard) navigator.clipboard.writeText(P.url).then(function () { say("Link copiado."); }, function () { say(P.url); });
    else say(P.url);
  };

  // Imagen para historias
  var story = $("story");
  if (story) story.onclick = function () {
    story.disabled = true; say("Preparando la imagen…");
    var s = document.createElement("script"); s.src = "/assets/imagenes.js";
    var listo = window.Imagenes ? Promise.resolve() : new Promise(function (r, j) { s.onload = r; s.onerror = j; document.head.appendChild(s); });
    listo.then(function () {
      return window.Imagenes.historia({ palabra: P.palabra, es: P.es, tipo: P.tipo, imagen: P.imagen, marca: P.marca, host: P.host, slug: P.slug });
    }).then(function (c) { return window.Imagenes.aBlob(c); }).then(function (blob) {
      var file = new File([blob], P.slug + "-historia.png", { type: "image/png" });
      var msg = '¿Sabes cómo se dice "' + P.es + '" en rapa nui? Es ' + P.palabra + ". Escúchala: " + P.url;
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
