// Genera las imágenes para redes de una palabra, en el navegador:
//   og(p)       1200 × 630   vista previa al compartir el link (WhatsApp, Facebook, X)
//   historia(p) 1080 × 1920  historias de Instagram y estados de WhatsApp
//   post(p)     1080 × 1350  publicación del feed de Instagram
// p = { palabra, es, tipo, imagen (url o Image), marca, host, slug }
(function () {
  var ACENTO = "#E07A5C";
  var C = { bg: "#10272F", patch: "#1C3640", thread: "rgba(236,240,238,.7)", ink: "#ECF0EE", muted: "#93A8AB", accent: ACENTO, accentInk: "#1A0A05" };
  function usarAcento(p) {
    C.accent = (p && /^#[0-9a-fA-F]{6}$/.test(p.acento || "")) ? p.acento : ACENTO;
    var n = parseInt(C.accent.slice(1), 16), lum = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    C.accentInk = lum > 0.55 ? "#1A0A05" : "#FFFFFF";
  }
  var SERIF = '"Noto Serif Display", Georgia, serif', SANS = '"Atkinson Hyperlegible", system-ui, sans-serif';

  function cargarFuentes(texto) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load("700 120px " + SERIF, texto || "aʻŋ"),
      document.fonts.load("400 40px " + SANS, "significa"),
      document.fonts.load("700 40px " + SANS, "Escúchala"),
    ]).catch(function () {});
  }
  function cargarImagen(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      if (typeof src !== "string") return res(src);
      var i = new Image(); i.crossOrigin = "anonymous";
      i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src;
    });
  }
  function lienzo(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d"); x.fillStyle = C.bg; x.fillRect(0, 0, w, h); return [c, x]; }
  function ajustar(x, texto, peso, familia, max, inicio, min) {
    var s = inicio; do { x.font = peso + " " + s + "px " + familia; s -= 4; } while (x.measureText(texto).width > max && s > (min || 40)); return s + 4;
  }
  function espaciado(x, px) { if ("letterSpacing" in x) x.letterSpacing = px + "px"; }
  function parche(x, cx, cy, r, img, palabra) {
    x.fillStyle = C.patch; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    if (img) {
      x.save(); x.beginPath(); x.arc(cx, cy, r - 6, 0, Math.PI * 2); x.clip();
      var s = r * 2 * 0.76, k = Math.min(s / img.width, s / img.height);
      x.drawImage(img, cx - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k); x.restore();
    } else if (palabra) {
      x.fillStyle = C.ink; x.textAlign = "center"; x.textBaseline = "middle";
      x.font = "700 " + Math.round(r * 0.9) + "px " + SERIF; x.fillText([...palabra][0] || "", cx, cy + r * 0.05);
      x.textBaseline = "alphabetic";
    }
    x.strokeStyle = C.thread; x.lineWidth = Math.max(3, r / 60); x.setLineDash([r / 16, r / 22]);
    x.beginPath(); x.arc(cx, cy, r - r * 0.06, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  }
  function pastilla(x, cx, cy, w, h, texto, size) {
    x.fillStyle = C.accent; x.beginPath();
    if (x.roundRect) x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); else x.rect(cx - w / 2, cy - h / 2, w, h);
    x.fill(); x.fillStyle = C.accentInk; x.textAlign = "center"; x.font = "700 " + size + "px " + SANS;
    x.fillText(texto, cx, cy + size * 0.35);
  }
  function tipo(x, texto, cx, y, size) {
    x.textAlign = "center"; x.fillStyle = C.accent; x.font = "700 " + size + "px " + SANS;
    espaciado(x, size * 0.2); x.fillText(texto.toUpperCase(), cx, y); espaciado(x, 0);
  }
  function marcaArriba(x, cx, y, marca, size) {
    if (!marca) return; x.fillStyle = C.ink; x.textAlign = "center"; x.font = "700 " + size + "px " + SANS;
    espaciado(x, size * 0.18); x.fillText(marca.toUpperCase(), cx, y); espaciado(x, 0);
  }

  async function og(p) {
    usarAcento(p);
    await cargarFuentes(p.palabra); var img = await cargarImagen(p.imagen);
    var r = lienzo(1200, 630), c = r[0], x = r[1];
    var izq = 80, ancho = img ? 640 : 1040;
    x.textAlign = "left";
    if (p.tipo) { x.fillStyle = C.accent; x.font = "700 28px " + SANS; espaciado(x, 5); x.fillText(p.tipo.toUpperCase(), izq, 150); espaciado(x, 0); }
    x.fillStyle = C.ink; var s = ajustar(x, p.palabra, "700", SERIF, ancho, 190, 60);
    x.fillText(p.palabra, izq, 150 + s * 0.95);
    var y = 150 + s * 0.95 + 70;
    x.fillStyle = C.muted; x.font = "400 40px " + SANS; x.fillText("significa", izq, y);
    x.fillStyle = C.ink; x.font = "700 40px " + SANS; x.fillText(p.es, izq + x.measureText("significa ").width + 6, y);
    x.fillStyle = C.accent; x.font = "700 32px " + SANS; x.fillText("▶  Escúchala en la voz de un hablante", izq, 540);
    x.fillStyle = C.muted; x.font = "400 26px " + SANS; x.fillText((p.enlace || ((p.host || "") + "/p/" + p.slug)), izq, 584);
    if (img) parche(x, 960, 315, 205, img);
    return c;
  }

  async function historia(p) {
    usarAcento(p);
    await cargarFuentes(p.palabra); var img = await cargarImagen(p.imagen);
    var r = lienzo(1080, 1920), c = r[0], x = r[1], cx = 540;
    marcaArriba(x, cx, 160, p.marca, 34);
    var y, s;
    if (img) {
      parche(x, cx, 540, 300, img);
      s = ajustar(x, p.palabra, "700", SERIF, 920, 260);
      var arriba = 840 + 80;
      if (p.tipo) { tipo(x, p.tipo, cx, arriba + 40, 40); arriba += 70; }
      y = arriba + s * 0.74;
    } else {
      parche(x, cx, 770, 470, null); y = 860;
      s = ajustar(x, p.palabra, "700", SERIF, 760, 250);
      if (p.tipo) tipo(x, p.tipo, cx, y - s * 0.78 - 40, 40);
    }
    x.textAlign = "center"; x.fillStyle = C.ink; x.font = "700 " + s + "px " + SERIF; x.fillText(p.palabra, cx, y);
    x.fillStyle = C.muted; x.font = "400 56px " + SANS; x.fillText("significa", cx, y + 110);
    x.fillStyle = C.ink; ajustar(x, p.es, "700", SANS, 900, 72, 40); x.fillText(p.es, cx, y + 200);
    pastilla(x, cx, 1600, 560, 120, "▶  Escúchala", 52);
    x.fillStyle = C.muted; x.font = "400 38px " + SANS; x.fillText((p.enlace || ((p.host || "") + "/p/" + p.slug)), cx, 1730);
    return c;
  }

  async function post(p) {
    usarAcento(p);
    await cargarFuentes(p.palabra); var img = await cargarImagen(p.imagen);
    var r = lienzo(1080, 1350), c = r[0], x = r[1], cx = 540;
    marcaArriba(x, cx, 120, p.marca, 30);
    var y, s;
    if (img) {
      parche(x, cx, 420, 230, img);
      s = ajustar(x, p.palabra, "700", SERIF, 900, 200);
      var arriba = 650 + 70;
      if (p.tipo) { tipo(x, p.tipo, cx, arriba + 34, 34); arriba += 60; }
      y = arriba + s * 0.74;
    } else {
      parche(x, cx, 560, 380, null); y = 640;
      s = ajustar(x, p.palabra, "700", SERIF, 640, 200);
      if (p.tipo) tipo(x, p.tipo, cx, y - s * 0.78 - 34, 34);
    }
    x.textAlign = "center"; x.fillStyle = C.ink; x.font = "700 " + s + "px " + SERIF; x.fillText(p.palabra, cx, y);
    x.fillStyle = C.muted; x.font = "400 46px " + SANS; x.fillText("significa", cx, y + 90);
    x.fillStyle = C.ink; ajustar(x, p.es, "700", SANS, 900, 62, 36); x.fillText(p.es, cx, y + 165);
    x.fillStyle = C.accent; x.font = "700 36px " + SANS; x.fillText("▶  Escúchala: link en la bio", cx, 1270);
    return c;
  }

  function aBlob(canvas, tipo) { return new Promise(function (res) { canvas.toBlob(res, tipo || "image/png", 0.92); }); }

  window.Imagenes = { og: og, historia: historia, post: post, aBlob: aBlob, cargarFuentes: cargarFuentes };
})();
