/**
 * Fusión pura del directorio de asesores: estático (correos.json) + dinámico
 * (hojas_extra/grupos_extra/miembros_extra) + overrides (correos_edits).
 *
 * Misma lógica que hoy vive embebida en ListaCorreos.tsx (fuente de verdad de
 * la UI); se extrae aquí para que tanto la UI como el export de solo lectura
 * hacia la plataforma comercial (ver accesosSync.service.ts) usen un único
 * merge y no se desincronicen.
 */

export interface AsesorEstaticoRaw {
  nombre: string;
  correo: string;
  estado?: string;
  jira?: boolean;
  slack?: boolean;
  sf?: boolean;
  tl?: boolean;
}

export interface GrupoEstaticoRaw {
  nombre: string;
  asesores: AsesorEstaticoRaw[];
}

export interface HojaEstaticaRaw {
  id: string;
  nombre: string;
  grupos: GrupoEstaticoRaw[];
}

export interface HojaExtraRaw {
  id: string;
  nombre: string;
}

export interface GrupoExtraRaw {
  id: string;
  hojaId: string;
  nombre: string;
}

export interface GrupoOcultoRaw {
  hojaId: string;
  nombre: string;
}

export interface MiembroExtraRaw {
  id?: string;
  hojaId: string;
  grupoNombre: string;
  nombre: string;
  correo: string;
  slack: boolean;
  jira: boolean;
  sf: boolean;
  estado: string;
}

export interface FusionDirectorioInput {
  hojasEstaticas: HojaEstaticaRaw[];
  hojasExtra: HojaExtraRaw[];
  gruposExtra: GrupoExtraRaw[];
  gruposOcultos: GrupoOcultoRaw[];
  miembrosExtra: MiembroExtraRaw[];
  edits: Record<string, string>;
}

export interface AsesorFusionado {
  correo: string;
  nombre: string;
  estado: string;
  jira: boolean;
  slack: boolean;
  sf: boolean;
  tl: boolean;
  eliminado: boolean;
  transferido: boolean;
  esDinamico: boolean;
  hojaId: string;
  hojaNombre: string;
  grupoNombre: string;
}

function estKey(correo: string, campo: string): string {
  return `${correo}||${campo}`;
}

function aplicarOverrides(
  a: AsesorEstaticoRaw | MiembroExtraRaw,
  edits: Record<string, string>,
  esDinamico: boolean,
  hojaId: string,
  hojaNombre: string,
  grupoNombre: string,
): AsesorFusionado {
  const correo = a.correo;
  const key = (campo: string) => estKey(correo, campo);
  return {
    correo,
    nombre: edits[key('nombre')] ?? a.nombre,
    estado: (edits[key('estado')] ?? a.estado ?? 'Activo').toLowerCase(),
    jira: (edits[key('jira')] ?? (a.jira ? 'true' : 'false')) === 'true',
    slack: (edits[key('slack')] ?? (a.slack ? 'true' : 'false')) === 'true',
    sf: (edits[key('sf')] ?? (a.sf ? 'true' : 'false')) === 'true',
    tl: 'tl' in a ? !!a.tl : false,
    eliminado: edits[key('eliminado')] === 'true',
    transferido: esDinamico ? false : edits[key('transferido')] === 'true',
    esDinamico,
    hojaId,
    hojaNombre,
    grupoNombre,
  };
}

export function fusionarDirectorio(input: FusionDirectorioInput): AsesorFusionado[] {
  const { hojasEstaticas, hojasExtra, gruposExtra, gruposOcultos, miembrosExtra, edits } = input;

  const todasHojas = [
    ...hojasEstaticas,
    ...hojasExtra.map((h) => ({ id: h.id, nombre: h.nombre, grupos: [] as GrupoEstaticoRaw[] })),
  ];

  const resultado: AsesorFusionado[] = [];

  for (const hoja of todasHojas) {
    const ocultoSet = new Set(
      gruposOcultos.filter((g) => g.hojaId === hoja.id).map((g) => g.nombre),
    );
    const gruposDinamicos = gruposExtra
      .filter((g) => g.hojaId === hoja.id)
      .map((g) => ({ nombre: g.nombre, asesores: [] as AsesorEstaticoRaw[] }));
    const grupos = [...hoja.grupos.filter((g) => !ocultoSet.has(g.nombre)), ...gruposDinamicos];

    for (const grupo of grupos) {
      for (const a of grupo.asesores) {
        resultado.push(aplicarOverrides(a, edits, false, hoja.id, hoja.nombre, grupo.nombre));
      }
      const extras = miembrosExtra.filter(
        (m) => m.hojaId === hoja.id && m.grupoNombre === grupo.nombre,
      );
      for (const m of extras) {
        resultado.push(aplicarOverrides(m, edits, true, hoja.id, hoja.nombre, grupo.nombre));
      }
    }
  }

  return resultado;
}
