// /api/admin/* -> todo lo que hace el panel central. Cada acción revisa quién la pide.
import {
  json, limpiar, slugify, esSlug, esId, nuevoId, normalizarDominio, PLATAFORMA,
  leerPlataforma, completarLengua, leerCatalogo, actualizarCatalogo, actualizarLenguas, actualizarUsuarios,
  datos, medios, publica, baseLengua, enviarAPapelera, moverMedio, mesActual,
  entrar, bloqueada, firmarSesion, quienEs, esGeneral, puedeLengua, leerUsuarios, hashClave, ADMIN_LISTO,
  registrar, firmaPrivada, ipDe,
} from "../lib/comun.mjs";

const MB = 1024 * 1024;
const LIMITES = {
  audio: { max: 4 * MB, tipos: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "video/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"] },
  img: { max: 2.5 * MB, tipos: ["image/png", "image/webp", "image/jpeg"] },
  og: { max: 1.5 * MB, tipos: ["image/png", "image/jpeg"] },
};
const TEXTO_MAX = { palabra: 60, es: 120, tipo: 40, guia: 60, texto: 600, sistema: 40, validadoPor: 120 };
const reservados = new Set([PLATAFORMA.dominio, PLATAFORMA.panel]);
const error = (msg, status) => Object.assign(new Error(msg), { status });

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
    if (ruta[0] === "cerrar-sesiones" && M === "POST") return await cerrarSesiones(req, yo);

    // Una lengua: /l/:id/...
    if (ruta[0] === "l") {
      const id = ruta[1];
      if (!esId(id) || !puedeLengua(yo, id)) return json({ error: "No tienes acceso a esa lengua." }, 403);
      const plat = await leerPlataforma();
      const lengua = plat.lenguas.find((l) => l.id === id);
      if (!lengua) return json({ error: "Esa lengua no existe." }, 404);
      const [, , que, extra, accion] = ruta;
      if (que === "palabras" && M === "GET") return await listarPalabras(lengua);
      if (que === "palabra" && M === "POST" && !extra) return await guardarPalabra(req, lengua, yo);
      if (que === "palabra" && M === "DELETE" && esSlug(extra)) return await borrarPalabra(req, lengua, extra, yo);
      if (que === "config" && M === "PUT") return await editarLengua(req, lengua, yo);
      if (que === "papelera" && M === "GET" && !extra) return await verPapelera(lengua);
      if (que === "papelera" && M === "POST" && extra && accion === "restaurar") return await restaurar(req, lengua, extra, yo);
      if (que === "respaldo" && M === "GET") return await respaldoLengua(lengua, url);
      if (que === "estadisticas" && M === "GET") return await estadisticas(lengua, url);
      return json({ error: "Ruta desconocida." }, 404);
    }

    // Solo administración general
    if (!esGeneral(yo)) return json({ error: "Solo la administración general puede hacer esto." }, 403);
    if (ruta[0] === "lenguas" && M === "POST") return await crearLengua(req, yo);
    if (ruta[0] === "lenguas" && M === "DELETE" && esId(ruta[1])) return await borrarLengua(req, ruta[1], yo);
    if (ruta[0] === "registro" && M === "GET") return await verRegistro(url);
    if (ruta[0] === "usuarios" && M === "GET") return json({ usuarios: (await leerUsuarios()).map(sinClave) });
    if (ruta[0] === "usuarios" && M === "POST") return await guardarUsuario(req, null, yo);
    if (ruta[0] === "usuarios" && M === "PUT" && ruta[1]) return await guardarUsuario(req, ruta[1], yo);
    if (ruta[0] === "usuarios" && M === "DELETE" && ruta[1]) return await borrarUsuario(req, ruta[1], yo);
    if (ruta[0] === "respaldos" && M === "GET" && !ruta[1]) return await listarRespaldos();
    if (ruta[0] === "respaldos" && M === "GET" && /^\d{4}-\d{2}-\d{2}$/.test(ruta[1] || "")) return await verRespaldo(ruta[1]);
    return json({ error: "Ruta desconocida." }, 404);
  } catch (e) {
    if (e.status) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Error del servidor: " + (e.message || e) }, 500);
  }
};

// Límite por visitante: frena a quien pruebe contraseñas o abuse del panel (devuelve 429).
export const config = { path: "/api/admin/*", rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] } };

// ---------------- sesión ----------------
async function login(req) {
  if (!ADMIN_LISTO()) return json({ error: "Falta configurar ADMIN_PASSWORD (mínimo 8 caracteres) en Netlify." }, 503);
  const b = await req.json().catch(() => ({}));
  const correo = String(b.correo || "").trim().toLowerCase() || "admin";
  const ip = ipDe(req);
  const min = await bloqueada(correo, ip);
  if (min) { await registrar(req, correo, "entrada bloqueada"); return json({ error: `Demasiados intentos fallidos. Espera ${min} minuto${min === 1 ? "" : "s"} y vuelve a intentar.` }, 429); }
  const u = await entrar(correo, b.clave, { ip });
  if (!u) {
    await registrar(req, correo, "entrada fallida");
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }
  await registrar(req, u.correo, "entrada");
  return json({ token: firmarSesion(u.correo, u.version), yo: u });
}

async function inicio(yo, url) {
  const plat = await leerPlataforma();
  const lenguas = plat.lenguas.filter((l) => puedeLengua(yo, l.id)).map((l) => ({ ...l, base: baseLengua(l, url.origin) }));
  return json({ yo, lenguas, porDefecto: plat.porDefecto, plataforma: PLATAFORMA });
}

async function cambiarClave(req, yo) {
  if (yo.correo === "admin") return json({ error: "La contraseña de administración general se cambia en Netlify (ADMIN_PASSWORD)." }, 400);
  const b = await req.json().catch(() => ({}));
  if (!(await entrar(yo.correo, b.actual, { contar: false }))) return json({ error: "La contraseña actual no es correcta." }, 400);
  if (String(b.nueva || "").length < 8) return json({ error: "La nueva contraseña necesita al menos 8 caracteres." }, 400);
  const sv = await actualizarUsuarios((doc) => {
    const u = doc.usuarios.find((x) => x.correo === yo.correo);
    if (!u) throw error("Tu cuenta ya no existe.", 404);
    Object.assign(u, hashClave(b.nueva));
    u.sv = (u.sv || 0) + 1;
    return u.sv;
  });
  await registrar(req, yo.correo, "cambió su contraseña");
  return json({ ok: true, token: firmarSesion(yo.correo, sv) });
}

async function cerrarSesiones(req, yo) {
  if (yo.correo === "admin") return json({ error: "Para cerrar todas las sesiones de administración general, cambia ADMIN_PASSWORD en Netlify." }, 400);
  const sv = await actualizarUsuarios((doc) => {
    const u = doc.usuarios.find((x) => x.correo === yo.correo);
    if (!u) throw error("Tu cuenta ya no existe.", 404);
    u.sv = (u.sv || 0) + 1;
    return u.sv;
  });
  await registrar(req, yo.correo, "cerró sus otras sesiones");
  return json({ ok: true, token: firmarSesion(yo.correo, sv) });
}

async function verRegistro(url) {
  const mes = /^\d{4}-\d{2}$/.test(url.searchParams.get("mes") || "") ? url.searchParams.get("mes") : mesActual();
  const st = datos();
  const [doc, lista] = await Promise.all([st.get("registro/" + mes, { type: "json" }), st.list({ prefix: "registro/" })]);
  const meses = [...new Set([...lista.blobs.map((b) => b.key.split("/").pop()), mesActual()])].sort().reverse();
  return json({ mes, meses, entradas: ((doc && doc.e) || []).slice().reverse() });
}

// ---------------- palabras ----------------
function vistaAdmin(p, id) {
  return {
    ...publica(p, id),
    publicada: p.publicada !== false,
    creada: p.creada,
    v: p.v,
    audios: (p.audios || []).map((a) => ({ ...a, url: urlPrivada(id, p.slug, a) })),
  };
}

// Enlace que funciona aunque la voz no tenga autorización (solo lo recibe quien está en el panel).
function urlPrivada(L, slug, a) {
  const clave = `${L}/audio/${slug}/${a.id}`;
  return `/media/${clave}?v=${a.v || 0}&k=${firmaPrivada(clave)}`;
}

async function listarPalabras(lengua) {
  const { palabras } = await leerCatalogo(lengua.id);
  return json({ palabras: palabras.map((p) => vistaAdmin(p, lengua.id)) });
}

function tipoValido(f, campo) {
  const lim = LIMITES[campo];
  const tipo = (f.type || "").toLowerCase().split(";")[0].trim();
  if (!lim.tipos.includes(tipo)) throw error(`Formato no permitido (${tipo || "desconocido"}).`, 415);
  if (f.size > lim.max) throw error(`El archivo pesa demasiado (máximo ${Math.round((lim.max / MB) * 10) / 10} MB).`, 413);
  return tipo;
}
const archivo = (form, campo) => { const f = form.get(campo); return f && typeof f !== "string" && f.size ? f : null; };

async function guardarPalabra(req, lengua, yo) {
  const form = await req.formData();
  let d;
  try { d = JSON.parse(form.get("datos") || "{}"); } catch { return json({ error: "Datos inválidos." }, 400); }
  const L = lengua.id;
  const nueva = !d.slugOriginal;
  const slug = nueva ? slugify(d.palabra) : d.slugOriginal;
  if (!esSlug(slug)) return json({ error: "La palabra necesita al menos una letra." }, 400);
  if (!limpiar(d.palabra, 60) || !limpiar(d.es, 120)) return json({ error: "Faltan la palabra o su significado." }, 400);

  // Revisión rápida antes de subir archivos.
  const previo = (await leerCatalogo(L)).palabras.find((x) => x.slug === slug);
  if (nueva && previo) return json({ error: `Ya existe una palabra con la dirección /p/${slug}.` }, 409);
  if (!nueva && !previo) return json({ error: "Esa palabra ya no existe. Recarga el panel." }, 404);
  if (!nueva && d.vBase && previo.v && previo.v !== d.vBase) {
    return json({ error: "Otra persona guardó cambios en esta palabra mientras la editabas. Tus cambios no se guardaron: recarga la palabra y vuelve a hacerlos." }, 409);
  }

  // 1) Subir archivos nuevos
  const md = medios(), subidos = [], ahora = Date.now();
  const nuevosAudios = {};
  try {
    for (const a of Array.isArray(d.audios) ? d.audios.slice(0, 10) : []) {
      if (!a || !a.archivo) continue;
      const f = archivo(form, a.archivo); if (!f) continue;
      const tipo = tipoValido(f, "audio"), id = nuevoId(), clave = `${L}/audio/${slug}/${id}`;
      const publico = !!(a.consentimiento && a.consentimiento.ok);
      await md.set(clave, await f.arrayBuffer(), { metadata: { type: tipo, publico } });
      subidos.push(clave); nuevosAudios[a.archivo] = id;
    }
    for (const campo of ["img", "og"]) {
      const f = archivo(form, campo); if (!f) continue;
      const tipo = tipoValido(f, campo), clave = `${L}/${campo}/${slug}`;
      await md.set(clave, await f.arrayBuffer(), { metadata: { type: tipo } });
    }
  } catch (e) {
    for (const k of subidos) await md.delete(k).catch(() => {});
    throw e;
  }

  // 2) Guardar en el catálogo de forma segura
  let quitados = [], cambioPublico = [];
  let p;
  try {
    p = await actualizarCatalogo(L, (doc) => {
      let x = doc.palabras.find((w) => w.slug === slug);
      if (nueva) {
        if (x) throw error(`Ya existe una palabra con la dirección /p/${slug}.`, 409);
        x = { slug, creada: new Date().toISOString(), creadaPor: yo.correo, audios: [] };
        doc.palabras.unshift(x);
      } else {
        if (!x) throw error("Esa palabra ya no existe. Recarga el panel.", 404);
        if (d.vBase && x.v && x.v !== d.vBase) throw error("Otra persona guardó cambios en esta palabra mientras la editabas. Recarga la palabra y vuelve a hacer tus cambios.", 409);
      }
      for (const [k, max] of Object.entries(TEXTO_MAX)) x[k] = limpiar(d[k], max);
      x.en = Array.isArray(d.en) ? d.en.map((v) => limpiar(v, 40)).filter(Boolean).slice(0, 12) : [];
      x.variantes = Array.isArray(d.variantes)
        ? d.variantes.map((v) => ({ texto: limpiar(v && v.texto, 60), sistema: limpiar(v && v.sistema, 40) })).filter((v) => v.texto).slice(0, 8) : [];
      x.validado = !!d.validado;
      x.publicada = d.publicada !== false;
      x.editadaPor = yo.correo;

      const previos = new Map((x.audios || []).map((a) => [a.id, a]));
      const lista = [];
      quitados = []; cambioPublico = [];
      for (const a of Array.isArray(d.audios) ? d.audios.slice(0, 10) : []) {
        const cons = a && a.consentimiento ? { ok: !!a.consentimiento.ok, nota: limpiar(a.consentimiento.nota, 300) } : { ok: false, nota: "" };
        if (a.id && previos.has(a.id)) {
          const prev = previos.get(a.id); previos.delete(a.id);
          if (a.quitar) { quitados.push(a.id); continue; }
          const c = prev.consentimiento || {};
          const cambia = c.ok !== cons.ok || (c.nota || "") !== cons.nota;
          if (!!c.ok !== cons.ok) cambioPublico.push({ id: a.id, publico: cons.ok });
          lista.push({ ...prev, voz: limpiar(a.voz, 80), variante: limpiar(a.variante, 60), consentimiento: cambia ? { ...cons, fecha: new Date().toISOString(), por: yo.correo } : c });
        } else if (a.archivo && nuevosAudios[a.archivo]) {
          lista.push({ id: nuevosAudios[a.archivo], v: ahora, voz: limpiar(a.voz, 80), variante: limpiar(a.variante, 60), consentimiento: { ...cons, fecha: new Date().toISOString(), por: yo.correo }, subidoPor: yo.correo });
        }
      }
      for (const id of previos.keys()) quitados.push(id);
      x.audios = lista;
      if (archivo(form, "img")) x.imagen = true;
      if (archivo(form, "og")) x.og = true;
      if (d.quitarImagen && !archivo(form, "img")) x.imagen = false;
      x.v = ahora;
      return x;
    });
  } catch (e) {
    for (const k of subidos) await md.delete(k).catch(() => {});
    throw e;
  }

  // 3) Si cambió la autorización de una voz, su archivo pasa a público o a privado
  for (const c of cambioPublico) {
    const clave = `${L}/audio/${slug}/${c.id}`;
    const r = await md.getWithMetadata(clave, { type: "arrayBuffer" }).catch(() => null);
    if (r && r.data) await md.set(clave, r.data, { metadata: { ...(r.metadata || {}), publico: c.publico } });
  }
  await registrar(req, yo.correo, nueva ? "creó palabra" : "editó palabra", { l: L, s: slug, d: p.palabra });

  // 4) Lo quitado va a la papelera (se borra solo a los 30 días)
  for (const id of quitados) await moverMedio(`${L}/audio/${slug}/${id}`, `papelera/${ahora}-voz/${L}/audio/${slug}/${id}`).catch(() => {});
  if (d.quitarImagen && !archivo(form, "img")) await moverMedio(`${L}/img/${slug}`, `papelera/${ahora}-img/${L}/img/${slug}`).catch(() => {});

  return json({ ok: true, palabra: vistaAdmin(p, L) });
}

async function borrarPalabra(req, lengua, slug, yo) {
  const p = await actualizarCatalogo(lengua.id, (doc) => {
    const i = doc.palabras.findIndex((x) => x.slug === slug);
    if (i < 0) throw error("No existe.", 404);
    return doc.palabras.splice(i, 1)[0];
  });
  await enviarAPapelera(lengua.id, p, yo.correo);
  await registrar(req, yo.correo, "eliminó palabra", { l: lengua.id, s: slug, d: p.palabra });
  return json({ ok: true });
}

async function verPapelera(lengua) {
  const st = datos();
  const { blobs } = await st.list({ prefix: `papelera/${lengua.id}/` });
  const items = [];
  for (const b of blobs.slice(-60)) {
    const x = await st.get(b.key, { type: "json" });
    if (x) items.push({ id: x.id, palabra: x.palabra.palabra, es: x.palabra.es, borrada: x.borrada, por: x.por });
  }
  items.sort((a, b) => (a.borrada < b.borrada ? 1 : -1));
  return json({ items, dias: 30 });
}

async function restaurar(req, lengua, id, yo) {
  if (!/^\d+-[a-z0-9-]+$/.test(id)) return json({ error: "Elemento inválido." }, 400);
  const st = datos(), clave = `papelera/${lengua.id}/${id}`;
  const x = await st.get(clave, { type: "json" });
  if (!x) return json({ error: "Ya no está en la papelera." }, 404);
  await actualizarCatalogo(lengua.id, (doc) => {
    if (doc.palabras.some((w) => w.slug === x.palabra.slug)) throw error(`Ya existe otra palabra con la dirección /p/${x.palabra.slug}. Elimínala o cámbiala antes de restaurar.`, 409);
    doc.palabras.unshift({ ...x.palabra, restauradaPor: yo.correo, v: Date.now() });
  });
  for (const k of x.claves || []) await moverMedio(`papelera/${id}/${k}`, k).catch(() => {});
  await st.delete(clave);
  await registrar(req, yo.correo, "restauró palabra", { l: lengua.id, s: x.palabra.slug, d: x.palabra.palabra });
  return json({ ok: true });
}

// ---------------- respaldos ----------------
async function respaldoLengua(lengua, url) {
  const { palabras } = await leerCatalogo(lengua.id);
  return json({
    tipo: "imita-respaldo-lengua", version: 1, fecha: new Date().toISOString(),
    lengua: { ...lengua, base: baseLengua(lengua, url.origin) },
    palabras: palabras.map((p) => ({ ...p, archivos: [
      ...(p.audios || []).map((a) => ({ clave: `audio/${p.slug}/${a.id}`, url: urlPrivada(lengua.id, p.slug, a) })),
      ...(p.imagen ? [{ clave: `img/${p.slug}`, url: `/media/${lengua.id}/img/${p.slug}` }] : []),
    ] })),
  });
}
async function listarRespaldos() {
  const { blobs } = await datos().list({ prefix: "respaldos/" });
  return json({ respaldos: blobs.map((b) => b.key.replace("respaldos/", "")).sort().reverse() });
}
async function verRespaldo(fecha) {
  const r = await datos().get("respaldos/" + fecha, { type: "json" });
  return r ? json(r) : json({ error: "No existe ese respaldo." }, 404);
}

// ---------------- estadísticas ----------------
async function estadisticas(lengua, url) {
  const mes = /^\d{4}-\d{2}$/.test(url.searchParams.get("mes") || "") ? url.searchParams.get("mes") : mesActual();
  const st = datos();
  const [doc, lista] = await Promise.all([
    st.get(`stats/${lengua.id}/${mes}`, { type: "json" }),
    st.list({ prefix: `stats/${lengua.id}/` }),
  ]);
  const meses = lista.blobs.map((b) => b.key.split("/").pop()).filter((m) => /^\d{4}-\d{2}$/.test(m));
  if (!meses.includes(mesActual())) meses.push(mesActual());
  return json({ mes, meses: [...new Set(meses)].sort().reverse(), datos: (doc && doc.p) || {}, dias: (doc && doc.d) || {} });
}

// ---------------- lenguas ----------------
function limpiarLista(v, max, n) {
  const arr = Array.isArray(v) ? v : String(v || "").split(",");
  return arr.map((x) => limpiar(String(x), max)).filter(Boolean).slice(0, n);
}

async function editarLengua(req, lengua, yo) {
  const b = await req.json().catch(() => ({}));
  let dominios;
  if (esGeneral(yo) && b.dominios !== undefined) {
    dominios = limpiarLista(b.dominios, 100, 6).map(normalizarDominio).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
    for (const d of dominios) if (reservados.has(d)) return json({ error: `${d} es de la plataforma; no se puede asignar a una lengua.` }, 400);
  }
  const l = await actualizarLenguas((doc) => {
    const l = doc.lenguas.find((x) => x.id === lengua.id);
    if (!l) throw error("Esa lengua ya no existe.", 404);
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
      if (dominios) {
        for (const d of dominios) {
          const otra = doc.lenguas.find((x) => x.id !== l.id && (x.dominios || []).map(normalizarDominio).includes(d));
          if (otra) throw error(`${d} ya está asignado a ${otra.nombre}.`, 409);
        }
        l.dominios = dominios;
      }
      if (b.porDefecto) doc.porDefecto = l.id;
    }
    return l;
  });
  await registrar(req, yo.correo, "editó lengua", { l: lengua.id });
  return json({ ok: true, lengua: { ...l, base: baseLengua(l, new URL(req.url).origin) } });
}

async function crearLengua(req, yo) {
  const b = await req.json().catch(() => ({}));
  const id = slugify(b.id || b.nombre).replace(/-/g, "");
  const nombre = limpiar(b.nombre, 60);
  if (!esId(id) || !nombre) return json({ error: "Indica el nombre y un código corto (2 a 30 letras o números, sin espacios)." }, 400);
  await leerPlataforma(); // asegura la migración inicial
  const l = await actualizarLenguas((doc) => {
    if (doc.lenguas.some((x) => x.id === id)) throw error(`Ya existe la lengua con código «${id}».`, 409);
    const nueva = completarLengua({ id, nombre, nombreLengua: limpiar(b.nombreLengua, 80), marca: { nombre } });
    doc.lenguas.push(nueva);
    if (!doc.porDefecto) doc.porDefecto = id;
    return nueva;
  });
  await registrar(req, yo.correo, "creó lengua", { l: id });
  return json({ ok: true, lengua: { ...l, base: baseLengua(l, new URL(req.url).origin) } });
}

async function borrarLengua(req, id, yo) {
  const { palabras } = await leerCatalogo(id);
  if (palabras.length) return json({ error: "Esta lengua tiene palabras. Elimínalas primero, o desactívala." }, 409);
  await actualizarLenguas((doc) => {
    doc.lenguas = doc.lenguas.filter((l) => l.id !== id);
    if (doc.porDefecto === id) doc.porDefecto = doc.lenguas[0] ? doc.lenguas[0].id : "";
  });
  await registrar(req, yo.correo, "eliminó lengua", { l: id });
  return json({ ok: true });
}

// ---------------- personas ----------------
const sinClave = (u) => ({ correo: u.correo, nombre: u.nombre, rol: u.rol, lenguas: u.lenguas, activo: u.activo !== false, creado: u.creado });

async function guardarUsuario(req, correoUrl, yo) {
  const b = await req.json().catch(() => ({}));
  const plat = await leerPlataforma();
  const lenguasOk = (Array.isArray(b.lenguas) ? b.lenguas : []).filter((id) => plat.lenguas.some((l) => l.id === id));
  const rol = b.rol === "general" ? "general" : "editor";
  if (b.clave && String(b.clave).length < 8) return json({ error: "La contraseña necesita al menos 8 caracteres." }, 400);
  if (correoUrl) {
    const u = await actualizarUsuarios((doc) => {
      const u = doc.usuarios.find((x) => x.correo === correoUrl);
      if (!u) throw error("No existe esa persona.", 404);
      if (typeof b.nombre === "string") u.nombre = limpiar(b.nombre, 80);
      u.lenguas = lenguasOk; u.rol = rol;
      const cerrar = !!b.clave || (typeof b.activo === "boolean" && !b.activo && u.activo !== false) || !!b.cerrarSesiones;
      if (typeof b.activo === "boolean") u.activo = b.activo;
      if (b.clave) Object.assign(u, hashClave(b.clave));
      if (cerrar) u.sv = (u.sv || 0) + 1;
      return u;
    });
    await registrar(req, yo.correo, "editó persona", { d: correoUrl + (b.clave ? " (nueva contraseña)" : "") + (b.activo === false ? " (sin acceso)" : "") });
    return json({ ok: true, usuario: sinClave(u) });
  }
  const correo = String(b.correo || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ error: "Escribe un correo válido." }, 400);
  if (String(b.clave || "").length < 8) return json({ error: "La contraseña inicial necesita al menos 8 caracteres." }, 400);
  const u = await actualizarUsuarios((doc) => {
    if (doc.usuarios.some((x) => x.correo === correo)) throw error("Ya existe una persona con ese correo.", 409);
    const u = { correo, nombre: limpiar(b.nombre, 80), rol, lenguas: lenguasOk, activo: true, creado: new Date().toISOString(), ...hashClave(b.clave) };
    doc.usuarios.push(u);
    return u;
  });
  await registrar(req, yo.correo, "agregó persona", { d: correo });
  return json({ ok: true, usuario: sinClave(u) });
}

async function borrarUsuario(req, correo, yo) {
  await actualizarUsuarios((doc) => {
    const n = doc.usuarios.length;
    doc.usuarios = doc.usuarios.filter((x) => x.correo !== correo);
    if (doc.usuarios.length === n) throw error("No existe esa persona.", 404);
  });
  await registrar(req, yo.correo, "quitó acceso", { d: correo });
  return json({ ok: true });
}
