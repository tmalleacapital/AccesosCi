'use client';

import { startTransition, useMemo, useOptimistic } from 'react';
import correosData from '@/data/correos.json';
import { restaurarCorreoAction } from '@/app/actions';

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

function buildEliminados(edits: Record<string, string>): EliminadoInfo[] {
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
  return result.sort((a, b) => b.en.localeCompare(a.en));
}

export function EliminadosPanel({
  edits: editsInicial,
  esAdmin,
}: {
  edits: Record<string, string>;
  esAdmin: boolean;
}) {
  const [edits, actualizarEdits] = useOptimistic(
    editsInicial,
    (prev, update: { key: string; valor: string }) => ({ ...prev, [update.key]: update.valor }),
  );

  const eliminados = useMemo(() => buildEliminados(edits), [edits]);

  function handleRestaurar(correo: string) {
    startTransition(() => {
      actualizarEdits({ key: estKey(correo, 'eliminado'), valor: 'false' });
      restaurarCorreoAction(correo);
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
      <div className="rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="w-[20%] px-3 py-2 font-semibold text-foreground">Nombre</th>
              <th className="w-[26%] px-3 py-2 font-semibold text-foreground">Correo</th>
              <th className="w-[18%] px-3 py-2 font-semibold text-foreground">Equipo</th>
              <th className="w-[20%] px-3 py-2 font-semibold text-foreground">Eliminado por</th>
              <th className="w-[130px] whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                Fecha
              </th>
              {esAdmin && <th className="w-[90px] px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {eliminados.map((e) => (
              <tr key={e.correo} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 text-foreground">{e.nombre}</td>
                <td className="max-w-0 px-3 py-2">
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {e.correo}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs text-muted-foreground">{e.grupo}</div>
                  <div className="text-xs text-muted-foreground/60">{e.hoja}</div>
                </td>
                <td className="max-w-0 px-3 py-2">
                  <span className="block truncate text-xs text-muted-foreground">{e.por}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {formatTimestamp(e.en)}
                </td>
                {esAdmin && (
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRestaurar(e.correo)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      Restaurar
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
