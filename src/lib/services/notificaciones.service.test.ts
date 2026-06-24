import { describe, expect, it } from 'vitest';
import type { Plataforma, Solicitud } from '@/types';
import { construirCorreoSolicitud, BUZON_ACCESOS } from './notificaciones.service';

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
