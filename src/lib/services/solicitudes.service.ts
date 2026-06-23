import type {
  AccesoSolicitado,
  DatosBaja,
  DatosCreacion,
  DatosModificacion,
  DatosSolicitud,
  EstadoSolicitud,
  PersonaDirectorio,
  Solicitud,
  TipoSolicitud,
} from '@/types';
import { esCorreoCorporativo } from './auth.service';

export interface NuevaSolicitudInput {
  tipo: TipoSolicitud;
  solicitanteEmail: string;
  datos: DatosSolicitud;
  plataformaIds: string[];
  comentario?: string;
}

export interface SolicitudDeps {
  now: () => Date;
  generarId: () => string;
}

function esVacio(valor: unknown): boolean {
  return typeof valor !== 'string' || valor.trim().length === 0;
}

/** Valida la entrada y devuelve la lista de errores (vacía si es válida). */
export function validarEntradaSolicitud(input: NuevaSolicitudInput): string[] {
  const errores: string[] = [];

  if (!esCorreoCorporativo(input.solicitanteEmail)) {
    errores.push('El solicitante debe usar un correo @capitalinteligente.cl.');
  }

  if (input.plataformaIds.length === 0) {
    errores.push('Debe seleccionar al menos una plataforma.');
  }

  if (input.tipo === 'crear') {
    const d = input.datos as DatosCreacion;
    if (esVacio(d.nombre)) errores.push('El nombre es obligatorio.');
    if (esVacio(d.segundoNombre)) errores.push('El segundo nombre es obligatorio.');
    if (esVacio(d.apellidoPaterno)) errores.push('El apellido paterno es obligatorio.');
    if (esVacio(d.apellidoMaterno)) errores.push('El apellido materno es obligatorio.');
    if (esVacio(d.celular)) errores.push('El celular es obligatorio.');
    if (esVacio(d.correoPersonal)) errores.push('El correo personal es obligatorio.');
  } else if (input.tipo === 'modificar') {
    const d = input.datos as DatosModificacion;
    if (esVacio(d.correoCorporativo)) {
      errores.push('Debe indicar el correo @capitalinteligente.cl a modificar.');
    }
    if (esVacio(d.detalle)) {
      errores.push('Debe describir qué se quiere modificar.');
    }
  } else {
    const d = input.datos as DatosBaja;
    if (esVacio(d.correoCorporativo)) {
      errores.push('Debe indicar el correo @capitalinteligente.cl a dar de baja.');
    }
  }

  return errores;
}

export function crearSolicitud(input: NuevaSolicitudInput, deps: SolicitudDeps): Solicitud {
  const errores = validarEntradaSolicitud(input);
  if (errores.length > 0) {
    throw new Error(`Solicitud inválida: ${errores.join(' ')}`);
  }

  const fecha = deps.now().toISOString();
  const accesos: AccesoSolicitado[] = input.plataformaIds.map((plataformaId) => ({
    plataformaId,
    fechaSolicitud: fecha,
    estado: 'pendiente',
  }));

  return {
    id: deps.generarId(),
    tipo: input.tipo,
    solicitanteEmail: input.solicitanteEmail.trim().toLowerCase(),
    fechaCreacion: fecha,
    estado: 'pendiente',
    datos: input.datos,
    accesos,
    ...(input.comentario?.trim() ? { comentario: input.comentario.trim() } : {}),
  };
}

/** Devuelve una copia con el nuevo estado propagado a todos los accesos. */
export function cambiarEstadoSolicitud(solicitud: Solicitud, estado: EstadoSolicitud): Solicitud {
  return {
    ...solicitud,
    estado,
    accesos: solicitud.accesos.map((a) => ({ ...a, estado })),
  };
}

export interface GrupoSolicitudes {
  tipo: TipoSolicitud;
  solicitudes: Solicitud[];
}

const ORDEN_TIPOS: TipoSolicitud[] = ['crear', 'modificar', 'baja'];

/** Agrupa las solicitudes por tipo, en orden: creación, modificación, baja. */
export function agruparPorTipo(solicitudes: Solicitud[]): GrupoSolicitudes[] {
  return ORDEN_TIPOS.map((tipo) => ({
    tipo,
    solicitudes: solicitudes.filter((s) => s.tipo === tipo),
  }));
}

/**
 * Construye el directorio de personas a partir de las solicitudes completadas:
 * - una "crear" completada (con correoCorporativoAsignado) agrega/activa a la persona
 *   y sus accesos.
 * - una "baja" completada marca a la persona como eliminada y sus accesos solicitados
 *   como eliminados.
 * Se procesa en orden cronológico para que la acción más reciente gane.
 */
export function construirDirectorio(solicitudes: Solicitud[]): PersonaDirectorio[] {
  const porFecha = [...solicitudes].sort(
    (a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime(),
  );

  const personas = new Map<string, PersonaDirectorio>();

  function obtenerOPersona(correo: string): PersonaDirectorio {
    const existente = personas.get(correo);
    if (existente) return existente;
    const nueva: PersonaDirectorio = { correoCorporativo: correo, estado: 'activo', accesos: [] };
    personas.set(correo, nueva);
    return nueva;
  }

  function actualizarAcceso(
    persona: PersonaDirectorio,
    plataformaId: string,
    fechaSolicitud: string,
    estado: 'activo' | 'eliminado',
  ) {
    const idx = persona.accesos.findIndex((a) => a.plataformaId === plataformaId);
    const acceso = { plataformaId, fechaSolicitud, estado };
    if (idx === -1) {
      persona.accesos.push(acceso);
    } else {
      persona.accesos[idx] = acceso;
    }
  }

  for (const s of porFecha) {
    if (s.estado !== 'completada') continue;

    if (s.tipo === 'crear' && s.correoCorporativoAsignado) {
      const persona = obtenerOPersona(s.correoCorporativoAsignado);
      persona.estado = 'activo';
      for (const a of s.accesos) {
        if (a.estado === 'completada') {
          actualizarAcceso(persona, a.plataformaId, a.fechaSolicitud, 'activo');
        }
      }
    }

    if (s.tipo === 'baja') {
      const { correoCorporativo } = s.datos as DatosBaja;
      const persona = obtenerOPersona(correoCorporativo);
      persona.estado = 'eliminado';
      for (const a of s.accesos) {
        if (a.estado === 'completada') {
          actualizarAcceso(persona, a.plataformaId, a.fechaSolicitud, 'eliminado');
        }
      }
    }
  }

  return [...personas.values()].sort((a, b) =>
    a.correoCorporativo.localeCompare(b.correoCorporativo),
  );
}
