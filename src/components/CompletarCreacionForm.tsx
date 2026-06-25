'use client';

import { useState, useMemo } from 'react';
import { cambiarEstadoAction } from '@/app/actions';
import correosData from '@/data/correos.json';
import type { GrupoExtra } from '@/lib/db';

interface AsesorRaw {
  estado: string;
  slack: boolean;
  jira: boolean;
}
interface GrupoRaw {
  nombre: string;
  asesores: AsesorRaw[];
}
interface HojaRaw {
  id: string;
  nombre: string;
  grupos: GrupoRaw[];
}

const data = correosData as { actualizado: string; hojas: HojaRaw[] };

interface BPOption {
  key: string;
  label: string;
  hojaLabel: string;
  usaSlack: boolean;
  usaJira: boolean;
  isDynamic: boolean;
}

function buildBPOptions(gruposExtra: GrupoExtra[]): BPOption[] {
  const options: BPOption[] = [];
  for (const hoja of data.hojas) {
    for (const grupo of hoja.grupos) {
      const activos = grupo.asesores.filter((a) => a.estado !== 'Eliminado');
      const total = activos.length || 1;
      options.push({
        key: `static::${hoja.id}::${grupo.nombre}`,
        label: grupo.nombre,
        hojaLabel: hoja.nombre.replace(/^MBP\s+/, ''),
        usaSlack: activos.filter((a) => a.slack).length / total > 0.4,
        usaJira: activos.some((a) => a.jira),
        isDynamic: false,
      });
    }
  }
  for (const g of gruposExtra) {
    options.push({
      key: `dynamic::${g.id}`,
      label: g.nombre,
      hojaLabel: 'Dinámico',
      usaSlack: false,
      usaJira: false,
      isDynamic: true,
    });
  }
  return options;
}

export function CompletarCreacionForm({
  id,
  gruposExtra = [],
  tieneSalesforce = false,
}: {
  id: string;
  gruposExtra?: GrupoExtra[];
  tieneSalesforce?: boolean;
}) {
  const [bpKey, setBpKey] = useState('');
  const bpOptions = useMemo(() => buildBPOptions(gruposExtra), [gruposExtra]);
  const selectedBP = bpOptions.find((bp) => bp.key === bpKey);

  const bpHojaId = useMemo(() => {
    if (!bpKey) return '';
    if (bpKey.startsWith('static::')) return bpKey.split('::')[1] ?? '';
    if (bpKey.startsWith('dynamic::')) {
      const dynamicId = bpKey.slice('dynamic::'.length);
      return gruposExtra.find((g) => g.id === dynamicId)?.hojaId ?? '';
    }
    return '';
  }, [bpKey, gruposExtra]);

  const bpGrupoNombre = selectedBP?.label ?? '';

  return (
    <form action={cambiarEstadoAction}>
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="estado"
        value={tieneSalesforce ? 'esperando_salesforce' : 'completada'}
      />
      <input type="hidden" name="bpHojaId" value={bpHojaId} />
      <input type="hidden" name="bpGrupoNombre" value={bpGrupoNombre} />
      <input type="hidden" name="bpSlack" value={String(selectedBP?.usaSlack ?? false)} />
      <input type="hidden" name="bpJira" value={String(selectedBP?.usaJira ?? false)} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`correo-${id}`} className="block text-[11px] text-muted-foreground mb-1">
            Correo creado
          </label>
          <input
            id={`correo-${id}`}
            name="correoCorporativoAsignado"
            type="email"
            required
            placeholder="usuario@capitalinteligente.cl"
            className="w-60 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-sky-400 dark:focus:border-sky-600"
          />
        </div>

        <div>
          <label
            htmlFor={`password-${id}`}
            className="block text-[11px] text-muted-foreground mb-1"
          >
            Contraseña
          </label>
          <input
            id={`password-${id}`}
            name="passwordCorreo"
            type="text"
            required
            placeholder="Contraseña del correo"
            className="w-44 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-sky-400 dark:focus:border-sky-600"
          />
        </div>

        <div>
          <label htmlFor={`bp-${id}`} className="block text-[11px] text-muted-foreground mb-1">
            BP asignado
          </label>
          <select
            id={`bp-${id}`}
            value={bpKey}
            onChange={(e) => setBpKey(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-sky-400 dark:focus:border-sky-600 max-w-[200px]"
          >
            <option value="">Seleccionar BP…</option>
            {bpOptions.map((bp) => (
              <option key={bp.key} value={bp.key}>
                {bp.hojaLabel} · {bp.label}
              </option>
            ))}
          </select>
        </div>

        {selectedBP && !selectedBP.isDynamic && (
          <div className="flex items-center gap-1.5 self-end pb-[7px]">
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                selectedBP.usaSlack
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'border-border bg-muted text-muted-foreground/50 line-through'
              }`}
            >
              Slack
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                selectedBP.usaJira
                  ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400'
                  : 'border-border bg-muted text-muted-foreground/50 line-through'
              }`}
            >
              Jira
            </span>
          </div>
        )}

        <button
          type="submit"
          className="self-end rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
        >
          {tieneSalesforce ? 'Completar paso 1 (correo)' : 'Completar'}
        </button>
      </div>
    </form>
  );
}
