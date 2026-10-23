// /api/admin/* -> todo lo que hace el panel de administración. Exige la contraseña.
import { leerCatalogo, guardarCatalogo, medios, slugify, esSlug, json, autorizado, publica, MARCA_VACIA } from "../lib/comun.mjs";

const MB = 1024 * 1024;
const LIMITES = {
  audio: { max: 4 * MB, tipos: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "video/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"] },
  img: { max: 2.5 * MB, tipos: ["image/png", "image/webp", "image/jpeg"] },
  og: { max: 1.5 * MB, tipos: ["image/png", "image/jpeg"] },
};
const TEXTO_MAX = { palabra: 60, es: 120, tipo: 40, guia: 60, texto: 600, voz: 80 };

export default async (req) => {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/api\/admin\/?/, "").replace(/\/+$/, "");

  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    return json({ error: "Falta configurar la contraseña (ADMIN_PASSWORD, mínimo 8 caracteres) en Netlify." }, 503);
  }
  if (!autorizado(req)) return json({ error: "Contraseña incorrecta." }, 401);

  try {
    if (ruta === "login" && req.method === "POST") return json({ ok: true });
    if (ruta === "catalogo" && req.method === "GET") return json(await catalogoAdmin());
    if (ruta === "marca" && req.method === "PUT") return await guardarMarca(req);
    if (ruta === "palabra" && req.method === "POST") return await guardarPalabra(req);
    const m = /^palabra\/([a-z0-9-]+)$/.exec(ruta);
    if (m && req.method === "DELETE") return await borrarPalabra(m[1]);
    return json({ error: "Ruta desconocida." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor: " + (e.message || e) }, 500);
  }
};

async function catalogoAdmin() {
  const cat = await leerCatalogo();
  return {
    marca: cat.marca,
    palabras: cat.palabras.map((p) => ({ ...publica(p), publicada: p.publicada !== false, creada: p.creada, v: p.v })),
  };
}

async function guardarMarca(req) {
  const body = await req.json();
  const cat = await leerCatalogo();
  for (const k of Object.keys(MARCA_VACIA)) {
    if (typeof body[k] === "string") cat.marca[k] = body[k].trim().slice(0, 400);
  }
  cat.marca.instagram = cat.marca.instagram.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  cat.marca.dominio = cat.marca.dominio.replace(/\/+$/, "");
  if (cat.marca.dominio && !/^https?:\/\//.test(cat.marca.dominio)) cat.marca.dominio = "https://" + cat.marca.dominio;
  if (cat.marca.tienda && !/^https?:\/\//.test(cat.marca.tienda)) cat.marca.tienda = "https://" + cat.marca.tienda;
  await guardarCatalogo(cat);
  return json({ ok: true, marca: cat.marca });
}

function limpiar(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function guardarPalabra(req) {
  const form = await req.formData();
  let d;
  try { d = JSON.parse(form.get("datos") || "{}"); } catch { return json({ error: "Datos inválidos." }, 400); }

  const cat = await leerCatalogo();
  const original = d.slugOriginal;
  let p;
  if (original) {
    if (!esSlug(original)) return json({ error: "Palabra inválida." }, 400);
    p = cat.palabras.find((x) => x.slug === original);
    if (!p) return json({ error: "Esa palabra ya no existe. Recarga el panel." }, 404);
  } else {
    const slug = slugify(d.palabra);
    if (!slug) return json({ error: "La palabra necesita al menos una letra." }, 400);
    if (cat.palabras.some((x) => x.slug === slug)) return json({ error: `Ya existe una palabra con la dirección /p/${slug}.` }, 409);
    p = { slug, creada: new Date().toISOString() };
    cat.palabras.push(p);
  }

  for (const [k, max] of Object.entries(TEXTO_MAX)) p[k] = limpiar(d[k], max);
  if (!p.palabra || !p.es) return json({ error: "Faltan la palabra o su significado." }, 400);
  p.en = Array.isArray(d.en) ? d.en.map((x) => limpiar(x, 40)).filter(Boolean).slice(0, 12) : [];
  p.validado = !!d.validado;
  p.publicada = d.publicada !== false;

  // Archivos
  const st = medios();
  for (const campo of ["audio", "img", "og"]) {
    const f = form.get(campo);
    if (!f || typeof f === "string" || !f.size) continue;
    const lim = LIMITES[campo];
    const tipo = (f.type || "").toLowerCase().split(";")[0].trim();
    if (!lim.tipos.includes(tipo)) return json({ error: `Formato no permitido para ${campo}: ${tipo || "desconocido"}.` }, 415);
    if (f.size > lim.max) return json({ error: `El archivo de ${campo} pesa demasiado (máximo ${Math.round(lim.max / MB * 10) / 10} MB).` }, 413);
    await st.set(`${campo}/${p.slug}`, await f.arrayBuffer(), { metadata: { type: tipo } });
    p[campo === "img" ? "imagen" : campo] = true;
  }
  if (d.quitarImagen) { await st.delete(`img/${p.slug}`); p.imagen = false; }

  p.v = Date.now();
  await guardarCatalogo(cat);
  return json({ ok: true, palabra: { ...publica(p), publicada: p.publicada } });
}

async function borrarPalabra(slug) {
  const cat = await leerCatalogo();
  const i = cat.palabras.findIndex((x) => x.slug === slug);
  if (i < 0) return json({ error: "No existe." }, 404);
  cat.palabras.splice(i, 1);
  await guardarCatalogo(cat);
  const st = medios();
  await Promise.all(["audio", "img", "og"].map((t) => st.delete(`${t}/${slug}`).catch(() => {})));
  return json({ ok: true });
}

export const config = { path: "/api/admin/*" };
