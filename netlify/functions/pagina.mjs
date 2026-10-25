// Páginas públicas, generadas en el servidor para que WhatsApp, Instagram y Facebook
// muestren la vista previa correcta.
//   Dominio de una lengua (vananga.cl):   /   y   /p/:slug
//   Cualquier dominio, por código:        /l/:lengua   y   /l/:lengua/p/:slug
//   imita.cl:                             página de la empresa IMITA SpA
//   aprenda.imita.cl (y otros):           vitrina para explorar y escuchar todas las lenguas
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
    if (!lengua) return html(await aprende(activas, url, true), 404);
  } else {
    lengua = lenguaPorHost(activas, host);
    if (!lengua && slug) lengua = activas.find((l) => l.id === plat.porDefecto);   // QR de prueba en la dirección de Netlify
    if (!lengua && !slug && host === PLATAFORMA.dominio) return html(empresa(url));
    if (!lengua) return html(await aprende(activas, url, false));
  }

  const { palabras } = await leerCatalogo(lengua.id);
  const visibles = palabras.filter((p) => p.publicada !== false).map((p) => publica(p, lengua.id));
  const ctx = { lengua, pre, base: lenguaPorHost([lengua], host) ? url.origin : baseLengua(lengua, url.origin), canon: baseLengua(lengua, url.origin) };

  if (!slug) return html(paginaInicio(ctx, visibles));
  const p = visibles.find((x) => x.slug === String(slug).toLowerCase());
  if (!p) return html(paginaNoEncontrada(ctx, visibles, slug), 404);
  return html(paginaPalabra(ctx, p, visibles));
};

// Encabezados de seguridad: solo se ejecuta código propio del sitio y nadie puede meter la página dentro de otra.
const SEGURIDAD = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000",
};

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, max-age=60, stale-while-revalidate=300",
      "netlify-vary": "header=Host",
      ...SEGURIDAD,
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

function head({ titulo, descripcion, url, imagen, imagenAlt, acento, css = "/assets/lengua.css" }) {
  const a = acento || "#E07A5C";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="#0B171C">
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
<link rel="stylesheet" href="${css}">
${acento === null ? "" : `<style>:root{--accent:${oscurecer(a)}}@media (prefers-color-scheme:dark){:root{--accent:${a}}}</style>`}
</head>
<body>
<main id="app">`;
}

// ---------------- sitio de una lengua ----------------
function top(ctx, volver) {
  const m = ctx.lengua.marca;
  return `<header class="ln-top"><a class="ln-marca" href="${ctx.pre || "/"}">${esc(m.nombre || ctx.lengua.nombre)}</a><nav>${volver ? `<a href="${ctx.pre || "/"}">Todas las palabras</a>` : ""}<a href="https://${PLATAFORMA.aprende}">Más lenguas</a></nav></header>`;
}
function pie(ctx) {
  const m = ctx.lengua.marca;
  return `<footer class="ln-pie">${m.instagram ? `<a href="https://instagram.com/${encodeURIComponent(m.instagram)}" target="_blank" rel="noopener">Instagram @${esc(m.instagram)}</a>` : ""}${m.tienda ? `<a href="${esc(m.tienda)}" target="_blank" rel="noopener">Tienda</a>` : ""}${m.contacto ? `<span>${esc(m.contacto)}</span>` : ""}<span>Palabras ${esc(ctx.lengua.nombre.toLowerCase())} en la voz de sus hablantes</span><a href="https://${PLATAFORMA.dominio}" target="_blank" rel="noopener">Hecho con ${PLATAFORMA.nombre}</a></footer>`;
}
function pin(p, cls = "ln-pin") {
  return `<span class="${cls}">${p.imagen ? `<img src="${esc(p.imagen)}" alt=""${cls === "ln-pin" ? ' loading="lazy"' : ""}>` : `<span>${esc([...p.palabra][0] || "")}</span>`}</span>`;
}
function tarjeta(ctx, p) {
  return `<li><a class="ln-card" href="${ctx.pre}/p/${esc(p.slug)}">${pin(p)}<span class="ln-ic" aria-hidden="true">${p.audio ? ICON.play : ""}</span>` +
    `<span class="ln-w" lang="und">${esc(p.palabra)}</span><span class="ln-es">${esc(p.es)}</span>${p.tipo ? `<span class="ln-t">${esc(p.tipo)}</span>` : ""}</a></li>`;
}
function metaLengua(ctx, extra) {
  const m = ctx.lengua.marca;
  return {
    titulo: `${m.nombre || ctx.lengua.nombre} · Palabras ${ctx.lengua.nombre.toLowerCase()}`,
    descripcion: m.bajada || `Escanea, escucha y dila bien. Cada palabra en la voz de un hablante ${ctx.lengua.nombre.toLowerCase()}.`,
    url: ctx.canon + "/",
    imagen: ctx.base + "/assets/og.png",
    imagenAlt: "Escanea. Escucha. Dila bien.",
    acento: null,
    css: "/assets/lengua.css",
    ...extra,
  };
}
const abrir = (ctx) => `<main id="app" class="ln" style="--c:${esc(ctx.lengua.acento || "#E07A5C")}">`;

function paginaInicio(ctx, palabras) {
  const l = ctx.lengua, m = l.marca;
  return head(metaLengua(ctx)).replace('<main id="app">', abrir(ctx)) + top(ctx, false) +
    `<section class="ln-hero ln-portada"><p class="ln-eyebrow" lang="und">${esc(l.nombreLengua || "Colección")}</p><h1>Palabras ${esc(l.nombre.toLowerCase())}</h1>${m.bajada ? `<p class="ln-bajada">${esc(m.bajada)}</p>` : ""}</section>` +
    (palabras.length ? `<section class="ln-sec"><h2>Toca una palabra para escucharla</h2><ul class="ln-grid">${palabras.map((p) => tarjeta(ctx, p)).join("")}</ul></section>` : `<p class="ln-vacio">Pronto vas a encontrar aquí las primeras palabras de la colección.</p>`) +
    (m.programa ? `<section class="ln-nota"><p>${esc(m.programa)}</p></section>` : "") + pie(ctx) +
    `</main><script type="application/json" id="datos-pagina">${JSON.stringify({ lengua: l.id, slug: "_" }).replace(/</g, "\\u003c")}</script><script src="/assets/palabra.js" defer></script></body></html>`;
}

function paginaNoEncontrada(ctx, palabras, slug) {
  return head(metaLengua(ctx)).replace('<main id="app">', abrir(ctx)) + top(ctx, true) +
    `<section class="ln-hero ln-portada"><p class="ln-eyebrow">Colección</p><h1>Esta palabra viene pronto</h1><p class="ln-bajada">Todavía no publicamos «${esc(slug)}». Mientras, escucha las que ya están.</p></section>` +
    `<section class="ln-sec"><ul class="ln-grid">${palabras.map((p) => tarjeta(ctx, p)).join("")}</ul></section>` + pie(ctx) + `</main></body></html>`;
}

function paginaPalabra(ctx, p, todas) {
  const l = ctx.lengua, m = l.marca;
  const url = `${ctx.canon}/p/${p.slug}`;
  const otras = todas.filter((x) => x.slug !== p.slug);
  const datos = { ...p, url, lengua: l.id, marca: m.nombre || l.nombre, host: ctx.canon.replace(/^https?:\/\//, ""), acento: l.acento };
  const acerca = [m.bajada && `<p>${esc(m.bajada)}</p>`, m.programa && `<p>${esc(m.programa)}</p>`].filter(Boolean).join("");
  const fila = (k, v) => `<div class="ln-fila"><dt>${k}</dt><dd>${v}</dd></div>`;
  const ficha = [
    p.audios[0] && p.audios[0].voz ? fila("Voz", esc(p.audios[0].voz) + (p.audios[0].variante ? ` · ${esc(p.audios[0].variante)}` : "")) : "",
    p.guia ? fila("Se pronuncia", `<code>${esc(p.guia)}</code>`) : "",
    p.variantes.length ? fila("También se escribe", p.variantes.map((v) => `<b lang="und">${esc(v.texto)}</b>${v.sistema ? ` <span class="ln-suave">(${esc(v.sistema)})</span>` : ""}`).join(", ")) : "",
    p.en.length ? fila("Viene en", esc(p.en.join(", "))) : "",
    p.validado && p.validadoPor ? fila("Validada por", esc(p.validadoPor)) : "",
  ].join("");
  const voces = p.audios.length > 1
    ? `<div class="ln-voces"><span class="ln-lbl">Otras voces</span>${p.audios.slice(1).map((a, i) => `<button type="button" class="ln-chip voz" data-i="${i + 1}">${ICON.play}${esc(a.voz || "Voz " + (i + 2))}${a.variante ? ` · ${esc(a.variante)}` : ""}</button>`).join("")}</div>` : "";

  return head({
    titulo: `${p.palabra} · ${p.es} en ${l.nombre.toLowerCase()}`,
    descripcion: `Escucha cómo se dice «${p.palabra}» (${p.es}) en la voz de un hablante ${l.nombre.toLowerCase()}.`,
    url,
    imagen: p.og ? ctx.base + p.og : ctx.base + "/assets/og.png",
    imagenAlt: `${p.palabra}, ${p.es} en ${l.nombre.toLowerCase()}`,
    acento: null,
    css: "/assets/lengua.css",
  }).replace('<main id="app">', abrir(ctx)) + top(ctx, true) +
    `<section class="ln-hero ln-palabra${p.imagen ? " con-img" : ""}">` +
    `<p class="ln-eyebrow">${esc([p.tipo, l.nombre].filter(Boolean).join(" · "))}</p>` +
    (p.audio
      ? `<button type="button" class="ln-play" id="play" aria-label="Escuchar ${esc(p.palabra)}">${ICON.play}</button>`
      : `<span class="ln-play ln-play-off" aria-hidden="true">${ICON.play}</span>`) +
    `<h1 lang="und">${esc(p.palabra)}</h1><p class="ln-sig">significa <b>${esc(p.es)}</b></p>` +
    `<div class="ln-acc">${p.audio ? `<button type="button" class="ln-btn" id="slow" aria-pressed="false">Más lento</button>` : `<span class="ln-sinvoz">El audio se está grabando. Vuelve pronto.</span>`}</div>` +
    (p.imagen ? pin(p, "ln-img") : "") +
    `</section>` +
    (!p.validado ? `<p class="ln-aviso">Por validar: estamos confirmando la escritura y el audio con hablantes.</p>` : "") +
    (ficha || voces || p.texto ? `<section class="ln-ficha">${p.texto ? `<p class="ln-texto">${esc(p.texto)}</p>` : ""}${ficha ? `<dl>${ficha}</dl>` : ""}${voces}</section>` : "") +
    `<section class="ln-share"><h2>Compártela</h2><p>¿La llevas en tu prenda o artículo? Súbela a historias o mándasela a alguien para que aprenda a decirla.</p>` +
    `<div class="ln-row"><button class="ln-chip ln-fuerte" type="button" id="story">${ICON.story}Imagen para historias</button>` +
    `<a class="ln-chip" id="wa" href="https://wa.me/?text=${encodeURIComponent(`¿Sabes cómo se dice "${p.es}" en ${l.nombre.toLowerCase()}? Es ${p.palabra}. Escúchala: ${url}`)}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a>` +
    `<button class="ln-chip" type="button" id="copy">${ICON.link}Copiar link</button></div><p class="ln-toast" id="toast" role="status"></p></section>` +
    (acerca ? `<section class="ln-nota"><h2>Por qué una palabra</h2>${acerca}</section>` : "") +
    (otras.length ? `<section class="ln-sec"><h2>Otras palabras de la colección</h2><ul class="ln-grid">${otras.map((x) => tarjeta(ctx, x)).join("")}</ul></section>` : "") +
    pie(ctx) +
    `</main><script type="application/json" id="datos-pagina">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script><script src="/assets/palabra.js" defer></script></body></html>`;
}

// ---------------- aprenda.imita.cl: explorar y escuchar ----------------
async function aprende(lenguas, url, noEncontrada) {
  const grupos = [];
  for (const l of lenguas) {
    const { palabras } = await leerCatalogo(l.id);
    const vis = palabras.filter((p) => p.publicada !== false).map((p) => publica(p, l.id));
    grupos.push({ l, vis });
  }
  const todas = [];
  for (const g of grupos) for (const p of g.vis.slice(0, 80)) {
    const href = (g.l.dominios[0] ? "https://" + g.l.dominios[0] : "/l/" + g.l.id) + "/p/" + p.slug;
    todas.push({ l: g.l.id, s: p.slug, w: p.palabra, es: p.es, t: p.tipo, a: p.audio, i: p.imagen, h: href });
  }
  const conVoz = todas.filter((x) => x.a);
  const dia = Math.floor(Date.now() / 86400000);
  const hoy = conVoz.length ? conVoz[dia % conVoz.length] : todas[0];
  const L = Object.fromEntries(grupos.map((g) => [g.l.id, { n: g.l.nombre, nl: g.l.nombreLengua, c: g.l.acento, d: g.l.dominios[0] || "", k: g.vis.length }]));
  const datos = { palabras: todas, lenguas: L, hoy: hoy ? hoy.l + "/" + hoy.s : "" };
  const color = (id) => esc((L[id] && L[id].c) || "#E07A5C");

  const tarjeta = (x) => `<li><button type="button" class="ap-card" data-k="${esc(x.l + "/" + x.s)}" style="--c:${color(x.l)}"${x.a ? "" : " data-sin=\"1\""}>` +
    `<span class="ap-pin">${x.i ? `<img src="${esc(x.i)}" alt="" loading="lazy">` : `<span>${esc([...x.w][0] || "")}</span>`}</span>` +
    `<span class="ap-w" lang="und">${esc(x.w)}</span><span class="ap-es">${esc(x.es)}</span>` +
    `<span class="ap-l">${esc(L[x.l].n)}</span><span class="ap-ic" aria-hidden="true">${x.a ? ICON.play : ""}</span></button></li>`;

  return head({
    titulo: "Aprenda · Lenguas que se escuchan",
    descripcion: "Escucha palabras de lenguas originarias en la voz de sus hablantes. Elige una lengua, toca una palabra y dila bien.",
    url: "https://" + PLATAFORMA.aprende + "/",
    imagen: url.origin + "/assets/og.png",
    imagenAlt: "Escanea. Escucha. Dila bien.",
    css: "/assets/aprende.css",
    acento: null,
  }).replace('<main id="app">', '<main id="app" class="ap">') +
  `<header class="ap-top"><a class="ap-marca" href="/">aprenda<span>.imita</span></a><nav><a href="#explorar">Explorar</a><a href="#comunidades">Comunidades</a></nav></header>` +
  (noEncontrada ? `<p class="ap-aviso">No encontramos esa lengua. Estas son las que están activas.</p>` : "") +
  (hoy ? `<section class="ap-hero" style="--c:${color(hoy.l)}">` +
    `<p class="ap-eyebrow">Palabra del día · <span id="hoyLengua">${esc(L[hoy.l].n)}</span></p>` +
    `<button type="button" class="ap-play" id="hoyPlay" data-k="${esc(hoy.l + "/" + hoy.s)}" aria-label="Escuchar ${esc(hoy.w)}">${ICON.play}</button>` +
    `<h1 class="ap-hoy" lang="und" id="hoyPalabra">${esc(hoy.w)}</h1>` +
    `<p class="ap-sig">significa <b id="hoySig">${esc(hoy.es)}</b></p>` +
    `<div class="ap-acc"><button type="button" class="ap-btn" id="otra">Otra palabra</button><a class="ap-link" id="hoyVer" href="${esc(hoy.h)}">Ver la palabra</a></div>` +
    `</section>`
    : `<section class="ap-hero"><h1 class="ap-hoy">Lenguas que se escuchan</h1><p class="ap-sig">Pronto vas a encontrar aquí las primeras palabras.</p></section>`) +
  `<section class="ap-intro"><h2>Toca una palabra y escúchala en la voz de quien la habla.</h2><p>Cada prenda u objeto lleva una palabra en una lengua originaria y un QR. Aquí están todas, para escucharlas, repetirlas y compartirlas.</p></section>` +
  `<section class="ap-explorar" id="explorar"><div class="ap-chips" role="group" aria-label="Elegir lengua"><button type="button" class="ap-chip" data-l="" aria-pressed="true">Todas <span>${todas.length}</span></button>` +
  grupos.map((g) => `<button type="button" class="ap-chip" data-l="${esc(g.l.id)}" aria-pressed="false" style="--c:${color(g.l.id)}">${esc(g.l.nombre)} <span>${g.vis.length}</span></button>`).join("") + `</div>` +
  (todas.length ? `<ul class="ap-grid" id="grid">${todas.map(tarjeta).join("")}</ul>` : `<p class="ap-vacio">Todavía no hay palabras publicadas.</p>`) +
  `<p class="ap-estado" id="estado" role="status"></p></section>` +
  `<section class="ap-lenguas"><h2>Las lenguas</h2><ul>${grupos.map((g) => `<li style="--c:${color(g.l.id)}"><a href="${esc(g.l.dominios[0] ? "https://" + g.l.dominios[0] : "/l/" + g.l.id)}"><b>${esc(g.l.nombre)}</b>${g.l.nombreLengua ? `<span lang="und">${esc(g.l.nombreLengua)}</span>` : ""}<em>${g.vis.length} ${g.vis.length === 1 ? "palabra" : "palabras"}</em></a></li>`).join("")}</ul></section>` +
  `<section class="ap-pasos"><h2>Cómo funciona</h2><ol>` +
  `<li><b>Se graba con hablantes.</b> Cada palabra se registra en la voz de una persona de la comunidad, con su autorización.</li>` +
  `<li><b>Va en la prenda.</b> La palabra se borda o estampa, y el QR va en la etiqueta.</li>` +
  `<li><b>Se escucha y se comparte.</b> Quien la lleva escanea, escucha cómo se dice y la comparte.</li></ol></section>` +
  `<section class="ap-com" id="comunidades"><h2>Para comunidades y organizaciones</h2><p>Cada lengua tiene su propio sitio y su propio equipo. Las comunidades deciden qué palabras se publican, quién las valida y qué voces se usan, y pueden retirar una grabación cuando quieran.</p>` +
  (process.env.CONTACTO_IMITA ? `<p>¿Trabajas con una lengua originaria y quieres sumarla? Escríbenos a <b>${esc(process.env.CONTACTO_IMITA)}</b>.</p>` : "") + `</section>` +
  `<footer class="ap-pie"><a href="https://${PLATAFORMA.dominio}">Un proyecto de ${PLATAFORMA.nombre}</a><a href="https://${PLATAFORMA.panel}">Acceso al panel</a></footer>` +
  `</main><script type="application/json" id="datos-aprende">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script><script src="/assets/aprende.js" defer></script></body></html>`;
}

// ---------------- imita.cl: la empresa ----------------
function empresa(url) {
  const contacto = process.env.CONTACTO_IMITA;
  return head({
    titulo: "IMITA · Ideas que se vuelven tecnología",
    descripcion: "IMITA SpA es un estudio chileno que convierte ideas en tecnología que la gente usa: del primer prototipo a un producto en marcha.",
    url: "https://" + PLATAFORMA.dominio + "/",
    imagen: url.origin + "/assets/og-imita.png",
    imagenAlt: "IMITA",
    css: "/assets/empresa.css",
    acento: null,
  }).replace('<main id="app">', '<main id="app" class="em">') +
  `<header class="em-top"><span class="em-logo">IMITA</span><a href="#contacto">Contacto</a></header>` +
  `<section class="em-hero"><h1>Ideas que se vuelven <span>tecnología.</span></h1>` +
  `<p>Somos un estudio en Chile. Tomamos una idea, la convertimos en un prototipo que funciona y lo llevamos a un producto que la gente usa.</p></section>` +
  `<section class="em-modo"><h2>Cómo trabajamos</h2><ol>` +
  `<li><span>01</span><b>Entender la idea</b><p>Qué problema resuelve, para quién y qué tiene que pasar para que funcione.</p></li>` +
  `<li><span>02</span><b>Prototipo real</b><p>En semanas, algo que se puede tocar, probar y mostrar. No una presentación.</p></li>` +
  `<li><span>03</span><b>Producto en marcha</b><p>Lo que funcionó se vuelve un servicio estable, seguro y fácil de mantener.</p></li></ol></section>` +
  `<section class="em-proy"><h2>En curso</h2><a class="em-card" href="https://${PLATAFORMA.aprende}">` +
  `<span class="em-tag">Proyecto propio · 2026</span><b>Lenguas que se escuchan</b>` +
  `<p>Palabras de lenguas originarias en prendas y objetos. Un QR lleva a la voz de un hablante; un panel permite a cada comunidad publicar sus palabras.</p>` +
  `<span class="em-ir">aprenda.imita.cl →</span></a></section>` +
  `<section class="em-contacto" id="contacto"><h2>¿Tienes una idea?</h2>` +
  (contacto ? `<p>Conversemos. Escríbenos a <a href="mailto:${esc(contacto)}">${esc(contacto)}</a>.</p>` : `<p>Conversemos.</p>`) + `</section>` +
  `<footer class="em-pie"><span>IMITA SpA · Chile</span><a href="https://${PLATAFORMA.aprende}">aprenda.imita.cl</a></footer></main></body></html>`;
}
