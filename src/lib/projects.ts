export type Project = {
  project_id: string; project_name: string; unit_id: string; commune: string; address: string;
  latitude: number; longitude: number; offer_price_uf: number; useful_area_m2: number;
  bedrooms: number; bathrooms: number; delivery_date: string; delivery_date_status: string;
  immediate_delivery_verified: boolean; available_stock_verified: boolean;
  publication_url: string; data_observed_at: string; evidence_notes: string;
  demo: boolean; geolocation_precision: string;
};
export type DeliveryState = 'red' | 'yellow' | 'green' | 'gray';
export const PROJECTS_KEY = 'atlas-projects-v1';
export const COMPARE_KEY = 'atlas-compare-v1';
export const FAVORITES_KEY = 'atlas-favorites-v1';
export const projectKey = (p: Project) => `${p.project_id}:${p.unit_id}`;
export const deliveryLabels: Record<DeliveryState, string> = {
  red: 'Inmediata verificada', yellow: 'Futura · hasta 365 días', green: 'Futura · más de 365 días', gray: 'Por verificar',
};
export function chileToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function deliveryState(p: Project, today = chileToday()): DeliveryState {
  if (!p.available_stock_verified || !p.publication_url || !p.data_observed_at) return 'gray';
  if (p.immediate_delivery_verified) return 'red';
  if (p.delivery_date_status !== 'verified' || !p.delivery_date) return 'gray';
  const days = Math.round((Date.parse(p.delivery_date) - Date.parse(today)) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return 'gray';
  return days <= 365 ? 'yellow' : 'green';
}
export function monthsToDelivery(p: Project) {
  if (!p.delivery_date) return 0;
  return Math.max(0, Math.ceil((Date.parse(p.delivery_date) - Date.parse(chileToday())) / (86400000 * 30.4375)));
}
export function safeUrl(value: string): string {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  const delimiter = text.split('\n')[0].includes(';') ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && char === delimiter) { row.push(value.trim()); value = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV con comillas sin cerrar.');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function importProjects(text: string): { projects: Project[]; errors: string[] } {
  let rows: string[][];
  try { rows = parseCsv(text); } catch (e) { return { projects: [], errors: [(e as Error).message] }; }
  if (rows.length < 2) return { projects: [], errors: ['El CSV debe contener encabezados y al menos una unidad.'] };
  const headers = rows[0];
  const required = ['project_id', 'project_name', 'unit_id', 'commune', 'latitude', 'longitude', 'offer_price_uf'];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) return { projects: [], errors: [`Faltan columnas: ${missing.join(', ')}.`] };
  if (new Set(headers).size !== headers.length) return { projects: [], errors: ['Hay columnas duplicadas.'] };
  const projects: Project[] = [], errors: string[] = [], ids = new Set<string>();
  rows.slice(1).forEach((row, i) => {
    const number = i + 2;
    const data = Object.fromEntries(headers.map((h, index) => [h, row[index] ?? '']));
    if (row.length !== headers.length) { errors.push(`Fila ${number}: número de columnas distinto al encabezado.`); return; }
    const problems: string[] = [];
    for (const field of required) if (!data[field]) problems.push(`falta ${field}`);
    const numeric = (field: string, fallback = 0) => {
      if (!data[field]) return fallback;
      const result = Number(data[field]);
      if (!Number.isFinite(result) || /\s/.test(data[field])) problems.push(`${field} debe ser número con punto decimal, sin separadores de miles`);
      return result;
    };
    const boolean = (field: string) => {
      if (!['true', 'false', ''].includes(data[field] ?? '')) problems.push(`${field} usa true/false`);
      return data[field] === 'true';
    };
    const date = (field: string) => {
      const value = data[field] || '';
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) problems.push(`${field} usa una fecha válida AAAA-MM-DD`);
      return value;
    };
    const p: Project = {
      project_id: data.project_id, project_name: data.project_name, unit_id: data.unit_id,
      commune: data.commune, address: data.address || '', latitude: numeric('latitude'), longitude: numeric('longitude'),
      offer_price_uf: numeric('offer_price_uf'), useful_area_m2: numeric('useful_area_m2'), bedrooms: numeric('bedrooms'), bathrooms: numeric('bathrooms'),
      delivery_date: date('delivery_date'), delivery_date_status: data.delivery_date_status || 'unknown',
      immediate_delivery_verified: boolean('immediate_delivery_verified'), available_stock_verified: boolean('available_stock_verified'),
      publication_url: safeUrl(data.publication_url || ''), data_observed_at: date('data_observed_at'),
      evidence_notes: data.evidence_notes || '', demo: false, geolocation_precision: data.geolocation_precision || 'approximate',
    };
    if (p.latitude < -34.5 || p.latitude > -32.5 || p.longitude < -72 || p.longitude > -69) problems.push('coordenadas fuera del área de Santiago');
    if (p.offer_price_uf <= 0 || p.offer_price_uf > 100000) problems.push('precio UF fuera de rango (0–100.000)');
    if (p.useful_area_m2 < 0 || p.bedrooms < 0 || p.bathrooms < 0) problems.push('superficie/dormitorios/baños no pueden ser negativos');
    if (!['verified', 'estimated', 'unknown'].includes(p.delivery_date_status)) problems.push('delivery_date_status usa verified/estimated/unknown');
    if (data.publication_url && !p.publication_url) problems.push('publication_url debe ser HTTPS válido');
    if (ids.has(projectKey(p))) problems.push('unidad duplicada');
    ids.add(projectKey(p));
    if (problems.length) errors.push(`Fila ${number}: ${problems.join('; ')}.`); else projects.push(p);
  });
  return { projects: errors.length ? [] : projects, errors };
}
export function demoProjects(): Project[] {
  const today = chileToday();
  const future = (days: number) => new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
  return [
    { project_name: 'DEMO · Jardín del futuro', commune: 'Ñuñoa', latitude: -33.455, longitude: -70.604, offer_price_uf: 2500, delivery_date: future(1080), immediate_delivery_verified: false, available_stock_verified: true },
    { project_name: 'DEMO · Parque urbano', commune: 'Santiago', latitude: -33.446, longitude: -70.646, offer_price_uf: 2100, delivery_date: future(270), immediate_delivery_verified: false, available_stock_verified: true },
    { project_name: 'DEMO · Barrio estación', commune: 'Providencia', latitude: -33.429, longitude: -70.612, offer_price_uf: 3200, delivery_date: today, immediate_delivery_verified: true, available_stock_verified: true },
    { project_name: 'DEMO · Proyecto por revisar', commune: 'Ñuñoa', latitude: -33.465, longitude: -70.625, offer_price_uf: 2300, delivery_date: '', immediate_delivery_verified: false, available_stock_verified: false },
  ].map((p, i) => ({ ...p, project_id: `demo-${i}`, unit_id: '101', address: 'Ubicación ficticia / de ejemplo', useful_area_m2: 35, bedrooms: 1, bathrooms: 1, delivery_date_status: 'verified', publication_url: 'https://example.org', data_observed_at: today, evidence_notes: 'DEMO / DATOS SIMULADOS. No es una oferta ni evidencia comercial.', demo: true, geolocation_precision: 'approximate' }));
}
export const csvHeaders = 'project_id,project_name,unit_id,commune,address,latitude,longitude,offer_price_uf,useful_area_m2,bedrooms,bathrooms,delivery_date,delivery_date_status,immediate_delivery_verified,available_stock_verified,publication_url,data_observed_at,evidence_notes,geolocation_precision';
export const templateCsv = `${csvHeaders}\n`;
