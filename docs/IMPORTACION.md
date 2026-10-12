# Importación de unidades

Usa ofertas obtenidas legalmente. CSV UTF-8, una fila por unidad. No subas respaldos personales al repositorio.

| Campo | Uso |
| --- | --- |
| project_id, unit_id | Obligatorios. Juntos identifican la unidad y permiten actualizarla. |
| project_name, commune | Obligatorios. Texto del proyecto y comuna. |
| latitude, longitude | Obligatorios. WGS84, con punto decimal. Área admitida: latitudes −34,5 a −32,5; longitudes −72 a −69. |
| offer_price_uf | Obligatorio. Precio positivo de esa unidad, no precio «desde» del edificio. |
| address | Dirección publicada. Si falta, se muestra pendiente. |
| useful_area_m2, bedrooms, bathrooms | Opcionales, cero indica desconocido en la plantilla. |
| delivery_date | Fecha válida AAAA-MM-DD, no trimestre ambiguo. |
| delivery_date_status | verified / estimated / unknown. Describe tu evidencia; Atlas no la verifica por ti. |
| immediate_delivery_verified | true solo con recepción/entrega confirmada, no por fecha pasada. |
| available_stock_verified | true solo con disponibilidad de esa unidad confirmada. |
| publication_url | Enlace HTTPS a evidencia de la oferta. No se aceptan scripts ni HTTP. |
| data_observed_at | Fecha de observación AAAA-MM-DD. |
| evidence_notes | Resumen de respaldo y datos pendientes. |
| geolocation_precision | exact o approximate; marca approximate si la ubicación es una aproximación. |

Rojo requiere stock, fuente y fecha de observación más entrega inmediata verificada; amarillo/verde requieren también fecha futura con estado verified. Fechas ya pasadas sin confirmación quedan grises. El umbral es 365 días de calendario según la fecha local de Santiago. Son reglas visuales sobre evidencia declarada en el CSV, no autorización de renta corta ni garantía comercial.

La importación es atómica: si hay una fila inválida, no se importa ninguna. Identificadores duplicados dentro de un archivo son errores. En una importación posterior, identificadores ya existentes se actualizan; exporta un respaldo antes si necesitas conservar el catálogo anterior.

No importes datos ficticios como ofertas reales. El interruptor DEMO genera ejemplos separados y rotulados en memoria. Columnas adicionales de documentos, inmobiliaria o gasto común aún no se usan: conserva ese material original aparte; no se presenta como integrado.
