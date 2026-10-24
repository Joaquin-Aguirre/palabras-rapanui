// POST /api/evento -> cuenta visitas, escaneos de QR, reproducciones y veces compartida.
// Lo envía la página pública con JavaScript (los robots que no ejecutan JS no cuentan).
// Un documento por lengua y por mes: { p: { slug: { v, q, a, c } }, d: { "2026-10-23": visitas } }
import { esId, esSlug, actualizarDoc, mesActual } from "../lib/comun.mjs";

const TIPOS = { visita: "v", qr: "q", audio: "a", compartir: "c" };
const MAX_PALABRAS = 5000;

export default async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  let b;
  try { b = JSON.parse(await req.text()); } catch { return new Response(null, { status: 400 }); }
  const campo = TIPOS[b && b.t];
  const slug = b && b.s === "_" ? "_" : b && b.s;
  if (!campo || !esId(b.l) || !(slug === "_" || esSlug(slug))) return new Response(null, { status: 400 });

  const mes = mesActual();
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  try {
    await actualizarDoc(`stats/${b.l}/${mes}`, (doc) => {
      doc.p = doc.p || {}; doc.d = doc.d || {};
      if (!doc.p[slug] && Object.keys(doc.p).length >= MAX_PALABRAS) return;
      const x = (doc.p[slug] = doc.p[slug] || {});
      x[campo] = (x[campo] || 0) + 1;
      if (campo === "v" || campo === "q") doc.d[dia] = (doc.d[dia] || 0) + 1;
    }, { p: {}, d: {} });
  } catch (_) { /* si hay demasiado tráfico simultáneo se pierde un conteo, nunca la página */ }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};

// Límite por visitante: un bot no puede inflar las estadísticas ni gastar créditos (devuelve 429).
export const config = { path: "/api/evento", rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] } };
