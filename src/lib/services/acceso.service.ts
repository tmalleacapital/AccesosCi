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

/** Un cargo concreto: qué es la persona y sobre qué MBP/BP. */
export interface Cargo {
  rol: RolAsignable;
  hojaId: string;
  /** Ausente cuando rol es 'mbp': el cargo cubre la hoja completa. */
  grupoNombre?: string;
}

/**
 * Todos los cargos de una persona: su rol principal más sus cargos extra.
 * Ej. cfigueroa es MBP de Forza Capital y además líder del "BP Forza Capital"
 * que vive dentro de ese mismo MBP.
 */
export function calcularCargos(input: AccesoInput): Cargo[] {
  const cargos: Cargo[] = [];

  if (input.rol === 'mbp' && input.grupoBp) {
    cargos.push({ rol: 'mbp', hojaId: input.grupoBp });
  } else if ((input.rol === 'bp' || input.rol === 'team_leader') && input.grupoBp) {
    const sep = input.grupoBp.indexOf('|');
    if (sep !== -1) {
      cargos.push({
        rol: input.rol,
        hojaId: input.grupoBp.slice(0, sep),
        grupoNombre: input.grupoBp.slice(sep + 1),
      });
    }
  }

  for (const a of input.asignaciones ?? []) {
    cargos.push(
      a.rol === 'mbp'
        ? { rol: 'mbp', hojaId: a.hojaId }
        : { rol: a.rol, hojaId: a.hojaId, grupoNombre: a.grupoNombre },
    );
  }

  return cargos;
}

/** Los ámbitos visibles que se desprenden de esos cargos. */
export function calcularAmbitos(input: AccesoInput): Ambito[] {
  return calcularCargos(input).map((c) =>
    c.rol === 'mbp'
      ? { hojaId: c.hojaId }
      : c.rol === 'team_leader'
        ? { hojaId: c.hojaId, grupoNombre: c.grupoNombre, soloDeTeamLeader: input.email }
        : { hojaId: c.hojaId, grupoNombre: c.grupoNombre },
  );
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
 * Si estos ámbitos alcanzan para operar sobre un BP concreto. No distingue si
 * la vista queda acotada a un Team Leader — eso lo resuelve puedeVerAsesor()
 * fila a fila.
 */
export function puedeAccederAGrupo(
  ambitos: Ambito[],
  hojaId: string,
  grupoNombre: string,
): boolean {
  return ambitos.some(
    (a) => a.hojaId === hojaId && (!a.grupoNombre || a.grupoNombre === grupoNombre),
  );
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
