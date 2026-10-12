import { describe, expect, it } from 'vitest';
import {
  chileToday, csvHeaders, deliveryState, importProjects, parseCsv, safeUrl,
  type Project,
} from './projects';

const today = '2026-10-12';
const project: Project = {
  project_id: 'p1', project_name: 'Proyecto de prueba', unit_id: '101',
  commune: 'Santiago', address: 'Dirección de prueba', latitude: -33.45,
  longitude: -70.65, offer_price_uf: 2500, useful_area_m2: 35, bedrooms: 1,
  bathrooms: 1, delivery_date: '2027-10-12', delivery_date_status: 'verified',
  immediate_delivery_verified: false, available_stock_verified: true,
  publication_url: 'https://example.org/unidad/101', data_observed_at: today,
  evidence_notes: 'Información ingresada para la prueba', demo: false,
  geolocation_precision: 'approximate',
};

function csv(...projects: Partial<Project>[]): string {
  const headers = csvHeaders.split(',');
  const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `${csvHeaders}\n${projects.map(item => {
    const row = { ...project, ...item } as unknown as Record<string, unknown>;
    return headers.map(header => cell(row[header])).join(',');
  }).join('\n')}`;
}

describe('clasificación por fecha y evidencia', () => {
  it('usa la fecha local chilena incluso cerca del cambio de día UTC', () => {
    expect(chileToday(new Date('2026-06-02T02:00:00Z'))).toBe('2026-06-01');
  });

  it('clasifica 365 días como amarilla y 366 como verde', () => {
    expect(deliveryState(project, today)).toBe('yellow');
    expect(deliveryState({ ...project, delivery_date: '2027-10-13' }, today)).toBe('green');
  });

  it('una fecha pasada no prueba una entrega inmediata', () => {
    expect(deliveryState({ ...project, delivery_date: '2026-10-11' }, today)).toBe('gray');
    expect(deliveryState({ ...project, delivery_date: today }, today)).toBe('gray');
  });

  it('exige stock, enlace y fecha de observación para mostrar entrega verificada', () => {
    const immediate = { ...project, immediate_delivery_verified: true };
    expect(deliveryState(immediate, today)).toBe('red');
    expect(deliveryState({ ...immediate, available_stock_verified: false }, today)).toBe('gray');
    expect(deliveryState({ ...immediate, publication_url: '' }, today)).toBe('gray');
    expect(deliveryState({ ...immediate, data_observed_at: '' }, today)).toBe('gray');
  });

  it('mantiene fechas desconocidas o estimadas en gris', () => {
    expect(deliveryState({ ...project, delivery_date_status: 'unknown' }, today)).toBe('gray');
    expect(deliveryState({ ...project, delivery_date_status: 'estimated' }, today)).toBe('gray');
    expect(deliveryState({ ...project, delivery_date: '' }, today)).toBe('gray');
  });
});

describe('importación CSV sin cambios parciales', () => {
  it('conserva comas, saltos de línea y comillas dentro de celdas', () => {
    const text = csv({ project_name: 'Edificio, "Parque"', evidence_notes: 'Primera línea\nSegunda, línea' });
    const result = importProjects(text);
    expect(result.errors).toEqual([]);
    expect(result.projects[0].project_name).toBe('Edificio, "Parque"');
    expect(result.projects[0].evidence_notes).toBe('Primera línea\nSegunda, línea');
  });

  it('acepta punto y coma y BOM en el encabezado', () => {
    expect(parseCsv('\uFEFFproject_id;unit_id\r\np1;"101; A"\r\n')).toEqual([
      ['project_id', 'unit_id'], ['p1', '101; A'],
    ]);
  });

  it('rechaza archivos sin encabezados obligatorios', () => {
    const result = importProjects('project_id,unit_id\np1,101');
    expect(result.projects).toEqual([]);
    expect(result.errors[0]).toContain('Faltan columnas');
    expect(result.errors[0]).toContain('offer_price_uf');
  });

  it('rechaza encabezados duplicados y comillas sin cerrar', () => {
    expect(importProjects(`${csvHeaders},unit_id\n${'x,'.repeat(19)}101`).errors[0]).toContain('duplicadas');
    expect(importProjects(`${csvHeaders}\n"p1`).errors[0]).toContain('comillas sin cerrar');
  });

  it('rechaza unidades repetidas y devuelve cero proyectos', () => {
    const result = importProjects(csv({}, {}));
    expect(result.projects).toEqual([]);
    expect(result.errors.join(' ')).toContain('unidad duplicada');
  });

  it('no aplica las filas válidas cuando otra fila tiene datos inválidos', () => {
    const result = importProjects(csv({}, { unit_id: '102', latitude: -90, longitude: 180 }));
    expect(result.projects).toEqual([]);
    expect(result.errors.join(' ')).toContain('coordenadas fuera');
  });

  it('rechaza fechas imposibles sin normalizarlas al mes siguiente', () => {
    const result = importProjects(csv({ delivery_date: '2027-02-31', data_observed_at: '2026-02-30' }));
    expect(result.projects).toEqual([]);
    expect(result.errors.join(' ')).toContain('delivery_date');
    expect(result.errors.join(' ')).toContain('data_observed_at');
  });

  it('rechaza números no finitos y precios no positivos', () => {
    for (const offer_price_uf of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(importProjects(csv({ offer_price_uf })).projects).toEqual([]);
    }
  });

  it('rechaza enlaces ejecutables y enlaces sin HTTPS', () => {
    for (const publication_url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.org']) {
      const result = importProjects(csv({ publication_url }));
      expect(result.projects).toEqual([]);
      expect(result.errors.join(' ')).toContain('HTTPS');
    }
    expect(safeUrl('https://example.org/listado')).toBe('https://example.org/listado');
  });

  it('rechaza columnas faltantes en una fila y booleanos ambiguos', () => {
    expect(importProjects(`${csvHeaders}\np1,Proyecto,101`).errors.join(' ')).toContain('número de columnas');
    const invalidBoolean = csv({}).replace('"false","true"', '"no","true"');
    expect(importProjects(invalidBoolean).errors.join(' ')).toContain('true/false');
  });
});
