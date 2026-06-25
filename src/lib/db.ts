import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Plataforma, Solicitud, Usuario } from '@/types';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

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
  const { data, error } = await getSupabase().from('usuarios').select('email, nombre, rol');
  if (error) throw new Error(`leerUsuarios: ${error.message}`);
  return (data ?? []).map((row) => ({
    email: row.email as string,
    nombre: row.nombre as string,
    rol: row.rol as Usuario['rol'],
    passwordHash: '',
  }));
}

export async function leerPlataformas(): Promise<Plataforma[]> {
  const { data, error } = await getSupabase()
    .from('plataformas')
    .select('id, nombre, facturable, activa')
    .eq('activa', true)
    .order('nombre');
  if (error) throw new Error(`leerPlataformas: ${error.message}`);
  return (data ?? []) as Plataforma[];
}

export async function leerSolicitudes(): Promise<Solicitud[]> {
  const { data, error } = await getSupabase()
    .from('solicitudes')
    .select('*')
    .order('fecha_creacion', { ascending: false });
  if (error) throw new Error(`leerSolicitudes: ${error.message}`);
  return (data ?? []).map((row) => rowToSolicitud(row as SolicitudRow));
}

export async function guardarSolicitud(solicitud: Solicitud): Promise<void> {
  const { error } = await getSupabase()
    .from('solicitudes')
    .insert({
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

/** Devuelve un mapa { "correo||campo": valor } con todos los overrides del directorio. */
export async function leerEdicionesCorreos(): Promise<Record<string, string>> {
  const { data, error } = await getSupabase().from('correos_edits').select('correo, campo, valor');
  if (error) throw new Error(`leerEdicionesCorreos: ${error.message}`);
  const mapa: Record<string, string> = {};
  for (const row of data ?? []) {
    mapa[`${row.correo as string}||${row.campo as string}`] = row.valor as string;
  }
  return mapa;
}

export async function guardarEdicionCorreo(
  correo: string,
  campo: string,
  valor: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('correos_edits')
    .upsert({ correo, campo, valor }, { onConflict: 'correo,campo' });
  if (error) throw new Error(`guardarEdicionCorreo: ${error.message}`);
}

export interface HojaExtra {
  id: string;
  nombre: string;
}

export async function leerHojasExtra(): Promise<HojaExtra[]> {
  const { data, error } = await getSupabase()
    .from('hojas_extra')
    .select('id, nombre')
    .order('created_at');
  if (error) throw new Error(`leerHojasExtra: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
  }));
}

export async function crearHojaExtra(nombre: string): Promise<void> {
  const { error } = await getSupabase().from('hojas_extra').insert({ nombre });
  if (error) throw new Error(`crearHojaExtra: ${error.message}`);
}

export interface GrupoExtra {
  id: string;
  hojaId: string;
  nombre: string;
}

export async function leerGruposExtra(): Promise<GrupoExtra[]> {
  const { data, error } = await getSupabase()
    .from('grupos_extra')
    .select('id, hoja_id, nombre')
    .order('created_at');
  if (error) throw new Error(`leerGruposExtra: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    hojaId: row.hoja_id as string,
    nombre: row.nombre as string,
  }));
}

export async function crearGrupoExtra(hojaId: string, nombre: string): Promise<void> {
  const { error } = await getSupabase().from('grupos_extra').insert({ hoja_id: hojaId, nombre });
  if (error) throw new Error(`crearGrupoExtra: ${error.message}`);
}

export async function eliminarGrupoExtra(id: string): Promise<void> {
  const { error } = await getSupabase().from('grupos_extra').delete().eq('id', id);
  if (error) throw new Error(`eliminarGrupoExtra: ${error.message}`);
}

export async function leerGruposOcultos(): Promise<{ hojaId: string; nombre: string }[]> {
  const { data, error } = await getSupabase().from('grupos_ocultos').select('hoja_id, nombre');
  if (error) throw new Error(`leerGruposOcultos: ${error.message}`);
  return (data ?? []).map((row) => ({
    hojaId: row.hoja_id as string,
    nombre: row.nombre as string,
  }));
}

export async function ocultarGrupo(hojaId: string, nombre: string): Promise<void> {
  const { error } = await getSupabase().from('grupos_ocultos').insert({ hoja_id: hojaId, nombre });
  if (error) throw new Error(`ocultarGrupo: ${error.message}`);
}

export interface MiembroExtra {
  id: string;
  hojaId: string;
  grupoNombre: string;
  nombre: string;
  correo: string;
  slack: boolean;
  jira: boolean;
  sf: string;
  estado: string;
}

export async function leerMiembrosExtra(): Promise<MiembroExtra[]> {
  const { data, error } = await getSupabase()
    .from('miembros_extra')
    .select('id, hoja_id, grupo_nombre, nombre, correo, slack, jira, sf, estado')
    .order('created_at');
  if (error) throw new Error(`leerMiembrosExtra: ${error.message}`);
  const todos = (data ?? []).map((row) => ({
    id: row.id as string,
    hojaId: row.hoja_id as string,
    grupoNombre: row.grupo_nombre as string,
    nombre: row.nombre as string,
    correo: row.correo as string,
    slack: row.slack as boolean,
    jira: row.jira as boolean,
    sf: row.sf as string,
    estado: row.estado as string,
  }));
  // Deduplicar por correo: conservar el último insertado (más reciente)
  const vistos = new Map<string, MiembroExtra>();
  for (const m of todos) vistos.set(m.correo, m);
  return Array.from(vistos.values());
}

export async function crearMiembroExtra(
  hojaId: string,
  grupoNombre: string,
  nombre: string,
  correo: string,
  slack: boolean,
  jira: boolean,
  sf: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('miembros_extra')
    .insert({ hoja_id: hojaId, grupo_nombre: grupoNombre, nombre, correo, slack, jira, sf });
  if (error) throw new Error(`crearMiembroExtra: ${error.message}`);
}

export async function transferirMiembroExtra(
  correo: string,
  newHojaId: string,
  newGrupoNombre: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('miembros_extra')
    .update({ hoja_id: newHojaId, grupo_nombre: newGrupoNombre })
    .eq('correo', correo);
  if (error) throw new Error(`transferirMiembroExtra: ${error.message}`);
}

export async function borrarEdicionesEliminado(correo: string): Promise<void> {
  const { error } = await getSupabase()
    .from('correos_edits')
    .delete()
    .eq('correo', correo)
    .in('campo', ['eliminado', 'eliminado_por', 'eliminado_en']);
  if (error) throw new Error(`borrarEdicionesEliminado: ${error.message}`);
}

export async function actualizarSolicitud(actualizada: Solicitud): Promise<void> {
  const { error } = await getSupabase()
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
