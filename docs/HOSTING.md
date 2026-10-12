# Publicar Atlas Santiago gratis

GitHub Pages es la opción elegida para esta app personal: ya existe el repositorio de GitHub, la aplicación se compila a archivos estáticos y no necesita mantener un servidor, una base de datos ni claves de API. Solo hace falta la cuenta de GitHub que administra el repositorio. Un dominio propio es opcional y su compra tiene un costo separado.

## Qué significa «gratis» en este caso

- GitHub Free permite Pages en repositorios **públicos**. Pages desde repositorios privados requiere un plan compatible, como GitHub Pro o Team.
- Los runners estándar de GitHub Actions son gratuitos para repositorios públicos y para Pages. No se necesitan runners de pago.
- Pages admite sitios publicados de hasta 1 GB, con un límite orientativo de transferencia de 100 GB al mes. Son límites suficientes para esta app personal; no equivalen a disponibilidad garantizada.
- El sitio será público. Pages sirve archivos estáticos: no ejecuta un backend ni ofrece una base de datos privada.

El uso previsto es comparar escenarios propios de inversión. Los límites de Pages excluyen usarlo como alojamiento gratuito de un negocio online, comercio electrónico o SaaS comercial. Si la app se transforma en un servicio para clientes, habrá que revisar el alojamiento.

## Datos personales

Los cambios introducidos y guardados en el navegador permanecen en ese navegador, sin sincronización entre dispositivos. Exportar e importar una copia permite trasladarlos. Borrar los datos del navegador puede eliminar el guardado local.

Los valores de ejemplo incluidos en el código o en los archivos compilados pueden ser vistos por cualquier visitante. El guardado local no oculta esos valores iniciales ni cifra los archivos exportados. Mantén fuera del repositorio respaldos personales, RUT, documentos bancarios, contraseñas y credenciales. Esta versión no necesita secretos de despliegue: el workflow utiliza la autenticación de GitHub Actions que proporciona GitHub.

El mapa puede solicitar cartografía al proveedor indicado en la aplicación. El alojamiento gratuito de la app no cambia las condiciones ni la disponibilidad del proveedor de mapas. No se necesita contratar Google Maps para publicar este proyecto.

## Pasos para activar Pages

1. Sube los archivos del proyecto, incluido el lockfile y el workflow de publicación, a la rama `main` de `MickaXXX/Chatgpt`.
2. Si utilizas GitHub Free, confirma que el repositorio es público. Cambiar su visibilidad también hace público su código e historial.
3. En el repositorio abre **Settings → Pages → Build and deployment → Source** y selecciona **GitHub Actions**. Esta configuración requiere permisos de administrador o mantenedor.
4. En **Actions**, abre el workflow de publicación y verifica que terminan la instalación, las comprobaciones, la compilación y el despliegue. Si se permite ejecución manual, puedes usar **Run workflow**.
5. Abre la URL que GitHub muestre en Pages o en el entorno `github-pages` después de un despliegue correcto. La dirección esperada para este repositorio es `https://mickaxxx.github.io/Chatgpt/`; esta dirección no confirma por sí sola que el sitio ya esté publicado.

El workflow debe compilar con `npm ci` y `npm run build`, subir únicamente `dist` con `actions/upload-pages-artifact` y publicar con `actions/deploy-pages`. El job de despliegue requiere `pages: write` e `id-token: write` y el entorno `github-pages`. No publiques `node_modules`, respaldos personales ni el archivo adjunto original como parte de `dist`.

Vite debe generar rutas de recursos compatibles con el subdirectorio del sitio. La documentación recomienda `base: '/Chatgpt/'` para esta URL. Una base relativa `./` también permite una aplicación de una sola página sin rutas de servidor; valida siempre la compilación bajo `/Chatgpt/`, no solo desde la raíz del servidor local.

## Si algo falla

| Síntoma | Revisión concreta |
| --- | --- |
| Pages responde 404 | Comprueba que Pages está activado, que el Source es GitHub Actions y que el último despliegue terminó correctamente. |
| Aparece HTML sin estilos o pantalla vacía | Revisa la base de Vite y las solicitudes a JavaScript/CSS bajo `/Chatgpt/`. |
| El workflow no puede desplegar | Revisa `pages: write`, `id-token: write` y si el entorno `github-pages` permite desplegar desde `main`. |
| Cambios guardados no aparecen en otro dispositivo | El guardado es local; utiliza exportar/importar para trasladar la copia. |

## Alternativas comparadas

| Opción | Encaje para esta app | Información verificada |
| --- | --- | --- |
| **GitHub Pages** | Elegida; una sola cuenta y app estática. | Free requiere repo público. Actions estándar gratuitos para repos públicos/Pages. Sitio de hasta 1 GB y transferencia orientativa de 100 GB/mes. |
| **Cloudflare** | Alternativa gratuita si quieres alojar código de un repo privado sin pagar Pages privado. Requiere cuenta Cloudflare además de GitHub si conectas ambos. | Pages Free: 500 builds/mes, 20.000 archivos y 25 MiB/archivo. Cloudflare ahora recomienda **Workers para proyectos nuevos**; Workers Static Assets sirve archivos gratis con solicitudes ilimitadas. El código de servidor consume otra cuota. |
| **Vercel Hobby** | Alternativa para app estática o una futura app Next.js. Añade una cuenta y configuración externa. | El repositorio oficial de Vercel confirma despliegue por importación o CLI. La documentación de límites de Hobby no fue accesible en este entorno; no se dan cuotas ni se asegura su encaje contractual actual. |
| **Supabase Free** | Útil más adelante si necesitas login y sincronización; no es necesario para el MVP ni sustituye su alojamiento web. Añade una cuenta, base de datos y políticas de acceso. | Dos proyectos gratis; 500 MB de base de datos por proyecto, 1 GB de archivos, 5 GB de salida y 50.000 usuarios activos/mes. Puede pausar proyectos de poca actividad durante un período de 7 días. |

Mantener el MVP estático reduce servicios que configurar y elimina fallos de autenticación, credenciales y pausas de la base de datos. Si necesitas sincronización real entre computador y teléfono, habrá que incorporar un backend; el archivo exportado es una copia manual.

## Fuentes oficiales consultadas

Consulta: **12 de octubre de 2026**. Los sitios de documentación devolvieron un error 403 del proxy del entorno. Se verificaron los textos mediante `raw.githubusercontent.com` en los repositorios oficiales de sus autores. Los enlaces de documentación se ofrecen para lectura normal y los enlaces al código permiten revisar la evidencia obtenida.

- [Disponibilidad de GitHub Pages según el plan](https://raw.githubusercontent.com/github/docs/main/data/reusables/gated-features/pages.md).
- [Límites de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [texto oficial verificado](https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/github-pages-limits.md).
- [Configurar el origen de publicación](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [texto oficial verificado](https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site.md).
- [Workflows personalizados de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [texto oficial verificado](https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages.md).
- [Facturación de GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · [texto oficial verificado](https://raw.githubusercontent.com/github/docs/main/content/billing/concepts/product-billing/github-actions.md).
- [Visibilidad pública de Pages](https://raw.githubusercontent.com/github/docs/main/data/reusables/pages/private_pages_are_public_warning.md).
- [Publicar Vite en GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages) · [texto oficial verificado](https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/static-deploy.md).
- [Límites de Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/) · [texto oficial verificado](https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/pages/platform/limits.mdx).
- [Orientación de Cloudflare para proyectos nuevos](https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/partials/pages/workers-for-new-projects.mdx).
- [Facturación de Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) · [texto oficial verificado](https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers/static-assets/billing-and-limitations.mdx).
- [Vercel: despliegue en su repositorio oficial](https://raw.githubusercontent.com/vercel/vercel/main/README.md). [Vercel Hobby](https://vercel.com/docs/plans/hobby): sus cuotas no se pudieron verificar.
- [Planes y cuotas de Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase) · [texto oficial verificado](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/platform/billing-on-supabase.mdx).
- [Disponibilidad de Supabase Free](https://supabase.com/docs/guides/deployment/going-into-prod#availability) · [texto oficial verificado](https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/deployment/going-into-prod.mdx).
