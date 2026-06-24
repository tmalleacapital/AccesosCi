import { describe, expect, it } from 'vitest';
import type { Plataforma, Solicitud } from '@/types';
import {
  construirCorreoSolicitud,
  construirCorreoEnProceso,
  construirCorreoCompletada,
  BUZON_ACCESOS,
} from './notificaciones.service';

const plataformas: Plataforma[] = [
  { id: 'gmail', nombre: 'Gmail @capitalinteligente.cl', facturable: true, activa: true },
  { id: 'slack', nombre: 'Slack', facturable: true, activa: true },
];

const solicitud: Solicitud = {
  id: 'sol_1',
  tipo: 'crear',
  solicitanteEmail: 'ana@capitalinteligente.cl',
  fechaCreacion: '2026-06-18T12:00:00.000Z',
  estado: 'pendiente',
  datos: {
    nombre: 'Juan',
    segundoNombre: 'Carlos',
    apellidoPaterno: 'Pérez',
    apellidoMaterno: 'López',
    celular: '+56912345678',
    correoPersonal: 'juan@gmail.com',
  },
  accesos: [
    { plataformaId: 'gmail', fechaSolicitud: '2026-06-18T12:00:00.000Z', estado: 'pendiente' },
    { plataformaId: 'slack', fechaSolicitud: '2026-06-18T12:00:00.000Z', estado: 'pendiente' },
  ],
};

describe('construirCorreoSolicitud', () => {
  it('dirige el correo al buzón de accesos', () => {
    const correo = construirCorreoSolicitud(solicitud, plataformas);
    expect(correo.to).toBe(BUZON_ACCESOS);
  });

  it('incluye el tipo y el solicitante en el asunto', () => {
    const correo = construirCorreoSolicitud(solicitud, plataformas);
    expect(correo.subject).toContain('Crear acceso');
    expect(correo.subject).toContain('ana@capitalinteligente.cl');
  });

  it('lista los nombres de las plataformas pedidas', () => {
    const correo = construirCorreoSolicitud(solicitud, plataformas);
    expect(correo.body).toContain('Gmail @capitalinteligente.cl');
    expect(correo.body).toContain('Slack');
  });

  it('incluye los datos de creación', () => {
    const correo = construirCorreoSolicitud(solicitud, plataformas);
    expect(correo.body).toContain('Juan');
    expect(correo.body).toContain('Pérez');
    expect(correo.body).toContain('+56912345678');
  });
});

describe('construirCorreoEnProceso', () => {
  it('dirige el correo al solicitante', () => {
    const correo = construirCorreoEnProceso(solicitud);
    expect(correo.to).toBe('ana@capitalinteligente.cl');
  });

  it('incluye el id del ticket en el asunto', () => {
    const correo = construirCorreoEnProceso(solicitud);
    expect(correo.subject).toContain('sol_1');
  });

  it('menciona que está en proceso en el cuerpo', () => {
    const correo = construirCorreoEnProceso(solicitud);
    expect(correo.body).toContain('en proceso');
  });
});

describe('construirCorreoCompletada', () => {
  const solicitudCompletada: Solicitud = {
    ...solicitud,
    estado: 'completada',
    correoCorporativoAsignado: 'jperez@capitalinteligente.cl',
  };

  it('dirige el correo al solicitante', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas);
    expect(correo.to).toBe('ana@capitalinteligente.cl');
  });

  it('incluye el id del ticket en el asunto', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas);
    expect(correo.subject).toContain('sol_1');
  });

  it('incluye el correo corporativo asignado en el cuerpo', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas);
    expect(correo.body).toContain('jperez@capitalinteligente.cl');
  });

  it('incluye los datos personales en el cuerpo', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas);
    expect(correo.body).toContain('Juan');
    expect(correo.body).toContain('Pérez');
    expect(correo.body).toContain('+56912345678');
  });

  it('incluye las plataformas solicitadas', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas);
    expect(correo.body).toContain('Gmail @capitalinteligente.cl');
    expect(correo.body).toContain('Slack');
  });

  it('incluye la contraseña cuando se proporciona', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas, 'MiClave123!');
    expect(correo.body).toContain('MiClave123!');
  });

  it('no muestra bloque de contraseña cuando no se proporciona', () => {
    const correo = construirCorreoCompletada(solicitudCompletada, plataformas);
    expect(correo.body).not.toContain('Contraseña');
  });
});
