// GET /media/:lengua/:tipo/:slug[/:id] -> audio, ilustración o imagen de vista previa.
// Responde pedidos por rangos (206): el iPhone los exige para reproducir audio.
import { medios, esSlug, esId, firmaPrivadaOk, puedeVer } from "../lib/comun.mjs";

const TIPOS = new Set(["audio", "img", "og"]);

export default async (req, context) => {
  if (!puedeVer(req)) return new Response("No encontrado", { status: 404 });
  const { lengua, tipo, slug, id } = context.params;
  if (!esId(lengua) || !TIPOS.has(tipo) || !esSlug(slug)) return new Response("No encontrado", { status: 404 });
  if (tipo === "audio" && !/^[a-f0-9]{6,20}$/.test(id || "")) return new Response("No encontrado", { status: 404 });
  const clave = tipo === "audio" ? `${lengua}/audio/${slug}/${id}` : `${lengua}/${tipo}/${slug}`;
  const r = await medios().getWithMetadata(clave, { type: "arrayBuffer" });
  if (!r || !r.data) return new Response("No encontrado", { status: 404 });

  // Voces sin autorización: solo con la firma que entrega el panel.
  const u = new URL(req.url);
  const privada = tipo === "audio" && r.metadata && r.metadata.publico === false;
  if (privada && !firmaPrivadaOk(clave, u.searchParams.get("k"))) return new Response("No encontrado", { status: 404 });

  const total = r.data.byteLength;
  const versionada = u.searchParams.has("v");
  const headers = {
    "content-type": r.metadata?.type || "application/octet-stream",
    "cache-control": privada ? "private, no-store" : versionada ? "public, max-age=31536000, immutable" : "public, max-age=300",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  };
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (rango && (rango[1] || rango[2])) {
    let ini, fin;
    if (rango[1] === "") { ini = Math.max(0, total - Number(rango[2])); fin = total - 1; }
    else { ini = Number(rango[1]); fin = rango[2] ? Math.min(Number(rango[2]), total - 1) : total - 1; }
    if (ini >= total || ini > fin) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${total}` } });
    return new Response(r.data.slice(ini, fin + 1), { status: 206, headers: { ...headers, "content-range": `bytes ${ini}-${fin}/${total}`, "content-length": String(fin - ini + 1) } });
  }
  return new Response(r.data, { headers: { ...headers, "content-length": String(total) } });
};

export const config = { path: ["/media/:lengua/:tipo/:slug", "/media/:lengua/:tipo/:slug/:id"] };
