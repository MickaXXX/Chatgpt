import { test, expect } from '@playwright/test';
import { calculate, defaultAssumptions } from '../src/lib/finance';

const profile = { salary: 2000000, extraIncome: 200000, extraMonths: 6, savings: 4000000, monthlySavings: 300000, emergencyReserve: 1000000, recognizeExtraIncome: false };
const financial = { profile, assumptions: defaultAssumptions };
const backup = { schemaVersion: 1, data: { 'atlas-personal-v1': financial } };
const currency = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
const csv = 'project_id,project_name,unit_id,commune,latitude,longitude,offer_price_uf,delivery_date,delivery_date_status,available_stock_verified,publication_url,data_observed_at\np1,"Proyecto de prueba, no comercial",301,Ñuñoa,-33.455,-70.604,2200,2030-05-01,verified,true,https://example.org,2026-10-12';

test('perfil público vacío y sin proyectos reales inventados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Tu inversión empieza/ })).toBeVisible();
  await expect(page.locator('.overview-grid')).toContainText('$0');
  await page.getByRole('button', { name: 'Explorar proyectos', exact: true }).first().click();
  await expect(page.getByText('0 unidades importadas', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tus proyectos, en un solo mapa' })).toBeVisible();
  await expect(page.getByLabel('Explorar ejemplos DEMO')).not.toBeChecked();
});

test('importar perfil valida, restaura y persiste; honorarios estacionales separados', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Fuentes y respaldo', exact: true }).click();
  await page.getByLabel('Archivo de respaldo JSON').setInputFiles({ name: 'perfil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText('Respaldo validado.', { exact: false })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restaurar y recargar' }).click();
  await expect(page.locator('.overview-grid')).toContainText(currency(profile.savings));
  await expect(page.locator('.overview-grid')).toContainText('Honorarios: $1.200.000 al año');
  await page.reload();
  await expect(page.locator('.overview-grid')).toContainText(currency(profile.salary));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-personal-v1')!));
  expect(saved.profile).toEqual(profile);
});

test('simulador cambia costos y muestra flujo calculado, exporta 360 cuotas', async ({ page }) => {
  await page.addInitScript(state => localStorage.setItem('atlas-personal-v1', JSON.stringify(state)), financial);
  await page.goto('/');
  await page.getByRole('button', { name: 'Simulador', exact: true }).click();
  const result = calculate(profile, defaultAssumptions);
  await expect(page.locator('.cashflow-hero')).toContainText(currency(result.traditional.flow));
  await page.getByLabel('Arriendo mensual esperado').fill('650000');
  const changed = calculate(profile, { ...defaultAssumptions, rent: 650000 });
  await expect(page.locator('.cashflow-hero')).toContainText(currency(changed.traditional.flow));
  await page.getByRole('button', { name: 'Renta corta', exact: true }).click();
  await expect(page.locator('.cashflow-hero')).toContainText(currency(changed.short.flow));
  await expect(page.getByText('Provisión tributaria', { exact: false }).first()).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Amortización CSV' }).click();
  const file = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of file!) chunks.push(Buffer.from(chunk));
  const lines = Buffer.concat(chunks).toString().trim().split(/\r?\n/);
  expect(lines).toHaveLength(361);
  expect(lines.at(-1)).toContain('360;');
  expect(lines.at(-1)).toContain('0,0000');
});

test('importar unidad, favorito y comparar; selección abre ficha y simulador', async ({ page }) => {
  await page.addInitScript(state => localStorage.setItem('atlas-personal-v1', JSON.stringify(state)), financial);
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar proyectos', exact: true }).first().click();
  await page.locator('input[type=file]').setInputFiles({ name: 'proyectos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.project-list')).toContainText('Proyecto de prueba, no comercial');
  await page.getByRole('button', { name: /^Guardar favorito/ }).click();
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await expect(page.locator('.compare-section')).toContainText('2.200');
  await page.getByRole('button', { name: 'Ver ficha', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Ficha de unidad' })).toContainText('Renta corta: reglamento y tributación por verificar');
  await page.getByRole('button', { name: 'Simular esta unidad' }).click();
  await expect(page.getByLabel('Precio del departamento')).toHaveValue('2200');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-favorites-v1')!))).toEqual(['p1:301']);
});

test('CSV inválido no guarda filas ni reemplaza un catálogo existente', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar proyectos', exact: true }).first().click();
  await page.locator('input[type=file]').setInputFiles({ name: 'error.csv', mimeType: 'text/csv', buffer: Buffer.from(csv.replace('2200', '-200')) });
  await expect(page.getByRole('alert')).toContainText('precio UF fuera de rango');
  expect(await page.evaluate(() => localStorage.getItem('atlas-projects-v1'))).toBeNull();
});

test('DEMO requiere activación y no se guarda como oferta real', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar proyectos', exact: true }).first().click();
  await page.getByLabel('Explorar ejemplos DEMO').check();
  await expect(page.locator('.project-list .project-card')).toHaveCount(4);
  await expect(page.locator('.demo-control')).toContainText('DATOS SIMULADOS');
  expect(await page.evaluate(() => localStorage.getItem('atlas-projects-v1'))).toBeNull();
  await page.getByLabel('Explorar ejemplos DEMO').uncheck();
  await expect(page.locator('.project-list .project-card')).toHaveCount(0);
});

test('respaldo malformado se rechaza sin cambiar el perfil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Fuentes y respaldo', exact: true }).click();
  const invalid = structuredClone(backup); invalid.data['atlas-personal-v1'].assumptions.vacancyPct = 150;
  await page.getByLabel('Archivo de respaldo JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('alert')).toContainText('Respaldo rechazado');
  await expect(page.getByRole('button', { name: 'Restaurar y recargar' })).toHaveCount(0);
});

test('pantallas navegables en móvil sin desbordamiento de página', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Simulador', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Los números detrás/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
