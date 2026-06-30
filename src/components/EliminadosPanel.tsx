'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';
import correosData from '@/data/correos.json';
import { restaurarCorreoAction } from '@/app/actions';
import type { MiembroExtra } from '@/lib/db';

interface Asesor {
  nombre: string;
  correo: string;
}
interface Grupo {
  nombre: string;
  asesores: Asesor[];
}
interface Hoja {
  id: string;
  nombre: string;
  grupos: Grupo[];
}

const data = correosData as { actualizado: string; hojas: Hoja[] };

function estKey(correo: string, campo: string) {
  return `${correo}||${campo}`;
}

function formatTimestamp(iso: string): string {
  if (!iso || iso === '—') return '—';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

interface EliminadoInfo {
  correo: string;
  nombre: string;
  hoja: string;
  grupo: string;
  por: string;
  en: string;
}

function buildEliminados(
  edits: Record<string, string>,
  miembrosExtra: MiembroExtra[],
): EliminadoInfo[] {
  const result: EliminadoInfo[] = [];

  for (const hoja of data.hojas) {
    for (const grupo of hoja.grupos) {
      for (const asesor of grupo.asesores) {
        if (edits[estKey(asesor.correo, 'eliminado')] === 'true') {
          result.push({
            correo: asesor.correo,
            nombre: edits[estKey(asesor.correo, 'nombre')] ?? asesor.nombre,
            hoja: hoja.nombre.replace(/^MBP\s+/, ''),
            grupo: grupo.nombre,
            por: edits[estKey(asesor.correo, 'eliminado_por')] ?? '—',
            en: edits[estKey(asesor.correo, 'eliminado_en')] ?? '—',
          });
        }
      }
    }
  }

  for (const m of miembrosExtra) {
    if (edits[estKey(m.correo, 'eliminado')] === 'true') {
      result.push({
        correo: m.correo,
        nombre: edits[estKey(m.correo, 'nombre')] ?? m.nombre,
        hoja: m.hojaId,
        grupo: m.grupoNombre,
        por: edits[estKey(m.correo, 'eliminado_por')] ?? '—',
        en: edits[estKey(m.correo, 'eliminado_en')] ?? '—',
      });
    }
  }

  const vistos = new Set<string>();
  return result
    .filter((e) => {
      if (vistos.has(e.correo)) return false;
      vistos.add(e.correo);
      return true;
    })
    .sort((a, b) => b.en.localeCompare(a.en));
}

export function EliminadosPanel({
  edits: editsInicial,
  esAdmin,
  miembrosExtra = [],
}: {
  edits: Record<string, string>;
  esAdmin: boolean;
  miembrosExtra?: MiembroExtra[];
}) {
  const [edits, actualizarEdits] = useOptimistic(
    editsInicial,
    (prev, update: { key: string; valor: string }) => ({ ...prev, [update.key]: update.valor }),
  );
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const eliminados = useMemo(() => buildEliminados(edits, miembrosExtra), [edits, miembrosExtra]);

  function handleRestaurar(correo: string) {
    if (restaurando) return;
    setRestaurando(correo);
    startTransition(() => {
      actualizarEdits({ key: estKey(correo, 'eliminado'), valor: 'false' });
      restaurarCorreoAction(correo).finally(() => setRestaurando(null));
    });
  }

  if (eliminados.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No hay correos eliminados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {eliminados.length} correo{eliminados.length !== 1 ? 's' : ''} eliminado
        {eliminados.length !== 1 ? 's' : ''}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="w-[42%] px-3 py-2 font-semibold text-foreground">Nombre / Correo</th>
              <th className="w-[18%] px-3 py-2 font-semibold text-foreground">Equipo</th>
              <th className="w-[13%] px-3 py-2 font-semibold text-foreground">Eliminado por</th>
              <th className="w-[17%] whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                Fecha
              </th>
              {esAdmin && <th className="w-[10%] px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {eliminados.map((e) => (
              <tr key={e.correo} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{e.nombre}</div>
                  <div className="font-mono text-xs text-muted-foreground">{e.correo}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs text-muted-foreground">{e.grupo}</div>
                  <div className="text-xs text-muted-foreground/60">{e.hoja}</div>
                </td>
                <td className="px-3 py-2">
                  <span title={e.por} className="text-xs text-muted-foreground">
                    {e.por.split('@')[0]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(e.en)}
                </td>
                {esAdmin && (
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={restaurando === e.correo}
                      onClick={() => handleRestaurar(e.correo)}
                      className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      {restaurando === e.correo && (
                        <svg
                          aria-hidden="true"
                          className="h-3 w-3 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      )}
                      {restaurando === e.correo ? 'Restaurando…' : 'Restaurar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
