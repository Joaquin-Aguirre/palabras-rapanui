// Arma un archivo .zip en el navegador (sin compresión: audios e imágenes ya vienen comprimidos).
// Zip.crear([{ nombre: "datos.json", datos: Uint8Array | string }, ...]) -> Blob
(function () {
  var TABLA = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  var enc = new TextEncoder();

  function crear(archivos) {
    var partes = [], central = [], offset = 0;
    var ahora = new Date(), hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    var fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
    archivos.forEach(function (a) {
      var nombre = enc.encode(a.nombre), datos = typeof a.datos === "string" ? enc.encode(a.datos) : a.datos;
      var crc = crc32(datos), tam = datos.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, hora, true); lh.setUint16(12, fecha, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, tam, true); lh.setUint32(22, tam, true); lh.setUint16(26, nombre.length, true); lh.setUint16(28, 0, true);
      partes.push(lh.buffer, nombre, datos);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, hora, true); ch.setUint16(14, fecha, true); ch.setUint32(16, crc, true); ch.setUint32(20, tam, true); ch.setUint32(24, tam, true);
      ch.setUint16(28, nombre.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, nombre);
      offset += 30 + nombre.length + tam;
    });
    var tamCentral = central.reduce(function (n, p) { return n + p.byteLength; }, 0);
    var fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
    return new Blob(partes.concat(central, [fin.buffer]), { type: "application/zip" });
  }
  window.Zip = { crear: crear };
})();
