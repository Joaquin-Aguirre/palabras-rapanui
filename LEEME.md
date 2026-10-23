# Palabras rapa nui: sitio y panel

Cada prenda o artículo lleva un QR. El QR abre la página de su palabra, con el significado y el audio de un hablante rapa nui.

Todo se maneja desde el panel en `/admin`, en el computador o el celular:

- Crear una palabra: escribirla (con botones para ʻ y ŋ), grabar el audio con el micrófono o subir un mp3, m4a o mp4, y agregar la ilustración.
- El audio se limpia solo: queda en mono, sin silencios al inicio y al final, con volumen parejo y en mp3 liviano.
- Al guardar, la palabra queda publicada al instante. No hay que subir carpetas.
- El panel entrega el QR (SVG para imprenta y PNG), la imagen para historias, el post para el feed y el texto con hashtags listo para copiar.
- Cada palabra tiene su propia vista previa al compartir el link en WhatsApp, Instagram o Facebook.

## Puesta en marcha (una sola vez)

1. **Subir el código a GitHub** en un repositorio, por ejemplo `palabras-rapanui`.
2. **Conectar Netlify:** en Netlify, *Add new project → Import an existing project → GitHub*, elegir el repositorio y presionar *Deploy*. No hay que cambiar ninguna configuración: todo está en `netlify.toml`.
3. **Crear la contraseña del panel:** en el proyecto de Netlify, *Project configuration → Environment variables → Add a variable*. Nombre: `ADMIN_PASSWORD`. Valor: una contraseña de al menos 8 caracteres. Después, en *Deploys*, *Trigger deploy → Deploy project* para que la tome.
4. Entrar a `https://TU-SITIO.netlify.app/admin`, escribir la contraseña y crear la primera palabra.
5. En la pestaña **Marca**, completar nombre, Instagram, tienda y la frase de la colección.

## Dominio propio

Cuando compres el dominio, conéctalo en Netlify (*Domain management*) y escríbelo en la pestaña **Marca → Dominio propio**. Desde ese momento los QR y links usan tu dominio. Imprime QR definitivos solo después de esto.

## Reglas que no cambian

- La dirección de cada palabra (`/p/vave`) queda fija al crearla. Es la que lleva el QR impreso.
- El audio, la imagen y los textos se pueden corregir cuando quieras; el QR sigue funcionando.
- Una palabra sin "Validada" muestra el aviso "Por validar". Una palabra sin "Publicada" queda guardada pero oculta.
- Los QR antiguos con `?p=palabra` siguen funcionando: llevan a `/p/palabra`.

## Cómo está hecho

- `public/`: páginas estáticas (panel, estilos, fuentes, librerías).
- `netlify/functions/pagina.mjs`: genera la portada y la página de cada palabra, con su vista previa para redes.
- `netlify/functions/admin.mjs`: guarda, edita y elimina palabras. Exige la contraseña.
- `netlify/functions/media.mjs`: entrega audios e imágenes.
- Los datos y archivos se guardan en Netlify Blobs, dentro de la misma cuenta de Netlify. No hay base de datos aparte.

Librerías incluidas: `lamejs` (LGPL, convierte a mp3, ver `public/lib/lame-LICENSE.txt`) y `qrcode-generator` (MIT).
