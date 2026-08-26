import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { Rol, RolAsignable } from '@/types';

const COOKIE = 'sa_session';

/** Cargo extra dentro de la sesión (ver Asignacion en @/types). */
export interface AsignacionSesion {
  rol: RolAsignable;
  hojaId: string;
  grupoNombre?: string;
}

export interface Sesion {
  email: string;
  nombre: string;
  rol: Rol;
  grupoBp?: string;
  multiempresas?: boolean;
  /** Cargos extra además del rol principal; el acceso es la unión de ambos. */
  asignaciones?: AsignacionSesion[];
}

function firmar(payload: string): string {
  return createHmac('sha256', process.env.OTP_SECRET ?? '').update(payload).digest('hex');
}

export async function getSesion(): Promise<Sesion | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const [payload, firma] = raw.split('.');
    if (!payload || !firma) return null;
    const esperada = firmar(payload);
    if (
      firma.length !== esperada.length ||
      !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))
    ) {
      return null;
    }
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Sesion;
  } catch {
    return null;
  }
}

export async function setSesion(sesion: Sesion): Promise<void> {
  const store = await cookies();
  const payload = Buffer.from(JSON.stringify(sesion), 'utf8').toString('base64url');
  const valor = `${payload}.${firmar(payload)}`;
  store.set(COOKIE, valor, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  });
}

export async function clearSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
