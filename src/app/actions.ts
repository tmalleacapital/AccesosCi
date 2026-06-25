'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  actualizarSolicitud,
  borrarEdicionesEliminado,
  crearGrupoExtra,
  crearHojaExtra,
  crearMiembroExtra,
  eliminarGrupoExtra,
  guardarEdicionCorreo,
  ocultarGrupo,
  guardarSolicitud,
  leerPlataformas,
  leerSolicitudes,
  leerUsuarios,
  transferirMiembroExtra,
} from '@/lib/db';
import { clearSesion, getSesion, setSesion } from '@/lib/session';
import { esCorreoCorporativo } from '@/lib/services/auth.service';
import { generarOtp, guardarOtp, limpiarOtp, verificarOtp } from '@/lib/services/otp.service';
import { enviarCodigoOtp, enviarCorreo } from '@/lib/services/email.service';
import {
  cambiarEstadoSolicitud,
  crearSolicitud,
  validarEntradaSolicitud,
  type NuevaSolicitudInput,
} from '@/lib/services/solicitudes.service';
import {
  construirCorreoSolicitud,
  construirCorreoConfirmacion,
  construirCorreoEnProceso,
  construirCorreoCompletada,
} from '@/lib/services/notificaciones.service';
import type { DatosSolicitud, EstadoSolicitud, TipoSolicitud } from '@/types';

export async function solicitarCodigoAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!esCorreoCorporativo(email)) {
    return { error: 'Solo se permiten cuentas @capitalinteligente.cl.' };
  }

  const otp = generarOtp();
  await guardarOtp(email, otp);

  try {
    await enviarCodigoOtp(email, otp);
  } catch {
    return { error: 'No se pudo enviar el correo. Intenta nuevamente.' };
  }

  return { emailEnviado: email };
}

export async function verificarCodigoAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const codigo = String(formData.get('codigo') ?? '').trim();

  const valido = await verificarOtp(email, codigo);
  if (!valido) {
    return { error: 'Código incorrecto o expirado.', email };
  }

  await limpiarOtp();

  const usuarios = await leerUsuarios();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === email);

  const nombre = usuario?.nombre ?? email.split('@')[0];
  const rol = usuario?.rol ?? 'solicitante';

  await setSesion({ email, nombre, rol });
  redirect('/');
}

export async function logoutAction() {
  await clearSesion();
  redirect('/login');
}

export async function crearSolicitudAction(_prev: unknown, formData: FormData) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');

  const tipo = String(formData.get('tipo') ?? 'crear') as TipoSolicitud;
  const plataformaIds = formData.getAll('plataformas').map(String);

  let datos: DatosSolicitud;
  if (tipo === 'crear') {
    datos = {
      nombre: String(formData.get('nombre') ?? ''),
      segundoNombre: String(formData.get('segundoNombre') ?? ''),
      apellidoPaterno: String(formData.get('apellidoPaterno') ?? ''),
      apellidoMaterno: String(formData.get('apellidoMaterno') ?? ''),
      celular: String(formData.get('celular') ?? ''),
      correoPersonal: String(formData.get('correoPersonal') ?? ''),
    };
  } else if (tipo === 'modificar') {
    datos = {
      correoCorporativo: String(formData.get('correoCorporativo') ?? ''),
      detalle: String(formData.get('detalle') ?? ''),
    };
  } else {
    datos = {
      correoCorporativo: String(formData.get('correoCorporativo') ?? ''),
      redistribucionSalesforce: String(formData.get('redistribucionSalesforce') ?? '') || undefined,
    };
  }

  const comentario = String(formData.get('comentario') ?? '').trim() || undefined;

  const PREFIJO: Record<string, string> = { crear: 'CREA', modificar: 'MOD', baja: 'ELIM' };

  const todasLasSolicitudes = await leerSolicitudes();
  const correlativo = todasLasSolicitudes.filter((s) => s.tipo === tipo).length + 1;
  const id = `${PREFIJO[tipo]}#${correlativo}`;

  const input: NuevaSolicitudInput = {
    tipo,
    solicitanteEmail: sesion.email,
    datos,
    plataformaIds,
    comentario,
  };

  const errores = validarEntradaSolicitud(input);
  if (errores.length > 0) {
    return { error: errores.join(' ') };
  }

  const solicitud = crearSolicitud(input, {
    now: () => new Date(),
    generarId: () => id,
  });
  await guardarSolicitud(solicitud);

  const plataformas = await leerPlataformas();
  const correoEquipo = construirCorreoSolicitud(solicitud, plataformas);
  const correoConfirmacion = construirCorreoConfirmacion(solicitud, plataformas);
  await Promise.all([
    enviarCorreo(correoEquipo.to, correoEquipo.subject, correoEquipo.body),
    enviarCorreo(correoConfirmacion.to, correoConfirmacion.subject, correoConfirmacion.body),
  ]);

  revalidatePath('/');
  redirect('/?creada=1');
}

export async function editarCorreoAction(
  correo: string,
  campo: string,
  valor: string,
): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await guardarEdicionCorreo(correo, campo, valor);
  revalidatePath('/');
}

export async function eliminarCorreoAction(correo: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await Promise.all([
    guardarEdicionCorreo(correo, 'eliminado', 'true'),
    guardarEdicionCorreo(correo, 'eliminado_por', sesion.email),
    guardarEdicionCorreo(correo, 'eliminado_en', new Date().toISOString()),
  ]);
  revalidatePath('/');
}

export async function restaurarCorreoAction(correo: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await borrarEdicionesEliminado(correo);
  revalidatePath('/');
}

export async function crearHojaAction(nombre: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  if (!nombre.trim()) throw new Error('El nombre del MBP no puede estar vacío.');
  await crearHojaExtra(nombre.trim());
  revalidatePath('/');
}

export async function crearGrupoAction(hojaId: string, nombre: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  if (!nombre.trim()) throw new Error('El nombre del equipo no puede estar vacío.');
  await crearGrupoExtra(hojaId, nombre.trim());
  revalidatePath('/');
}

export async function eliminarGrupoAction(id: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await eliminarGrupoExtra(id);
  revalidatePath('/');
}

export async function ocultarGrupoAction(hojaId: string, nombre: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await ocultarGrupo(hojaId, nombre);
  revalidatePath('/');
}

export async function cambiarEstadoAction(formData: FormData) {
  const sesion = await getSesion();
  if (!sesion || (sesion.rol !== 'equipo' && sesion.rol !== 'admin')) {
    throw new Error('No autorizado.');
  }

  const id = String(formData.get('id') ?? '');
  const estado = String(formData.get('estado') ?? '') as EstadoSolicitud;
  const correoCorporativoAsignado = String(formData.get('correoCorporativoAsignado') ?? '').trim();
  const passwordCorreo = String(formData.get('passwordCorreo') ?? '').trim() || undefined;
  const bpHojaId = String(formData.get('bpHojaId') ?? '').trim() || undefined;
  const bpGrupoNombre = String(formData.get('bpGrupoNombre') ?? '').trim() || undefined;

  const [solicitudes, plataformas] = await Promise.all([leerSolicitudes(), leerPlataformas()]);
  const solicitud = solicitudes.find((s) => s.id === id);
  if (!solicitud) throw new Error(`Solicitud no encontrada: ${id}`);

  if (solicitud.tipo === 'crear' && estado === 'completada' && !correoCorporativoAsignado) {
    throw new Error(
      'Debe indicar el correo @capitalinteligente.cl asignado para completar la creación.',
    );
  }

  const actualizada = cambiarEstadoSolicitud(solicitud, estado);
  const solicitudFinal = correoCorporativoAsignado
    ? { ...actualizada, correoCorporativoAsignado }
    : actualizada;
  await actualizarSolicitud(solicitudFinal);

  if (estado === 'en_proceso') {
    const correo = construirCorreoEnProceso(solicitudFinal);
    await enviarCorreo(correo.to, correo.subject, correo.body);
  } else if (estado === 'completada') {
    const correo = construirCorreoCompletada(solicitudFinal, plataformas, passwordCorreo);
    await enviarCorreo(correo.to, correo.subject, correo.body);

    if (solicitudFinal.tipo === 'crear' && correoCorporativoAsignado && bpHojaId && bpGrupoNombre) {
      const d = solicitudFinal.datos as import('@/types').DatosCreacion;
      const nombreCompleto = [d.nombre, d.segundoNombre, d.apellidoPaterno, d.apellidoMaterno]
        .filter(Boolean)
        .join(' ');

      const idsAccesos = new Set(solicitudFinal.accesos.map((a) => a.plataformaId));
      const tieneSlack = plataformas.some(
        (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('slack'),
      );
      const tieneJira = plataformas.some(
        (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('jira'),
      );

      await crearMiembroExtra(
        bpHojaId,
        bpGrupoNombre,
        nombreCompleto,
        correoCorporativoAsignado,
        tieneSlack,
        tieneJira,
        '',
      );
    }
  }

  revalidatePath('/');
}

export async function transferirCorreoAction(
  correo: string,
  datos: { nombre: string; slack: boolean; jira: boolean; sf: string; estado: string },
  targetHojaId: string,
  targetGrupoNombre: string,
  esDinamico: boolean,
): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');

  if (esDinamico) {
    await transferirMiembroExtra(correo, targetHojaId, targetGrupoNombre);
  } else {
    await Promise.all([
      guardarEdicionCorreo(correo, 'eliminado', 'true'),
      guardarEdicionCorreo(correo, 'eliminado_por', sesion.email),
      guardarEdicionCorreo(correo, 'eliminado_en', new Date().toISOString()),
    ]);
    await crearMiembroExtra(
      targetHojaId,
      targetGrupoNombre,
      datos.nombre,
      correo,
      datos.slack,
      datos.jira,
      datos.sf,
    );
  }

  revalidatePath('/');
}
