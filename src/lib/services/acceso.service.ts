import type { Rol, RolAsignable } from '@/types';

/**
 * Parte de la estructura que alguien puede ver.
 * - Sin `grupoNombre`: un MBP completo (todos los BP de esa hoja).
 * - Con `soloDeTeamLeader`: dentro de ese BP, solo los asesores asignados a ese
 *   Team Leader (más él mismo).
 */
export interface Ambito {
  hojaId: string;
  grupoNombre?: string;
  soloDeTeamLeader?: string;
}

export interface AccesoInput {
  /** Correo de la persona: un Team Leader se acota a los que le reportan a él. */
  email: string;
  rol: Rol;
  /** "hojaId|grupoNombre" para bp/team_leader; solo "hojaId" para mbp. */
  grupoBp?: string;
  /** Cargos extra: una persona puede tener más de uno a la vez. */
  asignaciones?: { rol: RolAsignable; hojaId: string; grupoNombre?: string }[];
}

function ambitoDe(
  rol: RolAsignable,
  hojaId: string,
  grupoNombre: string | undefined,
  email: string,
): Ambito {
  if (rol === 'mbp') return { hojaId };
  if (rol === 'team_leader') return { hojaId, grupoNombre, soloDeTeamLeader: email };
  return { hojaId, grupoNombre };
}

/**
 * Ámbitos visibles para una persona: la unión de su rol principal y de sus
 * cargos extra. Ej. cfigueroa es MBP de Forza Capital y además líder del "BP
 * Forza Capital" que vive dentro de ese mismo MBP.
 */
export function calcularAmbitos(input: AccesoInput): Ambito[] {
  const ambitos: Ambito[] = [];

  if (input.rol === 'mbp' && input.grupoBp) {
    ambitos.push({ hojaId: input.grupoBp });
  } else if ((input.rol === 'bp' || input.rol === 'team_leader') && input.grupoBp) {
    const sep = input.grupoBp.indexOf('|');
    if (sep !== -1) {
      ambitos.push(
        ambitoDe(
          input.rol,
          input.grupoBp.slice(0, sep),
          input.grupoBp.slice(sep + 1),
          input.email,
        ),
      );
    }
  }

  for (const a of input.asignaciones ?? []) {
    ambitos.push(ambitoDe(a.rol, a.hojaId, a.grupoNombre, input.email));
  }

  return ambitos;
}

/**
 * Colapsa los ámbitos por hoja.
 * - Valor `null` en la hoja: MBP completo; gana sobre cualquier restricción.
 * - Si no, un Map de BP → `null` (BP completo) o el correo del Team Leader que
 *   acota la vista. Ser líder del BP gana sobre ser TL de ese mismo BP.
 */
export function resolverAmbitoPorHoja(
  ambitos: Ambito[],
): Map<string, Map<string, string | null> | null> {
  const map = new Map<string, Map<string, string | null> | null>();

  for (const a of ambitos) {
    if (!a.grupoNombre) {
      map.set(a.hojaId, null);
      continue;
    }
    const actual = map.get(a.hojaId);
    if (actual === null) continue; // ya cubre la hoja entera

    const grupos = actual ?? new Map<string, string | null>();
    const restriccionActual = grupos.get(a.grupoNombre);
    // null (BP completo) manda; solo se guarda el TL si aún no había entrada.
    if (!grupos.has(a.grupoNombre) || restriccionActual !== null) {
      grupos.set(a.grupoNombre, a.soloDeTeamLeader ?? null);
    }
    map.set(a.hojaId, grupos);
  }

  return map;
}

/**
 * Dentro de un BP ya autorizado, decide si se ve a un asesor puntual.
 * `soloDeTeamLeader` null = sin restricción (líder BP o MBP).
 */
export function puedeVerAsesor(
  soloDeTeamLeader: string | null,
  correoAsesor: string,
  reportaA: string | undefined,
): boolean {
  if (!soloDeTeamLeader) return true;
  const tl = soloDeTeamLeader.toLowerCase();
  if (correoAsesor.trim().toLowerCase() === tl) return true; // el TL se ve a sí mismo
  return (reportaA ?? '').trim().toLowerCase() === tl;
}
