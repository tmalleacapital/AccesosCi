// Tipos de dominio de "Solicitudes de Accesos".

export type Rol = 'solicitante' | 'equipo' | 'admin';

export interface Usuario {
  email: string; // siempre @capitalinteligente.cl
  nombre: string;
  rol: Rol;
  // Hash simple para login del MVP (no producción).
  passwordHash: string;
}

export interface Plataforma {
  id: string;
  nombre: string;
  /** Si la plataforma genera cobro al solicitar acceso. */
  facturable: boolean;
  activa: boolean;
}

export type TipoSolicitud = 'crear' | 'modificar' | 'baja';

export type EstadoSolicitud =
  | 'pendiente'
  | 'en_proceso'
  | 'esperando_salesforce'
  | 'completada'
  | 'rechazada';

/** Un acceso concreto pedido dentro de una solicitud. */
export interface AccesoSolicitado {
  plataformaId: string;
  /** Fecha en que se solicitó este acceso — base para los cobros. */
  fechaSolicitud: string; // ISO
  estado: EstadoSolicitud;
}

/** Datos requeridos al CREAR un acceso. */
export interface DatosCreacion {
  nombre: string;
  segundoNombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular: string;
  /** Correo personal donde se envían las credenciales del nuevo @capitalinteligente.cl. */
  correoPersonal: string;
  /** Contraseña del correo corporativo; se guarda al completar el paso 1 (tmallea). */
  passwordCorreo?: string;
}

/** Datos requeridos al MODIFICAR un acceso. */
export interface DatosModificacion {
  correoCorporativo: string; // @capitalinteligente.cl
  detalle: string; // qué se quiere modificar
}

/** Datos requeridos al dar de BAJA un acceso. */
export interface DatosBaja {
  correoCorporativo: string; // @capitalinteligente.cl
  /** Si la persona tiene Salesforce: a quién se redistribuyen leads y cuentas. */
  redistribucionSalesforce?: string;
}

export type DatosSolicitud = DatosCreacion | DatosModificacion | DatosBaja;

export interface Solicitud {
  id: string;
  tipo: TipoSolicitud;
  /** Email del solicitante (@capitalinteligente.cl). */
  solicitanteEmail: string;
  fechaCreacion: string; // ISO
  estado: EstadoSolicitud;
  datos: DatosSolicitud;
  accesos: AccesoSolicitado[];
  comentario?: string;
  /**
   * Correo @capitalinteligente.cl que el Equipo asignó al completar una
   * solicitud de tipo "crear" (no existe hasta que la cuenta se crea de verdad).
   */
  correoCorporativoAsignado?: string;
}

export type EstadoPersona = 'activo' | 'eliminado';

export interface AccesoDirectorio {
  plataformaId: string;
  fechaSolicitud: string; // ISO
  estado: 'activo' | 'eliminado';
}

/** Ficha de una persona del directorio, derivada de las solicitudes completadas. */
export interface PersonaDirectorio {
  correoCorporativo: string;
  estado: EstadoPersona;
  accesos: AccesoDirectorio[];
}
