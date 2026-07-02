'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  actualizarRolUsuario,
  actualizarSolicitud,
  borrarEdicionesEliminado,
  crearGrupoExtra,
  crearHojaExtra,
  crearMiembroExtra,
  crearUsuario,
  eliminarGrupoExtra,
  eliminarUsuario,
  guardarEdicionCorreo,
  ocultarGrupo,
  guardarSolicitud,
  leerEdicionCorreo,
  leerHojasExtra,
  leerMiembrosExtra,
  leerPlataformas,
  leerSolicitudes,
  leerUsuarios,
  registrarHistorial,
  SolicitudIdDuplicadoError,
  transferirMiembroExtra,
} from '@/lib/db';
import correosData from '@/data/correos.json';
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
  construirCorreoParaSalesforce,
  construirCorreoParaJira,
  RESPONSABLE_SALESFORCE,
  RESPONSABLE_JIRA,
} from '@/lib/services/notificaciones.service';
import type { DatosBaja, DatosCreacion, DatosSolicitud, EstadoSolicitud, Rol, TipoSolicitud } from '@/types';

const RESPONSABLE_CORREO = 'tmallea@capitalinteligente.cl';

function fechaHoyChile(): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(new Date()).replace(/\//g, '-');
}

interface AsesorEstaticoRaw {
  correo: string;
}
interface GrupoEstaticoRaw {
  asesores: AsesorEstaticoRaw[];
}
interface HojaEstaticaRaw {
  id: string;
  nombre: string;
  grupos: GrupoEstaticoRaw[];
}
const hojasEstaticas = (correosData as { hojas: HojaEstaticaRaw[] }).hojas;
const correosEstaticos = hojasEstaticas.flatMap((h) =>
  h.grupos.flatMap((g) => g.asesores.map((a) => a.correo.toLowerCase())),
);

async function existeCorreoEnAlgunGrupo(correo: string): Promise<boolean> {
  const buscado = correo.toLowerCase();
  if (correosEstaticos.includes(buscado)) return true;
  const miembros = await leerMiembrosExtra();
  return miembros.some((m) => m.correo.toLowerCase() === buscado);
}

async function etiquetaHojaGrupo(hojaId: string, grupoNombre: string): Promise<string> {
  const estatica = hojasEstaticas.find((h) => h.id === hojaId);
  if (estatica) return `${estatica.nombre.replace(/^MBP\s+/, '')} · ${grupoNombre}`;
  const dinamicas = await leerHojasExtra();
  const dinamica = dinamicas.find((h) => h.id === hojaId);
  return `${dinamica?.nombre ?? hojaId} · ${grupoNombre}`;
}

// Evita filas duplicadas si se reintenta el mismo paso del ticket (doble clic, F5).
async function crearMiembroExtraSiNoExiste(
  hojaId: string,
  grupoNombre: string,
  nombre: string,
  correo: string,
  slack: boolean,
  jira: boolean,
  sf: string,
): Promise<void> {
  if (await existeCorreoEnAlgunGrupo(correo)) return;
  await crearMiembroExtra(hojaId, grupoNombre, nombre, correo, slack, jira, sf);
}

export async function solicitarCodigoAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!esCorreoCorporativo(email)) {
    return { error: 'Solo se permiten cuentas @capitalinteligente.cl.' };
  }

  const usuarios = await leerUsuarios();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === email);
  const rol = usuario?.rol ?? 'solicitante';
  if (rol !== 'bp' && rol !== 'admin' && rol !== 'finanzas') {
    return { error: 'No tienes acceso a esta plataforma.' };
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

  const usuarios = await leerUsuarios();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === email);

  const nombre = usuario?.nombre ?? email.split('@')[0];
  const rol = usuario?.rol ?? 'solicitante';
  const grupoBp = usuario?.grupoBp;

  if (rol !== 'bp' && rol !== 'admin' && rol !== 'finanzas') {
    return { error: 'No tienes acceso a esta plataforma.', email };
  }

  await limpiarOtp();
  await setSesion({ email, nombre, rol, ...(grupoBp ? { grupoBp } : {}) });
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
      rut: String(formData.get('rut') ?? ''),
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

  // El correlativo se calcula contando solicitudes existentes, sin secuencia
  // atómica en la BD. Si dos personas envían al mismo tiempo, reintentamos
  // con un correlativo nuevo cuando el insert choca por id duplicado.
  let solicitud;
  const MAX_INTENTOS = 5;
  for (let intento = 1; ; intento++) {
    const todasLasSolicitudes = await leerSolicitudes();
    const correlativo = todasLasSolicitudes.filter((s) => s.tipo === tipo).length + 1;
    const id = `${PREFIJO[tipo]}#${correlativo}`;
    solicitud = crearSolicitud(input, {
      now: () => new Date(),
      generarId: () => id,
    });
    try {
      await guardarSolicitud(solicitud);
      break;
    } catch (err) {
      if (err instanceof SolicitudIdDuplicadoError && intento < MAX_INTENTOS) continue;
      throw err;
    }
  }

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
  valorAnterior?: string,
): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await guardarEdicionCorreo(correo, campo, valor);
  // Las claves de métricas (__metrica__:...) no son correos reales, no se registran en el historial.
  if (correo.includes('@') && valor !== valorAnterior) {
    await registrarHistorial(correo, campo, valorAnterior ?? null, valor, sesion.email);
  }
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

export async function crearMiembroAction(
  hojaId: string,
  grupoNombre: string,
  nombre: string,
  correo: string,
  slack: boolean,
  jira: boolean,
  sf: string,
): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  if (!nombre.trim()) throw new Error('El nombre no puede estar vacío.');
  const correoLimpio = correo.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) throw new Error('El correo no es válido.');
  if (await existeCorreoEnAlgunGrupo(correoLimpio)) {
    throw new Error('Este correo ya existe en otro grupo.');
  }
  await crearMiembroExtra(hojaId, grupoNombre, nombre.trim(), correoLimpio, slack, jira, sf);
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

  const idsAccesos = new Set(solicitud.accesos.map((a) => a.plataformaId));
  const tieneJira = plataformas.some(
    (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('jira'),
  );

  // ── Paso 1: tmallea completa correo → esperando_salesforce | esperando_jira ─
  if (
    (estado === 'esperando_salesforce' || estado === 'esperando_jira') &&
    sesion.email === RESPONSABLE_CORREO &&
    solicitud.tipo === 'crear'
  ) {
    if (!correoCorporativoAsignado) {
      throw new Error('Debe indicar el correo @capitalinteligente.cl asignado.');
    }
    const datosActualizados: DatosCreacion = {
      ...(solicitud.datos as DatosCreacion),
      passwordCorreo,
    };
    const solicitudFinal = {
      ...cambiarEstadoSolicitud(solicitud, estado),
      correoCorporativoAsignado,
      datos: datosActualizados,
    };
    await actualizarSolicitud(solicitudFinal);

    if (bpHojaId && bpGrupoNombre) {
      const d = datosActualizados;
      const nombreCompleto = [d.nombre, d.segundoNombre, d.apellidoPaterno, d.apellidoMaterno]
        .filter(Boolean)
        .join(' ');
      const tieneSlack = plataformas.some(
        (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('slack'),
      );
      await crearMiembroExtraSiNoExiste(
        bpHojaId,
        bpGrupoNombre,
        nombreCompleto,
        correoCorporativoAsignado,
        tieneSlack,
        tieneJira,
        '',
      );
    }

    if (estado === 'esperando_salesforce') {
      const correoMguzman = construirCorreoParaSalesforce(solicitudFinal, plataformas);
      await enviarCorreo(correoMguzman.to, correoMguzman.subject, correoMguzman.body);
    } else {
      const correoJira = construirCorreoParaJira(solicitudFinal, plataformas);
      await enviarCorreo(correoJira.to, correoJira.subject, correoJira.body);
    }
    revalidatePath('/');
    return;
  }

  // ── Paso 2: mguzman completa Salesforce → esperando_jira | completada ──────
  if (
    estado === 'completada' &&
    sesion.email === RESPONSABLE_SALESFORCE &&
    solicitud.estado === 'esperando_salesforce'
  ) {
    const passwordAlmacenada = (solicitud.datos as DatosCreacion).passwordCorreo;

    if (tieneJira) {
      // Aún falta el paso de Jira
      const solicitudFinal = {
        ...cambiarEstadoSolicitud(solicitud, 'esperando_jira'),
      };
      await actualizarSolicitud(solicitudFinal);
      const correoJira = construirCorreoParaJira(solicitudFinal, plataformas);
      await enviarCorreo(correoJira.to, correoJira.subject, correoJira.body);
    } else {
      const solicitudFinal = cambiarEstadoSolicitud(solicitud, 'completada');
      await actualizarSolicitud(solicitudFinal);
      const correo = construirCorreoCompletada(solicitudFinal, plataformas, passwordAlmacenada);
      const correoPersonalSf = (solicitudFinal.datos as DatosCreacion).correoPersonal;
      await Promise.all([
        enviarCorreo(correo.to, correo.subject, correo.body),
        ...(correoPersonalSf && correoPersonalSf !== correo.to
          ? [enviarCorreo(correoPersonalSf, correo.subject, correo.body)]
          : []),
      ]);
    }
    revalidatePath('/');
    return;
  }

  // ── Paso 3: cpeede completa Jira → completada ──────────────────────────────
  if (
    estado === 'completada' &&
    sesion.email === RESPONSABLE_JIRA &&
    solicitud.estado === 'esperando_jira'
  ) {
    const passwordAlmacenada = (solicitud.datos as DatosCreacion).passwordCorreo;
    const solicitudFinal = cambiarEstadoSolicitud(solicitud, 'completada');
    await actualizarSolicitud(solicitudFinal);
    const correo = construirCorreoCompletada(solicitudFinal, plataformas, passwordAlmacenada);
    const correoPersonalJira = (solicitudFinal.datos as DatosCreacion).correoPersonal;
    await Promise.all([
      enviarCorreo(correo.to, correo.subject, correo.body),
      ...(correoPersonalJira && correoPersonalJira !== correo.to
        ? [enviarCorreo(correoPersonalJira, correo.subject, correo.body)]
        : []),
    ]);
    revalidatePath('/');
    return;
  }

  // ── Flujo normal (tickets sin Salesforce o que no son tipo crear) ───────────
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
    const correoPersonalNormal =
      solicitudFinal.tipo === 'crear'
        ? (solicitudFinal.datos as DatosCreacion).correoPersonal
        : undefined;
    await Promise.all([
      enviarCorreo(correo.to, correo.subject, correo.body),
      ...(correoPersonalNormal && correoPersonalNormal !== correo.to
        ? [enviarCorreo(correoPersonalNormal, correo.subject, correo.body)]
        : []),
    ]);

    if (solicitudFinal.tipo === 'crear' && correoCorporativoAsignado && bpHojaId && bpGrupoNombre) {
      const d = solicitudFinal.datos as DatosCreacion;
      const nombreCompleto = [d.nombre, d.segundoNombre, d.apellidoPaterno, d.apellidoMaterno]
        .filter(Boolean)
        .join(' ');
      const tieneSlack = plataformas.some(
        (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('slack'),
      );
      const tieneJira = plataformas.some(
        (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('jira'),
      );
      await crearMiembroExtraSiNoExiste(
        bpHojaId,
        bpGrupoNombre,
        nombreCompleto,
        correoCorporativoAsignado,
        tieneSlack,
        tieneJira,
        '',
      );
    }

    if (solicitudFinal.tipo === 'baja') {
      const correoBaja = (solicitudFinal.datos as DatosBaja).correoCorporativo;
      const fecha = fechaHoyChile();
      const [estadoActual, comentarioActual] = await Promise.all([
        leerEdicionCorreo(correoBaja, 'estado'),
        leerEdicionCorreo(correoBaja, 'comentario'),
      ]);
      const nuevoComentario = comentarioActual
        ? `${comentarioActual}\nEliminado el ${fecha}`
        : `Eliminado el ${fecha}`;
      await Promise.all([
        guardarEdicionCorreo(correoBaja, 'estado', 'Eliminado'),
        guardarEdicionCorreo(correoBaja, 'comentario', nuevoComentario),
      ]);
      await Promise.all([
        registrarHistorial(correoBaja, 'estado', estadoActual ?? 'Activo', 'Eliminado', sesion.email),
        registrarHistorial(correoBaja, 'comentario', comentarioActual, nuevoComentario, sesion.email),
      ]);
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
  origenHojaId?: string,
  origenGrupoNombre?: string,
): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');

  if (esDinamico) {
    await transferirMiembroExtra(correo, targetHojaId, targetGrupoNombre);
  } else {
    // Para miembros estáticos usamos 'transferido' (no 'eliminado') para que
    // no aparezcan en el panel Eliminados ni filtren la nueva entrada en miembros_extra.
    await guardarEdicionCorreo(correo, 'transferido', 'true');
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

  const [origenLabel, destinoLabel] = await Promise.all([
    origenHojaId && origenGrupoNombre ? etiquetaHojaGrupo(origenHojaId, origenGrupoNombre) : null,
    etiquetaHojaGrupo(targetHojaId, targetGrupoNombre),
  ]);
  await registrarHistorial(correo, 'mbp_bp', origenLabel, destinoLabel, sesion.email);

  revalidatePath('/');
}

// ─── Administración de usuarios (solo admin) ──────────────────────────────────

export async function crearUsuarioAction(
  email: string,
  nombre: string,
  rol: Rol,
  grupoBp?: string,
): Promise<{ error?: string }> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');

  const correo = email.trim().toLowerCase();
  if (!esCorreoCorporativo(correo)) {
    return { error: 'Solo se permiten cuentas @capitalinteligente.cl.' };
  }
  if (!nombre.trim()) {
    return { error: 'El nombre no puede estar vacío.' };
  }

  await crearUsuario(correo, nombre.trim(), rol, grupoBp?.trim() || undefined);
  revalidatePath('/');
  return {};
}

export async function actualizarRolUsuarioAction(
  email: string,
  rol: Rol,
  grupoBp?: string,
): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  await actualizarRolUsuario(email.trim().toLowerCase(), rol, grupoBp?.trim() || undefined);
  revalidatePath('/');
}

export async function eliminarUsuarioAction(email: string): Promise<void> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== 'admin') throw new Error('No autorizado.');
  if (email.trim().toLowerCase() === sesion.email.toLowerCase()) {
    throw new Error('No puedes eliminar tu propia cuenta.');
  }
  await eliminarUsuario(email.trim().toLowerCase());
  revalidatePath('/');
}
