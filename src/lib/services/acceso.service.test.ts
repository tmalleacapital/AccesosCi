import { describe, expect, it } from 'vitest';
import { calcularAmbitos, resolverAmbitoPorHoja } from './acceso.service';

describe('calcularAmbitos', () => {
  it('un bp aporta su propio BP (hoja + grupo)', () => {
    expect(calcularAmbitos({ rol: 'bp', grupoBp: 'mbp-skala|Vanema' })).toEqual([
      { hojaId: 'mbp-skala', grupoNombre: 'Vanema' },
    ]);
  });

  it('un team_leader se comporta igual que un bp', () => {
    expect(calcularAmbitos({ rol: 'team_leader', grupoBp: 'mbp-cfm|Neumann' })).toEqual([
      { hojaId: 'mbp-cfm', grupoNombre: 'Neumann' },
    ]);
  });

  it('un mbp aporta la hoja completa, sin grupo', () => {
    expect(calcularAmbitos({ rol: 'mbp', grupoBp: 'mbp-forza' })).toEqual([
      { hojaId: 'mbp-forza' },
    ]);
  });

  it('admin/equipo/finanzas no aportan ámbitos por su rol principal', () => {
    expect(calcularAmbitos({ rol: 'admin' })).toEqual([]);
    expect(calcularAmbitos({ rol: 'finanzas' })).toEqual([]);
    expect(calcularAmbitos({ rol: 'equipo' })).toEqual([]);
  });

  it('suma los cargos extra al rol principal — caso cfigueroa: MBP de Forza y además BP dentro de Forza', () => {
    const ambitos = calcularAmbitos({
      rol: 'mbp',
      grupoBp: 'mbp-forza',
      asignaciones: [{ rol: 'bp', hojaId: 'mbp-forza', grupoNombre: 'BP Forza Capital' }],
    });
    expect(ambitos).toEqual([
      { hojaId: 'mbp-forza' },
      { hojaId: 'mbp-forza', grupoNombre: 'BP Forza Capital' },
    ]);
  });

  it('una asignación de tipo mbp ignora el grupoNombre (cubre la hoja entera)', () => {
    const ambitos = calcularAmbitos({
      rol: 'solicitante',
      asignaciones: [{ rol: 'mbp', hojaId: 'mbp-skala', grupoNombre: 'no-deberia-usarse' }],
    });
    expect(ambitos).toEqual([{ hojaId: 'mbp-skala' }]);
  });

  it('alguien sin rol de estructura ni cargos extra no ve nada', () => {
    expect(calcularAmbitos({ rol: 'solicitante' })).toEqual([]);
  });

  it('ignora un grupoBp mal formado (sin separador) en roles de BP', () => {
    expect(calcularAmbitos({ rol: 'bp', grupoBp: 'sin-separador' })).toEqual([]);
  });
});

describe('resolverAmbitoPorHoja', () => {
  it('agrupa varios BP de la misma hoja en un set', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A' },
      { hojaId: 'h1', grupoNombre: 'B' },
    ]);
    expect(map.get('h1')).toEqual(new Set(['A', 'B']));
  });

  it('null significa la hoja completa', () => {
    const map = resolverAmbitoPorHoja([{ hojaId: 'h1' }]);
    expect(map.get('h1')).toBeNull();
  });

  it('tener el MBP completo gana sobre un BP puntual de la misma hoja', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A' },
      { hojaId: 'h1' },
    ]);
    expect(map.get('h1')).toBeNull();
  });

  it('el orden no altera el resultado: el MBP completo gana igual si viene primero', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1' },
      { hojaId: 'h1', grupoNombre: 'A' },
    ]);
    expect(map.get('h1')).toBeNull();
  });

  it('mantiene las hojas separadas', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A' },
      { hojaId: 'h2' },
    ]);
    expect(map.get('h1')).toEqual(new Set(['A']));
    expect(map.get('h2')).toBeNull();
    expect(map.has('h3')).toBe(false);
  });
});
