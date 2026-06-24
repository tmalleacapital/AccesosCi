import { describe, expect, it } from 'vitest';
import {
  crearSolicitud,
  validarEntradaSolicitud,
  cambiarEstadoSolicitud,
  agruparPorTipo,
  construirDirectorio,
  type NuevaSolicitudInput,
} from './solicitudes.service';
import type { Solicitud } from '@/types';

const deps = {
  now: () => new Date('2026-06-18T12:00:00.000Z'),
  generarId: () => 'sol_test_1',
};

const inputCrear: NuevaSolicitudInput = {
  tipo: 'crear',
  solicitanteEmail: 'ana@capitalinteligente.cl',
  datos: {
    nombre: 'Juan',
    segundoNombre: 'Carlos',
    apellidoPaterno: 'Pérez',
    apellidoMaterno: 'López',
    celular: '+56912345678',
    correoPersonal: 'juan@gmail.com',
  },
  plataformaIds: ['gmail', 'slack'],
};

describe('validarEntradaSolicitud', () => {
  it('acepta una solicitud de creación válida', () => {
    expect(validarEntradaSolicitud(inputCrear)).toEqual([]);
  });

  it('exige al menos una plataforma', () => {
    const errores = validarEntradaSolicitud({ ...inputCrear, plataformaIds: [] });
    expect(errores).toContain('Debe seleccionar al menos una plataforma.');
  });

  it('exige los campos obligatorios al crear', () => {
    const errores = validarEntradaSolicitud({
      ...inputCrear,
      datos: {
        nombre: '',
        segundoNombre: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        celular: '',
        correoPersonal: '',
      },
    });
    expect(errores.length).toBeGreaterThan(0);
  });

  it('exige correo corporativo del solicitante', () => {
    const errores = validarEntradaSolicitud({
      ...inputCrear,
      solicitanteEmail: 'ana@gmail.com',
    });
    expect(errores).toContain('El solicitante debe usar un correo @capitalinteligente.cl.');
  });

  it('en baja exige el correo corporativo a eliminar', () => {
    const errores = validarEntradaSolicitud({
      tipo: 'baja',
      solicitanteEmail: 'ana@capitalinteligente.cl',
      datos: { correoCorporativo: '' },
      plataformaIds: ['gmail'],
    });
    expect(errores).toContain('Debe indicar el correo @capitalinteligente.cl a dar de baja.');
  });
});

describe('crearSolicitud', () => {
  it('construye la solicitud con estado pendiente y fechas por acceso', () => {
    const sol = crearSolicitud(inputCrear, deps);
    expect(sol.id).toBe('sol_test_1');
    expect(sol.estado).toBe('pendiente');
    expect(sol.fechaCreacion).toBe('2026-06-18T12:00:00.000Z');
    expect(sol.accesos).toHaveLength(2);
    expect(sol.accesos[0]).toEqual({
      plataformaId: 'gmail',
      fechaSolicitud: '2026-06-18T12:00:00.000Z',
      estado: 'pendiente',
    });
  });

  it('lanza si la entrada es inválida', () => {
    expect(() => crearSolicitud({ ...inputCrear, plataformaIds: [] }, deps)).toThrow();
  });
});

describe('cambiarEstadoSolicitud', () => {
  it('propaga el estado a la solicitud y sus accesos', () => {
    const sol = crearSolicitud(inputCrear, deps);
    const actualizada = cambiarEstadoSolicitud(sol, 'completada');
    expect(actualizada.estado).toBe('completada');
    expect(actualizada.accesos.every((a) => a.estado === 'completada')).toBe(true);
  });

  it('no muta la solicitud original', () => {
    const sol = crearSolicitud(inputCrear, deps);
    cambiarEstadoSolicitud(sol, 'completada');
    expect(sol.estado).toBe('pendiente');
  });
});

describe('agruparPorTipo', () => {
  it('separa las solicitudes en grupos por tipo, manteniendo el orden crear/modificar/baja', () => {
    const crear = crearSolicitud(inputCrear, deps);
    const baja = crearSolicitud(
      {
        tipo: 'baja',
        solicitanteEmail: 'ana@capitalinteligente.cl',
        datos: { correoCorporativo: 'saliente@capitalinteligente.cl' },
        plataformaIds: ['gmail'],
      },
      deps,
    );

    const grupos = agruparPorTipo([crear, baja]);

    expect(grupos.map((g) => g.tipo)).toEqual(['crear', 'modificar', 'baja']);
    expect(grupos.find((g) => g.tipo === 'crear')?.solicitudes).toEqual([crear]);
    expect(grupos.find((g) => g.tipo === 'modificar')?.solicitudes).toEqual([]);
    expect(grupos.find((g) => g.tipo === 'baja')?.solicitudes).toEqual([baja]);
  });

  it('devuelve listas vacías si no hay solicitudes', () => {
    const grupos = agruparPorTipo([] as Solicitud[]);
    expect(grupos.every((g) => g.solicitudes.length === 0)).toBe(true);
  });
});

describe('construirDirectorio', () => {
  function solicitudCrearCompletada(
    correoCorporativoAsignado: string,
    plataformaIds: string[],
    fecha: string,
  ): Solicitud {
    const sol = crearSolicitud(
      { ...inputCrear, plataformaIds },
      { now: () => new Date(fecha), generarId: () => `sol_${correoCorporativoAsignado}_${fecha}` },
    );
    return {
      ...cambiarEstadoSolicitud(sol, 'completada'),
      correoCorporativoAsignado,
    };
  }

  function solicitudBajaCompletada(
    correoCorporativo: string,
    plataformaIds: string[],
    fecha: string,
  ): Solicitud {
    const sol = crearSolicitud(
      {
        tipo: 'baja',
        solicitanteEmail: 'ana@capitalinteligente.cl',
        datos: { correoCorporativo },
        plataformaIds,
      },
      { now: () => new Date(fecha), generarId: () => `sol_baja_${correoCorporativo}_${fecha}` },
    );
    return cambiarEstadoSolicitud(sol, 'completada');
  }

  it('ignora solicitudes de creación que no estén completadas o sin correo asignado', () => {
    const pendiente = crearSolicitud(inputCrear, deps);
    const directorio = construirDirectorio([pendiente]);
    expect(directorio).toEqual([]);
  });

  it('agrega una persona activa con sus accesos al completar una creación', () => {
    const sol = solicitudCrearCompletada(
      'juan.perez@capitalinteligente.cl',
      ['gmail', 'slack'],
      '2026-01-10T10:00:00.000Z',
    );

    const directorio = construirDirectorio([sol]);

    expect(directorio).toHaveLength(1);
    expect(directorio[0]).toEqual({
      correoCorporativo: 'juan.perez@capitalinteligente.cl',
      estado: 'activo',
      accesos: [
        { plataformaId: 'gmail', fechaSolicitud: '2026-01-10T10:00:00.000Z', estado: 'activo' },
        { plataformaId: 'slack', fechaSolicitud: '2026-01-10T10:00:00.000Z', estado: 'activo' },
      ],
    });
  });

  it('marca a la persona como eliminada tras una baja completada', () => {
    const crear = solicitudCrearCompletada(
      'juan.perez@capitalinteligente.cl',
      ['gmail'],
      '2026-01-10T10:00:00.000Z',
    );
    const baja = solicitudBajaCompletada(
      'juan.perez@capitalinteligente.cl',
      ['gmail'],
      '2026-03-01T10:00:00.000Z',
    );

    const directorio = construirDirectorio([crear, baja]);

    expect(directorio).toHaveLength(1);
    expect(directorio[0].estado).toBe('eliminado');
    expect(directorio[0].accesos).toEqual([
      { plataformaId: 'gmail', fechaSolicitud: '2026-03-01T10:00:00.000Z', estado: 'eliminado' },
    ]);
  });

  it('permite agregar una plataforma nueva a alguien ya activo, sin afectar su estado general', () => {
    const crear = solicitudCrearCompletada(
      'juan.perez@capitalinteligente.cl',
      ['gmail'],
      '2026-01-10T10:00:00.000Z',
    );
    const crearOtraPlataforma = solicitudCrearCompletada(
      'juan.perez@capitalinteligente.cl',
      ['slack'],
      '2026-02-01T10:00:00.000Z',
    );

    const directorio = construirDirectorio([crear, crearOtraPlataforma]);

    expect(directorio).toHaveLength(1);
    expect(directorio[0].estado).toBe('activo');
    expect(directorio[0].accesos.map((a) => a.plataformaId).sort()).toEqual(['gmail', 'slack']);
  });

  it('ordena el directorio alfabéticamente por correo corporativo', () => {
    const b = solicitudCrearCompletada(
      'b@capitalinteligente.cl',
      ['gmail'],
      '2026-01-01T00:00:00.000Z',
    );
    const a = solicitudCrearCompletada(
      'a@capitalinteligente.cl',
      ['gmail'],
      '2026-01-02T00:00:00.000Z',
    );

    const directorio = construirDirectorio([b, a]);

    expect(directorio.map((p) => p.correoCorporativo)).toEqual([
      'a@capitalinteligente.cl',
      'b@capitalinteligente.cl',
    ]);
  });
});
