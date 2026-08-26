import type { Rol, RolAsignable } from '@/types';

/**
 * Parte de la estructura que alguien puede ver. Sin `grupoNombre` significa un
 * MBP completo: todos los BP de esa hoja.
 */
export interface Ambito {
  hojaId: string;
  grupoNombre?: string;
}

export interface AccesoInput {
  rol: Rol;
  /** "hojaId|grupoNombre" para bp/team_leader; solo "hojaId" para mbp. */
  grupoBp?: string;
  /** Cargos extra: una persona puede tener más de uno a la vez. */
  asignaciones?: { rol: RolAsignable; hojaId: string; grupoNombre?: string }[];
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
      ambitos.push({
        hojaId: input.grupoBp.slice(0, sep),
        grupoNombre: input.grupoBp.slice(sep + 1),
      });
    }
  }

  for (const a of input.asignaciones ?? []) {
    ambitos.push(
      a.rol === 'mbp' ? { hojaId: a.hojaId } : { hojaId: a.hojaId, grupoNombre: a.grupoNombre },
    );
  }

  return ambitos;
}

/**
 * Colapsa los ámbitos por hoja. `null` = la hoja completa (gana siempre sobre
 * los BP puntuales de esa misma hoja); un Set = solo esos BP.
 */
export function resolverAmbitoPorHoja(ambitos: Ambito[]): Map<string, Set<string> | null> {
  const map = new Map<string, Set<string> | null>();
  for (const a of ambitos) {
    if (!a.grupoNombre) {
      map.set(a.hojaId, null);
      continue;
    }
    const actual = map.get(a.hojaId);
    if (actual === null) continue; // ya cubre la hoja entera
    map.set(a.hojaId, new Set([...(actual ?? []), a.grupoNombre]));
  }
  return map;
}
