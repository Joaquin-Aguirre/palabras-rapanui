// Páginas públicas generadas en el servidor, para que WhatsApp, Instagram y Facebook
// muestren la vista previa de cada palabra:  /  (colección)  y  /p/:slug  (una palabra).
import { leerCatalogo, publica, esc } from "../lib/comun.mjs";

export default async (req, context) => {
  const url = new URL(req.url);

  // QR antiguos: /?p=vave -> /p/vave
  const viejo = url.searchParams.get("p");
  if (url.pathname === "/" && viejo) {
    return Response.redirect(new URL("/p/" + encodeURIComponent(viejo.toLowerCase()), url), 301);
  }

  const { marca, palabras } = await leerCatalogo();
  const base = (marca.dominio || url.origin).replace(/\/+$/, "");
  const visibles = palabras.filter((p) => p.publicada !== false).map(publica);

  if (url.pathname === "/") return html(paginaInicio(marca, visibles, base));

  const slug = (context.params.slug || "").toLowerCase();
  const p = visibles.find((x) => x.slug === slug);
  if (!p) return html(paginaNoEncontrada(marca, visibles, base, slug), 404);
  return html(paginaPalabra(marca, p, visibles, base));
};

export const config = { path: ["/", "/p/:slug"] };

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  story: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm5 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 19a4.5 4.5 0 0 1-3.2-7.7l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a2.5 2.5 0 0 0 3.5 3.5l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1A4.5 4.5 0 0 1 8.5 19zm7.4-4.8a1 1 0 0 1-.7-1.7l2.1-2.1a2.5 2.5 0 0 0-3.5-3.5l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1a4.5 4.5 0 0 1 6.4 6.4l-2.1 2.1a1 1 0 0 1-.8.2z"/></svg>',
};

function head({ titulo, descripcion, url, imagen, imagenAlt }) {
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
</head>
<body>
<main id="app">`;
}

function top(marca, volver) {
  return `<div class="top"><a class="brand" href="/">${esc(marca.nombre)}</a>${volver ? '<a class="toplink" href="/">Todas las palabras</a>' : ""}</div>`;
}

function pie(marca) {
  return `<footer>${marca.instagram ? `<a href="https://instagram.com/${encodeURIComponent(marca.instagram)}" target="_blank" rel="noopener">Instagram @${esc(marca.instagram)}</a>` : ""}${marca.tienda ? `<a href="${esc(marca.tienda)}" target="_blank" rel="noopener">Tienda</a>` : ""}${marca.contacto ? `<span>${esc(marca.contacto)}</span>` : ""}<span>Palabras rapa nui en la voz de sus hablantes</span></footer>`;
}

function parche(p) {
  const dentro = p.imagen ? `<img src="${esc(p.imagen)}" alt="" loading="lazy">` : `<span class="mini">${esc([...p.palabra][0] || "")}</span>`;
  return `<div class="patch">${dentro}</div>`;
}

function tarjeta(p) {
  return `<a class="card" href="/p/${esc(p.slug)}">${parche(p)}<span class="w" lang="rap">${esc(p.palabra)}</span><span class="t">${esc(p.es)}</span></a>`;
}

function paginaInicio(marca, palabras, base) {
  return head({
    titulo: `${marca.nombre} · Palabras rapa nui`,
    descripcion: marca.bajada || "Escanea, escucha y dila bien. Cada palabra en la voz de un hablante rapa nui.",
    url: base + "/",
    imagen: base + "/assets/og.png",
    imagenAlt: "Escanea. Escucha. Dila bien.",
  }) + top(marca, false) +
  `<section class="intro"><span class="tipo">Colección</span><h1>Palabras rapa nui</h1>${marca.bajada ? `<p>${esc(marca.bajada)}</p>` : ""}</section>` +
  (palabras.length
    ? `<ul class="grid">${palabras.map((p) => `<li>${tarjeta(p)}</li>`).join("")}</ul>`
    : `<p class="vacio">Pronto vas a encontrar aquí las primeras palabras de la colección.</p>`) +
  (marca.programa ? `<section class="about"><p>${esc(marca.programa)}</p></section>` : "") +
  pie(marca) + `</main></body></html>`;
}

function paginaNoEncontrada(marca, palabras, base, slug) {
  return head({
    titulo: `${marca.nombre} · Palabras rapa nui`,
    descripcion: marca.bajada,
    url: base + "/",
    imagen: base + "/assets/og.png",
    imagenAlt: "Escanea. Escucha. Dila bien.",
  }) + top(marca, true) +
  `<section class="intro"><span class="tipo">Colección</span><h1>Esta palabra viene pronto</h1><p>Todavía no publicamos «${esc(slug)}». Mientras, escucha las que ya están.</p></section>` +
  `<ul class="grid">${palabras.map((p) => `<li>${tarjeta(p)}</li>`).join("")}</ul>` +
  pie(marca) + `</main></body></html>`;
}

function paginaPalabra(marca, p, todas, base) {
  const url = `${base}/p/${p.slug}`;
  const otras = todas.filter((x) => x.slug !== p.slug);
  const datos = { ...p, url, marca: marca.nombre, host: base.replace(/^https?:\/\//, "") };
  const acerca = [marca.bajada && `<p>${esc(marca.bajada)}</p>`, marca.programa && `<p>${esc(marca.programa)}</p>`, p.voz && `<p class="voz">Voz: ${esc(p.voz)}</p>`].filter(Boolean).join("");

  return head({
    titulo: `${p.palabra} · ${p.es} en rapa nui`,
    descripcion: `Escucha cómo se dice «${p.palabra}» (${p.es}) en la voz de un hablante rapa nui.`,
    url,
    imagen: p.og ? base + p.og : base + "/assets/og.png",
    imagenAlt: `${p.palabra}, ${p.es} en rapa nui`,
  }) + top(marca, true) +
  `<section class="hero">${p.imagen ? parche(p) : ""}` +
  (p.tipo ? `<span class="tipo">${esc(p.tipo)}</span>` : "") +
  `<h1 lang="rap">${esc(p.palabra)}</h1><p class="es">significa <b>${esc(p.es)}</b></p>` +
  (!p.validado ? `<div class="aviso">Por validar: estamos confirmando la escritura y el audio con hablantes rapa nui.</div>` : "") +
  (p.audio
    ? `<div class="player"><button class="play" id="play" type="button">${ICON.play}Escuchar</button><button class="chip" id="slow" type="button" aria-pressed="false">Más lento</button></div>`
    : `<div class="noaudio">El audio de esta palabra se está grabando. Vuelve pronto.</div>`) +
  (p.guia ? `<div class="guia">Se pronuncia <code>${esc(p.guia)}</code></div>` : "") +
  (p.texto ? `<p class="texto">${esc(p.texto)}</p>` : "") +
  (p.en.length ? `<p class="guia">Viene en: <b style="color:var(--ink)">${esc(p.en.join(", "))}</b></p>` : "") +
  `</section>` +
  `<section class="share"><h2>Compártela</h2><p>¿La llevas en tu prenda o artículo? Súbela a historias o mándasela a alguien para que aprenda a decirla.</p>` +
  `<div class="row"><button class="chip primary" type="button" id="story">${ICON.story}Imagen para historias</button>` +
  `<a class="chip" id="wa" href="https://wa.me/?text=${encodeURIComponent(`¿Sabes cómo se dice "${p.es}" en rapa nui? Es ${p.palabra}. Escúchala: ${url}`)}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a>` +
  `<button class="chip" type="button" id="copy">${ICON.link}Copiar link</button></div><p class="toast" id="toast" role="status"></p></section>` +
  (acerca ? `<section class="about"><h2>Por qué una palabra</h2>${acerca}</section>` : "") +
  (otras.length ? `<section class="more"><h2>Otras palabras de la colección</h2><div class="strip">${otras.map(tarjeta).join("")}</div></section>` : "") +
  pie(marca) +
  `</main><script>window.PALABRA=${JSON.stringify(datos).replace(/</g, "\\u003c")};</script><script src="/assets/palabra.js" defer></script></body></html>`;
}
