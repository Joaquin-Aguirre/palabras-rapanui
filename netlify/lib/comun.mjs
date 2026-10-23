// Utilidades compartidas por las funciones del servidor.
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

// "datos" guarda el catálogo (palabras + marca) en un solo documento JSON.
// "medios" guarda audios e imágenes. Consistencia fuerte: lo que guardas se ve al tiro.
export const datos = () => getStore({ name: "datos", consistency: "strong" });
export const medios = () => getStore({ name: "medios", consistency: "strong" });

export const MARCA_VACIA = {
  nombre: "Tu marca",
  bajada: "Cada prenda y artículo lleva una palabra rapa nui. Escúchala, dila bien y pásala.",
  programa: "",
  instagram: "",
  tienda: "",
  contacto: "",
  hashtags: "#rapanui #lenguarapanui #isladepascua",
  dominio: "",
};

export async function leerCatalogo() {
  const c = await datos().get("catalogo", { type: "json" });
  return {
    marca: { ...MARCA_VACIA, ...(c?.marca || {}) },
    palabras: Array.isArray(c?.palabras) ? c.palabras : [],
  };
}

export async function guardarCatalogo(cat) {
  await datos().setJSON("catalogo", cat);
}

export function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ŋ/gi, "ng").replace(/[ʻʼ‘’'`]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const esSlug = (s) => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 60;

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

// Contraseña de administrador: variable de entorno ADMIN_PASSWORD en Netlify.
export function autorizado(req) {
  const clave = process.env.ADMIN_PASSWORD || "";
  if (clave.length < 8) return false;
  const h = req.headers.get("authorization") || "";
  const enviada = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = createHash("sha256").update(enviada).digest();
  const b = createHash("sha256").update(clave).digest();
  return timingSafeEqual(a, b);
}

// Lo que el público puede ver de una palabra.
export function publica(p) {
  const v = p.v || 0;
  return {
    slug: p.slug,
    palabra: p.palabra,
    es: p.es,
    tipo: p.tipo || "",
    en: p.en || [],
    guia: p.guia || "",
    texto: p.texto || "",
    voz: p.voz || "",
    validado: !!p.validado,
    audio: p.audio ? `/media/audio/${p.slug}?v=${v}` : "",
    imagen: p.imagen ? `/media/img/${p.slug}?v=${v}` : "",
    og: p.og ? `/media/og/${p.slug}?v=${v}` : "",
  };
}
