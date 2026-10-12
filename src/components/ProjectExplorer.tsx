import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Download, Upload, MapPin, Heart, ArrowUpRight, Layers, X } from 'lucide-react';
import { calculate, type Assumptions, type Profile } from '../lib/finance';
import { COMPARE_KEY, FAVORITES_KEY, PROJECTS_KEY, deliveryLabels, deliveryState, demoProjects, importProjects, monthsToDelivery, projectKey, templateCsv, type Project } from '../lib/projects';
import { download, readStored, saveStored } from '../lib/storage';

const money = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const uf = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);
const colors = { red: '#e45c59', yellow: '#ecb636', green: '#278e69', gray: '#7c8585' };

function ProjectMap({ projects, selected, onSelect }: { projects: Project[]; selected: string; onSelect: (p: Project) => void }) {
  const container = useRef<HTMLDivElement>(null); const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current, center: [-70.627, -33.446], zoom: 11.3,
        style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
      });
      instance.addControl(new maplibregl.NavigationControl(), 'top-right');
      instance.on('error', () => setMapError(true));
      map.current = instance;
    } catch { setMapError(true); return; }
    return () => { instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const markers = projects.map(p => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `atlas-map-pin${selected === projectKey(p) ? ' selected' : ''}`;
      button.style.backgroundColor = colors[deliveryState(p)];
      button.textContent = '⌂'; button.title = p.project_name; button.setAttribute('aria-label', `Ver ${p.project_name}`);
      button.onclick = () => onSelect(p);
      return new maplibregl.Marker({ element: button }).setLngLat([p.longitude, p.latitude]).addTo(map.current!);
    });
    return () => markers.forEach(m => m.remove());
  }, [projects, selected, onSelect]);
  useEffect(() => {
    const p = projects.find(p => projectKey(p) === selected);
    if (p && map.current) map.current.easeTo({ center: [p.longitude, p.latitude], zoom: 14, duration: 500 });
  }, [selected]);
  return <div className="atlas-map-wrap">
    <div ref={container} className="atlas-map" aria-label="Mapa interactivo de Santiago" />
    {mapError && <div className="map-status" role="status">No se pudo cargar toda la cartografía. La lista y el simulador siguen disponibles. Revisa tu conexión y acceso a OpenStreetMap; vuelve a abrir esta pantalla para reintentar.</div>}
    <div className="map-legend">{Object.entries(deliveryLabels).map(([state, label]) => <span key={state}><i style={{ background: colors[state as keyof typeof colors] }} />{label}</span>)}</div>
  </div>;
}

export default function ProjectExplorer({ profile, assumptions, onSimulate }: { profile: Profile; assumptions: Assumptions; onSimulate: (priceUf: number, deliveryMonths: number) => void }) {
  const [realProjects, setRealProjects] = useState<Project[]>(() => readStored(PROJECTS_KEY, []));
  const [demo, setDemo] = useState(false); const [search, setSearch] = useState('');
  const [commune, setCommune] = useState(''); const [maxPrice, setMaxPrice] = useState(5000); const [futureOnly, setFutureOnly] = useState(false);
  const [selection, setSelection] = useState(''); const [notice, setNotice] = useState(''); const [errors, setErrors] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => readStored(FAVORITES_KEY, []));
  const [comparison, setComparison] = useState<string[]>(() => readStored(COMPARE_KEY, []));
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const projects = useMemo(() => demo ? demoProjects() : realProjects, [demo, realProjects]);
  const filtered = projects.filter(p => (!search || `${p.project_name} ${p.address} ${p.commune}`.toLowerCase().includes(search.toLowerCase())) && (!commune || p.commune === commune) && p.offer_price_uf <= maxPrice && (!futureOnly || ['yellow', 'green'].includes(deliveryState(p))) && (!onlyFavorites || favorites.includes(projectKey(p))));
  const selected = filtered.find(p => projectKey(p) === selection);
  const compared = projects.filter(p => comparison.includes(projectKey(p)));
  const inputRef = useRef<HTMLInputElement>(null);
  function toggleFavorite(p: Project) { const id = projectKey(p); const next = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id]; if (saveStored(FAVORITES_KEY, next)) setFavorites(next); else setNotice('No fue posible guardar: revisa el espacio o permisos de tu navegador.'); }
  function toggleCompare(p: Project) {
    const id = projectKey(p);
    if (comparison.length >= 5 && !comparison.includes(id)) { setNotice('Puedes comparar hasta 5 unidades.'); return; }
    const next = comparison.includes(id) ? comparison.filter(i => i !== id) : [...comparison, id];
    if (saveStored(COMPARE_KEY, next)) setComparison(next); else setNotice('No fue posible guardar la comparación.');
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErrors(['El archivo supera 2 MB. Divide la importación.']); return; }
    const result = importProjects(await file.text()); setErrors(result.errors);
    if (result.errors.length) { setNotice('No se importó ninguna fila. Corrige los errores y vuelve a cargar.'); return; }
    const byKey = new Map(realProjects.map(p => [projectKey(p), p]));
    result.projects.forEach(p => byKey.set(projectKey(p), p));
    const next = [...byKey.values()];
    if (!saveStored(PROJECTS_KEY, next)) { setNotice('El navegador no pudo guardar los proyectos. Exporta un respaldo antes de limpiar espacio.'); return; }
    setRealProjects(next); setDemo(false); setSelection(''); setNotice(`${result.projects.length} unidades importadas. Los identificadores existentes se actualizaron; verifica la evidencia de cada ficha.`);
  }
  return <>
    <div className="section-heading"><div><span className="eyebrow">Explorador inmobiliario</span><h1>Encuentra tu próximo paso</h1><p className="muted">Ubicación, entrega y números. Tú decides qué investigar.</p></div><button className="button primary" onClick={() => inputRef.current?.click()}><Upload size={17} /> Importar proyectos</button></div>
    <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
    <div className="card explorer-toolbar">
      <label className="field">Buscar<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Proyecto, dirección o comuna" /></label>
      <label className="field">Comuna<select value={commune} onChange={e => setCommune(e.target.value)}><option value="">Todas</option>{[...new Set(projects.map(p => p.commune))].sort().map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="field">Precio máximo UF<input type="number" min="1" max="100000" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} /></label>
      <label className="check-option"><input type="checkbox" checked={futureOnly} onChange={e => setFutureOnly(e.target.checked)} />Solo entrega futura verificada</label>
      <label className="check-option"><input type="checkbox" checked={onlyFavorites} onChange={e => setOnlyFavorites(e.target.checked)} />Mis favoritos</label>
    </div>
    <div className="demo-control"><label className="check-option"><input type="checkbox" checked={demo} onChange={e => { setDemo(e.target.checked); setSelection(''); setCommune(''); }} />Explorar ejemplos DEMO</label><span className="muted">{demo ? 'DATOS SIMULADOS · no son ofertas ni oportunidades reales.' : `${realProjects.length} unidades importadas · sin conexión automática a portales.`}</span><button className="button ghost" onClick={() => download('plantilla-proyectos.csv', templateCsv, 'text/csv;charset=utf-8')}><Download size={15} />Plantilla CSV</button></div>
    {notice && <div className="info-box" role="status">{notice}</div>}
    {errors.length > 0 && <div className="info-box warning" role="alert"><strong>Revisa tu archivo</strong><ul>{errors.slice(0, 20).map(error => <li key={error}>{error}</li>)}</ul>{errors.length > 20 && <p>Hay {errors.length} errores en total. Se muestran los primeros 20.</p>}</div>}
    <div className="explorer-grid">
      <ProjectMap projects={filtered} selected={selection} onSelect={p => setSelection(projectKey(p))} />
      <div className="project-list">
        <div className="list-label"><Layers size={15} /> {filtered.length} unidades {demo ? 'DEMO' : 'en tu búsqueda'}</div>
        {!filtered.length && <div className="card empty-state"><MapPin size={32} /><h2>{realProjects.length || demo ? 'Sin coincidencias' : 'Tus proyectos, en un solo mapa'}</h2><p>Importa ofertas que hayas obtenido de fuentes autorizadas. No inventamos precios, stock ni fechas.</p><button className="button secondary" onClick={() => inputRef.current?.click()}>Importar CSV</button><p className="muted">También puedes activar los ejemplos DEMO para aprender.</p></div>}
        {filtered.map(p => <article className={`card project-card${selection === projectKey(p) ? ' selected-card' : ''}`} key={projectKey(p)}>
          <div className="project-card-top"><span className="delivery-badge" style={{ color: colors[deliveryState(p)] }}><i style={{ background: colors[deliveryState(p)] }} />{deliveryLabels[deliveryState(p)]}</span><button className="icon-button" aria-label={`${favorites.includes(projectKey(p)) ? 'Quitar favorito' : 'Guardar favorito'} ${p.project_name}`} onClick={() => toggleFavorite(p)}><Heart size={17} fill={favorites.includes(projectKey(p)) ? '#278e69' : 'none'} /></button></div>
          <button className="project-title" onClick={() => setSelection(projectKey(p))}>{p.project_name}</button><p className="muted">{p.commune} · Unidad {p.unit_id} · {p.useful_area_m2 ? `${p.useful_area_m2} m² útiles` : 'Superficie por verificar'}</p>
          <div className="project-price">{uf(p.offer_price_uf)} <small>UF</small><span>{money(p.offer_price_uf * assumptions.uf)}</span></div>
          <div className="project-actions"><button className="button secondary" onClick={() => setSelection(projectKey(p))}>Ver ficha</button><button className="button ghost" onClick={() => toggleCompare(p)}>{comparison.includes(projectKey(p)) ? 'Quitar comparación' : 'Comparar'}</button></div>
        </article>)}
      </div>
    </div>
    {selected && <section className="card project-detail" aria-label="Ficha de unidad">
      <div className="card-header"><div><span className="eyebrow">{selected.demo ? 'DEMO / DATOS SIMULADOS' : 'Datos importados por ti'}</span><h2>{selected.project_name} · Unidad {selected.unit_id}</h2></div><button className="icon-button" aria-label="Cerrar ficha" onClick={() => setSelection('')}><X size={20} /></button></div>
      <div className="detail-grid"><div><p><strong>{selected.address || 'Dirección por verificar'}</strong><br />{selected.commune}</p><p>Ubicación {selected.geolocation_precision === 'exact' ? 'exacta según importación' : 'aproximada'} · {selected.latitude}, {selected.longitude}</p><p>Entrega: {selected.delivery_date || 'Sin fecha'} · {selected.delivery_date_status === 'verified' ? 'Declarada verificada en CSV' : 'Por verificar'}</p><p>Stock: {selected.available_stock_verified ? 'Declarado verificado en CSV' : 'Sin disponibilidad verificada'}</p><p>Observado: {selected.data_observed_at || 'Sin fecha de evidencia'}</p>{selected.publication_url && <a className="source-link" href={selected.publication_url} target="_blank" rel="noopener noreferrer">Abrir fuente declarada <ArrowUpRight size={15} /></a>}</div>
        <div><h3>Antes de firmar</h3><ul className="checklist"><li>Confirmar precio y stock de esta unidad.</li><li>Revisar recepción, promesa, cuotas del pie y multas por atraso.</li><li>Obtener evaluación bancaria y tasación.</li><li>Validar gastos comunes, contribuciones y arriendos comparables.</li><li>Renta corta: reglamento y tributación <strong>por verificar</strong>.</li></ul><p className="muted">{selected.evidence_notes || 'Sin documentos adicionales.'}</p><button className="button primary" onClick={() => onSimulate(selected.offer_price_uf, monthsToDelivery(selected))}>Simular esta unidad <ArrowUpRight size={16} /></button></div></div>
    </section>}
    {compared.length > 0 && <section className="card compare-section"><div className="card-header"><div><span className="eyebrow">Mismo escenario para cada unidad</span><h2>Tu comparación {demo ? 'DEMO' : 'provisional'}</h2></div><button className="button ghost" onClick={() => { if (saveStored(COMPARE_KEY, [])) setComparison([]); }}>Vaciar comparación</button></div>
      <p className="muted">Los arriendos y gastos son los supuestos de tu simulador, iguales para todas las unidades. No constituyen evidencia de mercado ni un ranking de inversiones.</p>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Unidad</th><th>Precio UF</th><th>Pie</th><th>Dividendo + seguro</th><th>Flujo tradicional</th><th>Flujo renta corta*</th><th>Pie faltante</th></tr></thead><tbody>{compared.map(p => {
        const result = calculate(profile, { ...assumptions, priceUf: p.offer_price_uf, deliveryMonths: monthsToDelivery(p) });
        return <tr key={projectKey(p)}><td>{p.project_name}<br /><small>{p.commune} · {p.unit_id}</small></td><td>{uf(p.offer_price_uf)}</td><td>{money(result.downPayment)}</td><td>{money(result.totalDebtPayment)}</td><td className={result.traditional.flow < 0 ? 'text-danger' : 'text-good'}>{money(result.traditional.flow)}</td><td>{money(result.short.flow)}</td><td>{money(result.gap)}</td></tr>;
      })}</tbody></table></div><p className="muted">*Renta corta: viabilidad legal y datos de ocupación por verificar. Pie calculado con UF de referencia, sin reajustes futuros.</p>
    </section>}
  </>;
}
