# Atlas Santiago

Aplicación personal para explorar ofertas importadas y comprobar si el pie, el dividendo y los flujos de arriendo caben en tu presupuesto. Interfaz en español de Chile, montos CLP/UF y calendario de Santiago.

## Qué funciona

- Perfil editable: sueldo, honorarios por meses pagados, ahorro, aporte mensual y reserva de emergencia.
- Proyección del pie a diferentes plazos, brecha de ahorro y sensibilidad al reajuste de UF.
- Hipotecario en UF con amortización francesa, tasa nominal o efectiva y cronograma descargable.
- Arriendo tradicional: vacancia, administración, mantención, contribuciones y gastos comunes del propietario, incluidos meses sin arrendatario.
- Renta corta: noches ocupadas, comisiones, costos variables/fijos, muebles, reserva tributaria editable y ocupación de equilibrio. La reserva **no es una liquidación de IVA**.
- Cuatro escenarios reproducibles: base, conservador, estrés y solo variación de UF.
- Mapa interactivo real MapLibre/OpenStreetMap, selección de unidad, filtros y estados de entrega rojo/amarillo/verde/gris.
- Importación CSV validada y atómica, actualización por identificador de proyecto+unidad, favoritos y comparación de hasta cinco unidades con los mismos supuestos.
- Respaldo JSON validado, importación y exportación; informe imprimible y cronograma CSV.

**No hay ofertas reales precargadas.** Los ejemplos DEMO aparecen solo si se activa su interruptor y no se guardan como catálogo real. Una marca de verificación en un CSV es una declaración del importador, no una revisión independiente de Atlas. Las capturas comerciales no demuestran stock, precio o arriendo vigentes.

## Instalar y ejecutar

Requisitos: Node.js 24 y npm. Versiones de dependencias fijadas en `package-lock.json`.

```bash
cd /workspace/Chatgpt
npm ci
npm test
npm run build
npm run dev -- --port 5173
```

En tu computador, sustituye el directorio por el de tu checkout. Para servir la compilación: `npm run preview -- --port 4173`. No abras `dist/index.html` directamente desde el explorador de archivos; utiliza un servidor HTTP o Pages.

Pruebas funcionales de navegador: `npm run build` y `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`. Para otra instalación de Chrome/Chromium, indica su ruta en `CHROMIUM_PATH`; también puedes instalar el navegador soportado por Playwright y ajustar `playwright.config.ts`. La configuración actual usa el Chromium ya instalado en el entorno de nube.

## Primer uso y privacidad

La versión pública arranca con perfil financiero vacío. Completa **Configuración** o importa un archivo de perfil en **Fuentes y respaldo → Restaurar respaldo**. El perfil personalizado entregado al usuario es un archivo separado, fuera del repositorio y del bundle público. No lo subas a GitHub.

Los cambios se guardan mediante `localStorage` en el dispositivo y origen actual. No existe sincronización, cuenta de usuario ni autenticación de servidor. Una URL de Pages será pública, pero los valores que escribas no se envían a un backend. Cualquier otra persona con acceso a tu navegador puede ver ese perfil. Exporta un respaldo antes de borrar datos o cambiar de dispositivo/dominio. Un respaldo JSON no está cifrado.

La cartografía solicita únicamente tiles de mapa a OpenStreetMap; ese proveedor recibe solicitudes geográficas normales. No se transmite el perfil financiero. Se mantiene atribución, sin descarga masiva, precarga de zonas ni caché offline. Consulta la [política de tiles de OSM](https://operations.osmfoundation.org/policies/tiles/). Si aumenta el tráfico, cambia a un proveedor con capacidad y licencia adecuadas.

## Importar proyectos

Descarga la plantilla desde el explorador. Columnas mínimas: `project_id,project_name,unit_id,commune,latitude,longitude,offer_price_uf`. Las restantes están en `public/plantilla-proyectos.csv` y se explican en `docs/IMPORTACION.md`. Se usa punto decimal sin separadores de miles; fechas AAAA-MM-DD y booleanos `true/false`. CSV admite comillas, BOM y delimitador coma o punto y coma. No admite XLSX en esta versión: exporta esa hoja a CSV UTF-8.

Los proyectos importados viven en tu navegador; no se publican en GitHub. Antes de volver a importar una unidad con el mismo identificador, exporta un respaldo para conservar el valor anterior. No hay historial de precios ni auditoría multiusuario en esta versión.

## Supuestos y límites financieros

La UF inicial y las tasas son supuestos manuales, **no valores vigentes ni cotizaciones bancarias**. Registrar una fecha no convierte la cifra en verificada. No hay APIs oficiales conectadas. El precio de referencia es un ejemplo matemático, no una oferta real.

Los honorarios se anualizan con meses pagados y solo entran a la renta de evaluación si activas esa opción. No se suman automáticamente al ahorro declarado. La referencia del 25% no contempla otras deudas ni reemplaza evaluación crediticia. Financiar 90% y aceptar un bono pie depende del banco y del contrato.

El pie proyectado utiliza crecimiento compuesto supuesto de UF; la disponibilidad de ahorro se mantiene nominal en CLP y sin retorno. Se aproxima el aporte mensual necesario distribuyendo el pie pendiente **y gastos de compra** en el plazo de entrega. El contrato puede cobrar cuotas antes de ese plazo; comprueba calendario y reserva/promesa. No hay bono pie incorporado como capital gratuito.

El modelo tradicional usa vacancia promedio; no simula exactamente qué meses estarán vacíos. La renta corta usa 30 noches/mes, sin estacionalidad real y con todos los ingresos/ocupación ingresados por ti. No afirma autorización de renta corta. La mantención usa un porcentaje del ingreso efectivo; pueden existir reparaciones aun sin renta y se deben presupuestar en otros costos. Los flujos tradicionales son anteriores al impuesto personal a la renta. La provisión tributaria de renta corta es un supuesto, no la obligación fiscal final.

Los cálculos usan números IEEE-754 de doble precisión, mantienen valores sin redondear internamente y redondean en presentación/exportación. Las pruebas concilian el saldo final de la amortización en UF con tolerancia de punto flotante. No es un sistema de contabilidad bancaria ni una cotización contractual.

## Publicar gratis en GitHub Pages

Consulta [docs/HOSTING.md](docs/HOSTING.md). El workflow `.github/workflows/pages.yml` instala con lockfile, prueba, compila y publica `dist` al recibir cambios en `main`. Requiere activar **Settings → Pages → Source: GitHub Actions** y un repositorio público para GitHub Free. No requiere tokens guardados en el código ni servicios de pago.

La publicación no se da por hecha porque exista el workflow: comprueba su ejecución y la dirección que muestre GitHub. La base relativa de Vite permite alojar la aplicación bajo `/Chatgpt/`; las pantallas usan estado de React y no requieren rutas de servidor.

## Alcance frente al documento de referencia

Esta primera entrega prioriza una app personal con pocos servicios que mantener. La arquitectura del documento (Next.js, PostgreSQL/PostGIS, roles, pipelines y jobs) es una etapa posterior, **no está implementada ni simulada como completada**.

Pendientes: sincronización/autenticación, base de datos geoespacial, importación XLSX/PDF, fuentes autorizadas de mercado, comparables de 2 km, UF automática, normativa por edificio, radar urbano, alertas programadas/email, asistente LLM, ranking validado, proyecciones de patrimonio/TIR/Monte Carlo y reportes Excel/PDF generados por servidor. Los ejemplos y estadísticas hoteleras no sustituyen datos de ocupación Airbnb. No existen promesas de plusvalía o retorno.

Prioridad siguiente: incorporar ofertas respaldadas por documentos y arriendos comparables autorizados; después añadir un backend si necesitas sincronización. No hace falta contratar una API para utilizar el simulador actual.

## Cambios futuros

Consulta [HOW_TO_EXTEND.md](HOW_TO_EXTEND.md). Ejemplo: «En el repositorio existente, añade un campo de otras deudas al perfil y úsalo en la referencia de capacidad. Conserva la importación actual, migra respaldos y actualiza las pruebas». Evita reconstruir la aplicación por cambios puntuales.
