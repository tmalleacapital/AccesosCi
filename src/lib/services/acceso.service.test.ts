import { describe, expect, it } from 'vitest';
import { calcularAmbitos, puedeVerAsesor, resolverAmbitoPorHoja } from './acceso.service';

const YO = 'djerez@capitalinteligente.cl';

describe('calcularAmbitos', () => {
  it('un bp aporta su propio BP completo (hoja + grupo, sin acotar a un TL)', () => {
    expect(calcularAmbitos({ email: YO, rol: 'bp', grupoBp: 'mbp-skala|Vanema' })).toEqual([
      { hojaId: 'mbp-skala', grupoNombre: 'Vanema' },
    ]);
  });

  it('un team_leader queda acotado a los asesores que le reportan', () => {
    expect(calcularAmbitos({ email: YO, rol: 'team_leader', grupoBp: 'mbp-cfm|Neumann' })).toEqual([
      { hojaId: 'mbp-cfm', grupoNombre: 'Neumann', soloDeTeamLeader: YO },
    ]);
  });

  it('un mbp aporta la hoja completa, sin grupo', () => {
    expect(calcularAmbitos({ email: YO, rol: 'mbp', grupoBp: 'mbp-forza' })).toEqual([
      { hojaId: 'mbp-forza' },
    ]);
  });

  it('admin/equipo/finanzas no aportan ámbitos por su rol principal', () => {
    expect(calcularAmbitos({ email: YO, rol: 'admin' })).toEqual([]);
    expect(calcularAmbitos({ email: YO, rol: 'finanzas' })).toEqual([]);
    expect(calcularAmbitos({ email: YO, rol: 'equipo' })).toEqual([]);
  });

  it('suma los cargos extra — caso cfigueroa: MBP de Forza y además BP dentro de Forza', () => {
    const ambitos = calcularAmbitos({
      email: 'cfigueroa@capitalinteligente.cl',
      rol: 'mbp',
      grupoBp: 'mbp-forza',
      asignaciones: [{ rol: 'bp', hojaId: 'mbp-forza', grupoNombre: 'BP Forza Capital' }],
    });
    expect(ambitos).toEqual([
      { hojaId: 'mbp-forza' },
      { hojaId: 'mbp-forza', grupoNombre: 'BP Forza Capital' },
    ]);
  });

  it('un cargo extra de team_leader también queda acotado a su gente', () => {
    const ambitos = calcularAmbitos({
      email: YO,
      rol: 'solicitante',
      asignaciones: [{ rol: 'team_leader', hojaId: 'h1', grupoNombre: 'BP A' }],
    });
    expect(ambitos).toEqual([{ hojaId: 'h1', grupoNombre: 'BP A', soloDeTeamLeader: YO }]);
  });

  it('alguien sin rol de estructura ni cargos extra no ve nada', () => {
    expect(calcularAmbitos({ email: YO, rol: 'solicitante' })).toEqual([]);
  });

  it('ignora un grupoBp mal formado (sin separador)', () => {
    expect(calcularAmbitos({ email: YO, rol: 'bp', grupoBp: 'sin-separador' })).toEqual([]);
  });
});

describe('resolverAmbitoPorHoja', () => {
  it('null en la hoja significa el MBP completo', () => {
    expect(resolverAmbitoPorHoja([{ hojaId: 'h1' }]).get('h1')).toBeNull();
  });

  it('agrupa varios BP de la misma hoja; null en el grupo = BP completo', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A' },
      { hojaId: 'h1', grupoNombre: 'B' },
    ]);
    expect(map.get('h1')).toEqual(
      new Map([
        ['A', null],
        ['B', null],
      ]),
    );
  });

  it('un team_leader deja el grupo acotado a su correo', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A', soloDeTeamLeader: YO },
    ]);
    expect(map.get('h1')).toEqual(new Map([['A', YO]]));
  });

  it('ser líder del BP gana sobre ser TL del mismo BP (ve todo, no solo los suyos)', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A', soloDeTeamLeader: YO },
      { hojaId: 'h1', grupoNombre: 'A' },
    ]);
    expect(map.get('h1')).toEqual(new Map([['A', null]]));
  });

  it('el orden no altera esa precedencia', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A' },
      { hojaId: 'h1', grupoNombre: 'A', soloDeTeamLeader: YO },
    ]);
    expect(map.get('h1')).toEqual(new Map([['A', null]]));
  });

  it('tener el MBP completo gana sobre cualquier restricción de esa hoja', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A', soloDeTeamLeader: YO },
      { hojaId: 'h1' },
    ]);
    expect(map.get('h1')).toBeNull();
  });

  it('mantiene las hojas separadas', () => {
    const map = resolverAmbitoPorHoja([
      { hojaId: 'h1', grupoNombre: 'A' },
      { hojaId: 'h2' },
    ]);
    expect(map.get('h1')).toEqual(new Map([['A', null]]));
    expect(map.get('h2')).toBeNull();
    expect(map.has('h3')).toBe(false);
  });
});

describe('puedeVerAsesor', () => {
  it('sin restricción de TL ve a cualquiera del BP', () => {
    expect(puedeVerAsesor(null, 'otro@x.cl', 'quien-sea@x.cl')).toBe(true);
    expect(puedeVerAsesor(null, 'otro@x.cl', undefined)).toBe(true);
  });

  it('un TL ve a quien le reporta', () => {
    expect(puedeVerAsesor(YO, 'priquelme@x.cl', YO)).toBe(true);
  });

  it('un TL NO ve a quien reporta a otro TL', () => {
    expect(puedeVerAsesor(YO, 'ajeno@x.cl', 'otrotl@x.cl')).toBe(false);
  });

  it('un TL NO ve a los asesores directos del líder BP (sin TL asignado)', () => {
    expect(puedeVerAsesor(YO, 'directo@x.cl', undefined)).toBe(false);
    expect(puedeVerAsesor(YO, 'directo@x.cl', '')).toBe(false);
  });

  it('un TL se ve a sí mismo aunque no se reporte a nadie', () => {
    expect(puedeVerAsesor(YO, YO, undefined)).toBe(true);
  });

  it('compara correos sin distinguir mayúsculas', () => {
    expect(puedeVerAsesor(YO, 'DJEREZ@capitalinteligente.CL', undefined)).toBe(true);
    expect(puedeVerAsesor(YO, 'otro@x.cl', 'DJerez@CapitalInteligente.cl')).toBe(true);
  });
});
