import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Plataforma, Solicitud, Usuario } from '@/types';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Tipo interno que refleja las columnas en snake_case de la BD.
interface SolicitudRow {
  id: string;
  tipo: string;
  solicitante_email: string;
  fecha_creacion: string;
  estado: string;
  datos: unknown;
  accesos: unknown;
  comentario: string | null;
  correo_corporativo_asignado: string | null;
}

function rowToSolicitud(row: SolicitudRow): Solicitud {
  return {
    id: row.id,
    tipo: row.tipo as Solicitud['tipo'],
    solicitanteEmail: row.solicitante_email,
    fechaCreacion: row.fecha_creacion,
    estado: row.estado as Solicitud['estado'],
    datos: row.datos as Solicitud['datos'],
    accesos: row.accesos as Solicitud['accesos'],
    ...(row.comentario ? { comentario: row.comentario } : {}),
    ...(row.correo_corporativo_asignado
      ? { correoCorporativoAsignado: row.correo_corporativo_asignado }
      : {}),
  };
}

export async function leerUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from('usuarios').select('email, nombre, rol');
  if (error) throw new Error(`leerUsuarios: ${error.message}`);
  return (data ?? []).map((row) => ({
    email: row.email as string,
    nombre: row.nombre as string,
    rol: row.rol as Usuario['rol'],
    passwordHash: '',
  }));
}

export async function leerPlataformas(): Promise<Plataforma[]> {
  const { data, error } = await supabase
    .from('plataformas')
    .select('id, nombre, facturable, activa')
    .eq('activa', true)
    .order('nombre');
  if (error) throw new Error(`leerPlataformas: ${error.message}`);
  return (data ?? []) as Plataforma[];
}

export async function leerSolicitudes(): Promise<Solicitud[]> {
  const { data, error } = await supabase
    .from('solicitudes')
    .select('*')
    .order('fecha_creacion', { ascending: false });
  if (error) throw new Error(`leerSolicitudes: ${error.message}`);
  return (data ?? []).map((row) => rowToSolicitud(row as SolicitudRow));
}

export async function guardarSolicitud(solicitud: Solicitud): Promise<void> {
  const { error } = await supabase.from('solicitudes').insert({
    id: solicitud.id,
    tipo: solicitud.tipo,
    solicitante_email: solicitud.solicitanteEmail,
    fecha_creacion: solicitud.fechaCreacion,
    estado: solicitud.estado,
    datos: solicitud.datos,
    accesos: solicitud.accesos,
    comentario: solicitud.comentario ?? null,
    correo_corporativo_asignado: solicitud.correoCorporativoAsignado ?? null,
  });
  if (error) throw new Error(`guardarSolicitud: ${error.message}`);
}

export async function actualizarSolicitud(actualizada: Solicitud): Promise<void> {
  const { error } = await supabase
    .from('solicitudes')
    .update({
      estado: actualizada.estado,
      datos: actualizada.datos,
      accesos: actualizada.accesos,
      comentario: actualizada.comentario ?? null,
      correo_corporativo_asignado: actualizada.correoCorporativoAsignado ?? null,
    })
    .eq('id', actualizada.id);
  if (error) throw new Error(`actualizarSolicitud: ${error.message}`);
}
