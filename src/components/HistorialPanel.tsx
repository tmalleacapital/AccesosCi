'use client';

import { useMemo, useState } from 'react';
import type { HistorialEntry } from '@/lib/db';

const ETIQUETAS_CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  correo: 'Correo',
  estado: 'Estado',
  jira: 'Jira',
  slack: 'Hubix',
  sf: 'Nodia',
  fechaEliminacion: 'Fecha baja',
  comentario: 'Comentario',
  tl: 'Team Leader',
  mbp_bp: 'MBP / BP',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const fecha = new Intl.DateTimeFormat('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'America/Santiago',
    }).format(d);
    const hora = new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'America/Santiago',
    }).format(d);
    return `${fecha} ${hora}`;
  } catch {
    return iso;
  }
}

function formatValor(campo: string, valor: string | null): string {
  if (valor === null || valor === '') return '—';
  if (campo === 'jira' || campo === 'slack' || campo === 'tl') return valor === 'true' ? 'Sí' : 'No';
  if (campo === 'sf') return valor || '—';
  return valor;
}

export function HistorialPanel({ historial }: { historial: HistorialEntry[] }) {
  const [busqueda, setBusqueda] = useState('');

  const filtrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return historial;
    return historial.filter(
      (h) =>
        h.correo.toLowerCase().includes(q) ||
        h.usuarioEmail.toLowerCase().includes(q) ||
        (ETIQUETAS_CAMPO[h.campo] ?? h.campo).toLowerCase().includes(q),
    );
  }, [historial, busqueda]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filtrado.length} cambio{filtrado.length !== 1 ? 's' : ''} registrado
          {filtrado.length !== 1 ? 's' : ''}
        </p>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por correo, campo o usuario…"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-72"
        />
      </div>

      {filtrado.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {historial.length === 0 ? 'Aún no hay cambios registrados.' : `Sin resultados para «${busqueda}».`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="w-[22%] px-3 py-2 font-semibold text-foreground">Correo</th>
                <th className="w-[12%] px-3 py-2 font-semibold text-foreground">Campo</th>
                <th className="w-[24%] px-3 py-2 font-semibold text-foreground">Cambio</th>
                <th className="w-[15%] px-3 py-2 font-semibold text-foreground">Quién</th>
                <th className="w-[17%] whitespace-nowrap px-3 py-2 font-semibold text-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{h.correo}</td>
                  <td className="px-3 py-2 text-xs text-foreground">
                    {ETIQUETAS_CAMPO[h.campo] ?? h.campo}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {h.valorAnterior !== null ? (
                      <>
                        <span className="line-through opacity-60">
                          {formatValor(h.campo, h.valorAnterior)}
                        </span>
                        {' → '}
                        <span className="font-medium text-foreground">
                          {formatValor(h.campo, h.valorNuevo)}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">
                        {formatValor(h.campo, h.valorNuevo)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span title={h.usuarioEmail} className="text-xs text-muted-foreground">
                      {h.usuarioEmail.split('@')[0]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatTimestamp(h.creadoEn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
