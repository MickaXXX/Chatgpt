# Ampliar Atlas sin romperlo

1. Revisa el módulo afectado: `src/lib/finance.ts` (cálculos), `projects.ts` (CSV/evidencia), `storage.ts` (persistencia), `components/Simulator.tsx`, `ProjectExplorer.tsx`, `DataPanel.tsx` o `App.tsx` (pantallas).
2. Define el cambio y cómo se migra el esquema de respaldo. Mantén compatibilidad con schemaVersion 1 o implementa una migración explícita.
3. Cambia solo lo necesario, conserva el diseño y no sustituuyas datos importados por DEMO.
4. Ejecuta `npm test`, `npm run build` y las pruebas de navegador afectadas.
5. Documenta fuentes, licencia, límites y estado de cualquier nueva integración. No publiques una integración sin verificar su operación.

Una comuna aparece al importar unidades de esa comuna; el filtro la descubre automáticamente. Cambiar el radio de comparables requiere implementar antes el módulo de comparables: actualmente no existe. Incorporar obras, indicadores o proveedor exige esquema de evidencia y no debe crear pins falsos cuando el servicio falle.

Para sincronización, incorpora Auth y políticas por usuario en una base de datos antes de almacenar perfiles remotos. Una contraseña solo en JavaScript no protege una URL pública ni reemplaza autorización de backend. Las claves de proveedores deben mantenerse fuera del bundle.

Prompt sugerido: «Trabaja sobre Atlas Santiago existente. Quiero [cambio]. Identifica los módulos afectados, conserva el guardado y cálculos actuales, implementa la migración necesaria y valida con pruebas. Indica qué fuentes o acceso faltan». No reescribas todo el proyecto.
