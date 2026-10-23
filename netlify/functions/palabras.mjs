// GET /api/palabras -> la colección pública (solo palabras publicadas).
import { leerCatalogo, publica, json } from "../lib/comun.mjs";

export default async () => {
  const { marca, palabras } = await leerCatalogo();
  return json(
    { marca: publicaMarca(marca), palabras: palabras.filter((p) => p.publicada !== false).map(publica) },
    200,
    { "cache-control": "public, max-age=0, must-revalidate" }
  );
};

function publicaMarca(m) {
  const { nombre, bajada, programa, instagram, tienda, contacto } = m;
  return { nombre, bajada, programa, instagram, tienda, contacto };
}

export const config = { path: "/api/palabras" };
