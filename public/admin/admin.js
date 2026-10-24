// Panel central IMITA: lenguas, palabras con varias voces y escrituras, personas con acceso,
// QR e imágenes para redes. Todo se publica al instante.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var S = { token: "", yo: null, lenguas: [], L: null, palabras: [], actual: null, audios: [], variantes: [], img: null, quitarImg: false, kit: null, personas: [], editPersona: null };

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slugify(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ŋ/gi, "ng").replace(/[ʻʼ‘’'`]/g, "")
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function say(el, t, kind) { el.textContent = t || ""; el.className = "msg" + (kind ? " " + kind : ""); }
  function guardarArchivo(blob, nombre) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
  }
  function copiar(texto, msgEl, ok) {
    if (!navigator.clipboard) { say(msgEl, "Selecciona el texto y cópialo a mano.", "err"); return; }
    navigator.clipboard.writeText(texto).then(function () { say(msgEl, ok, "ok"); }, function () { say(msgEl, "No se pudo copiar. Selecciona el texto y cópialo a mano.", "err"); });
  }
  function lista2arr(v) { return String(v || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean); }
  function nuevoToken(t) { if (!t) return; S.token = t; if (leerLocal("sesion")) guardarLocal("sesion", t); try { if (sessionStorage.getItem("sesion")) sessionStorage.setItem("sesion", t); } catch (_) {} }
  function guardarLocal(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }
  function leerLocal(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ""; } catch (_) { return ""; } }

  // ---------- API ----------
  async function api(ruta, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ authorization: "Bearer " + S.token }, opts.headers || {});
    if (opts.json !== undefined) { opts.body = JSON.stringify(opts.json); opts.headers["content-type"] = "application/json"; delete opts.json; }
    var r = await fetch("/api/admin/" + ruta, opts), d = {};
    try { d = await r.json(); } catch (_) {}
    if (r.status === 401) { salir("Tu sesión terminó. Vuelve a entrar."); throw new Error("401"); }
    if (!r.ok) throw new Error(d.error || "Error " + r.status);
    return d;
  }
  function fallo(el, prefijo) { return function (e) { if (e.message !== "401") say(el, prefijo + e.message, "err"); }; }

  // ---------- entrada ----------
  function salir(msg) {
    S.token = ""; guardarLocal("sesion", null); try { sessionStorage.removeItem("sesion"); } catch (_) {}
    $("vApp").hidden = true; $("vLogin").hidden = false; say($("msgLogin"), msg || "", msg ? "err" : "");
  }
  $("fLogin").addEventListener("submit", async function (e) {
    e.preventDefault(); say($("msgLogin"), "Entrando…");
    try {
      var r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ correo: $("correo").value, clave: $("clave").value }) });
      var d = {}; try { d = await r.json(); } catch (_) {}
      if (!r.ok) { say($("msgLogin"), d.error || "No se pudo entrar.", "err"); return; }
      S.token = d.token;
      if ($("recordar").checked) guardarLocal("sesion", d.token); else try { sessionStorage.setItem("sesion", d.token); } catch (_) {}
      $("clave").value = ""; await iniciar();
    } catch (_) { say($("msgLogin"), "Sin conexión con el servidor.", "err"); }
  });
  $("salir").onclick = function () { salir(); };

  async function iniciar(lenguaPreferida) {
    var d = await api("yo");
    S.yo = d.yo; S.lenguas = d.lenguas;
    $("vLogin").hidden = true; $("vApp").hidden = false;
    var general = S.yo.rol === "general";
    document.querySelectorAll(".tab.general").forEach(function (b) { b.hidden = !general; });
    document.querySelectorAll(".general-only").forEach(function (b) { b.hidden = !general; });
    $("cuentaInfo").textContent = (S.yo.nombre ? S.yo.nombre + " · " : "") + S.yo.correo + (general ? " · administración general" : "");
    $("cuentaClave").hidden = S.yo.correo === "admin";
    if (S.yo.correo === "admin") say($("msgCuenta"), "La contraseña de administración general se cambia en Netlify, en la variable ADMIN_PASSWORD.");
    $("lenguaSel").innerHTML = S.lenguas.map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.nombre) + (l.activa === false ? " (inactiva)" : "") + "</option>"; }).join("");
    $("selectorBox").hidden = S.lenguas.length < 2;
    $("sinLenguas").hidden = S.lenguas.length > 0;
    var id = lenguaPreferida || leerLocal("lengua");
    if (!S.lenguas.some(function (l) { return l.id === id; })) id = S.lenguas[0] && S.lenguas[0].id;
    if (id) { await cambiarLengua(id); mostrarTab("palabras"); } else mostrarTab(general ? "lenguas" : "cuenta");
    if (general) { pintarLenguas(); cargarPersonas(); }
  }
  $("lenguaSel").addEventListener("change", function () { cambiarLengua(this.value); });

  async function cambiarLengua(id) {
    S.L = S.lenguas.find(function (l) { return l.id === id; });
    guardarLocal("lengua", id); $("lenguaSel").value = id;
    document.documentElement.style.setProperty("--c", S.L.acento || "#E07A5C");
    $("verSitio").href = S.L.base;
    $("chars").innerHTML = (S.L.caracteres || []).map(function (c) { return '<button type="button" data-ch="' + esc(c) + '" aria-label="Insertar ' + esc(c) + '">' + esc(c) + "</button>"; }).join("");
    $("charsHint").textContent = S.L.caracteres && S.L.caracteres.length ? "Tal como va en la prenda. Usa los botones para los caracteres especiales." : "Tal como va en la prenda.";
    var sis = S.L.sistemas || [];
    $("sistemaBox").hidden = !sis.length;
    $("sistema").innerHTML = '<option value="">Sin especificar</option>' + sis.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
    llenarLengua();
    $("zipNombre").textContent = S.L.nombre;
    var d = await api("l/" + id + "/palabras");
    S.palabras = d.palabras; nueva();
    if (S.tab === "estadisticas") cargarStats();
    if (S.tab === "respaldos") cargarRespaldos();
  }

  // ---------- pestañas ----------
  function mostrarTab(t) {
    document.querySelectorAll(".tab").forEach(function (x) { if (x.dataset.tab === t) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
    $("tabPalabras").hidden = t !== "palabras"; $("tabLengua").hidden = t !== "lengua";
    $("tabLenguas").hidden = t !== "lenguas"; $("tabPersonas").hidden = t !== "personas"; $("tabCuenta").hidden = t !== "cuenta";
    $("tabEstadisticas").hidden = t !== "estadisticas"; $("tabRespaldos").hidden = t !== "respaldos"; $("tabActividad").hidden = t !== "actividad";
    if (t === "actividad") cargarActividad();
    S.tab = t;
    if (t === "estadisticas" && S.L) cargarStats();
    if (t === "respaldos" && S.L) cargarRespaldos();
  }
  document.querySelectorAll(".tab").forEach(function (b) { b.onclick = function () { mostrarTab(b.dataset.tab); }; });

  // ================= PALABRAS =================
  function lista() {
    var q = slugify($("buscar").value);
    var ps = S.palabras.filter(function (p) { return !q || slugify(p.palabra + " " + p.es).indexOf(q) >= 0; });
    $("conteo").textContent = "· " + S.palabras.length;
    $("items").innerHTML = ps.length ? ps.map(function (p) {
      var sel = S.actual && S.actual.slug === p.slug;
      var conVoz = (p.audios || []).filter(function (a) { return a.consentimiento && a.consentimiento.ok; }).length;
      return '<button type="button" class="item" data-slug="' + esc(p.slug) + '" aria-current="' + sel + '">' +
        '<span class="mini">' + (p.imagen ? '<img src="' + esc(p.imagen) + '" alt="">' : esc(Array.from(p.palabra)[0] || "")) + "</span>" +
        '<span><span class="w" lang="und">' + esc(p.palabra) + '</span><span class="t">' + esc(p.es) + "</span></span>" +
        '<span class="pills">' + (!p.publicada ? '<span class="pill off">Oculta</span>' : "") +
        '<span class="pill' + (p.validado ? " ok" : "") + '">' + (p.validado ? "Validada" : "Por validar") + "</span>" +
        (!conVoz ? '<span class="pill off">Sin voz</span>' : "") + "</span></button>";
    }).join("") : '<p class="hint">' + (S.palabras.length ? "Nada coincide con la búsqueda." : "Todavía no hay palabras en " + esc(S.L.nombre) + ". Crea la primera.") + "</p>";
  }
  $("buscar").addEventListener("input", lista);
  $("items").addEventListener("click", function (e) {
    var b = e.target.closest("[data-slug]"); if (!b) return;
    var p = S.palabras.find(function (x) { return x.slug === b.dataset.slug; }); if (p) editar(p);
  });
  $("nueva").onclick = function () { mostrarTab("palabras"); nueva(); $("palabra").focus(); };

  function soltarMedios() {
    S.audios.forEach(function (a) { if (a.nuevo && a.url) URL.revokeObjectURL(a.url); });
    if (S.img && S.img.url) URL.revokeObjectURL(S.img.url);
    S.audios = []; S.img = null; S.quitarImg = false; $("audioFile").value = ""; $("imgFile").value = "";
  }
  function mostrarEditor() { $("kit").hidden = true; $("fPalabra").hidden = false; }

  function nueva() {
    S.actual = null; soltarMedios(); mostrarEditor(); S.variantes = [];
    $("edTitulo").textContent = "Nueva palabra";
    ["palabra", "es", "tipo", "en", "guia", "texto", "validadoPor"].forEach(function (k) { $(k).value = ""; });
    $("sistema").value = ""; $("validado").checked = false; $("publicada").checked = true; $("validadoPorBox").hidden = true;
    $("borrar").hidden = true; $("verKit").hidden = true; $("verPagina").hidden = true; $("confirmBorrar").hidden = true;
    $("guardar").textContent = "Guardar y publicar";
    pintarVariantes(); pintarAudios(); pintarImg(null); slugView(); say($("msg"), ""); lista();
  }
  function editar(p) {
    S.actual = p; soltarMedios(); mostrarEditor();
    $("edTitulo").textContent = "Editar palabra";
    $("palabra").value = p.palabra; $("es").value = p.es; $("tipo").value = p.tipo || ""; $("sistema").value = p.sistema || "";
    $("en").value = (p.en || []).join(", "); $("guia").value = p.guia || ""; $("texto").value = p.texto || "";
    $("validado").checked = !!p.validado; $("validadoPor").value = p.validadoPor || ""; $("validadoPorBox").hidden = !p.validado;
    $("publicada").checked = p.publicada !== false;
    S.variantes = (p.variantes || []).map(function (v) { return { texto: v.texto, sistema: v.sistema }; });
    S.audios = (p.audios || []).map(function (a) { return { id: a.id, url: a.url, voz: a.voz || "", variante: a.variante || "", ok: !!(a.consentimiento && a.consentimiento.ok), nota: (a.consentimiento && a.consentimiento.nota) || "" }; });
    $("borrar").hidden = false; $("verKit").hidden = false; $("confirmBorrar").hidden = true;
    $("verPagina").hidden = false; $("verPagina").href = S.L.base + "/p/" + p.slug;
    $("guardar").textContent = "Guardar cambios";
    pintarVariantes(); pintarAudios(); pintarImg(p.imagen || null); slugView(); say($("msg"), ""); lista();
    if (window.matchMedia("(max-width:820px)").matches) $("fPalabra").scrollIntoView({ behavior: "smooth" });
  }
  function slugView() {
    var s = S.actual ? S.actual.slug : slugify($("palabra").value);
    var dup = !S.actual && s && S.palabras.some(function (p) { return p.slug === s; });
    $("slugView").innerHTML = s ? "Dirección: <b>/p/" + esc(s) + "</b>" + (S.actual ? " · fija" : "") + (dup ? " · <b>ya existe</b>" : "") : "";
    $("imgLetter").textContent = Array.from($("palabra").value)[0] || "";
  }
  $("palabra").addEventListener("input", slugView);
  $("validado").addEventListener("change", function () { $("validadoPorBox").hidden = !this.checked; });
  // Caracteres especiales: insertan en el campo de texto que tenga el foco (palabra o variante).
  var ultimoCampo = null;
  document.addEventListener("focusin", function (e) { if (e.target.matches && e.target.matches("#palabra, .var-texto")) ultimoCampo = e.target; });
  $("chars").addEventListener("mousedown", function (e) { if (e.target.closest("button")) e.preventDefault(); });
  $("chars").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var el = ultimoCampo || $("palabra"), s = el.selectionStart == null ? el.value.length : el.selectionStart, f = el.selectionEnd == null ? s : el.selectionEnd;
    el.value = el.value.slice(0, s) + b.dataset.ch + el.value.slice(f);
    el.focus(); el.setSelectionRange(s + b.dataset.ch.length, s + b.dataset.ch.length);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // ---------- variantes de escritura ----------
  function pintarVariantes() {
    var sis = S.L ? S.L.sistemas || [] : [];
    $("variantes").innerHTML = S.variantes.map(function (v, i) {
      return '<div class="var-row" data-i="' + i + '"><input type="text" class="var-texto" value="' + esc(v.texto) + '" placeholder="Otra forma de escribirla" aria-label="Otra forma de escribirla" spellcheck="false" autocapitalize="off">' +
        (sis.length ? '<select class="var-sis" aria-label="Alfabeto"><option value="">Alfabeto…</option>' + sis.map(function (s) { return "<option" + (s === v.sistema ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>" : '<input type="text" class="var-sis" value="' + esc(v.sistema) + '" placeholder="Alfabeto o zona (opcional)" aria-label="Alfabeto o zona">') +
        '<button type="button" class="link var-x">Quitar</button></div>';
    }).join("");
  }
  $("addVariante").onclick = function () { S.variantes.push({ texto: "", sistema: "" }); pintarVariantes(); var ins = $("variantes").querySelectorAll(".var-texto"); ins[ins.length - 1].focus(); };
  $("variantes").addEventListener("input", function (e) {
    var r = e.target.closest(".var-row"); if (!r) return; var v = S.variantes[+r.dataset.i];
    if (e.target.classList.contains("var-texto")) v.texto = e.target.value; else v.sistema = e.target.value;
  });
  $("variantes").addEventListener("change", function (e) { var r = e.target.closest(".var-row"); if (r && e.target.classList.contains("var-sis")) S.variantes[+r.dataset.i].sistema = e.target.value; });
  $("variantes").addEventListener("click", function (e) { if (!e.target.classList.contains("var-x")) return; S.variantes.splice(+e.target.closest(".var-row").dataset.i, 1); pintarVariantes(); });

  // ---------- voces ----------
  function pintarAudios() {
    var vis = S.audios.filter(function (a) { return !a.quitar; });
    $("audios").innerHTML = S.audios.map(function (a, i) {
      if (a.quitar) return "";
      var n = vis.indexOf(a);
      return '<div class="voz-row' + (a.nuevo ? " nueva" : "") + (!a.ok ? " sin" : "") + '" data-i="' + i + '">' +
        '<div class="voz-head"><b>' + (n === 0 ? "Voz principal" : "Voz " + (n + 1)) + (a.nuevo ? " · nueva" : "") + '</b><span class="inline">' +
        (n > 0 ? '<button type="button" class="link a-principal">Hacer principal</button>' : "") + '<button type="button" class="link a-quitar">Quitar</button></span></div>' +
        '<audio controls preload="none" src="' + esc(a.url) + '"></audio>' + (a.info ? '<span class="hint">' + esc(a.info) + "</span>" : "") +
        '<div class="row"><div class="f"><label>Quién habla</label><input type="text" class="a-voz" value="' + esc(a.voz) + '" placeholder="Nombre de la persona"></div>' +
        '<div class="f"><label>Variante o zona (opcional)</label><input type="text" class="a-var" value="' + esc(a.variante) + '"></div></div>' +
        '<label class="check"><input type="checkbox" class="a-ok"' + (a.ok ? " checked" : "") + '> <span><b>La persona autorizó publicar su voz.</b> Sin esto, la voz se guarda pero no se publica.</span></label>' +
        '<input type="text" class="a-nota" value="' + esc(a.nota) + '" placeholder="Detalle de la autorización (opcional): fecha, por escrito, en audio…" aria-label="Detalle de la autorización"></div>';
    }).join("");
  }
  $("audios").addEventListener("input", function (e) {
    var r = e.target.closest(".voz-row"); if (!r) return; var a = S.audios[+r.dataset.i];
    if (e.target.classList.contains("a-voz")) a.voz = e.target.value;
    else if (e.target.classList.contains("a-var")) a.variante = e.target.value;
    else if (e.target.classList.contains("a-nota")) a.nota = e.target.value;
  });
  $("audios").addEventListener("change", function (e) {
    if (!e.target.classList.contains("a-ok")) return;
    var r = e.target.closest(".voz-row"); S.audios[+r.dataset.i].ok = e.target.checked; r.classList.toggle("sin", !e.target.checked);
  });
  $("audios").addEventListener("click", function (e) {
    var r = e.target.closest(".voz-row"); if (!r) return; var i = +r.dataset.i;
    if (e.target.classList.contains("a-quitar")) { if (S.audios[i].nuevo) S.audios.splice(i, 1); else S.audios[i].quitar = true; pintarAudios(); }
    if (e.target.classList.contains("a-principal")) { var a = S.audios.splice(i, 1)[0]; S.audios.unshift(a); pintarAudios(); }
  });

  function cargarLame() {
    return new Promise(function (res, rej) {
      if (window.lamejs) return res(window.lamejs);
      var s = document.createElement("script"); s.src = "/lib/lame.min.js";
      s.onload = function () { window.lamejs ? res(window.lamejs) : rej(new Error("conversor")); };
      s.onerror = function () { rej(new Error("conversor")); }; document.head.appendChild(s);
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
    var n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, mono = new Float32Array(n), i;
    for (var c = 0; c < ch; c++) { var d = buf.getChannelData(c); for (i = 0; i < n; i++) mono[i] += d[i] / ch; }
    var pico = 0; for (i = 0; i < n; i++) { var v = Math.abs(mono[i]); if (v > pico) pico = v; }
    if (pico < 0.001) throw new Error("silencio");
    var umbral = Math.max(0.01, pico * 0.06), ini = 0, fin = n - 1;
    while (ini < n && Math.abs(mono[ini]) < umbral) ini++;
    while (fin > ini && Math.abs(mono[fin]) < umbral) fin--;
    var pad = Math.round(sr * 0.18); ini = Math.max(0, ini - pad); fin = Math.min(n - 1, fin + pad);
    var largo = fin - ini + 1, gan = Math.min(8, 0.89 / pico), pcm = new Int16Array(largo), fade = Math.min(Math.round(sr * 0.02), largo / 4);
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
  async function agregarVoz(blob, origen) {
    $("audioInfo").textContent = "Procesando audio…"; $("guardar").disabled = true;
    try {
      var r = await procesarAudio(blob), url = URL.createObjectURL(r.blob);
      var rec = r.original - r.segundos > 0.3 ? " · se recortaron " + (r.original - r.segundos).toFixed(1) + " s de silencio" : "";
      S.audios.push({ nuevo: true, blob: r.blob, url: url, voz: "", variante: "", ok: false, nota: "", info: origen + " · " + r.segundos.toFixed(1) + " s · " + Math.max(1, Math.round(r.blob.size / 1024)) + " KB" + rec });
      $("audioInfo").textContent = "Voz agregada. Escúchala, escribe quién habla y marca la autorización.";
    } catch (e) {
      if (e && e.message === "silencio") $("audioInfo").textContent = "El audio está en silencio. Revisa el micrófono y vuelve a grabar.";
      else if (blob.size < 4 * 1024 * 1024 && /^(audio|video)\//.test(blob.type)) {
        S.audios.push({ nuevo: true, blob: blob, url: URL.createObjectURL(blob), voz: "", variante: "", ok: false, nota: "", info: origen + " · se sube tal cual (este navegador no pudo convertirlo)" });
        $("audioInfo").textContent = "Voz agregada sin convertir.";
      } else $("audioInfo").textContent = "No se pudo leer ese archivo. Prueba con mp3 o m4a, o grábalo aquí.";
    }
    pintarAudios(); $("guardar").disabled = false;
  }
  $("audioFile").addEventListener("change", function () { var f = this.files[0]; if (f) agregarVoz(f, f.name); this.value = ""; });

  var G = { rec: null, chunks: [], t0: 0, timer: null, stream: null };
  $("grabar").onclick = async function () {
    if (G.rec && G.rec.state === "recording") { G.rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { $("audioInfo").textContent = "Este navegador no puede grabar. Sube un archivo de audio."; return; }
    try { G.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } }); }
    catch (_) { $("audioInfo").textContent = "Sin permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones."; return; }
    G.chunks = []; G.rec = new MediaRecorder(G.stream);
    G.rec.ondataavailable = function (e) { if (e.data.size) G.chunks.push(e.data); };
    G.rec.onstop = function () {
      clearInterval(G.timer); $("timer").hidden = true; G.stream.getTracks().forEach(function (t) { t.stop(); });
      $("grabar").classList.remove("on"); $("grabarTxt").textContent = "Grabar otra voz";
      agregarVoz(new Blob(G.chunks, { type: G.rec.mimeType || "audio/webm" }), "Grabación");
    };
    G.rec.start(); G.t0 = Date.now();
    $("grabar").classList.add("on"); $("grabarTxt").textContent = "Detener"; $("timer").hidden = false; $("timer").textContent = "0:00";
    $("audioInfo").textContent = "Grabando. Di la palabra con calma, una o dos veces.";
    G.timer = setInterval(function () {
      var s = Math.floor((Date.now() - G.t0) / 1000); $("timer").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      if (s >= 30) G.rec.stop();
    }, 250);
  };

  // ---------- imagen ----------
  function pintarImg(url) {
    var img = $("imgPrev");
    if (url) { img.src = url; img.hidden = false; $("imgLetter").hidden = true; $("quitarImg").hidden = false; $("imgBox").classList.add("has"); }
    else { img.hidden = true; img.removeAttribute("src"); $("imgLetter").hidden = false; $("quitarImg").hidden = true; $("imgBox").classList.remove("has"); }
  }
  function prepararImagen(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 800 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("imagen")); }, "image/png");
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("imagen")); }; im.src = u;
    });
  }
  $("imgFile").addEventListener("change", async function () {
    var f = this.files[0]; if (!f) return;
    try {
      var b = await prepararImagen(f);
      if (b.size > 2.4 * 1024 * 1024) { say($("msg"), "La imagen pesa mucho incluso reducida. Prueba con otra.", "err"); return; }
      var u = URL.createObjectURL(b); S.img = { blob: b, url: u }; S.quitarImg = false; pintarImg(u);
    } catch (_) { say($("msg"), "No se pudo leer esa imagen. Usa PNG o JPG.", "err"); }
  });
  $("quitarImg").onclick = function () { S.img = null; S.quitarImg = true; $("imgFile").value = ""; pintarImg(null); };

  // ---------- guardar ----------
  function datosImagenes(p, imagen) {
    var enlace = (S.L.base + "/p/" + p.slug).replace(/^https?:\/\//, "");
    return { palabra: p.palabra, es: p.es, tipo: p.tipo, imagen: imagen, marca: S.L.marca.nombre || S.L.nombre, enlace: enlace, slug: p.slug, acento: S.L.acento };
  }
  $("fPalabra").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("msg"), palabra = $("palabra").value.trim(), es = $("es").value.trim();
    if (!palabra) { say(msg, "Falta la palabra.", "err"); $("palabra").focus(); return; }
    if (!es) { say(msg, "Falta el significado en español.", "err"); $("es").focus(); return; }
    var nuevaP = !S.actual, slug = nuevaP ? slugify(palabra) : S.actual.slug;
    if (!slug) { say(msg, "La palabra necesita al menos una letra.", "err"); return; }
    if (nuevaP && S.palabras.some(function (p) { return p.slug === slug; })) { say(msg, "Ya existe /p/" + slug + ". Edítala desde la lista.", "err"); return; }
    var vivas = S.audios.filter(function (a) { return !a.quitar; });
    var aviso = !vivas.length ? "No tiene ninguna voz." : (!vivas.some(function (a) { return a.ok; }) ? "Ninguna voz tiene autorización, así que no se escuchará en el sitio." : "");
    if (aviso && this.dataset.confirmado !== aviso) { this.dataset.confirmado = aviso; say(msg, aviso + " Si igual quieres guardar, presiona de nuevo.", "err"); return; }
    delete this.dataset.confirmado;

    var fd = new FormData(), k = 0;
    var datos = {
      slugOriginal: nuevaP ? undefined : slug, vBase: nuevaP ? undefined : S.actual.v, palabra: palabra, es: es,
      tipo: $("tipo").value, guia: $("guia").value, texto: $("texto").value, sistema: $("sistema").value,
      en: lista2arr($("en").value), variantes: S.variantes.filter(function (v) { return v.texto.trim(); }),
      validado: $("validado").checked, validadoPor: $("validado").checked ? $("validadoPor").value : "",
      publicada: $("publicada").checked, quitarImagen: S.quitarImg,
      audios: S.audios.map(function (a) {
        var base = { voz: a.voz, variante: a.variante, consentimiento: { ok: a.ok, nota: a.nota } };
        if (a.nuevo) { var campo = "audio_" + k++; fd.append(campo, a.blob, slug + (a.blob.type === "audio/mpeg" ? ".mp3" : ".audio")); base.archivo = campo; return base; }
        base.id = a.id; if (a.quitar) base.quitar = true; return base;
      }),
    };
    var imgRedes = S.img ? S.img.url : (S.quitarImg ? null : (S.actual && S.actual.imagen) || null);
    $("guardar").disabled = true; say(msg, "Guardando…");
    try {
      var og = await Imagenes.aBlob(await Imagenes.og(datosImagenes({ palabra: palabra, es: es, tipo: datos.tipo, slug: slug }, imgRedes)), "image/png");
      fd.append("datos", JSON.stringify(datos));
      if (S.img) fd.append("img", S.img.blob, slug + ".png");
      fd.append("og", og, slug + "-og.png");
      var r = await api("l/" + S.L.id + "/palabra", { method: "POST", body: fd });
      var p = r.palabra, i = S.palabras.findIndex(function (x) { return x.slug === p.slug; });
      if (i >= 0) S.palabras[i] = p; else S.palabras.unshift(p);
      S.actual = p; soltarMedios();
      abrirKit(p, nuevaP ? "Publicada" : "Guardada");
    } catch (err) {
      fallo(msg, "No se pudo guardar: ")(err);
      if (/Otra persona/.test(err.message)) { try { S.palabras = (await api("l/" + S.L.id + "/palabras")).palabras; lista(); } catch (_) {} }
    }
    $("guardar").disabled = false;
  });

  $("borrar").onclick = function () { $("confirmBorrar").hidden = false; };
  $("borrarNo").onclick = function () { $("confirmBorrar").hidden = true; };
  $("borrarSi").onclick = async function () {
    var p = S.actual; if (!p) return;
    try {
      await api("l/" + S.L.id + "/palabra/" + p.slug, { method: "DELETE" });
      S.palabras = S.palabras.filter(function (x) { return x.slug !== p.slug; });
      nueva(); say($("msg"), "Eliminada «" + p.palabra + "».", "ok");
    } catch (err) { fallo($("msg"), "No se pudo eliminar: ")(err); }
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
    var m = S.L.marca, lineas = [p.palabra + " · " + p.es, ""];
    if (p.texto) lineas.push(p.texto, "");
    lineas.push("Escucha cómo se pronuncia en la voz de un hablante: link en la bio" + (m.instagram ? " de @" + m.instagram : "") + ".");
    if (p.en && p.en.length) lineas.push("La encuentras en: " + p.en.join(", ").toLowerCase() + ".");
    if (m.programa) lineas.push("", m.programa);
    lineas.push("", ((m.hashtags || "") + " #" + slugify(p.palabra).replace(/-/g, "")).trim());
    return lineas.join("\n");
  }
  async function abrirKit(p, titulo) {
    $("fPalabra").hidden = true; $("kit").hidden = false; lista();
    $("kitPalabra").textContent = p.palabra + (titulo ? " · " + titulo.toLowerCase() : "");
    var url = S.L.base + "/p/" + p.slug;
    $("kitURL").textContent = url + " · cada escaneo se cuenta en Estadísticas"; $("kitAbrir").href = url;
    $("kitAvisoDominio").hidden = !!(S.L.dominios && S.L.dominios.length);
    var svg = qrSvg(url + "?qr"); $("kitQR").innerHTML = svg;
    $("caption").value = caption(p); say($("kitMsg"), "Generando imágenes…");
    var datos = datosImagenes(p, p.imagen || null);
    var hist = await Imagenes.aBlob(await Imagenes.historia(datos)), post = await Imagenes.aBlob(await Imagenes.post(datos));
    if (S.kit) { URL.revokeObjectURL(S.kit.histUrl); URL.revokeObjectURL(S.kit.postUrl); }
    S.kit = { p: p, svg: svg, url: url, hist: hist, post: post, histUrl: URL.createObjectURL(hist), postUrl: URL.createObjectURL(post) };
    $("kitHistoria").src = S.kit.histUrl; $("kitPost").src = S.kit.postUrl;
    var puede = navigator.canShare && navigator.canShare({ files: [new File([hist], "a.png", { type: "image/png" })] });
    document.querySelectorAll(".share-btn").forEach(function (b) { b.hidden = !puede; });
    say($("kitMsg"), titulo ? titulo + " en " + url + "." : "", "ok");
    $("kit").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("verKit").onclick = function () { if (S.actual) abrirKit(S.actual, ""); };
  $("kitCerrar").onclick = function () { if (S.actual) editar(S.actual); else nueva(); };
  $("dlQRsvg").onclick = function () { guardarArchivo(new Blob([S.kit.svg], { type: "image/svg+xml" }), "qr-" + S.L.id + "-" + S.kit.p.slug + ".svg"); };
  $("dlQRpng").onclick = async function () { guardarArchivo(await svgAPng(S.kit.svg, 1200), "qr-" + S.L.id + "-" + S.kit.p.slug + ".png"); };
  $("dlHistoria").onclick = function () { guardarArchivo(S.kit.hist, S.kit.p.slug + "-historia.png"); };
  $("dlPost").onclick = function () { guardarArchivo(S.kit.post, S.kit.p.slug + "-post.png"); };
  document.querySelectorAll(".share-btn").forEach(function (b) {
    b.onclick = function () {
      var blob = b.dataset.que === "historia" ? S.kit.hist : S.kit.post;
      navigator.share({ files: [new File([blob], S.kit.p.slug + "-" + b.dataset.que + ".png", { type: "image/png" })], text: $("caption").value }).catch(function () {});
    };
  });
  $("copiarCaption").onclick = function () { copiar($("caption").value, $("kitMsg"), "Texto copiado. Pégalo en Instagram."); };
  $("copiarLink").onclick = function () { copiar(S.kit.url, $("kitMsg"), "Link copiado."); };


  // ================= ESTADÍSTICAS =================
  function fmt(n) { return (n || 0).toLocaleString("es-CL"); }
  function nombreMes(m) { var p = m.split("-"); return new Date(+p[0], +p[1] - 1, 15).toLocaleDateString("es-CL", { month: "long", year: "numeric" }); }
  async function cargarStats(mes) {
    $("stTitulo").textContent = "Estadísticas · " + S.L.nombre;
    try {
      var r = await api("l/" + S.L.id + "/estadisticas" + (mes ? "?mes=" + mes : ""));
      $("stMes").innerHTML = r.meses.map(function (m) { return '<option value="' + m + '"' + (m === r.mes ? " selected" : "") + ">" + esc(nombreMes(m)) + "</option>"; }).join("");
      var d = r.datos, t = { q: 0, v: 0, a: 0, c: 0 };
      Object.keys(d).forEach(function (k) { ["q", "v", "a", "c"].forEach(function (c) { t[c] += d[k][c] || 0; }); });
      $("stKpis").innerHTML = [["q", "Escaneos de QR"], ["v", "Otras visitas"], ["a", "Reproducciones"], ["c", "Veces compartida"]]
        .map(function (x) { return '<div class="kpi"><b>' + fmt(t[x[0]]) + "</b><span>" + x[1] + "</span></div>"; }).join("");
      // Días del mes
      var p = r.mes.split("-"), nd = new Date(+p[0], +p[1], 0).getDate(), max = 1, dias = [];
      for (var i = 1; i <= nd; i++) { var k = r.mes + "-" + String(i).padStart(2, "0"), n = r.dias[k] || 0; dias.push([k, n]); if (n > max) max = n; }
      $("stDias").innerHTML = dias.map(function (x) {
        return '<span class="dia' + (x[1] ? "" : " cero") + '" style="height:' + Math.max(2, Math.round((x[1] / max) * 100)) + '%" title="' + esc(x[0].slice(8) + " · " + fmt(x[1]) + " visitas") + '"></span>';
      }).join("");
      // Por palabra
      var porSlug = {}; S.palabras.forEach(function (w) { porSlug[w.slug] = w; });
      var filas = Object.keys(d).filter(function (k) { return k !== "_"; }).map(function (k) { return { k: k, x: d[k], tot: (d[k].q || 0) + (d[k].v || 0) }; })
        .sort(function (a, b) { return b.tot - a.tot; });
      var top = filas.length ? filas[0].tot || 1 : 1;
      $("stFilas").innerHTML = filas.length ? filas.map(function (f) {
        var w = porSlug[f.k];
        return "<tr><td><span class=\"w\" lang=\"und\">" + esc(w ? w.palabra : f.k) + "</span>" + (w ? ' <span class="muted">' + esc(w.es) + "</span>" : ' <span class="muted">(eliminada)</span>') +
          '<span class="barra" style="width:' + Math.round((f.tot / top) * 80) + 'px"></span></td><td>' + fmt(f.x.q) + "</td><td>" + fmt(f.x.v) + "</td><td>" + fmt(f.x.a) + "</td><td>" + fmt(f.x.c) + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="muted">Todavía no hay visitas este mes.</td></tr>';
    } catch (err) { if (err.message !== "401") $("stKpis").innerHTML = '<p class="msg err">No se pudieron cargar: ' + esc(err.message) + "</p>"; }
  }
  $("stMes").addEventListener("change", function () { cargarStats(this.value); });

  // ================= RESPALDOS =================
  async function cargarRespaldos() {
    $("zipNombre").textContent = S.L.nombre;
    try {
      var r = await api("l/" + S.L.id + "/papelera");
      $("papelera").innerHTML = r.items.length ? r.items.map(function (x) {
        return '<div class="fila"><span class="grow"><b lang="und">' + esc(x.palabra) + '</b> <span class="muted">· ' + esc(x.es) + '</span><br><span class="hint">Eliminada el ' + esc(new Date(x.borrada).toLocaleDateString("es-CL")) + (x.por ? " por " + esc(x.por) : "") + "</span></span>" +
          '<button type="button" class="btn ghost sm" data-restaurar="' + esc(x.id) + '">Restaurar</button></div>';
      }).join("") : '<p class="hint">La papelera está vacía.</p>';
    } catch (err) { fallo($("msgPapelera"), "")(err); }
    if (S.yo.rol === "general") {
      try {
        var c = await api("respaldos");
        $("copias").innerHTML = c.respaldos.length ? c.respaldos.map(function (f) {
          return '<div class="fila"><span class="grow"><b>' + esc(new Date(f + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })) + '</b></span><button type="button" class="link" data-copia="' + esc(f) + '">Descargar</button></div>';
        }).join("") : '<p class="hint">La primera copia automática se crea esta noche.</p>';
      } catch (_) {}
    }
  }
  $("papelera").addEventListener("click", async function (e) {
    var id = e.target.dataset.restaurar; if (!id) return;
    e.target.disabled = true;
    try {
      await api("l/" + S.L.id + "/papelera/" + encodeURIComponent(id) + "/restaurar", { method: "POST" });
      S.palabras = (await api("l/" + S.L.id + "/palabras")).palabras; lista();
      say($("msgPapelera"), "Restaurada. Ya está de nuevo en la colección y en el sitio.", "ok"); cargarRespaldos();
    } catch (err) { fallo($("msgPapelera"), "No se pudo restaurar: ")(err); e.target.disabled = false; }
  });
  $("copias").addEventListener("click", async function (e) {
    var f = e.target.dataset.copia; if (!f) return;
    try { var r = await api("respaldos/" + f); guardarArchivo(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }), "imita-copia-" + f + ".json"); } catch (_) {}
  });

  async function armarZip(lenguas) {
    var archivos = [], total = 0, hechos = 0, hoy = new Date().toISOString().slice(0, 10);
    var resumen = { tipo: "imita-respaldo", version: 1, fecha: new Date().toISOString(), lenguas: [] };
    for (var i = 0; i < lenguas.length; i++) {
      var r = await api("l/" + lenguas[i].id + "/respaldo");
      resumen.lenguas.push(r);
      r.palabras.forEach(function (p) { total += p.archivos.length; });
    }
    archivos.push({ nombre: "datos.json", datos: JSON.stringify(resumen, null, 2) });
    archivos.push({ nombre: "LEEME.txt", datos: "Respaldo de IMITA del " + hoy + ".\r\ndatos.json tiene todas las palabras, voces, autorizaciones y configuración.\r\nLas carpetas tienen los audios (mp3) y las ilustraciones (png) de cada lengua.\r\n" });
    for (var j = 0; j < resumen.lenguas.length; j++) {
      var L = resumen.lenguas[j];
      for (var k = 0; k < L.palabras.length; k++) {
        for (var a = 0; a < L.palabras[k].archivos.length; a++) {
          var x = L.palabras[k].archivos[a];
          try {
            var resp = await fetch(x.url);
            if (resp.ok) {
              var tipo = resp.headers.get("content-type") || "", ext = /mpeg/.test(tipo) ? ".mp3" : /png/.test(tipo) ? ".png" : /jpeg/.test(tipo) ? ".jpg" : /webp/.test(tipo) ? ".webp" : /mp4/.test(tipo) ? ".m4a" : "";
              archivos.push({ nombre: L.lengua.id + "/" + x.clave + ext, datos: new Uint8Array(await resp.arrayBuffer()) });
            }
          } catch (_) {}
          hechos++; say($("msgZip"), "Descargando archivos… " + hechos + " de " + total);
        }
      }
    }
    return { blob: Zip.crear(archivos), nombre: "imita-respaldo-" + (lenguas.length === 1 ? lenguas[0].id + "-" : "") + hoy + ".zip", total: total };
  }
  async function descargarZip(lenguas, btn) {
    btn.disabled = true; say($("msgZip"), "Preparando respaldo…");
    try { var z = await armarZip(lenguas); guardarArchivo(z.blob, z.nombre); say($("msgZip"), "Listo: " + z.nombre + " (" + Math.max(1, Math.round(z.blob.size / 1024)) + " KB, " + z.total + " archivos).", "ok"); }
    catch (err) { fallo($("msgZip"), "No se pudo armar el respaldo: ")(err); }
    btn.disabled = false;
  }
  $("zipLengua").onclick = function () { descargarZip([S.L], this); };
  $("zipTodo").onclick = function () { descargarZip(S.lenguas, this); };

  // ================= LENGUA =================
  var MARCA = { mNombre: "nombre", mInstagram: "instagram", mBajada: "bajada", mPrograma: "programa", mTienda: "tienda", mContacto: "contacto", mHashtags: "hashtags" };
  function llenarLengua() {
    var l = S.L;
    $("lenguaTitulo").textContent = l.nombre; $("lenguaBase").textContent = l.base;
    $("lNombre").value = l.nombre; $("lDominios").value = (l.dominios || []).join(", ");
    $("lActiva").checked = l.activa !== false; $("lDefecto").checked = false;
    $("lNombreLengua").value = l.nombreLengua || ""; $("lCaracteres").value = (l.caracteres || []).join(", ");
    $("lSistemas").value = (l.sistemas || []).join(", "); $("lAcento").value = l.acento || "#E07A5C";
    Object.keys(MARCA).forEach(function (id) { $(id).value = l.marca[MARCA[id]] || ""; });
    say($("msgLengua"), "");
  }
  $("fLengua").addEventListener("submit", async function (e) {
    e.preventDefault();
    var b = { nombreLengua: $("lNombreLengua").value, caracteres: lista2arr($("lCaracteres").value), sistemas: lista2arr($("lSistemas").value), acento: $("lAcento").value, marca: {} };
    Object.keys(MARCA).forEach(function (id) { b.marca[MARCA[id]] = $(id).value; });
    if (S.yo.rol === "general") { b.nombre = $("lNombre").value; b.dominios = lista2arr($("lDominios").value); b.activa = $("lActiva").checked; b.porDefecto = $("lDefecto").checked; }
    try {
      await api("l/" + S.L.id + "/config", { method: "PUT", json: b });
      await iniciar(S.L.id); mostrarTab("lengua"); say($("msgLengua"), "Guardado. Ya se ve en el sitio.", "ok");
    } catch (err) { fallo($("msgLengua"), "No se pudo guardar: ")(err); }
  });

  // ================= LENGUAS (general) =================
  function pintarLenguas() {
    $("listaLenguas").innerHTML = S.lenguas.map(function (l) {
      return '<div class="fila"><span class="grow"><b>' + esc(l.nombre) + '</b> <span class="muted">· ' + esc(l.id) + (l.activa === false ? " · inactiva" : "") + '</span><br><a class="link" href="' + esc(l.base) + '" target="_blank" rel="noopener">' + esc(l.base.replace(/^https?:\/\//, "")) + "</a></span>" +
        '<button type="button" class="btn ghost sm" data-ir="' + esc(l.id) + '">Administrar</button><button type="button" class="link" data-borrar="' + esc(l.id) + '">Eliminar</button></div>';
    }).join("") || '<p class="hint">Todavía no hay lenguas.</p>';
  }
  $("listaLenguas").addEventListener("click", async function (e) {
    var ir = e.target.dataset.ir, b = e.target.dataset.borrar;
    if (ir) { await cambiarLengua(ir); mostrarTab("lengua"); }
    if (b) {
      if (e.target.dataset.confirmar !== "1") { e.target.dataset.confirmar = "1"; e.target.textContent = "¿Seguro? Presiona de nuevo"; return; }
      try { await api("lenguas/" + b, { method: "DELETE" }); await iniciar(); mostrarTab("lenguas"); }
      catch (err) { fallo($("msgNuevaLengua"), "No se pudo eliminar: ")(err); e.target.textContent = "Eliminar"; delete e.target.dataset.confirmar; }
    }
  });
  $("nlNombre").addEventListener("input", function () { if (!$("nlId").dataset.tocado) $("nlId").value = slugify(this.value).replace(/-/g, ""); });
  $("nlId").addEventListener("input", function () { this.dataset.tocado = "1"; });
  $("fNuevaLengua").addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      var r = await api("lenguas", { method: "POST", json: { nombre: $("nlNombre").value, id: $("nlId").value, nombreLengua: $("nlNombreLengua").value } });
      ["nlNombre", "nlId", "nlNombreLengua"].forEach(function (id) { $(id).value = ""; }); delete $("nlId").dataset.tocado;
      await iniciar(r.lengua.id); mostrarTab("lengua");
      say($("msgLengua"), "Lengua creada. Completa su configuración y agrega a las personas que la administrarán.", "ok");
    } catch (err) { fallo($("msgNuevaLengua"), "No se pudo crear: ")(err); }
  });

  // ================= PERSONAS (general) =================
  async function cargarPersonas() {
    try { S.personas = (await api("usuarios")).usuarios; pintarPersonas(); limpiarPersona(); } catch (_) {}
  }
  function nombreLengua(id) { var l = S.lenguas.find(function (x) { return x.id === id; }); return l ? l.nombre : id; }
  function pintarPersonas() {
    $("listaPersonas").innerHTML = S.personas.map(function (u) {
      return '<div class="fila"><span class="grow"><b>' + esc(u.nombre || u.correo) + '</b> <span class="muted">· ' + esc(u.correo) + (u.activo ? "" : " · sin acceso") + "</span><br><span class=\"hint\">" +
        (u.rol === "general" ? "Administración general" : (u.lenguas.length ? u.lenguas.map(nombreLengua).join(", ") : "Sin lenguas asignadas")) + "</span></span>" +
        '<button type="button" class="btn ghost sm" data-editar="' + esc(u.correo) + '">Editar</button></div>';
    }).join("") || '<p class="hint">Todavía no hay personas. Solo entra la administración general.</p>';
  }
  function pintarChecksLenguas(marcadas) {
    $("pLenguas").innerHTML = S.lenguas.map(function (l) {
      return '<label class="chk"><input type="checkbox" value="' + esc(l.id) + '"' + (marcadas.indexOf(l.id) >= 0 ? " checked" : "") + "> " + esc(l.nombre) + "</label>";
    }).join("");
  }
  function limpiarPersona() {
    S.editPersona = null; $("personaTitulo").textContent = "Agregar persona"; $("pGuardar").textContent = "Agregar";
    $("pCorreo").value = ""; $("pCorreo").disabled = false; $("pNombre").value = ""; $("pClave").value = "";
    $("pClaveLbl").textContent = "Contraseña inicial"; $("pGeneral").checked = false; $("pActivo").checked = true;
    $("pCancelar").hidden = true; $("pBorrar").hidden = true; $("pCerrar").hidden = true; pintarChecksLenguas(S.L ? [S.L.id] : []);
  }
  $("listaPersonas").addEventListener("click", function (e) {
    var c = e.target.dataset.editar; if (!c) return;
    var u = S.personas.find(function (x) { return x.correo === c; }); S.editPersona = u;
    $("personaTitulo").textContent = "Editar a " + (u.nombre || u.correo); $("pGuardar").textContent = "Guardar cambios";
    $("pCorreo").value = u.correo; $("pCorreo").disabled = true; $("pNombre").value = u.nombre || ""; $("pClave").value = "";
    $("pClaveLbl").textContent = "Nueva contraseña (dejar vacío para no cambiarla)";
    $("pGeneral").checked = u.rol === "general"; $("pActivo").checked = u.activo; pintarChecksLenguas(u.lenguas || []);
    $("pCancelar").hidden = false; $("pBorrar").hidden = false; $("pCerrar").hidden = false; say($("msgPersona"), "");
    $("fPersona").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("pCancelar").onclick = limpiarPersona;
  $("fPersona").addEventListener("submit", async function (e) {
    e.preventDefault();
    var b = { nombre: $("pNombre").value, rol: $("pGeneral").checked ? "general" : "editor", activo: $("pActivo").checked,
      lenguas: Array.from($("pLenguas").querySelectorAll("input:checked")).map(function (x) { return x.value; }) };
    if ($("pClave").value) b.clave = $("pClave").value;
    try {
      if (S.editPersona) await api("usuarios/" + encodeURIComponent(S.editPersona.correo), { method: "PUT", json: b });
      else { b.correo = $("pCorreo").value; await api("usuarios", { method: "POST", json: b }); }
      var quien = $("pCorreo").value; await cargarPersonas();
      say($("msgPersona"), "Listo. " + quien + " entra en " + location.host + "/admin con su correo y contraseña.", "ok");
    } catch (err) { fallo($("msgPersona"), "No se pudo guardar: ")(err); }
  });
  $("pBorrar").onclick = async function () {
    var u = S.editPersona; if (!u) return;
    if (this.dataset.confirmar !== "1") { this.dataset.confirmar = "1"; this.textContent = "¿Seguro? Presiona de nuevo"; return; }
    delete this.dataset.confirmar; this.textContent = "Quitar acceso";
    try { await api("usuarios/" + encodeURIComponent(u.correo), { method: "DELETE" }); await cargarPersonas(); say($("msgPersona"), "Acceso quitado a " + u.correo + ".", "ok"); }
    catch (err) { fallo($("msgPersona"), "No se pudo quitar: ")(err); }
  };

  // ================= MI CUENTA =================
  $("fCuenta").addEventListener("submit", async function (e) {
    e.preventDefault();
    try { var r = await api("clave", { method: "POST", json: { actual: $("cActual").value, nueva: $("cNueva").value } }); nuevoToken(r.token); $("cActual").value = ""; $("cNueva").value = ""; say($("msgCuenta"), "Contraseña cambiada. Se cerró la sesión en tus otros dispositivos.", "ok"); }
    catch (err) { fallo($("msgCuenta"), "No se pudo cambiar: ")(err); }
  });

  $("cerrarOtras").onclick = async function () {
    try { var r = await api("cerrar-sesiones", { method: "POST" }); nuevoToken(r.token); say($("msgCuenta"), "Listo. Solo queda abierta esta sesión.", "ok"); }
    catch (err) { fallo($("msgCuenta"), "No se pudo: ")(err); }
  };
  $("pCerrar").onclick = async function () {
    var u = S.editPersona; if (!u) return;
    try {
      await api("usuarios/" + encodeURIComponent(u.correo), { method: "PUT", json: { nombre: u.nombre, rol: u.rol, activo: u.activo, lenguas: u.lenguas, cerrarSesiones: true } });
      say($("msgPersona"), "Se cerraron todas las sesiones de " + u.correo + ". Tendrá que volver a entrar.", "ok");
    } catch (err) { fallo($("msgPersona"), "No se pudo: ")(err); }
  };

  // ================= ACTIVIDAD (general) =================
  async function cargarActividad(mes) {
    try {
      var r = await api("registro" + (mes ? "?mes=" + mes : ""));
      $("acMes").innerHTML = r.meses.map(function (m) { return '<option value="' + m + '"' + (m === r.mes ? " selected" : "") + ">" + esc(nombreMes(m)) + "</option>"; }).join("");
      var solo = $("acFallidos").checked;
      var es = r.entradas.filter(function (e) { return !solo || /fallida|bloqueada/.test(e.a); });
      var nombreL = function (id) { var l = S.lenguas.find(function (x) { return x.id === id; }); return l ? l.nombre : id; };
      $("acFilas").innerHTML = es.length ? es.slice(0, 800).map(function (e) {
        var det = [e.l ? nombreL(e.l) : "", e.d || ""].filter(Boolean).join(" · ");
        return '<tr class="' + (/fallida|bloqueada/.test(e.a) ? "alerta" : "") + '"><td>' + esc(new Date(e.f).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })) + '</td><td class="izq">' + esc(e.u) + '</td><td class="izq">' + esc(e.a) + '</td><td class="izq">' + esc(det) + "</td><td>" + esc(e.ip || "") + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="muted">Sin actividad registrada.</td></tr>';
    } catch (err) { if (err.message !== "401") $("acFilas").innerHTML = '<tr><td colspan="5">' + esc(err.message) + "</td></tr>"; }
  }
  $("acMes").addEventListener("change", function () { cargarActividad(this.value); });
  $("acFallidos").addEventListener("change", function () { cargarActividad($("acMes").value); });

  // ---------- arranque ----------
  S.token = leerLocal("sesion");
  if (S.token) iniciar().catch(function () { salir(); }); else salir();
})();
