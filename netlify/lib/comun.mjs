// Núcleo compartido de la plataforma IMITA: lenguas, palabras, medios y accesos.
import { getStore } from "@netlify/blobs";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Almacenamiento (Netlify Blobs, consistencia fuerte: lo guardado se ve al tiro)
//   datos:  "lenguas"            lista de lenguas y su configuración
//           "catalogo/<lengua>"  palabras de cada lengua
//           "usuarios"           personas con acceso al panel
//   medios: "<lengua>/audio/<slug>/<id>", "<lengua>/img/<slug>", "<lengua>/og/<slug>"
// ---------------------------------------------------------------------------
export const datos = () => getStore({ name: "datos", consistency: "strong" });
export const medios = () => getStore({ name: "medios", consistency: "strong" });

export const PLATAFORMA = { nombre: "IMITA", dominio: "imita.cl", panel: "panel.imita.cl" };

// ---------- utilidades ----------
export function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ŋ/gi, "ng").replace(/[ʻʼ‘’'`]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
export const esSlug = (s) => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 60;
export const esId = (s) => typeof s === "string" && /^[a-z0-9]{2,30}$/.test(s);
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
export const limpiar = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const nuevoId = () => randomBytes(5).toString("hex");
export function normalizarHost(h) {
  return String(h || "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}
export function normalizarDominio(d) {
  return normalizarHost(String(d || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""));
}

// ---------- lenguas ----------
export const LENGUA_BASE = {
  id: "",
  nombre: "",            // "Rapa nui"
  nombreLengua: "",      // como se nombra en la propia lengua: "Vānaŋa Rapa Nui"
  activa: true,
  dominios: [],          // ["vananga.cl"]; el primero es el que va en los QR
  caracteres: [],        // botones del panel: ["ʻ", "ŋ"]
  sistemas: [],          // alfabetos o formas de escritura, ej. ["Unificado", "Ragileo", "Azümchefe"]
  acento: "#E07A5C",
  marca: {
    nombre: "",
    bajada: "",
    programa: "",
    instagram: "",
    tienda: "",
    contacto: "",
    hashtags: "",
  },
};

export function completarLengua(l) {
  return { ...LENGUA_BASE, ...l, marca: { ...LENGUA_BASE.marca, ...(l.marca || {}) } };
}

export async function leerPlataforma() {
  let d = await datos().get("lenguas", { type: "json" });
  if (!d) d = await migrarDesdeV1();
  const lenguas = (d.lenguas || []).map(completarLengua);
  const porDefecto = lenguas.some((l) => l.id === d.porDefecto) ? d.porDefecto : (lenguas[0] && lenguas[0].id) || "";
  return { lenguas, porDefecto };
}
export async function leerLenguas() {
  return (await leerPlataforma()).lenguas;
}
export async function guardarLenguas(lenguas, porDefecto) {
  const actual = await datos().get("lenguas", { type: "json" });
  await datos().setJSON("lenguas", { lenguas, porDefecto: porDefecto || (actual && actual.porDefecto) || (lenguas[0] && lenguas[0].id) });
}
// Qué lengua atiende un dominio (o null si es el dominio de la plataforma).
export function lenguaPorHost(lenguas, host) {
  const h = normalizarHost(host);
  return lenguas.find((l) => (l.dominios || []).some((d) => normalizarDominio(d) === h)) || null;
}
export async function leerLengua(id) {
  return (await leerLenguas()).find((l) => l.id === id) || null;
}

// La dirección pública principal de una lengua (la que va en los QR).
export function baseLengua(lengua, origen) {
  if (lengua.dominios && lengua.dominios[0]) return "https://" + lengua.dominios[0];
  return String(origen || "https://" + PLATAFORMA.dominio).replace(/\/+$/, "") + "/l/" + lengua.id;
}

// ---------- escritura segura ----------
// Lee un documento con su versión, aplica el cambio y lo guarda solo si nadie más
// guardó entremedio. Si alguien se adelantó, vuelve a leer y reintenta el mismo cambio.
export async function actualizarDoc(clave, cambiar, vacio, store = datos()) {
  for (let i = 0; i < 6; i++) {
    const r = await store.getWithMetadata(clave, { type: "json" });
    const doc = r && r.data ? r.data : JSON.parse(JSON.stringify(vacio));
    const resultado = await cambiar(doc);
    const w = r && r.etag
      ? await store.setJSON(clave, doc, { onlyIfMatch: r.etag })
      : await store.setJSON(clave, doc, { onlyIfNew: true });
    if (!w || w.modified !== false) return resultado;
    await new Promise((ok) => setTimeout(ok, 60 + Math.random() * 240));
  }
  throw Object.assign(new Error("Hay muchos cambios al mismo tiempo. Vuelve a intentar en unos segundos."), { status: 409 });
}

// ---------- palabras ----------
export async function leerCatalogo(lengua) {
  const c = await datos().get("catalogo/" + lengua, { type: "json" });
  return { palabras: Array.isArray(c?.palabras) ? c.palabras : [] };
}
export async function guardarCatalogo(lengua, cat) {
  await datos().setJSON("catalogo/" + lengua, { palabras: cat.palabras });
}
export function actualizarCatalogo(lengua, cambiar) {
  return actualizarDoc("catalogo/" + lengua, (doc) => {
    if (!Array.isArray(doc.palabras)) doc.palabras = [];
    return cambiar(doc);
  }, { palabras: [] });
}
export function actualizarLenguas(cambiar) {
  return actualizarDoc("lenguas", (doc) => {
    doc.lenguas = (doc.lenguas || []).map(completarLengua);
    return cambiar(doc);
  }, { lenguas: [], porDefecto: "" });
}
export function actualizarUsuarios(cambiar) {
  return actualizarDoc("usuarios", (doc) => {
    if (!Array.isArray(doc.usuarios)) doc.usuarios = [];
    return cambiar(doc);
  }, { usuarios: [] });
}

// ---------- papelera (30 días) ----------
// Al eliminar una palabra, sus datos y archivos pasan a la papelera en vez de borrarse.
export const DIAS_PAPELERA = 30;
export function clavesMedios(lengua, p) {
  return [
    ...(p.audios || []).map((a) => `${lengua}/audio/${p.slug}/${a.id}`),
    ...(p.imagen ? [`${lengua}/img/${p.slug}`] : []),
    ...(p.og ? [`${lengua}/og/${p.slug}`] : []),
  ];
}
export async function moverMedio(desde, hacia) {
  const md = medios();
  const r = await md.getWithMetadata(desde, { type: "arrayBuffer" });
  if (!r || !r.data) return false;
  await md.set(hacia, r.data, { metadata: r.metadata || {} });
  await md.delete(desde);
  return true;
}
export async function enviarAPapelera(lengua, p, por, extraClaves = []) {
  const id = Date.now() + "-" + p.slug;
  const claves = [...clavesMedios(lengua, p), ...extraClaves];
  for (const k of claves) await moverMedio(k, `papelera/${id}/${k}`).catch(() => {});
  await datos().setJSON(`papelera/${lengua}/${id}`, { id, lengua, palabra: p, claves, borrada: new Date().toISOString(), por });
  return id;
}

// ---------- fechas ----------
export function mesActual(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).formatToParts(d);
  return f.find((x) => x.type === "year").value + "-" + f.find((x) => x.type === "month").value;
}

// Lo que el público puede ver de una palabra.
export function publica(p, lengua) {
  const v = p.v || 0;
  const pre = `/media/${lengua}`;
  const audios = (p.audios || [])
    .filter((a) => a.consentimiento && a.consentimiento.ok)
    .map((a) => ({ id: a.id, voz: a.voz || "", variante: a.variante || "", url: `${pre}/audio/${p.slug}/${a.id}?v=${a.v || v}` }));
  return {
    slug: p.slug,
    palabra: p.palabra,
    es: p.es,
    tipo: p.tipo || "",
    en: p.en || [],
    guia: p.guia || "",
    texto: p.texto || "",
    sistema: p.sistema || "",
    variantes: p.variantes || [],
    validado: !!p.validado,
    validadoPor: p.validadoPor || "",
    audios,
    audio: audios[0] ? audios[0].url : "",
    imagen: p.imagen ? `${pre}/img/${p.slug}?v=${v}` : "",
    og: p.og ? `${pre}/og/${p.slug}?v=${v}` : "",
  };
}

// ---------- migración desde la versión de una sola lengua ----------
async function migrarDesdeV1() {
  const st = datos();
  const viejo = await st.get("catalogo", { type: "json" });
  const rapanui = completarLengua({
    id: "rapanui",
    nombre: "Rapa nui",
    nombreLengua: "Vānaŋa Rapa Nui",
    dominios: ["vananga.cl"],
    caracteres: ["ʻ", "ŋ"],
    marca: {
      nombre: "Vananga",
      bajada: "Cada prenda y artículo lleva una palabra rapa nui. Escúchala, dila bien y pásala.",
      hashtags: "#rapanui #vananga #isladepascua",
      ...((viejo && viejo.marca) || {}),
    },
  });
  delete rapanui.marca.dominio;
  if (viejo && viejo.marca && (!viejo.marca.nombre || viejo.marca.nombre === "Tu marca")) rapanui.marca.nombre = "Vananga";

  const palabras = [];
  const md = medios();
  for (const p of (viejo && viejo.palabras) || []) {
    const n = { ...p, audios: [] };
    delete n.audio; delete n.voz;
    if (p.audio) {
      const r = await md.getWithMetadata(`audio/${p.slug}`, { type: "arrayBuffer" });
      if (r && r.data) {
        const id = nuevoId();
        await md.set(`rapanui/audio/${p.slug}/${id}`, r.data, { metadata: r.metadata });
        n.audios.push({ id, voz: p.voz || "", variante: "", v: p.v || Date.now(), consentimiento: { ok: true, nota: "Cargado antes del registro de consentimiento; confirmar con la persona.", fecha: new Date().toISOString() } });
      }
    }
    for (const t of ["img", "og"]) {
      const r = await md.getWithMetadata(`${t}/${p.slug}`, { type: "arrayBuffer" });
      if (r && r.data) await md.set(`rapanui/${t}/${p.slug}`, r.data, { metadata: r.metadata });
    }
    palabras.push(n);
  }
  await guardarCatalogo("rapanui", { palabras });
  const d = { lenguas: [rapanui], porDefecto: "rapanui" };
  await st.setJSON("lenguas", d);
  return d;
}

// ---------------------------------------------------------------------------
// Accesos
//   Administrador general: entra con el correo "admin" y la contraseña ADMIN_PASSWORD
//   (variable de entorno en Netlify). Crea lenguas y personas.
//   Editores: correo y contraseña propios, con acceso solo a sus lenguas.
// Las sesiones son fichas firmadas que duran 30 días.
// ---------------------------------------------------------------------------
const DURACION = 30 * 24 * 3600 * 1000;
function secreto() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update("imita:" + s).digest();
}
const b64 = (b) => Buffer.from(b).toString("base64url");
export function firmarSesion(u) {
  const cuerpo = b64(JSON.stringify({ u, exp: Date.now() + DURACION }));
  return cuerpo + "." + b64(createHmac("sha256", secreto()).update(cuerpo).digest());
}
function leerSesion(token) {
  const [cuerpo, firma] = String(token || "").split(".");
  if (!cuerpo || !firma) return null;
  const esperada = createHmac("sha256", secreto()).update(cuerpo).digest();
  const dada = Buffer.from(firma, "base64url");
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) return null;
  try {
    const d = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

export function hashClave(clave, sal = randomBytes(16).toString("hex")) {
  return { sal, hash: scryptSync(String(clave), sal, 32).toString("hex") };
}
function claveCorrecta(clave, u) {
  const h = scryptSync(String(clave), u.sal, 32);
  const g = Buffer.from(u.hash, "hex");
  return h.length === g.length && timingSafeEqual(h, g);
}
function igualSeguro(a, b) {
  const x = createHash("sha256").update(String(a)).digest(), y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
}

export async function leerUsuarios() {
  return (await datos().get("usuarios", { type: "json" }))?.usuarios || [];
}
export async function guardarUsuarios(usuarios) {
  await datos().setJSON("usuarios", { usuarios });
}

export const ADMIN_LISTO = () => (process.env.ADMIN_PASSWORD || "").length >= 8;

// Devuelve { correo, nombre, rol, lenguas } o null.
export async function entrar(correo, clave) {
  correo = String(correo || "").trim().toLowerCase();
  if (correo === "admin" || correo === "") {
    if (ADMIN_LISTO() && igualSeguro(clave, process.env.ADMIN_PASSWORD)) return { correo: "admin", nombre: "Administración", rol: "general", lenguas: ["*"] };
    return null;
  }
  const u = (await leerUsuarios()).find((x) => x.correo === correo && x.activo !== false);
  if (!u || !claveCorrecta(clave, u)) return null;
  return { correo: u.correo, nombre: u.nombre, rol: u.rol || "editor", lenguas: u.lenguas || [] };
}

// Lee la sesión de la petición y vuelve a consultar los permisos (un acceso retirado se corta al tiro).
export async function quienEs(req) {
  const h = req.headers.get("authorization") || "";
  const s = leerSesion(h.startsWith("Bearer ") ? h.slice(7) : "");
  if (!s) return null;
  if (s.u === "admin") return ADMIN_LISTO() ? { correo: "admin", nombre: "Administración", rol: "general", lenguas: ["*"] } : null;
  const u = (await leerUsuarios()).find((x) => x.correo === s.u && x.activo !== false);
  return u ? { correo: u.correo, nombre: u.nombre, rol: u.rol || "editor", lenguas: u.lenguas || [] } : null;
}
export const esGeneral = (q) => q && q.rol === "general";
export const puedeLengua = (q, id) => q && (q.rol === "general" || (q.lenguas || []).includes(id));
