// Páginas públicas, generadas en el servidor para que WhatsApp, Instagram y Facebook
// muestren la vista previa correcta.
//   Dominio de una lengua (vananga.cl):   /   y   /p/:slug
//   Cualquier dominio, por código:        /l/:lengua   y   /l/:lengua/p/:slug
//   imita.cl:                             vitrina de la plataforma
//   panel.imita.cl:                       lleva al panel
import { leerPlataforma, leerCatalogo, publica, esc, lenguaPorHost, normalizarHost, baseLengua, PLATAFORMA } from "../lib/comun.mjs";

export const config = { path: ["/", "/p/:slug", "/l/:lengua", "/l/:lengua/p/:slug"] };

export default async (req, context) => {
  const url = new URL(req.url);
  const host = normalizarHost(url.host);

  if (host.startsWith("panel.")) return Response.redirect(new URL("/admin/", url), 302);

  // QR antiguos: /?p=vave -> /p/vave
  const viejo = url.searchParams.get("p");
  if (url.pathname === "/" && viejo) return Response.redirect(new URL("/p/" + encodeURIComponent(viejo.toLowerCase()), url), 301);

  const plat = await leerPlataforma();
  const activas = plat.lenguas.filter((l) => l.activa !== false);
  const { lengua: porCodigo, slug } = context.params || {};

  let lengua, pre = "";
  if (porCodigo) {
    lengua = activas.find((l) => l.id === porCodigo);
    pre = "/l/" + porCodigo;
    if (!lengua) return html(vitrina(activas, url, true), 404);
  } else {
    lengua = lenguaPorHost(activas, host);
    if (!lengua && slug) lengua = activas.find((l) => l.id === plat.porDefecto);   // QR de prueba en la dirección de Netlify
    if (!lengua) return html(vitrina(activas, url, false));
  }

  const { palabras } = await leerCatalogo(lengua.id);
  const visibles = palabras.filter((p) => p.publicada !== false).map((p) => publica(p, lengua.id));
  const ctx = { lengua, pre, base: lenguaPorHost([lengua], host) ? url.origin : baseLengua(lengua, url.origin), canon: baseLengua(lengua, url.origin) };

  if (!slug) return html(paginaInicio(ctx, visibles));
  const p = visibles.find((x) => x.slug === String(slug).toLowerCase());
  if (!p) return html(paginaNoEncontrada(ctx, visibles, slug), 404);
  return html(paginaPalabra(ctx, p, visibles));
};

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, max-age=60, stale-while-revalidate=300",
      "netlify-vary": "header=Host",
    },
  });
}

// Oscurece el color de acento para el modo claro.
function oscurecer(hex, f = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f).toString(16).padStart(2, "0"));
  return "#" + c.join("");
}

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  story: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm5 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 19a4.5 4.5 0 0 1-3.2-7.7l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a2.5 2.5 0 0 0 3.5 3.5l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1A4.5 4.5 0 0 1 8.5 19zm7.4-4.8a1 1 0 0 1-.7-1.7l2.1-2.1a2.5 2.5 0 0 0-3.5-3.5l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1a4.5 4.5 0 0 1 6.4 6.4l-2.1 2.1a1 1 0 0 1-.8.2z"/></svg>',
};

function head({ titulo, descripcion, url, imagen, imagenAlt, acento }) {
  const a = acento || "#E07A5C";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="#10272F">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CL">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(imagen)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imagenAlt)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%2310272F'/%3E%3Ccircle cx='16' cy='16' r='12' fill='none' stroke='%23ECF0EE' stroke-width='1.5' stroke-dasharray='2.5 2'/%3E%3Cpath d='M13 10v12l9-6z' fill='%23E07A5C'/%3E%3C/svg%3E">
<link rel="preload" href="/fonts/noto-serif-display-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/sitio.css">
<style>:root{--accent:${oscurecer(a)}}@media (prefers-color-scheme:dark){:root{--accent:${a}}}</style>
</head>
<body>
<main id="app">`;
}

// ---------------- sitio de una lengua ----------------
function top(ctx, volver) {
  const m = ctx.lengua.marca;
  return `<div class="top"><a class="brand" href="${ctx.pre || "/"}">${esc(m.nombre || ctx.lengua.nombre)}</a>${volver ? `<a class="toplink" href="${ctx.pre || "/"}">Todas las palabras</a>` : ""}</div>`;
}
function pie(ctx) {
  const m = ctx.lengua.marca;
  return `<footer>${m.instagram ? `<a href="https://instagram.com/${encodeURIComponent(m.instagram)}" target="_blank" rel="noopener">Instagram @${esc(m.instagram)}</a>` : ""}${m.tienda ? `<a href="${esc(m.tienda)}" target="_blank" rel="noopener">Tienda</a>` : ""}${m.contacto ? `<span>${esc(m.contacto)}</span>` : ""}<span>Palabras ${esc(ctx.lengua.nombre.toLowerCase())} en la voz de sus hablantes</span><a href="https://${PLATAFORMA.dominio}" target="_blank" rel="noopener">Hecho con ${PLATAFORMA.nombre}</a></footer>`;
}
function parche(p) {
  const dentro = p.imagen ? `<img src="${esc(p.imagen)}" alt="" loading="lazy">` : `<span class="mini">${esc([...p.palabra][0] || "")}</span>`;
  return `<div class="patch">${dentro}</div>`;
}
function tarjeta(ctx, p) {
  return `<a class="card" href="${ctx.pre}/p/${esc(p.slug)}">${parche(p)}<span class="w" lang="und">${esc(p.palabra)}</span><span class="t">${esc(p.es)}</span></a>`;
}
function metaLengua(ctx, extra) {
  const m = ctx.lengua.marca;
  return {
    titulo: `${m.nombre || ctx.lengua.nombre} · Palabras ${ctx.lengua.nombre.toLowerCase()}`,
    descripcion: m.bajada || `Escanea, escucha y dila bien. Cada palabra en la voz de un hablante ${ctx.lengua.nombre.toLowerCase()}.`,
    url: ctx.canon + "/",
    imagen: ctx.base + "/assets/og.png",
    imagenAlt: "Escanea. Escucha. Dila bien.",
    acento: ctx.lengua.acento,
    ...extra,
  };
}

function paginaInicio(ctx, palabras) {
  const l = ctx.lengua, m = l.marca;
  return head(metaLengua(ctx)) + top(ctx, false) +
    `<section class="intro"><span class="tipo">${esc(l.nombreLengua || "Colección")}</span><h1>Palabras ${esc(l.nombre.toLowerCase())}</h1>${m.bajada ? `<p>${esc(m.bajada)}</p>` : ""}</section>` +
    (palabras.length ? `<ul class="grid">${palabras.map((p) => `<li>${tarjeta(ctx, p)}</li>`).join("")}</ul>` : `<p class="vacio">Pronto vas a encontrar aquí las primeras palabras de la colección.</p>`) +
    (m.programa ? `<section class="about"><p>${esc(m.programa)}</p></section>` : "") + pie(ctx) +
    `</main><script>try{navigator.sendBeacon("/api/evento",JSON.stringify({l:${JSON.stringify(l.id)},s:"_",t:"visita"}))}catch(e){}</script></body></html>`;
}

function paginaNoEncontrada(ctx, palabras, slug) {
  return head(metaLengua(ctx)) + top(ctx, true) +
    `<section class="intro"><span class="tipo">Colección</span><h1>Esta palabra viene pronto</h1><p>Todavía no publicamos «${esc(slug)}». Mientras, escucha las que ya están.</p></section>` +
    `<ul class="grid">${palabras.map((p) => `<li>${tarjeta(ctx, p)}</li>`).join("")}</ul>` + pie(ctx) + `</main></body></html>`;
}

function paginaPalabra(ctx, p, todas) {
  const l = ctx.lengua, m = l.marca;
  const url = `${ctx.canon}/p/${p.slug}`;
  const otras = todas.filter((x) => x.slug !== p.slug);
  const datos = { ...p, url, lengua: l.id, marca: m.nombre || l.nombre, host: ctx.canon.replace(/^https?:\/\//, ""), acento: l.acento };
  const acerca = [m.bajada && `<p>${esc(m.bajada)}</p>`, m.programa && `<p>${esc(m.programa)}</p>`].filter(Boolean).join("");
  const variantes = p.variantes.length
    ? `<p class="guia">También se escribe: ${p.variantes.map((v) => `<b style="color:var(--ink)" lang="und">${esc(v.texto)}</b>${v.sistema ? ` <span>(${esc(v.sistema)})</span>` : ""}`).join(", ")}</p>` : "";
  const voces = p.audios.length > 1
    ? `<div class="voces"><span class="lbl">Otras voces</span>${p.audios.slice(1).map((a, i) => `<button type="button" class="chip voz" data-i="${i + 1}">${ICON.play}${esc(a.voz || "Voz " + (i + 2))}${a.variante ? ` · ${esc(a.variante)}` : ""}</button>`).join("")}</div>` : "";

  return head({
    titulo: `${p.palabra} · ${p.es} en ${l.nombre.toLowerCase()}`,
    descripcion: `Escucha cómo se dice «${p.palabra}» (${p.es}) en la voz de un hablante ${l.nombre.toLowerCase()}.`,
    url,
    imagen: p.og ? ctx.base + p.og : ctx.base + "/assets/og.png",
    imagenAlt: `${p.palabra}, ${p.es} en ${l.nombre.toLowerCase()}`,
    acento: l.acento,
  }) + top(ctx, true) +
    `<section class="hero">${p.imagen ? parche(p) : ""}` +
    (p.tipo ? `<span class="tipo">${esc(p.tipo)}</span>` : "") +
    `<h1 lang="und">${esc(p.palabra)}</h1><p class="es">significa <b>${esc(p.es)}</b></p>` +
    (!p.validado ? `<div class="aviso">Por validar: estamos confirmando la escritura y el audio con hablantes.</div>` : "") +
    (p.audio
      ? `<div class="player"><button class="play" id="play" type="button">${ICON.play}Escuchar</button><button class="chip" id="slow" type="button" aria-pressed="false">Más lento</button></div>${p.audios[0].voz ? `<p class="guia">Voz: ${esc(p.audios[0].voz)}${p.audios[0].variante ? ` · ${esc(p.audios[0].variante)}` : ""}</p>` : ""}${voces}`
      : `<div class="noaudio">El audio de esta palabra se está grabando. Vuelve pronto.</div>`) +
    (p.guia ? `<div class="guia">Se pronuncia <code>${esc(p.guia)}</code></div>` : "") +
    variantes +
    (p.texto ? `<p class="texto">${esc(p.texto)}</p>` : "") +
    (p.en.length ? `<p class="guia">Viene en: <b style="color:var(--ink)">${esc(p.en.join(", "))}</b></p>` : "") +
    (p.validado && p.validadoPor ? `<p class="guia">Validada por ${esc(p.validadoPor)}</p>` : "") +
    `</section>` +
    `<section class="share"><h2>Compártela</h2><p>¿La llevas en tu prenda o artículo? Súbela a historias o mándasela a alguien para que aprenda a decirla.</p>` +
    `<div class="row"><button class="chip primary" type="button" id="story">${ICON.story}Imagen para historias</button>` +
    `<a class="chip" id="wa" href="https://wa.me/?text=${encodeURIComponent(`¿Sabes cómo se dice "${p.es}" en ${l.nombre.toLowerCase()}? Es ${p.palabra}. Escúchala: ${url}`)}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a>` +
    `<button class="chip" type="button" id="copy">${ICON.link}Copiar link</button></div><p class="toast" id="toast" role="status"></p></section>` +
    (acerca ? `<section class="about"><h2>Por qué una palabra</h2>${acerca}</section>` : "") +
    (otras.length ? `<section class="more"><h2>Otras palabras de la colección</h2><div class="strip">${otras.map((x) => tarjeta(ctx, x)).join("")}</div></section>` : "") +
    pie(ctx) +
    `</main><script>window.PALABRA=${JSON.stringify(datos).replace(/</g, "\\u003c")};</script><script src="/assets/palabra.js" defer></script></body></html>`;
}

// ---------------- vitrina de la plataforma ----------------
function vitrina(lenguas, url, noEncontrada) {
  const tarjetas = lenguas.map((l) => {
    const href = l.dominios[0] ? "https://" + l.dominios[0] : "/l/" + l.id;
    return `<li><a class="lengua" href="${esc(href)}"><span class="ln">${esc(l.nombre)}</span>${l.nombreLengua ? `<span class="nl" lang="und">${esc(l.nombreLengua)}</span>` : ""}<span class="dom">${esc(l.dominios[0] || url.host + "/l/" + l.id)}</span></a></li>`;
  }).join("");
  return head({
    titulo: `${PLATAFORMA.nombre} · Lenguas que se escuchan`,
    descripcion: "Plataforma para que las lenguas originarias se escuchen en lo cotidiano: cada prenda u objeto lleva una palabra y un QR con la voz de un hablante.",
    url: "https://" + PLATAFORMA.dominio + "/",
    imagen: url.origin + "/assets/og.png",
    imagenAlt: "Escanea. Escucha. Dila bien.",
  }) +
  `<div class="top"><a class="brand" href="/">${PLATAFORMA.nombre}</a><a class="toplink" href="https://${PLATAFORMA.panel}">Acceso al panel</a></div>` +
  (noEncontrada ? `<p class="aviso">No encontramos esa lengua. Estas son las que están activas.</p>` : "") +
  `<section class="intro"><span class="tipo">Lenguas originarias</span><h1>Lenguas que se escuchan</h1>` +
  `<p>Cada prenda u objeto lleva una palabra en una lengua originaria y un QR. Al escanearlo, la palabra se escucha en la voz de un hablante.</p></section>` +
  `<section class="more"><h2>Lenguas en la plataforma</h2>${tarjetas ? `<ul class="lenguas">${tarjetas}</ul>` : `<p class="vacio">Pronto.</p>`}</section>` +
  `<section class="pasos"><h2>Cómo funciona</h2><ol>` +
  `<li><b>Se graba con hablantes.</b> Cada palabra se registra en la voz de una persona de la comunidad, con su autorización.</li>` +
  `<li><b>Va en la prenda.</b> La palabra se borda o estampa, y el QR va en la etiqueta.</li>` +
  `<li><b>Se escucha y se comparte.</b> Quien la lleva escanea, escucha cómo se dice y la comparte en redes.</li></ol></section>` +
  `<section class="about"><h2>Para comunidades y organizaciones</h2><p>Cada lengua tiene su propio sitio y su propio equipo. Las comunidades deciden qué palabras se publican, quién las valida y qué voces se usan, y pueden retirar una grabación cuando quieran.</p>` +
  (process.env.CONTACTO_IMITA ? `<p>¿Trabajas con una lengua originaria y quieres sumarla? Escríbenos a <b>${esc(process.env.CONTACTO_IMITA)}</b>.</p>` : "") + `</section>` +
  `<footer><span>${PLATAFORMA.nombre} SpA</span><a href="https://${PLATAFORMA.panel}">Acceso al panel</a></footer></main></body></html>`;
}
