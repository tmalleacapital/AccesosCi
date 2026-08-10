import 'server-only';
import correosData from '@/data/correos.json';
import {
  leerEdicionesCorreos,
  leerGruposExtra,
  leerGruposOcultos,
  leerHojasExtra,
  leerMiembrosExtra,
  leerUsuarios,
} from '@/lib/db';
import { fusionarDirectorio, type HojaEstaticaRaw } from '@/lib/services/directorio.service';
import { construirRosterAccesos, type RosterEntryAccesos } from '@/lib/services/accesosSync.service';

const hojasEstaticas = (correosData as { hojas: HojaEstaticaRaw[] }).hojas;

/**
 * Roster completo de asesores (estático + dinámico + overrides) para
 * consumo de solo lectura por la plataforma comercial. Ver sección 1-2 del
 * plan de integración: id estable = correo, nombre, email, rol, a quién
 * reporta, estado.
 */
export async function obtenerRosterAccesos(): Promise<RosterEntryAccesos[]> {
  const [edits, gruposExtra, gruposOcultos, hojasExtra, miembrosExtra, usuarios] =
    await Promise.all([
      leerEdicionesCorreos(),
      leerGruposExtra(),
      leerGruposOcultos(),
      leerHojasExtra(),
      leerMiembrosExtra(),
      leerUsuarios(),
    ]);

  // Este export es exclusivo de Capital Inteligente (ver ADR 001); Capital
  // Prime y cualquier otra empresa futura quedan fuera hasta que se decida
  // explícitamente extender la integración.
  const hojasExtraCapitalInteligente = hojasExtra.filter(
    (h) => h.empresa === 'capital_inteligente',
  );

  const asesores = fusionarDirectorio({
    hojasEstaticas,
    hojasExtra: hojasExtraCapitalInteligente,
    gruposExtra,
    gruposOcultos,
    miembrosExtra,
    edits,
  });

  const usuariosBp = usuarios.map((u) => ({ email: u.email, rol: u.rol }));
  return construirRosterAccesos(asesores, usuariosBp);
}
