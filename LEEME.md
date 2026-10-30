# IMITA: lenguas que se escuchan

Plataforma para publicar palabras de lenguas originarias con la voz de sus hablantes. Cada prenda u objeto lleva una palabra y un QR; al escanearlo, la palabra se escucha.

Un solo sistema atiende a todas las lenguas:

| Dirección | Qué muestra |
|---|---|
| `imita.cl` | Página de la empresa IMITA SpA |
| `aprenda.imita.cl` | Vitrina para explorar y escuchar todas las lenguas: palabra del día, filtro por lengua, tocar para escuchar |
| `panel.imita.cl` | Panel central (lleva a `/admin`) |
| `vananga.cl` | Sitio de rapa nui: colección y una página por palabra (`/p/vave`) |
| `dunguain.cl` | Sitio de mapudungun |
| `cualquier-dominio/l/<código>` | Sitio de una lengua sin dominio propio, por ejemplo `/l/mapudungun/p/ruka` |

## El panel

- **Palabras:** escribir la palabra (con botones para los caracteres especiales de cada lengua), su significado, otras formas de escribirla (por alfabeto o zona), una o varias voces grabadas con el micrófono o subidas en mp3, m4a o mp4, e ilustración. Al guardar queda publicada y aparecen el QR, la imagen para historias, el post para el feed y el texto con hashtags.
- **Voces con autorización:** cada voz se publica solo si está marcada "La persona autorizó publicar su voz". Se guarda quién la subió, cuándo y el detalle. Una voz sin autorización no se puede escuchar fuera del panel. Quitar una voz la saca del sitio y la deja 30 días en la papelera.
- **Lengua:** nombre en la propia lengua, caracteres especiales, alfabetos, marca, Instagram, tienda, hashtags y color de acento.
- **Lenguas** (solo administración general): crear lenguas, asignar dominios, activarlas o desactivarlas.
- **Personas** (solo administración general): dar acceso por correo y contraseña, con permiso solo a ciertas lenguas.
- **Estadísticas:** por mes, escaneos de QR, visitas, reproducciones y veces compartida, en total, por día y por palabra.
- **Respaldos:** descarga un .zip con todas las palabras, voces e ilustraciones de una lengua (o de todas). Incluye la papelera y las copias automáticas.
- **Actividad** (solo administración general): quién entró, qué cambió y los intentos fallidos de entrada, por mes.
- **Mi cuenta:** cada persona cambia su contraseña y puede cerrar la sesión en sus otros dispositivos.

## Protecciones

- **Ediciones simultáneas:** si dos personas guardan al mismo tiempo, el sistema no pisa cambios. Si ambas editaron la misma palabra, la segunda recibe un aviso para recargarla.
- **Papelera:** una palabra eliminada se guarda 30 días con sus voces e imágenes y se puede restaurar desde *Respaldos*.
- **Copia diaria automática:** cada noche se guarda una copia de los datos de todas las lenguas (se conservan 30). Las descarga la administración general en *Respaldos*.
- **Seguridad:**
  - Tras 5 intentos fallidos desde una conexión, esa cuenta se bloquea 15 minutos para esa conexión.
  - Límite de peticiones por visitante en el panel (120 por minuto) y en el contador de visitas (40 por minuto).
  - Encabezados de seguridad: solo se ejecuta código propio del sitio y ninguna página puede cargarse dentro de otro sitio. El micrófono solo se permite en el panel.
  - Las sesiones se cierran al cambiar la contraseña, al quitar el acceso o con "Cerrar sus sesiones". Cambiar `ADMIN_PASSWORD` cierra todas las de administración general.
  - Registro de actividad mensual con fecha, persona, acción e IP.
- **QR con conteo:** los QR del panel llevan `?qr` al final para contar los escaneos; la página lo quita de la dirección al abrirse.

La administración general entra con el correo `admin` y la contraseña `ADMIN_PASSWORD` configurada en Netlify.

## Cuentas que protegen todo

GitHub, Netlify, el correo y NIC Chile son las llaves del proyecto: verificación en dos pasos en todas. Los dominios, renovados por varios años y con renovación automática: si un dominio vence, otra persona puede comprarlo y los QR impresos llevarían a su sitio.

## Si algo pasa

1. Cambiar `ADMIN_PASSWORD` (y `SESSION_SECRET`) en Netlify y hacer un deploy: se cierran todas las sesiones.
2. En **Personas**, quitar el acceso a la cuenta comprometida.
3. Revisar **Actividad** para ver qué se cambió.
4. Recuperar desde la **papelera** o una **copia diaria**. Si el problema es el código, en Netlify *Deploys* se publica una versión anterior con un clic.

## Costos

Netlify cobra por créditos mensuales. En el plan gratuito, si se acaban, **los sitios quedan en pausa hasta el mes siguiente** y los QR dejan de funcionar. Antes de lanzar: plan Personal con recarga automática (*Team settings → Billing*).

## Configuración en Netlify

Variables de entorno (*Project configuration → Environment variables*):

- `ADMIN_PASSWORD` (obligatoria): contraseña de la administración general. Usa 16 caracteres o más y guárdala en un gestor de contraseñas.
- `SESSION_SECRET` (recomendada): texto largo y aleatorio que firma las sesiones y los enlaces privados. Si falta, se usa `ADMIN_PASSWORD`. Si la cambias, todas las personas tienen que volver a entrar.
- `CLAVE_PREVIA` (opcional, antes del lanzamiento): si está, todos los sitios piden esa clave para entrar, salvo `imita.cl` y el panel. La clave se pide una vez por dominio y dura 30 días en ese navegador; tras 5 intentos fallidos esa conexión espera 15 minutos. Para lanzar, se borra la variable y se publica de nuevo. En Netlify, *Visitor access* debe quedar en **Public**.
- `CONTACTO_IMITA` (opcional): correo de contacto que aparece en imita.cl y en aprenda.imita.cl.

Dominios (*Domain management*): agregar `vananga.cl`, `www.vananga.cl`, `dunguain.cl`, `www.dunguain.cl`, `imita.cl`, `www.imita.cl`, `aprenda.imita.cl` y `panel.imita.cl` al mismo proyecto. Netlify activa HTTPS solo.

## Agregar una lengua nueva

1. Panel → **Lenguas** → *Nueva lengua* (nombre y código corto, por ejemplo `mapudungun`).
2. En **Lengua**, completar caracteres especiales, alfabetos y marca. Si tiene dominio propio, escribirlo en *Dominios* y agregarlo también en Netlify.
3. Panel → **Personas**: dar acceso a quienes la van a administrar.

Mientras no tenga dominio propio, su sitio funciona en `aprenda.imita.cl/l/<código>`. Los QR definitivos se imprimen con el dominio que vaya a quedar para siempre.

## Reglas que no cambian

- La dirección de cada palabra (`/p/vave`) queda fija al crearla: es la que lleva el QR impreso. El audio, la imagen y los textos se pueden corregir cuando quieras.
- Los QR antiguos con `?p=palabra` siguen funcionando.

## Cómo está hecho

- `netlify/functions/pagina.mjs`: vitrina, sitio de cada lengua y página de cada palabra, con su vista previa para redes. Decide qué mostrar según el dominio.
- `netlify/functions/admin.mjs`: todo el panel. Revisa en cada acción quién la pide y a qué lengua tiene acceso.
- `netlify/functions/media.mjs`: entrega audios e imágenes (con soporte de rangos para iPhone).
- `netlify/functions/evento.mjs`: recibe los conteos de visitas, escaneos, reproducciones y compartidos.
- `netlify/functions/respaldo-diario.mjs`: tarea programada diaria (copia de datos y limpieza de la papelera).
- `netlify/lib/comun.mjs`: datos, lenguas, accesos y la migración automática desde la versión de una sola lengua.
- Datos y archivos en Netlify Blobs, dentro de la misma cuenta. Sin base de datos aparte.

Librerías incluidas: `lamejs` (LGPL, convierte a mp3; ver `public/lib/lame-LICENSE.txt`) y `qrcode-generator` (MIT).
