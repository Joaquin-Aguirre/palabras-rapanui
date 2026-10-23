// Panel de palabras: entrar, crear y editar palabras con audio e imagen,
// publicar al instante y sacar el QR y las imágenes para redes.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var state = { clave: "", marca: {}, palabras: [], actual: null, audio: null, img: null, quitarImg: false, kit: null };

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ŋ/gi, "ng").replace(/[ʻʼ‘’'`]/g, "")
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function say(el, t, kind) { el.textContent = t || ""; el.className = "msg" + (kind ? " " + kind : ""); }
  function base() { return (state.marca.dominio || location.origin).replace(/\/+$/, ""); }
  function host() { return base().replace(/^https?:\/\//, ""); }
  function urlDe(slug) { return base() + "/p/" + slug; }
  function guardarArchivo(blob, nombre) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
  }
  function copiar(texto, msgEl, ok) {
    var hecho = function () { say(msgEl, ok, "ok"); };
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(hecho, function () { say(msgEl, "No se pudo copiar. Selecciona el texto y cópialo a mano.", "err"); });
  }

  // ---------- API ----------
  async function api(ruta, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ authorization: "Bearer " + state.clave }, opts.headers || {});
    var r = await fetch("/api/admin/" + ruta, opts);
    var data = {};
    try { data = await r.json(); } catch (_) {}
    if (r.status === 401) { salir("La sesión se cerró. Vuelve a escribir la contraseña."); throw new Error("401"); }
    if (!r.ok) throw new Error(data.error || ("Error " + r.status));
    return data;
  }

  // ---------- entrada ----------
  function leerClave() { try { return sessionStorage.getItem("clave") || localStorage.getItem("clave") || ""; } catch (_) { return ""; } }
  function salir(msg) {
    state.clave = ""; try { sessionStorage.removeItem("clave"); localStorage.removeItem("clave"); } catch (_) {}
    $("vApp").hidden = true; $("vLogin").hidden = false; say($("msgLogin"), msg || "", msg ? "err" : ""); $("clave").focus();
  }
  $("fLogin").addEventListener("submit", async function (e) {
    e.preventDefault();
    state.clave = $("clave").value;
    say($("msgLogin"), "Entrando…");
    try {
      var r = await fetch("/api/admin/login", { method: "POST", headers: { authorization: "Bearer " + state.clave } });
      var d = {}; try { d = await r.json(); } catch (_) {}
      if (!r.ok) { say($("msgLogin"), d.error || "No se pudo entrar.", "err"); return; }
      try { ($("recordar").checked ? localStorage : sessionStorage).setItem("clave", state.clave); } catch (_) {}
      $("clave").value = ""; await iniciar();
    } catch (err) { say($("msgLogin"), "Sin conexión con el servidor.", "err"); }
  });
  $("salir").onclick = function () { salir(); };

  async function iniciar() {
    $("vLogin").hidden = true; $("vApp").hidden = false;
    var d = await api("catalogo");
    state.marca = d.marca; state.palabras = d.palabras;
    $("marcaNombre").textContent = state.marca.nombre || "Panel";
    llenarMarca(); lista(); nueva();
  }

  // ---------- pestañas ----------
  document.querySelectorAll(".tab").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.removeAttribute("aria-current"); });
      b.setAttribute("aria-current", "page");
      $("tabPalabras").hidden = b.dataset.tab !== "palabras";
      $("tabMarca").hidden = b.dataset.tab !== "marca";
    };
  });

  // ---------- lista ----------
  function lista() {
    var q = slugify($("buscar").value);
    var ps = state.palabras.filter(function (p) { return !q || slugify(p.palabra + " " + p.es).indexOf(q) >= 0; });
    $("conteo").textContent = "· " + state.palabras.length;
    $("items").innerHTML = ps.length ? ps.map(function (p) {
      var sel = state.actual && state.actual.slug === p.slug;
      return '<button type="button" class="item" data-slug="' + esc(p.slug) + '" aria-current="' + sel + '">' +
        '<span class="mini">' + (p.imagen ? '<img src="' + esc(p.imagen) + '" alt="">' : esc([...p.palabra][0] || "")) + "</span>" +
        '<span><span class="w" lang="rap">' + esc(p.palabra) + '</span><span class="t">' + esc(p.es) + "</span></span>" +
        '<span class="pills">' + (!p.publicada ? '<span class="pill off">Oculta</span>' : "") +
        '<span class="pill' + (p.validado ? " ok" : "") + '">' + (p.validado ? "Validada" : "Por validar") + "</span>" +
        (!p.audio ? '<span class="pill off">Sin audio</span>' : "") + "</span></button>";
    }).join("") : '<p class="hint">' + (state.palabras.length ? "Nada coincide con la búsqueda." : "Todavía no hay palabras. Crea la primera.") + "</p>";
  }
  $("buscar").addEventListener("input", lista);
  $("items").addEventListener("click", function (e) {
    var b = e.target.closest("[data-slug]"); if (!b) return;
    var p = state.palabras.find(function (x) { return x.slug === b.dataset.slug; });
    if (p) editar(p);
  });
  $("nueva").onclick = function () { nueva(); $("palabra").focus(); };

  // ---------- editor ----------
  function limpiarMedios() {
    if (state.audio && state.audio.url) URL.revokeObjectURL(state.audio.url);
    if (state.img && state.img.url) URL.revokeObjectURL(state.img.url);
    state.audio = null; state.img = null; state.quitarImg = false;
    $("audioFile").value = ""; $("imgFile").value = "";
  }
  function mostrarEditor() { $("kit").hidden = true; $("fPalabra").hidden = false; }

  function nueva() {
    state.actual = null; limpiarMedios(); mostrarEditor();
    $("edTitulo").textContent = "Nueva palabra";
    ["palabra", "es", "tipo", "en", "guia", "voz", "texto"].forEach(function (k) { $(k).value = ""; });
    $("validado").checked = false; $("publicada").checked = true;
    $("borrar").hidden = true; $("verKit").hidden = true; $("verPagina").hidden = true; $("confirmBorrar").hidden = true;
    $("guardar").textContent = "Guardar y publicar";
    pintarAudio(null); pintarImg(null); slugView(); say($("msg"), ""); lista();
  }
  function editar(p) {
    state.actual = p; limpiarMedios(); mostrarEditor();
    $("edTitulo").textContent = "Editar palabra";
    $("palabra").value = p.palabra; $("es").value = p.es; $("tipo").value = p.tipo || "";
    $("en").value = (p.en || []).join(", "); $("guia").value = p.guia || ""; $("voz").value = p.voz || ""; $("texto").value = p.texto || "";
    $("validado").checked = !!p.validado; $("publicada").checked = p.publicada !== false;
    $("borrar").hidden = false; $("verKit").hidden = false; $("confirmBorrar").hidden = true;
    $("verPagina").hidden = false; $("verPagina").href = "/p/" + p.slug;
    $("guardar").textContent = "Guardar cambios";
    pintarAudio(p.audio ? { url: p.audio, info: "Audio publicado. Graba o sube otro solo si quieres reemplazarlo." } : null);
    pintarImg(p.imagen || null); slugView(); say($("msg"), ""); lista();
    if (window.matchMedia("(max-width:820px)").matches) $("fPalabra").scrollIntoView({ behavior: "smooth" });
  }
  function slugView() {
    var s = state.actual ? state.actual.slug : slugify($("palabra").value);
    var dup = !state.actual && s && state.palabras.some(function (p) { return p.slug === s; });
    $("slugView").innerHTML = s ? "Dirección: <b>/p/" + esc(s) + "</b>" + (state.actual ? " · fija" : "") + (dup ? " · <b>ya existe</b>" : "") : "";
    $("imgLetter").textContent = [...$("palabra").value][0] || "";
  }
  $("palabra").addEventListener("input", slugView);
  document.querySelectorAll(".chars button").forEach(function (b) {
    b.addEventListener("click", function () {
      var el = $("palabra"), s = el.selectionStart == null ? el.value.length : el.selectionStart, e = el.selectionEnd == null ? s : el.selectionEnd;
      el.value = el.value.slice(0, s) + b.dataset.ch + el.value.slice(e);
      el.focus(); el.setSelectionRange(s + 1, s + 1); slugView();
    });
  });

  // ---------- audio: grabar, convertir, recortar ----------
  function pintarAudio(a) {
    var prev = $("audioPrev");
    if (a) { prev.src = a.url; prev.hidden = false; $("audioBox").classList.add("has"); $("audioInfo").textContent = a.info; }
    else { prev.removeAttribute("src"); prev.hidden = true; $("audioBox").classList.remove("has"); $("audioInfo").textContent = "Graba con el micrófono o sube un mp3, m4a o mp4. Se recortan los silencios y se convierte a mp3 solo."; }
  }
  function cargarLame() {
    return new Promise(function (res, rej) {
      if (window.lamejs) return res(window.lamejs);
      var s = document.createElement("script"); s.src = "/lib/lame.min.js";
      s.onload = function () { window.lamejs ? res(window.lamejs) : rej(new Error("conversor")); };
      s.onerror = function () { rej(new Error("conversor")); };
      document.head.appendChild(s);
    });
  }
  // Mono, sin silencios al inicio y al final, volumen parejo, mp3 96 kbps.
  async function procesarAudio(blob) {
    var lame = await cargarLame();
    var Ctx = window.AudioContext || window.webkitAudioContext, ctx = new Ctx();
    var buf = await new Promise(function (res, rej) {
      blob.arrayBuffer().then(function (ab) { var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }, rej);
    });
    if (ctx.close) ctx.close();
    var n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, mono = new Float32Array(n);
    for (var c = 0; c < ch; c++) { var d = buf.getChannelData(c); for (var i = 0; i < n; i++) mono[i] += d[i] / ch; }
    var pico = 0; for (i = 0; i < n; i++) { var v = Math.abs(mono[i]); if (v > pico) pico = v; }
    if (pico < 0.001) throw new Error("silencio");
    var umbral = Math.max(0.01, pico * 0.06), ini = 0, fin = n - 1;
    while (ini < n && Math.abs(mono[ini]) < umbral) ini++;
    while (fin > ini && Math.abs(mono[fin]) < umbral) fin--;
    var pad = Math.round(sr * 0.18); ini = Math.max(0, ini - pad); fin = Math.min(n - 1, fin + pad);
    var largo = fin - ini + 1, gan = Math.min(8, 0.89 / pico), pcm = new Int16Array(largo);
    var fade = Math.min(Math.round(sr * 0.02), largo / 4);
    for (i = 0; i < largo; i++) {
      var s = mono[ini + i] * gan;
      if (i < fade) s *= i / fade; else if (i > largo - fade) s *= (largo - i) / fade;
      s = Math.max(-1, Math.min(1, s)); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    var enc = new lame.Mp3Encoder(1, sr, 96), out = [];
    for (i = 0; i < largo; i += 1152) { var b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(new Uint8Array(b)); }
    var f = enc.flush(); if (f.length) out.push(new Uint8Array(f));
    return { blob: new Blob(out, { type: "audio/mpeg" }), segundos: largo / sr, original: n / sr };
  }
  async function usarAudio(blob, origen) {
    $("audioInfo").textContent = "Procesando audio…"; $("guardar").disabled = true;
    try {
      var r = await procesarAudio(blob);
      var url = URL.createObjectURL(r.blob);
      state.audio = { blob: r.blob, url: url };
      var rec = r.original - r.segundos > 0.3 ? " · se recortaron " + (r.original - r.segundos).toFixed(1) + " s de silencio" : "";
      pintarAudio({ url: url, info: origen + " · " + r.segundos.toFixed(1) + " s · " + Math.max(1, Math.round(r.blob.size / 1024)) + " KB" + rec + ". Escúchalo antes de guardar." });
    } catch (e) {
      if (e && e.message === "silencio") { pintarAudio(null); $("audioInfo").textContent = "El audio está en silencio. Revisa el micrófono y vuelve a grabar."; }
      else if (blob.size < 4 * 1024 * 1024 && /^(audio|video)\//.test(blob.type)) {
        var u = URL.createObjectURL(blob); state.audio = { blob: blob, url: u };
        pintarAudio({ url: u, info: origen + " · se sube tal cual (este navegador no pudo convertirlo)." });
      } else { pintarAudio(null); $("audioInfo").textContent = "No se pudo leer ese archivo. Prueba con mp3 o m4a, o grábalo aquí."; }
    }
    $("guardar").disabled = false;
  }
  $("audioFile").addEventListener("change", function () { var f = this.files[0]; if (f) usarAudio(f, f.name); });

  var grab = { rec: null, chunks: [], t0: 0, timer: null, stream: null };
  $("grabar").onclick = async function () {
    if (grab.rec && grab.rec.state === "recording") { grab.rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { $("audioInfo").textContent = "Este navegador no puede grabar. Sube un archivo de audio."; return; }
    try {
      grab.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    } catch (e) { $("audioInfo").textContent = "Sin permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones."; return; }
    grab.chunks = [];
    grab.rec = new MediaRecorder(grab.stream);
    grab.rec.ondataavailable = function (e) { if (e.data.size) grab.chunks.push(e.data); };
    grab.rec.onstop = function () {
      clearInterval(grab.timer); $("timer").hidden = true;
      grab.stream.getTracks().forEach(function (t) { t.stop(); });
      $("grabar").classList.remove("on"); $("grabarTxt").textContent = "Grabar de nuevo";
      usarAudio(new Blob(grab.chunks, { type: grab.rec.mimeType || "audio/webm" }), "Grabación");
    };
    grab.rec.start(); grab.t0 = Date.now();
    $("grabar").classList.add("on"); $("grabarTxt").textContent = "Detener"; $("timer").hidden = false; $("timer").textContent = "0:00";
    $("audioInfo").textContent = "Grabando. Di la palabra con calma, una o dos veces.";
    grab.timer = setInterval(function () {
      var s = Math.floor((Date.now() - grab.t0) / 1000); $("timer").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      if (s >= 30) grab.rec.stop();
    }, 250);
  };

  // ---------- imagen ----------
  function pintarImg(url) {
    var img = $("imgPrev");
    if (url) { img.src = url; img.hidden = false; $("imgLetter").hidden = true; $("quitarImg").hidden = false; $("imgBox").classList.add("has"); }
    else { img.hidden = true; img.removeAttribute("src"); $("imgLetter").hidden = false; $("quitarImg").hidden = true; $("imgBox").classList.remove("has"); }
  }
  // Ajusta a 800 px como máximo y conserva la transparencia.
  function prepararImagen(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 800 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("imagen")); }, "image/png");
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("imagen")); };
      im.src = u;
    });
  }
  $("imgFile").addEventListener("change", async function () {
    var f = this.files[0]; if (!f) return;
    try {
      var b = await prepararImagen(f);
      if (b.size > 2.4 * 1024 * 1024) { say($("msg"), "La imagen pesa mucho incluso reducida. Prueba con otra.", "err"); return; }
      var u = URL.createObjectURL(b); state.img = { blob: b, url: u }; state.quitarImg = false; pintarImg(u);
    } catch (_) { say($("msg"), "No se pudo leer esa imagen. Usa PNG o JPG.", "err"); }
  });
  $("quitarImg").onclick = function () { state.img = null; state.quitarImg = true; $("imgFile").value = ""; pintarImg(null); };

  // ---------- guardar ----------
  $("fPalabra").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("msg"), palabra = $("palabra").value.trim(), es = $("es").value.trim();
    if (!palabra) { say(msg, "Falta la palabra en rapa nui.", "err"); $("palabra").focus(); return; }
    if (!es) { say(msg, "Falta el significado en español.", "err"); $("es").focus(); return; }
    var nuevaP = !state.actual, slug = nuevaP ? slugify(palabra) : state.actual.slug;
    if (!slug) { say(msg, "La palabra necesita al menos una letra.", "err"); return; }
    if (nuevaP && state.palabras.some(function (p) { return p.slug === slug; })) { say(msg, "Ya existe /p/" + slug + ". Edítala desde la lista.", "err"); return; }
    var sinAudio = nuevaP ? !state.audio : (!state.actual.audio && !state.audio);
    if (sinAudio && !this.dataset.sinAudioOk) { this.dataset.sinAudioOk = "1"; say(msg, "No tiene audio. Si igual quieres guardarla, presiona de nuevo.", "err"); return; }
    delete this.dataset.sinAudioOk;

    var datos = {
      slugOriginal: nuevaP ? undefined : slug, palabra: palabra, es: es,
      tipo: $("tipo").value, guia: $("guia").value, voz: $("voz").value, texto: $("texto").value,
      en: $("en").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      validado: $("validado").checked, publicada: $("publicada").checked, quitarImagen: state.quitarImg,
    };
    var imgParaRedes = state.img ? state.img.url : (state.quitarImg ? null : (state.actual && state.actual.imagen) || null);

    $("guardar").disabled = true; say(msg, "Guardando…");
    try {
      var og = await Imagenes.aBlob(await Imagenes.og({ palabra: palabra, es: es, tipo: datos.tipo, imagen: imgParaRedes, host: host(), slug: slug }), "image/png");
      var fd = new FormData();
      fd.append("datos", JSON.stringify(datos));
      if (state.audio) fd.append("audio", state.audio.blob, slug + (state.audio.blob.type === "audio/mpeg" ? ".mp3" : ".audio"));
      if (state.img) fd.append("img", state.img.blob, slug + ".png");
      fd.append("og", og, slug + "-og.png");
      var r = await api("palabra", { method: "POST", body: fd });
      var p = r.palabra;
      var i = state.palabras.findIndex(function (x) { return x.slug === p.slug; });
      if (i >= 0) state.palabras[i] = p; else state.palabras.unshift(p);
      state.actual = p; limpiarMedios();
      abrirKit(p, nuevaP ? "Publicada" : "Guardada");
    } catch (err) {
      if (err.message !== "401") say(msg, "No se pudo guardar: " + err.message, "err");
    }
    $("guardar").disabled = false;
  });

  $("borrar").onclick = function () { $("confirmBorrar").hidden = false; };
  $("borrarNo").onclick = function () { $("confirmBorrar").hidden = true; };
  $("borrarSi").onclick = async function () {
    var p = state.actual; if (!p) return;
    try {
      await api("palabra/" + p.slug, { method: "DELETE" });
      state.palabras = state.palabras.filter(function (x) { return x.slug !== p.slug; });
      nueva(); say($("msg"), "Eliminada «" + p.palabra + "».", "ok");
    } catch (err) { if (err.message !== "401") say($("msg"), "No se pudo eliminar: " + err.message, "err"); }
  };

  // ---------- kit para redes ----------
  function qrSvg(texto) {
    var qr = qrcode(0, "M"); qr.addData(texto, "Byte"); qr.make();
    var n = qr.getModuleCount(), m = 4, t = n + m * 2, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" shape-rendering="crispEdges"><rect width="' + t + '" height="' + t + '" fill="#FFFFFF"/><path d="' + d + '" fill="#000000"/></svg>';
  }
  function svgAPng(svg, lado) {
    return new Promise(function (res) {
      var im = new Image(), u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      im.onload = function () { var c = document.createElement("canvas"); c.width = c.height = lado; var x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, lado, lado); URL.revokeObjectURL(u); c.toBlob(res, "image/png"); };
      im.src = u;
    });
  }
  function caption(p) {
    var m = state.marca, lineas = [p.palabra + " · " + p.es, ""];
    if (p.texto) lineas.push(p.texto, "");
    lineas.push("Escucha cómo se pronuncia en la voz de un hablante rapa nui: link en la bio" + (m.instagram ? " de @" + m.instagram : "") + ".");
    if (p.en && p.en.length) lineas.push("La encuentras en: " + p.en.join(", ").toLowerCase() + ".");
    if (m.programa) lineas.push("", m.programa);
    lineas.push("", ((m.hashtags || "") + " #" + slugify(p.palabra).replace(/-/g, "")).trim());
    return lineas.join("\n");
  }
  async function abrirKit(p, titulo) {
    $("fPalabra").hidden = true; $("kit").hidden = false; lista();
    $("kitPalabra").textContent = p.palabra + (titulo ? " · " + titulo.toLowerCase() : "");
    var url = urlDe(p.slug);
    $("kitURL").textContent = url; $("kitAbrir").href = "/p/" + p.slug;
    $("kitAvisoDominio").hidden = !!state.marca.dominio;
    var svg = qrSvg(url); $("kitQR").innerHTML = svg;
    $("caption").value = caption(p); say($("kitMsg"), "Generando imágenes…");
    var datos = { palabra: p.palabra, es: p.es, tipo: p.tipo, imagen: p.imagen || null, marca: state.marca.nombre, host: host(), slug: p.slug };
    var hist = await Imagenes.aBlob(await Imagenes.historia(datos));
    var post = await Imagenes.aBlob(await Imagenes.post(datos));
    if (state.kit) ["hist", "post"].forEach(function (k) { URL.revokeObjectURL(state.kit[k + "Url"]); });
    state.kit = { p: p, svg: svg, url: url, hist: hist, post: post, histUrl: URL.createObjectURL(hist), postUrl: URL.createObjectURL(post) };
    $("kitHistoria").src = state.kit.histUrl; $("kitPost").src = state.kit.postUrl;
    var puede = navigator.canShare && navigator.canShare({ files: [new File([hist], "a.png", { type: "image/png" })] });
    document.querySelectorAll(".share-btn").forEach(function (b) { b.hidden = !puede; });
    say($("kitMsg"), titulo ? titulo + " en " + url + ". Ya está en línea." : "", "ok");
    $("kit").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("verKit").onclick = function () { if (state.actual) abrirKit(state.actual, ""); };
  $("kitCerrar").onclick = function () { if (state.actual) editar(state.actual); else nueva(); };
  $("dlQRsvg").onclick = function () { guardarArchivo(new Blob([state.kit.svg], { type: "image/svg+xml" }), "qr-" + state.kit.p.slug + ".svg"); };
  $("dlQRpng").onclick = async function () { guardarArchivo(await svgAPng(state.kit.svg, 1200), "qr-" + state.kit.p.slug + ".png"); };
  $("dlHistoria").onclick = function () { guardarArchivo(state.kit.hist, state.kit.p.slug + "-historia.png"); };
  $("dlPost").onclick = function () { guardarArchivo(state.kit.post, state.kit.p.slug + "-post.png"); };
  document.querySelectorAll(".share-btn").forEach(function (b) {
    b.onclick = function () {
      var blob = b.dataset.que === "historia" ? state.kit.hist : state.kit.post;
      navigator.share({ files: [new File([blob], state.kit.p.slug + "-" + b.dataset.que + ".png", { type: "image/png" })], text: $("caption").value }).catch(function () {});
    };
  });
  $("copiarCaption").onclick = function () { copiar($("caption").value, $("kitMsg"), "Texto copiado. Pégalo en Instagram."); };
  $("copiarLink").onclick = function () { copiar(state.kit.url, $("kitMsg"), "Link copiado."); };

  // ---------- marca ----------
  var CAMPOS = { mNombre: "nombre", mInstagram: "instagram", mBajada: "bajada", mPrograma: "programa", mTienda: "tienda", mContacto: "contacto", mDominio: "dominio", mHashtags: "hashtags" };
  function llenarMarca() { Object.keys(CAMPOS).forEach(function (id) { $(id).value = state.marca[CAMPOS[id]] || ""; }); }
  $("fMarca").addEventListener("submit", async function (e) {
    e.preventDefault();
    var body = {}; Object.keys(CAMPOS).forEach(function (id) { body[CAMPOS[id]] = $(id).value; });
    try {
      var r = await api("marca", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      state.marca = r.marca; llenarMarca(); $("marcaNombre").textContent = state.marca.nombre || "Panel";
      say($("msgMarca"), "Guardado. Ya se ve en el sitio.", "ok");
    } catch (err) { if (err.message !== "401") say($("msgMarca"), "No se pudo guardar: " + err.message, "err"); }
  });

  // ---------- arranque ----------
  state.clave = leerClave();
  if (state.clave) iniciar().catch(function () { salir(); }); else salir();
})();
