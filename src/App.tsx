import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Building2, ChevronRight, CircleHelp, Compass, Download, FileCheck2, LayoutDashboard, Leaf, MapPinned, Menu, PiggyBank, Printer, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Wallet, X } from 'lucide-react';
import { calculate, defaultAssumptions, defaultProfile, validateInputs, type Assumptions, type Profile } from './lib/finance';
import { DataPanel } from './components/DataPanel';
import { Simulator } from './components/Simulator';
import './styles.css';

const ProjectExplorer = lazy(() => import('./components/ProjectExplorer'));

export const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
const number = (value: number, digits = 0) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: digits }).format(value);
const KEY = 'atlas-personal-v1';
type Tab = 'plan' | 'explore' | 'simulator' | 'sources' | 'settings';
const navigation = [
  { id: 'plan' as const, label: 'Mi plan', icon: LayoutDashboard },
  { id: 'explore' as const, label: 'Explorar proyectos', icon: MapPinned },
  { id: 'simulator' as const, label: 'Simulador', icon: SlidersHorizontal },
  { id: 'sources' as const, label: 'Fuentes y respaldo', icon: FileCheck2 },
];

function safelyMerge<T extends object>(defaults: T, candidate: unknown): T {
  const result = { ...defaults };
  if (!candidate || typeof candidate !== 'object') return result;
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (candidate as Partial<T>)[key];
    if (typeof value === typeof defaults[key] && (typeof value !== 'number' || Number.isFinite(value))) result[key] = value as T[keyof T];
  }
  return result;
}

function loadPersonal() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const profile = safelyMerge(defaultProfile, parsed.profile);
      const assumptions = safelyMerge(defaultAssumptions, parsed.assumptions);
      validateInputs(profile, assumptions);
      return { profile, assumptions, error: '' };
    }
  } catch {
    return { profile: { ...defaultProfile }, assumptions: { ...defaultAssumptions }, error: 'No pudimos leer tu configuración guardada. Puedes seguir usando la app con el perfil inicial.' };
  }
  return { profile: { ...defaultProfile }, assumptions: { ...defaultAssumptions }, error: '' };
}

export default function App() {
  const [initial] = useState(loadPersonal);
  const [profile, setProfile] = useState<Profile>(initial.profile);
  const [assumptions, setAssumptions] = useState<Assumptions>(initial.assumptions);
  const [tab, setTab] = useState<Tab>('plan');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storageError, setStorageError] = useState(initial.error);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ profile, assumptions })); }
    catch { setStorageError('El navegador no permite guardar cambios. Mantén esta pestaña abierta o exporta tu configuración para conservarlos.'); }
  }, [profile, assumptions]);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 5000); return () => window.clearTimeout(timer); } }, [notice]);
  function navigate(value: Tab) { setTab(value); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function exportPersonal() {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, data: { [KEY]: { profile, assumptions } } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'atlas-mi-configuracion.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('Configuración descargada. Guarda este archivo en un lugar seguro: contiene tus datos financieros.');
  }
  const title = tab === 'settings' ? 'Configuración' : navigation.find(item => item.id === tab)?.label;
  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate('plan'); }} aria-label="Atlas Santiago, ir a Mi plan"><span className="brand-symbol"><Building2 size={25} strokeWidth={1.7} /></span><span>atlas<span className="brand-city">SANTIAGO</span></span></a>
      <button className="sidebar-close icon-button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}><X size={21} /></button>
      <div className="workspace-label">TU ESPACIO DE INVERSIÓN</div>
      <nav aria-label="Navegación principal">{navigation.map(item => <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span>{tab === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-note"><span className="small-icon"><Leaf size={19} /></span><p>Una decisión grande.<br /><strong>Un paso a la vez.</strong></p><span>Compara, entiende y decide con tus propios números.</span><button onClick={() => navigate('simulator')}>Haz una simulación <ArrowUpRight size={15} /></button></div>
      <div className="sidebar-bottom"><button className={`nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19} /><span>Configuración</span></button><div className="sidebar-profile"><span className="avatar">MI</span><div><strong>Mi inversión</strong><span>Datos en este navegador</span></div><ShieldCheck size={17} /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><span>Mi espacio</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-actions"><span className="saved-status"><span />Guardado local</span><button className="icon-button help-button" onClick={() => navigate('sources')} aria-label="Cómo funciona Atlas y sus fuentes"><CircleHelp size={20} /></button><span className="avatar avatar-light">MI</span></div></header>
      <div className="page-content">
        {storageError && <div role="alert" className="warning-banner">{storageError}<button className="text-button" onClick={exportPersonal}>Exportar configuración</button></div>}
        {notice && <div className="toast" role="status">{notice}</div>}
        {tab === 'plan' && <Dashboard profile={profile} assumptions={assumptions} onDelivery={(deliveryMonths) => setAssumptions({ ...assumptions, deliveryMonths })} onNavigate={navigate} />}
        {tab === 'explore' && <Suspense fallback={<div className="info-box">Cargando el explorador de Santiago…</div>}><ProjectExplorer profile={profile} assumptions={assumptions} onSimulate={(priceUf, deliveryMonths) => { setAssumptions({ ...assumptions, priceUf, deliveryMonths }); navigate('simulator'); }} /></Suspense>}
        {tab === 'simulator' && <Simulator profile={profile} assumptions={assumptions} onChange={setAssumptions} />}
        {tab === 'sources' && <DataPanel />}
        {tab === 'settings' && <Settings profile={profile} onProfile={setProfile} assumptions={assumptions} onAssumptions={setAssumptions} onExport={exportPersonal} />}
        <footer className="page-footer"><span><Building2 size={14} /> atlas Santiago</span><span>Simulaciones para decidir mejor · Sin aprobación bancaria implícita</span></footer>
      </div>
    </main>
  </div>;
}

function Dashboard({ profile, assumptions, onDelivery, onNavigate }: { profile: Profile; assumptions: Assumptions; onDelivery: (months: number) => void; onNavigate: (tab: Tab) => void }) {
  const result = calculate(profile, assumptions);
  const horizons = [12, 24, 36, 48];
  const availableAt = (months: number) => Math.max(0, profile.savings + profile.monthlySavings * months - profile.emergencyReserve);
  const available = availableAt(0);
  const target = result.cashNeeded;
  const max = Math.max(availableAt(48), target, 1);
  const coords = [0, ...horizons].map((months, index) => `${52 + index * 104},${154 - availableAt(months) / max * 106}`);
  const affordable = result.incomeRatio <= 25;
  const canSave = result.monthlyNeeded <= profile.monthlySavings;
  return <>
    {profile.salary === 0 && profile.savings === 0 && <div className="info-box"><ShieldCheck size={18} /><p><strong>Tu perfil empieza vacío.</strong> Importa tu archivo personal desde <button className="text-button" onClick={() => onNavigate('sources')}>Fuentes y respaldo</button> o completa <button className="text-button" onClick={() => onNavigate('settings')}>Configuración</button>. Tus cifras no están en el código público.</p></div>}
    <div className="page-heading"><div><div className="eyebrow">TU PRÓXIMO GRAN PASO</div><h1>Tu inversión empieza con un plan<span className="mint-dot">.</span></h1><p>Una mirada clara a tus ahorros, tus posibilidades y lo que falta por construir.</p></div><button className="button secondary hide-small" onClick={() => window.print()}><Printer size={16} /> Imprimir plan</button></div>
    <section className="welcome-card"><div className="welcome-text"><span className="pill"><Sparkles size={13} /> HECHO PARA TU REALIDAD</span><h2>Un departamento.<br />Muchas decisiones.<br /><span>Más claridad.</span></h2><p>Explora Santiago y compara renta tradicional con renta corta, sin perder de vista tu capacidad de pago.</p><button className="button primary" onClick={() => onNavigate('explore')}>Explorar proyectos <ArrowRight size={17} /></button></div><div className="welcome-art" aria-hidden="true"><CityArt /><div className="art-caption"><span><Compass size={16} /> SANTIAGO, CHILE</span><small>Tu próximo capítulo</small></div></div></section>
    <section className="overview-grid" aria-label="Tu perfil financiero"><Metric icon={<Wallet size={20} />} label="Tu ahorro actual" value={money(profile.savings)} hint={`${money(result.reservedSavings)} reservados; meta ${money(profile.emergencyReserve)}`} /><Metric icon={<PiggyBank size={20} />} label="Aporte mensual al pie" value={money(profile.monthlySavings)} hint="Tu ahorro declarado, sin sumar honorarios" /><Metric icon={<Building2 size={20} />} label="Renta líquida mensual" value={money(profile.salary)} hint={`Honorarios: ${money(result.extraAnnualIncome)} al año`} /></section>
    <div className="dashboard-grid"><section className="card savings-card"><div className="card-header"><div><span className="eyebrow">EL TIEMPO TAMBIÉN CUENTA</span><h2>Tu camino hacia el pie</h2><p>Ahorro disponible después de tu reserva.</p></div><span className="tag">Sin rentabilidad asumida</span></div><div className="projection-summary"><strong>{money(result.savingsAtDelivery)}</strong><span>disponibles en {assumptions.deliveryMonths} meses</span><button className="text-button" onClick={() => onNavigate('settings')}>Editar mi ahorro <ArrowUpRight size={13} /></button></div><div className="chart-wrap"><svg viewBox="0 0 500 196" role="img" aria-label="Proyección del ahorro disponible desde hoy hasta 48 meses"><defs><linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78b7a0" stopOpacity=".3" /><stop offset="100%" stopColor="#78b7a0" stopOpacity="0" /></linearGradient></defs>{[48, 100, 154].map(y => <line key={y} x1="52" x2="468" y1={y} y2={y} stroke="#e7ece5" strokeDasharray="4 5" />)}<text x="4" y="52" className="chart-label">{number(max / 1000000, 1)} M</text><text x="4" y="158" className="chart-label">$ 0</text><path d={`M ${coords.join(' L ')} L 468 154 L 52 154 Z`} fill="url(#savings-fill)" /><path d={`M ${coords.join(' L ')}`} fill="none" stroke="#35735d" strokeWidth="2.7" />{coords.map((coord, index) => <g key={coord}><circle cx={coord.split(',')[0]} cy={coord.split(',')[1]} r="4" fill="#35735d" stroke="white" strokeWidth="2" /><text x={coord.split(',')[0]} y="182" textAnchor="middle" className="chart-label">{index === 0 ? 'Hoy' : `${horizons[index - 1]} meses`}</text></g>)}</svg></div><div className="horizon-options">{horizons.map(months => <button key={months} aria-pressed={assumptions.deliveryMonths === months} className={`horizon ${assumptions.deliveryMonths === months ? 'selected' : ''}`} onClick={() => onDelivery(months)}><span>{months} meses</span><strong>{money(availableAt(months))}</strong><span className="horizon-bar"><span style={{ width: `${Math.min(100, (availableAt(months)) / Math.max(1, target) * 100)}%` }} /></span></button>)}</div><p className="footnote">Las cuotas del pie pueden cobrarse antes de la entrega. Los montos del gráfico están en pesos de hoy; el simulador incluye la variación supuesta de la UF.</p></section>
    <section className="card compass-card"><div className="card-header"><div><span className="eyebrow">UNA PRIMERA REFERENCIA</span><h2>Tu brújula financiera</h2></div><span className="icon-circle"><Compass size={19} /></span></div><div className="reference-price"><span>Propiedad de referencia</span><strong>{number(assumptions.priceUf)} <small>UF</small></strong><button className="text-button" onClick={() => onNavigate('simulator')}>Cambiar supuestos <ArrowUpRight size={13} /></button></div><div className="compass-row"><span>Dividendo + seguro estimado</span><strong>{money(result.totalDebtPayment)}</strong></div><div className="compass-row"><span>Umbral orientativo: 25% de renta</span><strong>{money(result.recognizedIncome * .25)}</strong></div><div className="compass-row"><span>{assumptions.deliveryMonths ? 'Aporte mensual para pie y gastos' : 'Saldo de pie y gastos hoy'}</span><strong>{money(result.monthlyNeeded)}</strong></div><div className={`assessment ${affordable && canSave ? 'good' : 'warn'}`}><span className="assessment-dot" /><div><strong>{affordable && canSave ? 'Vale la pena seguir evaluando' : 'Este escenario necesita ajustes'}</strong><p>{!affordable ? 'El dividendo supera el 25% de la renta considerada. Prueba un menor precio o un pie mayor.' : !canSave ? 'La cuota del pie supera tu ahorro mensual. Prueba una entrega más lejana o un menor precio.' : 'El pie y el dividendo caben en estos supuestos. Falta verificar costos y condiciones del banco.'}</p></div></div><button className="button secondary full-width" onClick={() => onNavigate('simulator')}>Ver simulación completa <ArrowRight size={16} /></button></section></div>
    <section className="next-step-card"><span className="icon-circle"><MapPinned size={23} /></span><div><span className="eyebrow">PRIMERO, ENTENDER EL BARRIO</span><h3>Busca una buena ubicación. Después, prueba los números.</h3><p>Metro, demanda de arriendo, entrega y restricciones de renta corta: todo influye.</p></div><button className="button secondary" onClick={() => onNavigate('explore')}>Abrir mapa <ArrowUpRight size={16} /></button></section>
    <div className="dashboard-notes"><span><ShieldCheck size={15} /> Tus datos financieros se guardan en este navegador, sin sincronización.</span><span><CircleHelp size={15} /> UF: {money(assumptions.uf)} · supuesto editable, no UF vigente.</span></div>
  </>;
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) { return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><p>{hint}</p></article>; }

function Settings({ profile, onProfile, assumptions, onAssumptions, onExport }: { profile: Profile; onProfile: (value: Profile) => void; assumptions: Assumptions; onAssumptions: (value: Assumptions) => void; onExport: () => void }) {
  const fields: { key: keyof Profile; label: string; hint?: string; max?: number }[] = [
    { key: 'salary', label: 'Renta líquida mensual', hint: 'Tu sueldo mensual habitual' }, { key: 'savings', label: 'Ahorro actual' },
    { key: 'monthlySavings', label: 'Ahorro mensual para el pie', hint: 'Ya es ahorro disponible. No volvemos a sumar tu sueldo.' }, { key: 'emergencyReserve', label: 'Reserva para imprevistos', hint: 'Supuesto inicial de $2.000.000; puedes cambiarlo.' },
    { key: 'extraIncome', label: 'Honorarios por mes pagado', hint: 'Si el monto es bruto, ingresa aquí el líquido estimado.' }, { key: 'extraMonths', label: 'Meses pagados al año', max: 12, hint: 'Solo incluye los meses que efectivamente se pagan.' },
  ];
  return <><div className="page-heading"><div><div className="eyebrow">TUS NÚMEROS, TUS SUPUESTOS</div><h1>Un plan que se adapta a ti<span className="mint-dot">.</span></h1><p>Los cambios se aplican al instante y se guardan en este navegador.</p></div></div><div className="settings-grid"><section className="card"><div className="card-header"><div><h2>Mi perfil financiero</h2><p>Usa montos en pesos chilenos.</p></div><Wallet size={20} /></div><div className="form-grid">{fields.map(field => <label className="field" key={field.key}><span>{field.label}</span><div className="input-affix">{field.key !== 'extraMonths' && <span>$</span>}<input type="number" inputMode="numeric" min="0" max={field.max ?? 1000000000} step={field.key === 'extraMonths' ? 1 : 10000} value={profile[field.key] as number} onChange={event => onProfile({ ...profile, [field.key]: Math.min(field.max ?? 1000000000, Math.max(0, field.key === 'extraMonths' ? Math.round(Number(event.target.value) || 0) : Number(event.target.value) || 0)) })} /></div>{field.hint && <small>{field.hint}</small>}</label>)}</div><label className="toggle-row"><span><strong>Considerar honorarios en la renta bancaria</strong><small>Promedio anual: {money(profile.extraIncome * profile.extraMonths / 12)} al mes. El banco debe confirmar su aceptación.</small></span><input type="checkbox" checked={profile.recognizeExtraIncome} onChange={event => onProfile({ ...profile, recognizeExtraIncome: event.target.checked })} /></label><div className="info-box"><ShieldCheck size={18} /><p>La opción inicial usa solo tu sueldo. Los honorarios no aumentan automáticamente tu ahorro de {money(profile.monthlySavings)} al mes.</p></div></section><section className="card"><div className="card-header"><div><h2>UF de referencia</h2><p>Valor manual para tus simulaciones.</p></div><Settings2 size={20} /></div><label className="field"><span>Valor de una UF en pesos</span><div className="input-affix"><span>$</span><input type="number" min="1" max="1000000" value={assumptions.uf} onChange={event => onAssumptions({ ...assumptions, uf: Math.min(1000000, Math.max(1, Number(event.target.value) || 1)) })} /></div><small>Supuesto editable, no cotización vigente.</small></label><label className="field spaced"><span>Fecha de referencia registrada</span><input type="date" value={assumptions.ufDate} onChange={event => onAssumptions({ ...assumptions, ufDate: event.target.value })} /></label><a className="button secondary full-width spaced" href="https://www.sii.cl/valores_y_fechas/uf/uf2026.htm" target="_blank" rel="noreferrer">Consultar UF en el SII <ArrowUpRight size={15} /></a><div className="settings-divider" /><h3>Tu respaldo</h3><p className="muted">La app puede alojarse gratis en GitHub Pages. La URL es pública; tus cambios de perfil se almacenan en este dispositivo y navegador.</p><button className="button secondary full-width spaced" onClick={onExport}><Download size={16} /> Exportar mi configuración</button><button className="text-button reset-button" onClick={() => { if (window.confirm('¿Restaurar tu perfil y todos los supuestos iniciales? Se reemplazarán los cambios guardados en este navegador.')) { onProfile({ ...defaultProfile }); onAssumptions({ ...defaultAssumptions }); } }}>Restaurar valores iniciales</button></section></div></>;
}

function CityArt() { return <svg className="city-art" viewBox="0 0 520 350" fill="none"><defs><linearGradient id="city-sky" x1="100" y1="20" x2="500" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="#dae5d5" /><stop offset="1" stopColor="#b3c8b9" /></linearGradient><linearGradient id="city-building" x1="150" y1="70" x2="300" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#f6f1e5" /><stop offset="1" stopColor="#c5c6b5" /></linearGradient></defs><circle cx="300" cy="179" r="150" fill="url(#city-sky)" /><circle cx="426" cy="71" r="34" fill="#f6f0da" opacity=".8" /><path d="M22 290L118 221L155 241L217 188L277 214L335 180L391 227L458 216L520 257V350H22V290Z" fill="#9cb4a1" opacity=".45" /><path d="M98 300L109 286L128 300L158 294L191 311L246 281L312 304L379 288L456 310" stroke="#759882" strokeWidth="1" /><path d="M153 116L270 68L355 104V303L237 335L153 290V116Z" fill="url(#city-building)" /><path d="M270 68L355 104V303L270 283V68Z" fill="#78968a" /><path d="M153 116L270 68L276 79L160 127L153 116Z" fill="#fffaf1" /><path d="M270 68L355 104L350 116L276 79L270 68Z" fill="#b9c8bd" /><path d="M164 135L256 99V281L164 312V135Z" fill="#c7d4c8" />{[0, 1, 2, 3, 4, 5, 6].map(row => <g key={row}>{[0, 1, 2, 3].map(col => <path key={col} d={`M${170 + col * 22} ${139 + row * 23 - col * 8}l16 -6v15l-16 6v-15Z`} fill={row === 4 && col === 2 ? '#ecd599' : '#64857b'} opacity={col % 2 ? '.85' : '.65'} />)}<path d={`M283 ${102 + row * 25}l58 25v15l-58 -25v-15Z`} fill="#476d61" opacity=".7" /></g>)}<path d="M154 163L268 119M154 211L268 172M154 260L268 224M154 308L268 276" stroke="#eceadf" strokeWidth="5" /><path d="M272 123L351 157M272 175L351 209M272 228L351 262M272 278L351 307" stroke="#b8cabe" strokeWidth="5" /><path d="M230 296L250 289V330L230 336V296Z" fill="#607d6f" /><path d="M347 220L401 199L434 218V322L383 338L347 318V220Z" fill="#e1ddca" /><path d="M401 199L434 218V322L401 312V199Z" fill="#8ba494" />{[0, 1, 2, 3].map(row => <g key={row}><path d={`M357 ${232 + row * 21}l35 -14v12l-35 14v-12Z`} fill="#6c8a7c" /><path d={`M409 ${224 + row * 22}l17 9v12l-17 -9v-12Z`} fill="#5b7b6a" /></g>)}<path d="M119 250V311M87 277V329M465 279V331" stroke="#7b866a" strokeWidth="4" /><ellipse cx="119" cy="247" rx="22" ry="33" fill="#7f9d77" /><ellipse cx="87" cy="275" rx="16" ry="25" fill="#9bb184" /><ellipse cx="465" cy="270" rx="21" ry="35" fill="#668b72" /><path d="M65 341L156 311L236 350M305 342L360 326L447 350" stroke="#f4f0e4" strokeWidth="2" opacity=".8" /></svg>; }
