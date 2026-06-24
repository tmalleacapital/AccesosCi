import type { DatosBaja, DatosCreacion, DatosModificacion, Plataforma, Solicitud } from '@/types';

export const BUZON_ACCESOS = 'accesos@capitalinteligente.cl';
const DOMINIO = 'capitalinteligente.cl';

export interface CorreoSimulado {
  to: string;
  subject: string;
  body: string;
}

function nombrePlataforma(id: string, plataformas: Plataforma[]): string {
  return plataformas.find((p) => p.id === id)?.nombre ?? id;
}

function normalizar(texto: string | undefined): string {
  if (!texto) return '';
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

export function generarCorreoSugerido(
  nombre: string | undefined,
  apellidoPaterno: string | undefined,
): string {
  const inicial = normalizar(nombre).charAt(0);
  const apellido = normalizar(apellidoPaterno);
  if (!inicial || !apellido) return '';
  return `${inicial}${apellido}@${DOMINIO}`;
}

const ETIQUETA_TIPO: Record<string, string> = {
  crear: 'Crear acceso',
  modificar: 'Modificar acceso',
  baja: 'Baja de acceso',
};

function filas(pares: [string, string | undefined][]): string {
  return pares
    .filter(([, v]) => v)
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:6px 12px;font-weight:600;color:#555;white-space:nowrap;width:1%">${k}</td>
          <td style="padding:6px 12px;color:#111">${v}</td>
        </tr>`,
    )
    .join('');
}

function bloqueDatosHtml(solicitud: Solicitud): string {
  if (solicitud.tipo === 'crear') {
    const d = solicitud.datos as DatosCreacion;
    const correoSugerido = generarCorreoSugerido(d.nombre, d.apellidoPaterno);
    return filas([
      ['Nombre', d.nombre],
      ['Segundo nombre', d.segundoNombre],
      ['Apellido paterno', d.apellidoPaterno],
      ['Apellido materno', d.apellidoMaterno],
      ['Celular', d.celular],
      ['Correo personal', d.correoPersonal],
      ['✉ Correo sugerido', `<strong style="color:#1a73e8">${correoSugerido}</strong>`],
    ]);
  }
  if (solicitud.tipo === 'modificar') {
    const d = solicitud.datos as DatosModificacion;
    return filas([
      ['Correo corporativo', d.correoCorporativo],
      ['Detalle del cambio', d.detalle],
    ]);
  }
  const d = solicitud.datos as DatosBaja;
  return filas([
    ['Correo corporativo', d.correoCorporativo],
    ['Redistribución Salesforce', d.redistribucionSalesforce],
  ]);
}

export function construirCorreoEnProceso(solicitud: Solicitud): CorreoSimulado {
  const etiqueta = ETIQUETA_TIPO[solicitud.tipo] ?? solicitud.tipo;
  return {
    to: solicitud.solicitanteEmail,
    subject: `[En proceso] Ticket ${solicitud.id} — ${etiqueta}`,
    body: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">Tu solicitud está siendo procesada</h2>
        <p style="color:#888;margin-top:0">Ticket <strong>${solicitud.id}</strong> · Tipo: ${etiqueta}</p>
        <p>Tu solicitud está <strong>en proceso</strong>. El equipo de accesos está trabajando en ella y te avisaremos cuando esté lista.</p>
        <p style="margin-top:24px;font-size:0.8rem;color:#aaa">Este mensaje fue generado automáticamente por Solicitudes de Accesos · Capital Inteligente.</p>
      </div>
    `,
  };
}

export function construirCorreoCompletada(
  solicitud: Solicitud,
  plataformas: Plataforma[],
  passwordCorreo?: string,
): CorreoSimulado {
  const etiqueta = ETIQUETA_TIPO[solicitud.tipo] ?? solicitud.tipo;
  const fecha = new Date(solicitud.fechaCreacion).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const filasPlataformas = solicitud.accesos
    .map(
      (a) =>
        `<tr><td style="padding:6px 12px;color:#111">· ${nombrePlataforma(a.plataformaId, plataformas)}</td></tr>`,
    )
    .join('');

  const bloqueCorreoAsignado = solicitud.correoCorporativoAsignado
    ? `
      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f0fdf4;border-radius:8px;overflow:hidden;border:1px solid #bbf7d0">
        <thead>
          <tr><th colspan="2" style="padding:10px 12px;text-align:left;background:#dcfce7;font-size:0.85rem;color:#166534">✅ CREDENCIALES DE ACCESO</th></tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;font-weight:600;color:#166534;white-space:nowrap;width:1%">Correo</td>
            <td style="padding:8px 12px;font-size:1.05rem;font-weight:700;color:#15803d;font-family:monospace">${solicitud.correoCorporativoAsignado}</td>
          </tr>
          ${
            passwordCorreo
              ? `<tr>
            <td style="padding:8px 12px;font-weight:600;color:#166534;white-space:nowrap">Contraseña</td>
            <td style="padding:8px 12px;font-size:1.05rem;font-weight:700;color:#15803d;font-family:monospace">${passwordCorreo}</td>
          </tr>`
              : ''
          }
        </tbody>
      </table>`
    : '';

  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">Tu solicitud fue completada</h2>
      <p style="color:#888;margin-top:0">Ticket <strong>${solicitud.id}</strong> · ${fecha}</p>

      ${bloqueCorreoAsignado}

      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <thead>
          <tr><th colspan="2" style="padding:10px 12px;text-align:left;background:#eee;font-size:0.85rem;color:#555">DATOS DE LA SOLICITUD</th></tr>
        </thead>
        <tbody>
          ${filas([
            ['Tipo', etiqueta],
            ['Solicitante', solicitud.solicitanteEmail],
          ])}
          ${bloqueDatosHtml(solicitud)}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <thead>
          <tr><th style="padding:10px 12px;text-align:left;background:#eee;font-size:0.85rem;color:#555">PLATAFORMAS</th></tr>
        </thead>
        <tbody>
          ${filasPlataformas}
        </tbody>
      </table>

      ${
        solicitud.comentario
          ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;background:#fffbe6;border-radius:8px;overflow:hidden;border:1px solid #f0e68c">
        <thead>
          <tr><th style="padding:10px 12px;text-align:left;background:#f5e642;font-size:0.85rem;color:#555">COMENTARIOS</th></tr>
        </thead>
        <tbody>
          <tr><td style="padding:10px 12px;color:#111">${solicitud.comentario}</td></tr>
        </tbody>
      </table>`
          : ''
      }

      <p style="margin-top:24px;font-size:0.8rem;color:#aaa">Este mensaje fue generado automáticamente por Solicitudes de Accesos · Capital Inteligente.</p>
    </div>
  `;

  return {
    to: solicitud.solicitanteEmail,
    subject: `[Completada] Ticket ${solicitud.id} — ${etiqueta}`,
    body,
  };
}

export function construirCorreoSolicitud(
  solicitud: Solicitud,
  plataformas: Plataforma[],
): CorreoSimulado {
  const etiqueta = ETIQUETA_TIPO[solicitud.tipo] ?? solicitud.tipo;
  const fecha = new Date(solicitud.fechaCreacion).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const filasPlataformas = solicitud.accesos
    .map(
      (a) => `
        <tr>
          <td style="padding:6px 12px;color:#111">· ${nombrePlataforma(a.plataformaId, plataformas)}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">${etiqueta}</h2>
      <p style="color:#888;margin-top:0">Ticket <strong>${solicitud.id}</strong> · ${fecha}</p>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <thead>
          <tr><th colspan="2" style="padding:10px 12px;text-align:left;background:#eee;font-size:0.85rem;color:#555">SOLICITANTE</th></tr>
        </thead>
        <tbody>
          ${filas([['Correo', solicitud.solicitanteEmail]])}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <thead>
          <tr><th colspan="2" style="padding:10px 12px;text-align:left;background:#eee;font-size:0.85rem;color:#555">DATOS DE LA PERSONA</th></tr>
        </thead>
        <tbody>
          ${bloqueDatosHtml(solicitud)}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f9f9f9;border-radius:8px;overflow:hidden">
        <thead>
          <tr><th style="padding:10px 12px;text-align:left;background:#eee;font-size:0.85rem;color:#555">PLATAFORMAS SOLICITADAS</th></tr>
        </thead>
        <tbody>
          ${filasPlataformas}
        </tbody>
      </table>

      ${
        solicitud.comentario
          ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;background:#fffbe6;border-radius:8px;overflow:hidden;border:1px solid #f0e68c">
        <thead>
          <tr><th style="padding:10px 12px;text-align:left;background:#f5e642;font-size:0.85rem;color:#555">COMENTARIOS</th></tr>
        </thead>
        <tbody>
          <tr><td style="padding:10px 12px;color:#111">${solicitud.comentario}</td></tr>
        </tbody>
      </table>`
          : ''
      }

      <p style="margin-top:24px;font-size:0.8rem;color:#aaa">Este mensaje fue generado automáticamente por Solicitudes de Accesos · Capital Inteligente.</p>
    </div>
  `;

  return {
    to: BUZON_ACCESOS,
    subject: `[${etiqueta}] Ticket ${solicitud.id} — ${solicitud.solicitanteEmail}`,
    body,
  };
}
