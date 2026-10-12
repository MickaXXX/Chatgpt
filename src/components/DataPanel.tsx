import { useRef, useState } from 'react';
import { defaultAssumptions, defaultProfile, validateInputs, type Assumptions, type Profile } from '../lib/finance';
import { csvHeaders, importProjects, type Project } from '../lib/projects';
import { download } from '../lib/storage';

const PERSONAL_KEY = 'atlas-personal-v1';
const BACKUP_KEYS = [PERSONAL_KEY, 'atlas-projects-v1', 'atlas-compare-v1', 'atlas-favorites-v1'] as const;
type BackupKey = typeof BACKUP_KEYS[number];
type Backup = { schemaVersion: 1; data: Partial<Record<BackupKey, unknown>> };
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name}: se esperaba un objeto.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], name: string, required = true) {
  if (Object.keys(value).some(key => !allowed.includes(key)) || (required && allowed.some(key => !(key in value)))) {
    throw new Error(`${name}: campos desconocidos o incompletos.`);
  }
}

function projectList(value: unknown): Project[] {
  if (!Array.isArray(value) || value.length > 3000) throw new Error('Proyectos: lista inválida o demasiado extensa.');
  if (value.length === 0) return [];
  const headers = csvHeaders.split(',');
  const numeric = ['latitude', 'longitude', 'offer_price_uf', 'useful_area_m2', 'bedrooms', 'bathrooms'];
  const booleans = ['immediate_delivery_verified', 'available_stock_verified', 'demo'];
  const projects = value.map((item, index) => {
    const row = object(item, `Proyecto ${index + 1}`);
    exactKeys(row, [...headers, 'demo'], `Proyecto ${index + 1}`);
    for (const [key, field] of Object.entries(row)) {
      if (numeric.includes(key)) {
        if (typeof field !== 'number' || !Number.isFinite(field)) throw new Error(`Proyecto ${index + 1}: ${key} debe ser un número finito.`);
      } else if (booleans.includes(key)) {
        if (typeof field !== 'boolean') throw new Error(`Proyecto ${index + 1}: ${key} debe ser true/false.`);
      } else if (typeof field !== 'string' || field.length > 8192) {
        throw new Error(`Proyecto ${index + 1}: ${key} debe ser texto de hasta 8.192 caracteres.`);
      }
    }
    if ((row.useful_area_m2 as number) > 10000 || !Number.isInteger(row.bedrooms) || !Number.isInteger(row.bathrooms) ||
      (row.bedrooms as number) > 100 || (row.bathrooms as number) > 100) {
      throw new Error(`Proyecto ${index + 1}: superficie, dormitorios o baños fuera de rango.`);
    }
    return row;
  });
  const cell = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  const text = `${csvHeaders}\n${projects.map(row => headers.map(key => cell(row[key])).join(',')).join('\n')}`;
  const result = importProjects(text);
  if (result.errors.length) throw new Error(result.errors.slice(0, 3).join(' '));
  return result.projects.map((item, index) => ({ ...item, demo: projects[index].demo as boolean }));
}

function selectionList(value: unknown, name: string, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum || value.some(item => typeof item !== 'string' || item.length === 0 || item.length > 500)) {
    throw new Error(`${name}: se esperaba una lista de identificadores de unidades.`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${name}: hay identificadores duplicados.`);
  return value as string[];
}

function financialState(value: unknown): unknown {
  const state = object(value, 'Perfil financiero');
  exactKeys(state, ['profile', 'assumptions'], 'Perfil financiero');
  const profile = object(state.profile, 'Perfil');
  const assumptions = object(state.assumptions, 'Supuestos');
  exactKeys(profile, Object.keys(defaultProfile), 'Perfil');
  const requiredAssumptions = Object.keys(defaultAssumptions).filter(key => key !== 'shortTaxPct');
  exactKeys(assumptions, [...requiredAssumptions, 'shortTaxPct'], 'Supuestos', false);
  if (requiredAssumptions.some(key => !(key in assumptions))) throw new Error('Supuestos: faltan campos del simulador.');
  if (typeof profile.recognizeExtraIncome !== 'boolean') throw new Error('Perfil: el reconocimiento de honorarios debe ser true/false.');
  for (const [key, field] of Object.entries(profile)) {
    if (key === 'recognizeExtraIncome') continue;
    if (typeof field !== 'number' || !Number.isFinite(field) || field > 1e12) throw new Error(`Perfil: ${key} debe ser un número finito dentro de rango.`);
  }
  for (const [key, field] of Object.entries(assumptions)) {
    if (key === 'ufDate' || key === 'rateKind') continue;
    if (typeof field !== 'number' || !Number.isFinite(field) || field > 1e12) throw new Error(`Supuestos: ${key} debe ser un número finito dentro de rango.`);
  }
  if (typeof assumptions.ufDate !== 'string' || (assumptions.ufDate !== '' &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(assumptions.ufDate) || !Number.isFinite(Date.parse(assumptions.ufDate)) ||
      new Date(assumptions.ufDate).toISOString().slice(0, 10) !== assumptions.ufDate))) {
    throw new Error('Supuestos: la fecha UF debe estar vacía o ser una fecha válida AAAA-MM-DD.');
  }
  if ((assumptions.years as number) > 100 || (assumptions.deliveryMonths as number) > 1200 ||
    (assumptions.annualRatePct as number) > 100 || (assumptions.annualUfGrowthPct as number) > 100 ||
    (assumptions.uf as number) > 1_000_000 || (assumptions.priceUf as number) > 100_000) {
    throw new Error('Supuestos fuera de los límites del simulador (plazo de hasta 100 años, tasa/variación UF de hasta 100%, UF de hasta $1.000.000 y precio de hasta 100.000 UF).');
  }
  if ('shortTaxPct' in assumptions && ((assumptions.shortTaxPct as number) < 0 || (assumptions.shortTaxPct as number) > 100)) {
    throw new Error('La provisión tributaria de renta corta debe estar entre 0 y 100%.');
  }
  validateInputs(profile as Profile, assumptions as Assumptions);
  return { profile, assumptions };
}

function validatedBackup(value: unknown): Backup {
  const envelope = object(value, 'Respaldo');
  exactKeys(envelope, ['schemaVersion', 'data'], 'Respaldo');
  if (envelope.schemaVersion !== 1) throw new Error('Versión de respaldo no compatible. Se requiere schemaVersion 1.');
  const raw = object(envelope.data, 'Datos del respaldo');
  exactKeys(raw, BACKUP_KEYS, 'Datos del respaldo', false);
  if (!Object.keys(raw).length) throw new Error('El respaldo no contiene datos de Atlas.');
  const data: Backup['data'] = {};
  for (const key of BACKUP_KEYS) {
    if (!(key in raw)) continue;
    if (key === PERSONAL_KEY) data[key] = financialState(raw[key]);
    else if (key === 'atlas-projects-v1') data[key] = projectList(raw[key]);
    else data[key] = selectionList(raw[key], key === 'atlas-compare-v1' ? 'Comparación' : 'Favoritos', key === 'atlas-compare-v1' ? 5 : 3000);
  }
  return { schemaVersion: 1, data };
}

const sources = [
  { name: 'Banco Central de Chile', purpose: 'Consultar UF y fecha; ingreso manual en el simulador.', href: 'https://si3.bcentral.cl/indicadoressiete/secure/Indicadoresdiarios.aspx' },
  { name: 'CMF', purpose: 'Revisar condiciones de créditos, costos y entidades supervisadas.', href: 'https://www.cmfchile.cl/portal/principal/613/w3-channel.html' },
  { name: 'Servicio de Impuestos Internos', purpose: 'Consultar tributación e IVA aplicable al arriendo amoblado.', href: 'https://www.sii.cl/' },
  { name: 'BCN · Ley 21.442', purpose: 'Revisar copropiedad y contrastar el reglamento del edificio para renta corta.', href: 'https://www.bcn.cl/leychile/navegar?idNorma=1174663' },
  { name: 'Metro de Santiago', purpose: 'Consultar red, estaciones y proyectos en fuentes oficiales.', href: 'https://www.metro.cl/' },
  { name: 'CEAD', purpose: 'Consultar estadísticas territoriales; no garantizan seguridad de una unidad.', href: 'https://cead.spd.gov.cl/estadisticas-delictuales/' },
];

export function DataPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const message = (text: string, failed = false) => { setStatus(text); setError(failed); };

  function exportBackup() {
    try {
      const data: Backup['data'] = {};
      for (const key of BACKUP_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw !== null) data[key] = JSON.parse(raw);
      }
      const backup = validatedBackup({ schemaVersion: 1, data });
      download(`atlas-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
      message('Respaldo descargado. Contiene información financiera: guárdalo en un lugar seguro.');
    } catch (cause) {
      message(`No se pudo exportar: ${(cause as Error).message}`, true);
    }
  }

  async function inspectBackup(file: File | undefined) {
    setPending(null);
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('El archivo supera el límite de 2 MB.');
      const backup = validatedBackup(JSON.parse(await file.text()));
      setPending(backup);
      message('Respaldo validado. Revisa los datos incluidos antes de restaurarlo.');
    } catch (cause) {
      message(`Respaldo rechazado: ${(cause as Error).message}`, true);
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  function restoreBackup() {
    if (!pending) return;
    if (!window.confirm('Restaurar este respaldo reemplazará el perfil, los proyectos, favoritos y comparación guardados en este navegador. Se recargará la app. ¿Continuar?')) return;
    const previous: Partial<Record<BackupKey, string | null>> = {};
    try {
      for (const key of BACKUP_KEYS) previous[key] = localStorage.getItem(key);
      for (const key of BACKUP_KEYS) {
        if (key in pending.data) localStorage.setItem(key, JSON.stringify(pending.data[key]));
        else localStorage.removeItem(key);
      }
      window.location.reload();
    } catch {
      try {
        for (const key of BACKUP_KEYS) {
          if (!(key in previous)) continue;
          if (previous[key] !== null) localStorage.setItem(key, previous[key]!);
          else localStorage.removeItem(key);
        }
      } catch {
        message('No se pudo restaurar ni recuperar por completo el almacenamiento anterior. Conserva el archivo de respaldo y revisa el espacio o permisos del navegador.', true);
        return;
      }
      message('No se pudo restaurar. Los datos anteriores se conservaron; revisa el espacio o permisos del navegador.', true);
    }
  }

  return <section className="data-panel" aria-label="Fuentes y respaldo">
    <div className="card">
      <div className="card-header"><div><p className="eyebrow">Información y evidencia</p><h2>Fuentes y alcance</h2></div></div>
      <p>Atlas es una herramienta de comparación personal. Los precios, stock, entrega y arriendos requieren respaldo de cada unidad y fecha de consulta.</p>
      <div className="info-box">La UF se ingresa manualmente. No hay sincronización de tasas, proyectos o disponibilidad. Las capturas compartidas son referencias comerciales y de diseño, no cotizaciones vigentes verificadas.</div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Fuente oficial</th><th>Qué revisar</th></tr></thead><tbody>
        {sources.map(source => <tr key={source.name}><td><a href={source.href} target="_blank" rel="noopener noreferrer">{source.name} ↗</a></td><td>{source.purpose}</td></tr>)}
      </tbody></table></div>
      <p>Para verificar una oferta, consulta a la inmobiliaria y guarda el enlace, fecha, unidad y evidencia en tu CSV. También puedes contrastar <a href="https://www.toctoc.com/" target="_blank" rel="noopener noreferrer">TocToc</a>, <a href="https://www.portalinmobiliario.com/" target="_blank" rel="noopener noreferrer">Portal Inmobiliario</a> y <a href="https://goodprop.cl/" target="_blank" rel="noopener noreferrer">Goodprop</a>. Estos portales no están conectados a Atlas.</p>
      <p>El modo demo es opcional y usa datos simulados. El mapa muestra cartografía de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>, no verifica ubicaciones ni ofertas comerciales. Su carga requiere conexión y puede depender de la disponibilidad del servicio público de mapas.</p>
    </div>
    <div className="card">
      <div className="card-header"><div><p className="eyebrow">Tus datos</p><h2>Respaldo personal</h2></div></div>
      <p>El perfil, proyectos importados, favoritos y comparación se guardan en este navegador. Exporta un respaldo para conservarlos o moverlos a otro dispositivo.</p>
      <div className="info-box">El archivo contiene información financiera personal. Guárdalo de forma segura y evita subirlo al repositorio público.</div>
      <div className="button-row"><button className="button primary" onClick={exportBackup}>Exportar respaldo JSON</button><button className="button secondary" onClick={() => input.current?.click()}>Importar respaldo</button></div>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Archivo de respaldo JSON" onChange={event => { void inspectBackup(event.target.files?.[0]); }} />
      <p className="muted">Solo archivos de Atlas, versión 1, hasta 2 MB. La importación valida los datos antes de reemplazarlos.</p>
      {pending && <div className="info-box"><p>Incluye {PERSONAL_KEY in pending.data ? 'perfil financiero' : 'sin perfil financiero'}, {Array.isArray(pending.data['atlas-projects-v1']) ? pending.data['atlas-projects-v1'].length : 0} proyectos y listas de favoritos/comparación.</p><div className="button-row"><button className="button primary" onClick={restoreBackup}>Restaurar y recargar</button><button className="button secondary" onClick={() => { setPending(null); message('Importación cancelada.'); }}>Cancelar</button></div></div>}
      {status && <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'muted'}>{status}</p>}
    </div>
  </section>;
}
