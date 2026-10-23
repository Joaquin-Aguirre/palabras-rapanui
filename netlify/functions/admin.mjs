// /api/admin/* -> todo lo que hace el panel central. Cada acción revisa quién la pide.
import {
  json, limpiar, slugify, esSlug, esId, nuevoId, normalizarDominio, PLATAFORMA,
  leerPlataforma, guardarLenguas, completarLengua, leerCatalogo, guardarCatalogo, medios, publica, baseLengua,
  entrar, firmarSesion, quienEs, esGeneral, puedeLengua, leerUsuarios, guardarUsuarios, hashClave, ADMIN_LISTO,
} from "../lib/comun.mjs";

const MB = 1024 * 1024;
const LIMITES = {
  audio: { max: 4 * MB, tipos: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "video/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"] },
  img: { max: 2.5 * MB, tipos: ["image/png", "image/webp", "image/jpeg"] },
  og: { max: 1.5 * MB, tipos: ["image/png", "image/jpeg"] },
};
const TEXTO_MAX = { palabra: 60, es: 120, tipo: 40, guia: 60, texto: 600, sistema: 40, validadoPor: 120 };
const reservados = new Set([PLATAFORMA.dominio, PLATAFORMA.panel]);

export default async (req) => {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/api\/admin\/?/, "").replace(/\/+$/, "").split("/").map(decodeURIComponent);
  const M = req.method;

  try {
    if (ruta[0] === "login" && M === "POST") return await login(req);

    if (!ADMIN_LISTO()) return json({ error: "Falta configurar ADMIN_PASSWORD (mínimo 8 caracteres) en Netlify." }, 503);
    const yo = await quienEs(req);
    if (!yo) return json({ error: "Tu sesión terminó. Vuelve a entrar." }, 401);

    if (ruta[0] === "yo" && M === "GET") return await inicio(yo, url);
    if (ruta[0] === "clave" && M === "POST") return await cambiarClave(req, yo);

    // Una lengua: /l/:id/...
    if (ruta[0] === "l") {
      const id = ruta[1];
      if (!esId(id) || !puedeLengua(yo, id)) return json({ error: "No tienes acceso a esa lengua." }, 403);
      const plat = await leerPlataforma();
      const lengua = plat.lenguas.find((l) => l.id === id);
      if (!lengua) return json({ error: "Esa lengua no existe." }, 404);
      if (ruta[2] === "palabras" && M === "GET") return await listarPalabras(lengua, url);
      if (ruta[2] === "palabra" && M === "POST" && !ruta[3]) return await guardarPalabra(req, lengua, yo);
      if (ruta[2] === "palabra" && M === "DELETE" && esSlug(ruta[3])) return await borrarPalabra(lengua, ruta[3]);
      if (ruta[2] === "config" && M === "PUT") return await editarLengua(req, plat, lengua, yo);
      return json({ error: "Ruta desconocida." }, 404);
    }

    // Solo administración general
    if (!esGeneral(yo)) return json({ error: "Solo la administración general puede hacer esto." }, 403);
    if (ruta[0] === "lenguas" && M === "POST") return await crearLengua(req);
    if (ruta[0] === "lenguas" && M === "DELETE" && esId(ruta[1])) return await borrarLengua(ruta[1]);
    if (ruta[0] === "usuarios" && M === "GET") return json({ usuarios: (await leerUsuarios()).map(sinClave) });
    if (ruta[0] === "usuarios" && M === "POST") return await guardarUsuario(req, null);
    if (ruta[0] === "usuarios" && M === "PUT" && ruta[1]) return await guardarUsuario(req, ruta[1]);
    if (ruta[0] === "usuarios" && M === "DELETE" && ruta[1]) return await borrarUsuario(ruta[1]);
    return json({ error: "Ruta desconocida." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor: " + (e.message || e) }, 500);
  }
};

export const config = { path: "/api/admin/*" };

// ---------------- sesión ----------------
async function login(req) {
  if (!ADMIN_LISTO()) return json({ error: "Falta configurar ADMIN_PASSWORD (mínimo 8 caracteres) en Netlify." }, 503);
  const b = await req.json().catch(() => ({}));
  const u = await entrar(b.correo, b.clave);
  if (!u) { await new Promise((r) => setTimeout(r, 600)); return json({ error: "Correo o contraseña incorrectos." }, 401); }
  return json({ token: firmarSesion(u.correo), yo: u });
}

async function inicio(yo, url) {
  const plat = await leerPlataforma();
  const lenguas = plat.lenguas.filter((l) => puedeLengua(yo, l.id)).map((l) => ({ ...l, base: baseLengua(l, url.origin) }));
  return json({ yo, lenguas, porDefecto: plat.porDefecto, plataforma: PLATAFORMA });
}

async function cambiarClave(req, yo) {
  if (yo.correo === "admin") return json({ error: "La contraseña de administración general se cambia en Netlify (ADMIN_PASSWORD)." }, 400);
  const b = await req.json().catch(() => ({}));
  if (!(await entrar(yo.correo, b.actual))) return json({ error: "La contraseña actual no es correcta." }, 400);
  if (String(b.nueva || "").length < 8) return json({ error: "La nueva contraseña necesita al menos 8 caracteres." }, 400);
  const us = await leerUsuarios();
  const u = us.find((x) => x.correo === yo.correo);
  Object.assign(u, hashClave(b.nueva));
  await guardarUsuarios(us);
  return json({ ok: true });
}

// ---------------- palabras ----------------
function vistaAdmin(p, id) {
  return {
    ...publica(p, id),
    publicada: p.publicada !== false,
    creada: p.creada,
    v: p.v,
    audios: (p.audios || []).map((a) => ({ ...a, url: `/media/${id}/audio/${p.slug}/${a.id}?v=${a.v || p.v || 0}` })),
  };
}

async function listarPalabras(lengua) {
  const { palabras } = await leerCatalogo(lengua.id);
  return json({ palabras: palabras.map((p) => vistaAdmin(p, lengua.id)) });
}

async function subir(st, clave, f, campo) {
  const lim = LIMITES[campo];
  const tipo = (f.type || "").toLowerCase().split(";")[0].trim();
  if (!lim.tipos.includes(tipo)) throw Object.assign(new Error(`Formato no permitido (${tipo || "desconocido"}).`), { status: 415 });
  if (f.size > lim.max) throw Object.assign(new Error(`El archivo pesa demasiado (máximo ${Math.round((lim.max / MB) * 10) / 10} MB).`), { status: 413 });
  await st.set(clave, await f.arrayBuffer(), { metadata: { type: tipo } });
}

async function guardarPalabra(req, lengua, yo) {
  const form = await req.formData();
  let d;
  try { d = JSON.parse(form.get("datos") || "{}"); } catch { return json({ error: "Datos inválidos." }, 400); }
  const L = lengua.id;
  const cat = await leerCatalogo(L);
  let p, nueva = false;
  if (d.slugOriginal) {
    p = cat.palabras.find((x) => x.slug === d.slugOriginal);
    if (!p) return json({ error: "Esa palabra ya no existe. Recarga el panel." }, 404);
  } else {
    const slug = slugify(d.palabra);
    if (!slug) return json({ error: "La palabra necesita al menos una letra." }, 400);
    if (cat.palabras.some((x) => x.slug === slug)) return json({ error: `Ya existe una palabra con la dirección /p/${slug}.` }, 409);
    p = { slug, creada: new Date().toISOString(), creadaPor: yo.correo, audios: [] };
    nueva = true;
  }
  for (const [k, max] of Object.entries(TEXTO_MAX)) p[k] = limpiar(d[k], max);
  if (!p.palabra || !p.es) return json({ error: "Faltan la palabra o su significado." }, 400);
  p.en = Array.isArray(d.en) ? d.en.map((x) => limpiar(x, 40)).filter(Boolean).slice(0, 12) : [];
  p.variantes = Array.isArray(d.variantes)
    ? d.variantes.map((v) => ({ texto: limpiar(v && v.texto, 60), sistema: limpiar(v && v.sistema, 40) })).filter((v) => v.texto).slice(0, 8)
    : [];
  p.validado = !!d.validado;
  p.publicada = d.publicada !== false;
  p.editadaPor = yo.correo;

  const st = medios();
  const ahora = Date.now();
  try {
    // Audios: actualizar, quitar o agregar. Cada voz necesita consentimiento para publicarse.
    const previos = new Map((p.audios || []).map((a) => [a.id, a]));
    const resultado = [];
    for (const a of Array.isArray(d.audios) ? d.audios.slice(0, 10) : []) {
      const cons = a && a.consentimiento ? { ok: !!a.consentimiento.ok, nota: limpiar(a.consentimiento.nota, 300) } : { ok: false, nota: "" };
      if (a.id && previos.has(a.id)) {
        const prev = previos.get(a.id); previos.delete(a.id);
        if (a.quitar) { await st.delete(`${L}/audio/${p.slug}/${a.id}`); continue; }
        const c = prev.consentimiento || {};
        const cambia = c.ok !== cons.ok || (c.nota || "") !== cons.nota;
        resultado.push({ ...prev, voz: limpiar(a.voz, 80), variante: limpiar(a.variante, 60), consentimiento: cambia ? { ...cons, fecha: new Date().toISOString(), por: yo.correo } : c });
      } else if (a.archivo) {
        const f = form.get(a.archivo);
        if (!f || typeof f === "string" || !f.size) continue;
        const id = nuevoId();
        await subir(st, `${L}/audio/${p.slug}/${id}`, f, "audio");
        resultado.push({ id, v: ahora, voz: limpiar(a.voz, 80), variante: limpiar(a.variante, 60), consentimiento: { ...cons, fecha: new Date().toISOString(), por: yo.correo }, subidoPor: yo.correo });
      }
    }
    for (const id of previos.keys()) await st.delete(`${L}/audio/${p.slug}/${id}`);   // los que el panel ya no envía
    p.audios = resultado;

    for (const campo of ["img", "og"]) {
      const f = form.get(campo);
      if (!f || typeof f === "string" || !f.size) continue;
      await subir(st, `${L}/${campo}/${p.slug}`, f, campo);
      p[campo === "img" ? "imagen" : "og"] = true;
    }
    if (d.quitarImagen) { await st.delete(`${L}/img/${p.slug}`); p.imagen = false; }
  } catch (e) {
    if (e.status) return json({ error: e.message }, e.status);
    throw e;
  }

  p.v = ahora;
  if (nueva) cat.palabras.unshift(p);
  await guardarCatalogo(L, cat);
  return json({ ok: true, palabra: vistaAdmin(p, L) });
}

async function borrarPalabra(lengua, slug) {
  const cat = await leerCatalogo(lengua.id);
  const i = cat.palabras.findIndex((x) => x.slug === slug);
  if (i < 0) return json({ error: "No existe." }, 404);
  const [p] = cat.palabras.splice(i, 1);
  await guardarCatalogo(lengua.id, cat);
  const st = medios();
  const claves = [`${lengua.id}/img/${slug}`, `${lengua.id}/og/${slug}`, ...(p.audios || []).map((a) => `${lengua.id}/audio/${slug}/${a.id}`)];
  await Promise.all(claves.map((k) => st.delete(k).catch(() => {})));
  return json({ ok: true });
}

// ---------------- lenguas ----------------
function limpiarLista(v, max, n) {
  const arr = Array.isArray(v) ? v : String(v || "").split(",");
  return arr.map((x) => limpiar(String(x), max)).filter(Boolean).slice(0, n);
}

async function editarLengua(req, plat, lengua, yo) {
  const b = await req.json().catch(() => ({}));
  const l = completarLengua(lengua);
  if (typeof b.nombreLengua === "string") l.nombreLengua = limpiar(b.nombreLengua, 80);
  if (b.caracteres !== undefined) l.caracteres = limpiarLista(b.caracteres, 4, 12);
  if (b.sistemas !== undefined) l.sistemas = limpiarLista(b.sistemas, 40, 8);
  if (typeof b.acento === "string" && /^#[0-9a-fA-F]{6}$/.test(b.acento)) l.acento = b.acento;
  if (b.marca && typeof b.marca === "object") {
    for (const k of Object.keys(l.marca)) if (typeof b.marca[k] === "string") l.marca[k] = limpiar(b.marca[k], 400);
    l.marca.instagram = l.marca.instagram.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
    if (l.marca.tienda && !/^https?:\/\//.test(l.marca.tienda)) l.marca.tienda = "https://" + l.marca.tienda;
  }
  if (esGeneral(yo)) {
    if (typeof b.nombre === "string" && limpiar(b.nombre, 60)) l.nombre = limpiar(b.nombre, 60);
    if (typeof b.activa === "boolean") l.activa = b.activa;
    if (b.dominios !== undefined) {
      const doms = limpiarLista(b.dominios, 100, 6).map(normalizarDominio).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
      for (const d of doms) {
        if (reservados.has(d)) return json({ error: `${d} es de la plataforma; no se puede asignar a una lengua.` }, 400);
        const otra = plat.lenguas.find((x) => x.id !== l.id && x.dominios.map(normalizarDominio).includes(d));
        if (otra) return json({ error: `${d} ya está asignado a ${otra.nombre}.` }, 409);
      }
      l.dominios = doms;
    }
  }
  const lenguas = plat.lenguas.map((x) => (x.id === l.id ? l : x));
  await guardarLenguas(lenguas, esGeneral(yo) && b.porDefecto ? l.id : undefined);
  return json({ ok: true, lengua: { ...l, base: baseLengua(l, new URL(req.url).origin) } });
}

async function crearLengua(req) {
  const b = await req.json().catch(() => ({}));
  const plat = await leerPlataforma();
  const id = slugify(b.id || b.nombre).replace(/-/g, "");
  const nombre = limpiar(b.nombre, 60);
  if (!esId(id) || !nombre) return json({ error: "Indica el nombre y un código corto (2 a 30 letras o números, sin espacios)." }, 400);
  if (plat.lenguas.some((l) => l.id === id)) return json({ error: `Ya existe la lengua con código «${id}».` }, 409);
  const l = completarLengua({ id, nombre, nombreLengua: limpiar(b.nombreLengua, 80), marca: { nombre } });
  await guardarLenguas([...plat.lenguas, l]);
  await guardarCatalogo(id, { palabras: [] });
  return json({ ok: true, lengua: { ...l, base: baseLengua(l, new URL(req.url).origin) } });
}

async function borrarLengua(id) {
  const plat = await leerPlataforma();
  const { palabras } = await leerCatalogo(id);
  if (palabras.length) return json({ error: "Esta lengua tiene palabras. Elimínalas primero, o desactívala." }, 409);
  await guardarLenguas(plat.lenguas.filter((l) => l.id !== id), plat.porDefecto === id ? undefined : plat.porDefecto);
  return json({ ok: true });
}

// ---------------- personas ----------------
const sinClave = (u) => ({ correo: u.correo, nombre: u.nombre, rol: u.rol, lenguas: u.lenguas, activo: u.activo !== false, creado: u.creado });

async function guardarUsuario(req, correoUrl) {
  const b = await req.json().catch(() => ({}));
  const us = await leerUsuarios();
  const plat = await leerPlataforma();
  const lenguasOk = (Array.isArray(b.lenguas) ? b.lenguas : []).filter((id) => plat.lenguas.some((l) => l.id === id));
  const rol = b.rol === "general" ? "general" : "editor";
  if (correoUrl) {
    const u = us.find((x) => x.correo === correoUrl);
    if (!u) return json({ error: "No existe esa persona." }, 404);
    if (typeof b.nombre === "string") u.nombre = limpiar(b.nombre, 80);
    u.lenguas = lenguasOk; u.rol = rol;
    if (typeof b.activo === "boolean") u.activo = b.activo;
    if (b.clave) {
      if (String(b.clave).length < 8) return json({ error: "La contraseña necesita al menos 8 caracteres." }, 400);
      Object.assign(u, hashClave(b.clave));
    }
    await guardarUsuarios(us);
    return json({ ok: true, usuario: sinClave(u) });
  }
  const correo = String(b.correo || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ error: "Escribe un correo válido." }, 400);
  if (us.some((x) => x.correo === correo)) return json({ error: "Ya existe una persona con ese correo." }, 409);
  if (String(b.clave || "").length < 8) return json({ error: "La contraseña inicial necesita al menos 8 caracteres." }, 400);
  const u = { correo, nombre: limpiar(b.nombre, 80), rol, lenguas: lenguasOk, activo: true, creado: new Date().toISOString(), ...hashClave(b.clave) };
  us.push(u);
  await guardarUsuarios(us);
  return json({ ok: true, usuario: sinClave(u) });
}

async function borrarUsuario(correo) {
  const us = await leerUsuarios();
  const resto = us.filter((x) => x.correo !== correo);
  if (resto.length === us.length) return json({ error: "No existe esa persona." }, 404);
  await guardarUsuarios(resto);
  return json({ ok: true });
}
