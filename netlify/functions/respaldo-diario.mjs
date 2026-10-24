// Tarea automática diaria:
//  1. Guarda una copia de todos los datos (lenguas, palabras, personas) con la fecha del día.
//     Se conservan las últimas 30 copias.
//  2. Vacía de la papelera lo que lleva más de 30 días.
import { datos, medios, leerPlataforma, leerCatalogo, leerUsuarios, DIAS_PAPELERA } from "../lib/comun.mjs";

const COPIAS = 30;

export default async () => {
  const st = datos();
  const plat = await leerPlataforma();
  const catalogos = {};
  for (const l of plat.lenguas) catalogos[l.id] = (await leerCatalogo(l.id)).palabras;
  const usuarios = await leerUsuarios();
  const hoy = new Date().toISOString().slice(0, 10);
  await st.setJSON("respaldos/" + hoy, { tipo: "imita-respaldo", version: 1, fecha: new Date().toISOString(), plataforma: plat, catalogos, usuarios });

  // Conservar solo las últimas copias
  const { blobs } = await st.list({ prefix: "respaldos/" });
  const viejas = blobs.map((b) => b.key).sort().slice(0, Math.max(0, blobs.length - COPIAS));
  for (const k of viejas) await st.delete(k);

  // Papelera
  const limite = Date.now() - DIAS_PAPELERA * 24 * 3600 * 1000;
  const vencido = (k) => { const m = /(\d{13})/.exec(k); return m && Number(m[1]) < limite; };
  const pd = await st.list({ prefix: "papelera/" });
  for (const b of pd.blobs) if (vencido(b.key)) await st.delete(b.key);
  const pm = await medios().list({ prefix: "papelera/" });
  for (const b of pm.blobs) if (vencido(b.key)) await medios().delete(b.key);

  console.log(`Respaldo ${hoy}: ${plat.lenguas.length} lenguas, ${Object.values(catalogos).reduce((n, c) => n + c.length, 0)} palabras.`);
};

export const config = { schedule: "@daily" };
