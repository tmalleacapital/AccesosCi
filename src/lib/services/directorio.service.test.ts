import { describe, expect, it } from 'vitest';
import { fusionarDirectorio, type FusionDirectorioInput } from './directorio.service';

function baseInput(overrides: Partial<FusionDirectorioInput> = {}): FusionDirectorioInput {
  return {
    hojasEstaticas: [
      {
        id: 'hoja-1',
        nombre: 'MBP Martín Guzmán',
        grupos: [
          {
            nombre: 'Avanti',
            asesores: [
              { nombre: 'Ana Torres', correo: 'ana@capitalinteligente.cl', jira: true, slack: true },
            ],
          },
        ],
      },
    ],
    hojasExtra: [],
    gruposExtra: [],
    gruposOcultos: [],
    miembrosExtra: [],
    edits: {},
    ...overrides,
  };
}

describe('fusionarDirectorio', () => {
  it('incluye a los asesores estáticos con su hoja/grupo', () => {
    const resultado = fusionarDirectorio(baseInput());
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      correo: 'ana@capitalinteligente.cl',
      hojaId: 'hoja-1',
      hojaNombre: 'MBP Martín Guzmán',
      grupoNombre: 'Avanti',
      esDinamico: false,
    });
  });

  it('agrega los miembros dinámicos (miembros_extra) del mismo hoja+grupo', () => {
    const resultado = fusionarDirectorio(
      baseInput({
        miembrosExtra: [
          {
            id: 'm1',
            hojaId: 'hoja-1',
            grupoNombre: 'Avanti',
            nombre: 'Beto Nuevo',
            correo: 'beto@capitalinteligente.cl',
            slack: false,
            jira: false,
            sf: false,
            estado: 'Activo',
          },
        ],
      }),
    );
    expect(resultado.map((r) => r.correo)).toEqual(
      expect.arrayContaining(['ana@capitalinteligente.cl', 'beto@capitalinteligente.cl']),
    );
    const beto = resultado.find((r) => r.correo === 'beto@capitalinteligente.cl');
    expect(beto?.esDinamico).toBe(true);
  });

  it('incluye grupos dinámicos (grupos_extra) de un hoja estática o de una hoja_extra', () => {
    const resultado = fusionarDirectorio(
      baseInput({
        hojasExtra: [{ id: 'hoja-2', nombre: 'MBP Nuevo' }],
        gruposExtra: [{ id: 'g1', hojaId: 'hoja-2', nombre: 'Vanema' }],
        miembrosExtra: [
          {
            id: 'm2',
            hojaId: 'hoja-2',
            grupoNombre: 'Vanema',
            nombre: 'Carla Dyn',
            correo: 'carla@capitalinteligente.cl',
            slack: true,
            jira: false,
            sf: false,
            estado: 'Activo',
          },
        ],
      }),
    );
    const carla = resultado.find((r) => r.correo === 'carla@capitalinteligente.cl');
    expect(carla).toMatchObject({ hojaId: 'hoja-2', hojaNombre: 'MBP Nuevo', grupoNombre: 'Vanema' });
  });

  it('excluye grupos estáticos ocultos', () => {
    const resultado = fusionarDirectorio(baseInput({ gruposOcultos: [{ hojaId: 'hoja-1', nombre: 'Avanti' }] }));
    expect(resultado).toHaveLength(0);
  });

  it('aplica overrides de edits por campo (estado, jira, slack, sf, nombre)', () => {
    const resultado = fusionarDirectorio(
      baseInput({
        edits: {
          'ana@capitalinteligente.cl||estado': 'Eliminado',
          'ana@capitalinteligente.cl||jira': 'false',
          'ana@capitalinteligente.cl||sf': 'true',
          'ana@capitalinteligente.cl||nombre': 'Ana Torres Editada',
        },
      }),
    );
    expect(resultado[0]).toMatchObject({
      nombre: 'Ana Torres Editada',
      estado: 'eliminado',
      sf: true,
    });
    expect(resultado[0].jira).toBe(false);
  });

  it('marca eliminado=true cuando el flag global eliminado está seteado (soft-delete)', () => {
    const resultado = fusionarDirectorio(
      baseInput({ edits: { 'ana@capitalinteligente.cl||eliminado': 'true' } }),
    );
    expect(resultado[0].eliminado).toBe(true);
  });

  it('marca transferido=true cuando el asesor estático fue movido de grupo', () => {
    const resultado = fusionarDirectorio(
      baseInput({ edits: { 'ana@capitalinteligente.cl||transferido': 'true' } }),
    );
    expect(resultado[0].transferido).toBe(true);
  });

  it('un miembro dinámico nunca se marca transferido (el traspaso se maneja moviendo el registro)', () => {
    const resultado = fusionarDirectorio(
      baseInput({
        miembrosExtra: [
          {
            id: 'm1',
            hojaId: 'hoja-1',
            grupoNombre: 'Avanti',
            nombre: 'Beto',
            correo: 'beto@capitalinteligente.cl',
            slack: false,
            jira: false,
            sf: false,
            estado: 'Activo',
          },
        ],
        edits: { 'beto@capitalinteligente.cl||transferido': 'true' },
      }),
    );
    const beto = resultado.find((r) => r.correo === 'beto@capitalinteligente.cl');
    expect(beto?.transferido).toBe(false);
  });
});
