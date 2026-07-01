'use client';

import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import correosData from '@/data/correos.json';
import {
  crearGrupoAction,
  crearHojaAction,
  editarCorreoAction,
  eliminarCorreoAction,
  eliminarGrupoAction,
  ocultarGrupoAction,
  transferirCorreoAction,
} from '@/app/actions';
import type { GrupoExtra, HojaExtra, MiembroExtra } from '@/lib/db';
import { PRECIOS } from '@/lib/precios';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/lib/buttonStyles';

interface Asesor {
  nombre: string;
  correo: string;
  estado: string;
  jira: boolean;
  slack: boolean;
  sf: string;
  tl: boolean;
  fechaEliminacion?: string;
  comentario?: string;
  esDinamico?: boolean;
}

interface Grupo {
  nombre: string;
  asesores: Asesor[];
  metricas: { label: string; valor: number }[];
}

interface Hoja {
  id: string;
  nombre: string;
  grupos: Grupo[];
}

const data = correosData as { actualizado: string; hojas: Hoja[] };

function etiquetaHoja(nombre: string): string {
  return nombre.replace(/^MBP\s+/, '');
}

function formatFecha(raw: string): string {
  if (!raw || raw === '—') return '—';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
}

function formatFechaChile(iso: string): string {
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
    return formatFecha(iso);
  }
}

function estKey(correo: string, campo: string) {
  return `${correo}||${campo}`;
}

function metricaKey(grupoNombre: string, label: string) {
  return `__metrica__:${grupoNombre}||${label}`;
}

// ─── Exportación XLSX (vía API route — exceljs corre en servidor) ────────────

function fechaDescarga(): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(new Date()).replace(/\//g, '-');
}

function filtrarEdits(correos: string[], edits: Record<string, string>): Record<string, string> {
  const set = new Set(correos);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(edits)) {
    const correo = k.split('||')[0];
    if (set.has(correo)) out[k] = v;
  }
  return out;
}

async function exportarGrupoXlsx(
  grupo: Grupo,
  edits: Record<string, string>,
  eliminadas: Set<string>,
) {
  const editsFiltrados = filtrarEdits(grupo.asesores.map((a) => a.correo), edits);

  const res = await fetch('/api/export-xlsx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grupoNombre: grupo.nombre,
      asesores: grupo.asesores,
      edits: editsFiltrados,
      eliminadas: [...eliminadas],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    alert(`Error al generar el archivo: ${errBody.error ?? res.status}`);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${grupo.nombre} ${fechaDescarga()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarHojaXlsx(
  hoja: { id: string; nombre: string; grupos: Grupo[] },
  gruposExtra: GrupoExtra[],
  gruposOcultos: { hojaId: string; nombre: string }[],
  miembrosExtra: MiembroExtra[],
  edits: Record<string, string>,
  eliminadas: Set<string>,
  etiqueta: string,
) {
  const ocultos = new Set(
    gruposOcultos.filter((g) => g.hojaId === hoja.id).map((g) => g.nombre),
  );

  const gruposDin = gruposExtra
    .filter((g) => g.hojaId === hoja.id)
    .map((g) => ({ nombre: g.nombre, asesores: [] as Grupo['asesores'] }));

  const todosGrupos = [...hoja.grupos.filter((g) => !ocultos.has(g.nombre)), ...gruposDin].map(
    (g) => {
      const extras = miembrosExtra
        .filter((m) => m.hojaId === hoja.id && m.grupoNombre === g.nombre)
        .map((m) => ({
          nombre: m.nombre,
          correo: m.correo,
          estado: m.estado,
          jira: m.jira,
          slack: m.slack,
          sf: m.sf,
          tl: false as boolean,
          fechaEliminacion: undefined as string | undefined,
          esDinamico: true,
        }));
      return extras.length > 0 ? { ...g, asesores: [...g.asesores, ...extras] } : g;
    },
  );

  const todosCorreos = todosGrupos.flatMap((g) => g.asesores.map((a) => a.correo));
  const editsFiltrados = filtrarEdits(todosCorreos, edits);

  const res = await fetch('/api/export-mbp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hojaLabel: etiqueta,
      grupos: todosGrupos.map((g) => ({ grupoNombre: g.nombre, asesores: g.asesores })),
      edits: editsFiltrados,
      eliminadas: [...eliminadas],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    alert(`Error al generar el archivo: ${errBody.error ?? res.status}`);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${etiqueta} ${fechaDescarga()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarTodosMbpXlsx(
  hojas: Hoja[],
  gruposExtra: GrupoExtra[],
  gruposOcultos: { hojaId: string; nombre: string }[],
  miembrosExtra: MiembroExtra[],
  edits: Record<string, string>,
  eliminadas: Set<string>,
) {
  const hojasPayload = hojas.map((hoja) => {
    const ocultos = new Set(
      gruposOcultos.filter((g) => g.hojaId === hoja.id).map((g) => g.nombre),
    );

    const gruposDin = gruposExtra
      .filter((g) => g.hojaId === hoja.id)
      .map((g) => ({ nombre: g.nombre, asesores: [] as Grupo['asesores'] }));

    const todosGrupos = [...hoja.grupos.filter((g) => !ocultos.has(g.nombre)), ...gruposDin].map(
      (g) => {
        const extras = miembrosExtra
          .filter((m) => m.hojaId === hoja.id && m.grupoNombre === g.nombre)
          .map((m) => ({
            nombre: m.nombre,
            correo: m.correo,
            estado: m.estado,
            jira: m.jira,
            slack: m.slack,
            sf: m.sf,
            tl: false as boolean,
            fechaEliminacion: undefined as string | undefined,
            esDinamico: true,
          }));
        return extras.length > 0 ? { ...g, asesores: [...g.asesores, ...extras] } : g;
      },
    );

    return { hojaLabel: etiquetaHoja(hoja.nombre), grupos: todosGrupos };
  });

  const todosCorreos = hojasPayload.flatMap((h) => h.grupos.flatMap((g) => g.asesores.map((a) => a.correo)));
  const editsFiltrados = filtrarEdits(todosCorreos, edits);

  const res = await fetch('/api/export-todos-mbp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hojas: hojasPayload.map((h) => ({
        hojaLabel: h.hojaLabel,
        grupos: h.grupos.map((g) => ({ grupoNombre: g.nombre, asesores: g.asesores })),
      })),
      edits: editsFiltrados,
      eliminadas: [...eliminadas],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    alert(`Error al generar el archivo: ${errBody.error ?? res.status}`);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Todos los MBP ${fechaDescarga()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Spinner de carga ─────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Celda editable (texto / select) ────────────────────────────────────────

function CeldaTexto({
  valor,
  onSave,
  className,
}: {
  valor: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(valor);
  const ref = useRef<HTMLInputElement>(null);

  function iniciar() {
    setDraft(valor);
    setEditando(true);
    setTimeout(() => ref.current?.select(), 0);
  }

  function confirmar() {
    setEditando(false);
    if (draft.trim() !== valor) onSave(draft.trim());
  }

  if (!editando) {
    return (
      <span
        role="button"
        tabIndex={0}
        title="Clic para editar"
        onClick={iniciar}
        onKeyDown={(e) => e.key === 'Enter' && iniciar()}
        className={cn(
          'cursor-pointer rounded px-0.5 hover:bg-muted/60 hover:underline hover:decoration-dotted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          className,
        )}
      >
        {valor || <em className="text-muted-foreground/50">—</em>}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirmar();
        if (e.key === 'Escape') setEditando(false);
      }}
      className="w-full rounded border border-primary bg-background px-1 py-0.5 text-sm text-foreground outline-none ring-1 ring-primary/50"
    />
  );
}

function toIsoDate(raw: string): string {
  if (!raw || raw === '—') return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}

/** Inserta los '-' automáticamente mientras se escribe: "16062026" → "16-06-2026". */
function autoFormatFechaInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/** Acepta "16-06-2026" o "16/06/2026" y devuelve ISO (YYYY-MM-DD), o null si no es una fecha válida. */
function parseFechaInput(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getUTCDate() !== Number(dd) || d.getUTCMonth() + 1 !== Number(mm)) {
    return null;
  }
  return iso;
}

function CeldaFecha({
  valor,
  onSave,
  className,
}: {
  valor: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  function iniciar() {
    const f = formatFecha(valor);
    setDraft(f === '—' ? '' : f);
    setEditando(true);
    setTimeout(() => ref.current?.select(), 0);
  }

  function confirmar() {
    if (!draft.trim()) {
      setEditando(false);
      if (toIsoDate(valor) !== '') onSave('');
      return;
    }
    const parsed = parseFechaInput(draft);
    if (parsed === null) {
      alert('Fecha inválida. Usa el formato DD-MM-AAAA (ej: 16-06-2026).');
      setTimeout(() => ref.current?.focus(), 0);
      return;
    }
    setEditando(false);
    if (parsed !== toIsoDate(valor)) onSave(parsed);
  }

  if (!editando) {
    return (
      <span
        role="button"
        tabIndex={0}
        title="Clic para editar"
        onClick={iniciar}
        onKeyDown={(e) => e.key === 'Enter' && iniciar()}
        className={cn(
          'cursor-pointer rounded px-0.5 hover:bg-muted/60 hover:underline hover:decoration-dotted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          className,
        )}
      >
        {formatFecha(valor) === '—' ? <em className="text-muted-foreground/50">—</em> : formatFecha(valor)}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      value={draft}
      autoFocus
      placeholder="DD-MM-AAAA"
      onChange={(e) => setDraft(autoFormatFechaInput(e.target.value))}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') confirmar();
        if (e.key === 'Escape') setEditando(false);
      }}
      className="w-full rounded border border-primary bg-background px-1 py-0.5 text-xs text-foreground outline-none ring-1 ring-primary/50"
    />
  );
}

function CeldaSelect({
  valor,
  opciones,
  onSave,
}: {
  valor: string;
  opciones: string[];
  onSave: (v: string) => void;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onSave(e.target.value)}
      className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
    >
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o || '—'}
        </option>
      ))}
    </select>
  );
}

// ─── Badge estado ────────────────────────────────────────────────────────────

function EstadoBadge({ estado, onSave }: { estado: string; onSave: (v: string) => void }) {
  const activo = estado.toLowerCase() === 'activo';
  return (
    <select
      value={estado}
      onChange={(e) => onSave(e.target.value)}
      className={cn(
        'cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50',
        activo
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
      )}
    >
      <option value="Activo">Activo</option>
      <option value="Eliminado">Eliminado</option>
    </select>
  );
}

// ─── Toggle booleano ─────────────────────────────────────────────────────────

function ToggleBool({ valor, onToggle }: { valor: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={valor ? 'Sí — clic para quitar' : 'No — clic para agregar'}
      aria-label={valor ? 'Sí — clic para quitar' : 'No — clic para agregar'}
      aria-pressed={valor}
      className="rounded text-base leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {valor ? (
        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
      ) : (
        <span className="text-muted-foreground/40 hover:text-muted-foreground">—</span>
      )}
    </button>
  );
}

// ─── Modal de confirmación ───────────────────────────────────────────────────

function ConfirmModal({
  nombre,
  onConfirmar,
  onCancelar,
}: {
  nombre: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-xs space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">¿Eliminar asesor?</h2>
          <p className="text-sm text-muted-foreground">
            Se eliminará a <strong className="text-foreground">{nombre}</strong> de la lista.
            Tendrás unos segundos para deshacer la acción.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className={BTN_SECONDARY}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className={BTN_DANGER}>
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast de deshacer ────────────────────────────────────────────────────────

const UNDO_MS = 6000;

function UndoToast({ nombre, onDeshacer }: { nombre: string; onDeshacer: () => void }) {
  const [anchoPct, setAnchoPct] = useState(100);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnchoPct(0));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-foreground">
          <strong>{nombre}</strong> eliminado
        </p>
        <button
          type="button"
          onClick={onDeshacer}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Deshacer
        </button>
      </div>
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary"
          style={{
            width: `${anchoPct}%`,
            transition: `width ${UNDO_MS}ms linear`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Fila de asesor ──────────────────────────────────────────────────────────

interface TransferirDatos {
  correo: string;
  nombre: string;
  slack: boolean;
  jira: boolean;
  sf: string;
  estado: string;
  esDinamico: boolean;
}

function FilaAsesor({
  asesor,
  columnas,
  edits,
  onEdit,
  onEliminar,
  onTransferir,
  soloLectura = false,
  esAdmin = false,
}: {
  asesor: Asesor;
  columnas: { jira: boolean; slack: boolean; sf: boolean; fecha: boolean };
  edits: Record<string, string>;
  onEdit: (campo: string, valor: string) => void;
  onEliminar: () => void;
  onTransferir: (datos: TransferirDatos) => void;
  soloLectura?: boolean;
  esAdmin?: boolean;
}) {
  const orig = asesor.correo;

  function val(campo: keyof Asesor): string {
    const override = edits[estKey(orig, campo)];
    if (override !== undefined) return override;
    const v = asesor[campo];
    return typeof v === 'boolean' ? (v ? 'true' : 'false') : (v ?? '');
  }

  const nombre = val('nombre');
  const correo = val('correo');
  const estado = val('estado');
  const jira = val('jira') === 'true';
  const slack = val('slack') === 'true';
  const sf = val('sf');
  const tl = val('tl') === 'true';
  const fecha = val('fechaEliminacion');

  const estadoActivo = (estado || 'Activo').toLowerCase() === 'activo';

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/20">
      {/* Nombre */}
      <td className="px-3 py-2 text-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          {soloLectura ? (
            <span className="truncate">{nombre}</span>
          ) : (
            <CeldaTexto valor={nombre} onSave={(v) => onEdit('nombre', v)} className="truncate" />
          )}
          {tl &&
            (soloLectura ? (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                T.L
              </span>
            ) : (
              <button
                type="button"
                title="Team Leader — clic para quitar"
                aria-label="Quitar marca de Team Leader"
                onClick={() => onEdit('tl', 'false')}
                className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:bg-amber-950 dark:text-amber-400"
              >
                T.L
              </button>
            ))}
          {!tl && !soloLectura && (
            <button
              type="button"
              title="Marcar como Team Leader"
              aria-label="Marcar como Team Leader"
              onClick={() => onEdit('tl', 'true')}
              className="hidden rounded px-1 py-0.5 text-[10px] text-muted-foreground/30 hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:inline"
            >
              T.L
            </button>
          )}
        </div>
      </td>

      {/* Correo */}
      <td className="max-w-0 px-3 py-2">
        {soloLectura ? (
          <span className="block truncate font-mono text-xs text-muted-foreground">{correo}</span>
        ) : (
          <CeldaTexto
            valor={correo}
            onSave={(v) => onEdit('correo', v)}
            className="block truncate font-mono text-xs text-muted-foreground"
          />
        )}
      </td>

      {/* Estado */}
      <td className="px-3 py-2">
        {soloLectura ? (
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium',
              estadoActivo
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
            )}
          >
            {estado || 'Activo'}
          </span>
        ) : (
          <EstadoBadge estado={estado || 'Activo'} onSave={(v) => onEdit('estado', v)} />
        )}
      </td>

      {/* Jira */}
      {columnas.jira && (
        <td className="px-3 py-2 text-center">
          {soloLectura ? (
            <span className="text-base leading-none">
              {jira ? (
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </span>
          ) : (
            <ToggleBool valor={jira} onToggle={() => onEdit('jira', jira ? 'false' : 'true')} />
          )}
        </td>
      )}

      {/* Slack */}
      {columnas.slack && (
        <td className="px-3 py-2 text-center">
          {soloLectura ? (
            <span className="text-base leading-none">
              {slack ? (
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </span>
          ) : (
            <ToggleBool valor={slack} onToggle={() => onEdit('slack', slack ? 'false' : 'true')} />
          )}
        </td>
      )}

      {/* Salesforce */}
      {columnas.sf && (
        <td className="px-3 py-2">
          {soloLectura ? (
            <span className="text-xs text-muted-foreground">{sf || '—'}</span>
          ) : (
            <CeldaSelect
              valor={sf}
              opciones={['', 'Portal', 'Cloud']}
              onSave={(v) => onEdit('sf', v)}
            />
          )}
        </td>
      )}

      {/* Fecha baja */}
      {columnas.fecha && (
        <td className="whitespace-nowrap px-3 py-2">
          {soloLectura ? (
            <span className="text-xs text-muted-foreground">{formatFecha(fecha)}</span>
          ) : (
            <CeldaFecha
              valor={fecha}
              onSave={(v) => onEdit('fechaEliminacion', v)}
              className="text-xs text-muted-foreground"
            />
          )}
        </td>
      )}

      {/* Comentario — solo admin */}
      {esAdmin && (
        <td className="px-3 py-2">
          <CeldaTexto
            valor={val('comentario')}
            onSave={(v) => onEdit('comentario', v)}
            className="text-xs text-muted-foreground"
          />
        </td>
      )}

      {/* Acciones */}
      {!soloLectura && (
        <td className="px-1 py-2 text-center">
          <div className="flex items-center justify-center gap-0.5">
            <button
              type="button"
              title="Transferir a otro BP"
              aria-label={`Transferir a ${nombre} a otro BP`}
              onClick={() =>
                onTransferir({
                  correo: orig,
                  nombre,
                  slack,
                  jira,
                  sf,
                  estado,
                  esDinamico: !!asesor.esDinamico,
                })
              }
              className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-sky-50 hover:text-sky-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:opacity-100 dark:hover:bg-sky-950/40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              title="Eliminar asesor"
              aria-label={`Eliminar a ${nombre}`}
              onClick={onEliminar}
              className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover:opacity-100 dark:hover:bg-rose-950/40"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── Tabla de grupo ──────────────────────────────────────────────────────────

function calcularMetricasDinamicas(
  grupo: Grupo,
  edits: Record<string, string>,
  eliminadas: Set<string>,
): { label: string; valor: number }[] {
  const asesores = grupo.asesores
    .filter(
      (a) =>
        !eliminadas.has(a.correo) &&
        edits[estKey(a.correo, 'eliminado')] !== 'true' &&
        (a.esDinamico || edits[estKey(a.correo, 'transferido')] !== 'true'),
    )
    .map((a) => ({
      sf: (edits[estKey(a.correo, 'sf')] ?? a.sf ?? '').trim(),
      estado: (edits[estKey(a.correo, 'estado')] ?? a.estado ?? 'Activo').toLowerCase(),
    }));

  const portalActivo = asesores.filter((a) => a.sf === 'Portal' && a.estado === 'activo').length;
  const salesCloud = asesores.filter((a) => a.sf === 'Cloud' && a.estado === 'activo').length;

  const rawPortalActivo = edits[metricaKey(grupo.nombre, 'Cuentas Portal Activo')];
  const portalActivoFinal =
    rawPortalActivo !== undefined ? parseInt(rawPortalActivo, 10) : portalActivo;

  const jsonBaseline =
    grupo.metricas.find((m) => m.label === 'Cuentas Portal Creadas')?.valor ?? portalActivo;
  const rawBaseline = edits[metricaKey(grupo.nombre, 'Cuentas Portal Creadas')];
  const portalCreadas =
    rawBaseline !== undefined
      ? Math.max(parseInt(rawBaseline, 10), portalActivo)
      : Math.max(jsonBaseline, portalActivo);

  const rawSalesCloud = edits[metricaKey(grupo.nombre, 'Cuentas SalesCloud')];
  const salesCloudFinal = rawSalesCloud !== undefined ? parseInt(rawSalesCloud, 10) : salesCloud;

  return [
    { label: 'Cuentas Portal Activo', valor: portalActivoFinal },
    { label: 'Cuentas Portal Creadas', valor: portalCreadas },
    { label: 'Cuentas SalesCloud', valor: salesCloudFinal },
  ];
}

// ─── Dashboard de costos (BP) ──────────────────────────────────────────────────

function calcularResumenCostos(grupos: Grupo[], edits: Record<string, string>, eliminadas: Set<string>) {
  let countGoogle = 0;
  let countJira = 0;
  let countSlack = 0;
  let countSfCloud = 0;
  let countSfPortal = 0;

  for (const g of grupos) {
    for (const a of g.asesores) {
      if (eliminadas.has(a.correo)) continue;
      if (edits[estKey(a.correo, 'eliminado')] === 'true') continue;
      if (!a.esDinamico && edits[estKey(a.correo, 'transferido')] === 'true') continue;

      countGoogle++;
      const jira = (edits[estKey(a.correo, 'jira')] ?? (a.jira ? 'true' : 'false')) === 'true';
      const slack = (edits[estKey(a.correo, 'slack')] ?? (a.slack ? 'true' : 'false')) === 'true';
      const sf = (edits[estKey(a.correo, 'sf')] ?? a.sf ?? '').trim();
      if (jira) countJira++;
      if (slack) countSlack++;
      if (sf === 'Cloud') countSfCloud++;
      if (sf === 'Portal') countSfPortal++;
    }
  }

  const plataformas = [
    { label: 'Google Workspace', count: countGoogle, precio: PRECIOS.google },
    { label: 'Jira', count: countJira, precio: PRECIOS.jira },
    { label: 'Slack', count: countSlack, precio: PRECIOS.slack },
    { label: 'Salesforce Cloud', count: countSfCloud, precio: PRECIOS.sfCloud },
    { label: 'Salesforce Portal', count: countSfPortal, precio: PRECIOS.sfPortal },
  ].map((p) => ({ ...p, subtotal: p.count * p.precio }));

  const total = plataformas.reduce((n, p) => n + p.subtotal, 0);
  return { plataformas, total };
}

function formatUsd(n: number): string {
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function ResumenCostos({
  grupos,
  edits,
  eliminadas,
}: {
  grupos: Grupo[];
  edits: Record<string, string>;
  eliminadas: Set<string>;
}) {
  const { plataformas, total } = useMemo(
    () => calcularResumenCostos(grupos, edits, eliminadas),
    [grupos, edits, eliminadas],
  );
  const max = Math.max(...plataformas.map((p) => p.subtotal), 1);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Desglose de cobros mensuales</h3>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total mensual</p>
          <p className="text-lg font-bold text-foreground">{formatUsd(total)}</p>
        </div>
      </div>
      <div className="space-y-2">
        {plataformas.map((p) => (
          <div key={p.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">
                {p.label}{' '}
                <span className="text-muted-foreground">
                  ({p.count} × {formatUsd(p.precio)})
                </span>
              </span>
              <span className="font-medium text-foreground">{formatUsd(p.subtotal)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${p.subtotal === 0 ? 0 : Math.max((p.subtotal / max) * 100, 3)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Número editable en badge ─────────────────────────────────────────────────

function BadgeNumeroEditable({
  label,
  valor,
  onSave,
}: {
  label: string;
  valor: number;
  onSave: (v: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(String(valor));
  const ref = useRef<HTMLInputElement>(null);

  function iniciar() {
    setDraft(String(valor));
    setEditando(true);
    setTimeout(() => ref.current?.select(), 0);
  }

  function confirmar() {
    setEditando(false);
    const num = parseInt(draft, 10);
    if (!isNaN(num) && num !== valor) onSave(num);
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400">
      {label}:{' '}
      {editando ? (
        <input
          ref={ref}
          type="number"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar();
            if (e.key === 'Escape') setEditando(false);
          }}
          className="w-10 rounded border border-sky-400 bg-sky-50 px-1 text-center text-xs font-bold text-sky-700 outline-none dark:bg-sky-950 dark:text-sky-400"
        />
      ) : (
        <strong
          role="button"
          tabIndex={0}
          title="Clic para editar"
          aria-label={`${label}: ${valor}. Clic para editar`}
          onClick={iniciar}
          onKeyDown={(e) => e.key === 'Enter' && iniciar()}
          className="cursor-pointer rounded hover:underline hover:decoration-dotted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {valor}
        </strong>
      )}
    </span>
  );
}

function TablaGrupo({
  grupo,
  columnas,
  edits,
  eliminadas,
  onEdit,
  onEditMetrica,
  onEliminar,
  onTransferir,
  soloLectura = false,
  esAdmin = false,
}: {
  grupo: Grupo;
  columnas: { jira: boolean; slack: boolean; sf: boolean; fecha: boolean };
  edits: Record<string, string>;
  eliminadas: Set<string>;
  onEdit: (correoOrig: string, campo: string, valor: string) => void;
  onEditMetrica: (label: string, valor: number) => void;
  onEliminar: (correo: string, nombre: string) => void;
  onTransferir: (datos: TransferirDatos) => void;
  soloLectura?: boolean;
  esAdmin?: boolean;
}) {
  const [exportando, setExportando] = useState(false);
  const metricas = useMemo(
    () => calcularMetricasDinamicas(grupo, edits, eliminadas),
    [grupo, edits, eliminadas],
  );

  const asesoresVisibles = grupo.asesores.filter(
    (a) =>
      !eliminadas.has(a.correo) &&
      edits[estKey(a.correo, 'eliminado')] !== 'true' &&
      (a.esDinamico || edits[estKey(a.correo, 'transferido')] !== 'true'),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{grupo.nombre}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {asesoresVisibles.length}
        </span>
        {metricas.map((m) =>
          !soloLectura ? (
            <BadgeNumeroEditable
              key={m.label}
              label={m.label}
              valor={m.valor}
              onSave={(v) => onEditMetrica(m.label, v)}
            />
          ) : (
            <span
              key={m.label}
              className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400"
            >
              {m.label}: <strong>{m.valor}</strong>
            </span>
          ),
        )}
        <button
          type="button"
          title="Exportar a Excel"
          disabled={exportando}
          onClick={async () => {
            setExportando(true);
            try {
              await exportarGrupoXlsx(grupo, edits, eliminadas);
            } finally {
              setExportando(false);
            }
          }}
          className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          {exportando ? (
            <Spinner />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          )}
          {exportando ? 'Exportando…' : 'Exportar XLSX'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="w-[22%] px-3 py-2 font-semibold text-foreground">Nombre</th>
              <th className="px-3 py-2 font-semibold text-foreground">Correo</th>
              <th className="w-[108px] px-3 py-2 font-semibold text-foreground">Estado</th>
              {columnas.jira && (
                <th className="w-10 px-3 py-2 text-center font-semibold text-foreground">Jira</th>
              )}
              {columnas.slack && (
                <th className="w-10 px-3 py-2 text-center font-semibold text-foreground">Slack</th>
              )}
              {columnas.sf && (
                <th className="w-[95px] px-3 py-2 font-semibold text-foreground">Salesforce</th>
              )}
              {columnas.fecha && (
                <th className="w-[130px] whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                  Fecha baja
                </th>
              )}
              {esAdmin && <th className="px-3 py-2 font-semibold text-foreground">Comentario</th>}
              {!soloLectura && <th className="w-16" />}
            </tr>
          </thead>
          <tbody>
            {asesoresVisibles.map((a, i) => (
              <FilaAsesor
                key={`${a.correo}-${i}`}
                asesor={a}
                columnas={columnas}
                edits={edits}
                onEdit={(campo, valor) => onEdit(a.correo, campo, valor)}
                onEliminar={() =>
                  onEliminar(a.correo, edits[estKey(a.correo, 'nombre')] ?? a.nombre)
                }
                onTransferir={onTransferir}
                soloLectura={soloLectura}
                esAdmin={esAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Modal eliminar BP ────────────────────────────────────────────────────────

function ModalEliminarBP({
  bps,
  onEliminar,
  onCerrar,
}: {
  bps: { nombre: string; correos: number; extraId?: string }[];
  onEliminar: (info: { extraId?: string; nombre: string }) => void;
  onCerrar: () => void;
}) {
  const [advertencia, setAdvertencia] = useState<string | null>(null);

  function handleSeleccionar(bp: { nombre: string; correos: number; extraId?: string }) {
    if (bp.correos > 0) {
      setAdvertencia(
        `"${bp.nombre}" tiene ${bp.correos} correo${bp.correos !== 1 ? 's' : ''}. Debes eliminar todos los correos antes de poder eliminar el BP.`,
      );
      return;
    }
    onEliminar({ extraId: bp.extraId, nombre: bp.nombre });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Eliminar BP</h2>
          <p className="text-sm text-muted-foreground">Selecciona el BP que deseas eliminar.</p>
        </div>

        <div className="space-y-1.5">
          {bps.map((bp) => (
            <div
              key={bp.nombre}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{bp.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {bp.correos} correo{bp.correos !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSeleccionar(bp)}
                className="rounded-md border border-rose-200 bg-background px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        {advertencia && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
            {advertencia}
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onCerrar} className={BTN_SECONDARY}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal nuevo equipo ───────────────────────────────────────────────────────

function ModalNuevoEquipo({
  titulo = 'Nuevo equipo',
  descripcion = 'Ingresa el nombre del nuevo equipo.',
  placeholder = 'Ej: Equipo Norte',
  onCrear,
  onCancelar,
}: {
  titulo?: string;
  descripcion?: string;
  placeholder?: string;
  onCrear: (nombre: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || pending) return;
    setPending(true);
    try {
      await onCrear(nombre.trim());
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !pending && onCancelar()}
    >
      <div
        className="w-full max-w-xs space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={ref}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && !pending && onCancelar()}
            placeholder={placeholder}
            disabled={pending}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancelar} disabled={pending} className={BTN_SECONDARY}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nombre.trim() || pending}
              className={cn(BTN_PRIMARY, 'flex items-center gap-1.5')}
            >
              {pending && <Spinner />}
              {pending ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal transferir BP ─────────────────────────────────────────────────────

interface BPDisponible {
  hojaId: string;
  hojaLabel: string;
  grupoNombre: string;
}

function ModalTransferirBP({
  nombre,
  todosBPs,
  pending = false,
  onTransferir,
  onCancelar,
}: {
  nombre: string;
  todosBPs: BPDisponible[];
  pending?: boolean;
  onTransferir: (hojaId: string, grupoNombre: string) => void;
  onCancelar: () => void;
}) {
  const [seleccionado, setSeleccionado] = useState<{ hojaId: string; grupoNombre: string } | null>(
    null,
  );

  const hojas = useMemo(() => {
    const map = new Map<string, { hojaId: string; hojaLabel: string; grupos: string[] }>();
    for (const bp of todosBPs) {
      if (!map.has(bp.hojaId)) {
        map.set(bp.hojaId, { hojaId: bp.hojaId, hojaLabel: bp.hojaLabel, grupos: [] });
      }
      map.get(bp.hojaId)!.grupos.push(bp.grupoNombre);
    }
    return Array.from(map.values());
  }, [todosBPs]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !pending && onCancelar()}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Transferir correo</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona el BP destino para <strong className="text-foreground">{nombre}</strong>.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {hojas.map((hoja) => (
            <div key={hoja.hojaId}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {hoja.hojaLabel}
              </p>
              <div className="space-y-1">
                {hoja.grupos.map((g) => {
                  const activo =
                    seleccionado?.hojaId === hoja.hojaId && seleccionado?.grupoNombre === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      disabled={pending}
                      onClick={() => setSeleccionado({ hojaId: hoja.hojaId, grupoNombre: g })}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-40',
                        activo
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-foreground hover:bg-muted',
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={onCancelar} disabled={pending} className={BTN_SECONDARY}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!seleccionado || pending}
            onClick={() =>
              seleccionado && onTransferir(seleccionado.hojaId, seleccionado.grupoNombre)
            }
            className={cn(BTN_PRIMARY, 'flex items-center gap-1.5')}
          >
            {pending && <Spinner />}
            {pending ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ListaCorreos({
  edits: editsInicial,
  gruposExtra = [],
  gruposOcultos = [],
  miembrosExtra = [],
  hojasExtra = [],
  soloLectura = false,
  esAdmin = false,
  filtroGrupo,
}: {
  edits: Record<string, string>;
  gruposExtra?: GrupoExtra[];
  gruposOcultos?: { hojaId: string; nombre: string }[];
  miembrosExtra?: MiembroExtra[];
  hojasExtra?: HojaExtra[];
  soloLectura?: boolean;
  esAdmin?: boolean;
  filtroGrupo?: { hojaId: string; grupoNombre: string };
}) {
  const todasHojas = useMemo(
    () => [
      ...data.hojas,
      ...hojasExtra.map((h) => ({ id: h.id, nombre: h.nombre, grupos: [] as Grupo[] })),
    ],
    [hojasExtra],
  );

  const hojasVisibles = useMemo(() => {
    if (!filtroGrupo) return todasHojas;
    return todasHojas.filter((h) => h.id === filtroGrupo.hojaId);
  }, [todasHojas, filtroGrupo]);

  const [hojaActiva, setHojaActiva] = useState(() => {
    if (filtroGrupo) return filtroGrupo.hojaId;
    return data.hojas[0]?.id;
  });
  const [creandoMBP, setCreandoMBP] = useState(false);
  const [transfiriendo, setTransfiriendo] = useState<TransferirDatos | null>(null);
  const [errorTransferir, setErrorTransferir] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [confirming, setConfirming] = useState<{ correo: string; nombre: string } | null>(null);
  const [undoItem, setUndoItem] = useState<{ correo: string; nombre: string } | null>(null);
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [creandoEquipo, setCreandoEquipo] = useState(false);
  const [confirmandoEliminarGrupo, setConfirmandoEliminarGrupo] = useState<{
    extraId?: string;
    nombre: string;
  } | null>(null);
  const [mostrandoEliminarBP, setMostrandoEliminarBP] = useState(false);
  const [transferirPending, setTransferirPending] = useState(false);
  const [eliminarGrupoPending, setEliminarGrupoPending] = useState(false);
  const [exportandoHojaId, setExportandoHojaId] = useState<string | null>(null);
  const [exportandoTodos, setExportandoTodos] = useState(false);

  const [edits, actualizarEdits] = useOptimistic(
    editsInicial,
    (prev, update: { key: string; valor: string }) => ({ ...prev, [update.key]: update.valor }),
  );

  const hoja = todasHojas.find((h) => h.id === hojaActiva) ?? todasHojas[0];

  const gruposDinamicos = useMemo(
    () =>
      gruposExtra
        .filter((g) => g.hojaId === hoja.id)
        .map((g) => ({
          nombre: g.nombre,
          asesores: [],
          metricas: [
            { label: 'Cuentas Portal Activo', valor: 0 },
            { label: 'Cuentas Portal Creadas', valor: 0 },
            { label: 'Cuentas SalesCloud', valor: 0 },
          ],
          extraId: g.id,
        })),
    [gruposExtra, hoja.id],
  );

  const ocultoSet = useMemo(
    () => new Set(gruposOcultos.filter((g) => g.hojaId === hoja.id).map((g) => g.nombre)),
    [gruposOcultos, hoja.id],
  );

  const gruposSinBusqueda = useMemo(() => {
    const estaticos = hoja.grupos.filter((g) => !ocultoSet.has(g.nombre));
    const todos = [...estaticos, ...gruposDinamicos].map((g) => {
      const extras = miembrosExtra
        .filter((m) => m.hojaId === hoja.id && m.grupoNombre === g.nombre)
        .map((m) => ({
          nombre: m.nombre,
          correo: m.correo,
          estado: m.estado,
          jira: m.jira,
          slack: m.slack,
          sf: m.sf,
          tl: false,
          fechaEliminacion: undefined as string | undefined,
          esDinamico: true,
        }));
      return extras.length > 0 ? { ...g, asesores: [...g.asesores, ...extras] } : g;
    });
    return filtroGrupo ? todos.filter((g) => g.nombre === filtroGrupo.grupoNombre) : todos;
  }, [hoja, gruposDinamicos, ocultoSet, miembrosExtra, filtroGrupo]);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return gruposSinBusqueda;
    return gruposSinBusqueda
      .map((g) => ({
        ...g,
        asesores: g.asesores.filter(
          (a) => a.nombre.toLowerCase().includes(q) || a.correo.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.asesores.length > 0);
  }, [gruposSinBusqueda, busqueda]);

  // Las columnas opcionales se calculan sobre el grupo completo (sin filtro de
  // búsqueda) para que no desaparezcan al buscar un correo que aún no tiene
  // ese campo asignado (ej. Fecha baja).
  const columnas = useMemo(() => {
    const all = gruposSinBusqueda.flatMap((g) => g.asesores);
    return {
      jira: all.some((a) => a.jira),
      slack: all.some((a) => a.slack),
      sf: all.some((a) => !!a.sf),
      fecha: all.some((a) => !!a.fechaEliminacion),
    };
  }, [gruposSinBusqueda]);

  const totalHoja =
    hoja.grupos.reduce((n, g) => n + g.asesores.length, 0) +
    miembrosExtra.filter((m) => m.hojaId === hoja.id).length;

  const bpsInfo = useMemo(() => {
    const todosGrupos = [...hoja.grupos, ...gruposDinamicos];
    return todosGrupos.map((g) => ({
      nombre: g.nombre,
      correos: g.asesores.filter(
        (a) => !eliminadas.has(a.correo) && edits[estKey(a.correo, 'eliminado')] !== 'true',
      ).length,
      extraId: 'extraId' in g ? (g.extraId as string) : undefined,
    }));
  }, [hoja.grupos, gruposDinamicos, edits, eliminadas]);
  const totalGeneral = data.hojas.reduce(
    (n, h) => n + h.grupos.reduce((m, g) => m + g.asesores.length, 0),
    0,
  );

  const todosBPs = useMemo<BPDisponible[]>(() => {
    const result: BPDisponible[] = [];
    for (const h of data.hojas) {
      for (const g of h.grupos) {
        if (!gruposOcultos.some((o) => o.hojaId === h.id && o.nombre === g.nombre)) {
          result.push({ hojaId: h.id, hojaLabel: etiquetaHoja(h.nombre), grupoNombre: g.nombre });
        }
      }
    }
    for (const g of gruposExtra) {
      const hojaLabel = etiquetaHoja(todasHojas.find((h) => h.id === g.hojaId)?.nombre ?? g.hojaId);
      result.push({ hojaId: g.hojaId, hojaLabel, grupoNombre: g.nombre });
    }
    return result;
  }, [gruposOcultos, gruposExtra, todasHojas]);

  function handleEdit(correoOrig: string, campo: string, valor: string) {
    const key = estKey(correoOrig, campo);
    startTransition(() => {
      actualizarEdits({ key, valor });
      editarCorreoAction(correoOrig, campo, valor);
    });
  }

  function handleSolicitarEliminar(correo: string, nombre: string) {
    setConfirming({ correo, nombre });
  }

  function handleConfirmarEliminar() {
    if (!confirming) return;
    const { correo, nombre } = confirming;
    setConfirming(null);
    setEliminadas((prev) => new Set(prev).add(correo));
    setUndoItem({ correo, nombre });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
      setEliminadas((prev) => {
        const next = new Set(prev);
        next.delete(correo);
        return next;
      });
      startTransition(() => {
        actualizarEdits({ key: estKey(correo, 'eliminado'), valor: 'true' });
        eliminarCorreoAction(correo);
      });
    }, UNDO_MS);
  }

  function handleDeshacer() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoItem) {
      setEliminadas((prev) => {
        const next = new Set(prev);
        next.delete(undoItem.correo);
        return next;
      });
    }
    setUndoItem(null);
  }

  async function handleTransferir(hojaId: string, grupoNombre: string) {
    if (!transfiriendo || transferirPending) return;
    const datos = transfiriendo;
    setErrorTransferir(null);
    setTransferirPending(true);
    try {
      await transferirCorreoAction(
        datos.correo,
        {
          nombre: datos.nombre,
          slack: datos.slack,
          jira: datos.jira,
          sf: datos.sf,
          estado: datos.estado,
        },
        hojaId,
        grupoNombre,
        datos.esDinamico,
      );
      setTransfiriendo(null);
    } catch (e) {
      setErrorTransferir(e instanceof Error ? e.message : 'Error al transferir el correo.');
    } finally {
      setTransferirPending(false);
    }
  }

  async function handleCrearEquipo(nombre: string) {
    await crearGrupoAction(hoja.id, nombre);
    setCreandoEquipo(false);
  }

  async function handleCrearMBP(nombre: string) {
    await crearHojaAction(nombre);
    setCreandoMBP(false);
  }

  async function handleConfirmarEliminarGrupo() {
    if (!confirmandoEliminarGrupo || eliminarGrupoPending) return;
    const { extraId, nombre } = confirmandoEliminarGrupo;
    setEliminarGrupoPending(true);
    try {
      if (extraId) {
        await eliminarGrupoAction(extraId);
      } else {
        await ocultarGrupoAction(hoja.id, nombre);
      }
      setConfirmandoEliminarGrupo(null);
    } finally {
      setEliminarGrupoPending(false);
    }
  }

  function handleEditMetrica(grupoNombre: string, label: string, valor: number) {
    const key = metricaKey(grupoNombre, label);
    startTransition(() => {
      actualizarEdits({ key, valor: String(valor) });
      editarCorreoAction(key, label, String(valor));
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {totalGeneral} correos en {data.hojas.length} hojas · Actualizado{' '}
            {formatFechaChile(edits['__meta__||lastUpdated'] ?? data.actualizado)}
          </p>
          {!soloLectura && (
            <button
              type="button"
              onClick={() => setCreandoMBP(true)}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo MBP
            </button>
          )}
          {!soloLectura && (
            <button
              type="button"
              disabled={exportandoTodos}
              onClick={async () => {
                setExportandoTodos(true);
                try {
                  await exportarTodosMbpXlsx(
                    hojasVisibles,
                    gruposExtra,
                    gruposOcultos,
                    miembrosExtra,
                    edits,
                    eliminadas,
                  );
                } finally {
                  setExportandoTodos(false);
                }
              }}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
            >
              {exportandoTodos ? (
                <Spinner />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              Exportar MBPs
            </button>
          )}
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-56"
        />
      </div>

      {filtroGrupo && <ResumenCostos grupos={grupos} edits={edits} eliminadas={eliminadas} />}

      {/* Tabs por hoja */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {hojasVisibles.map((h) => {
          const etiqueta = etiquetaHoja(h.nombre);
          return (
            <div key={h.id} className="group flex items-end">
              <button
                type="button"
                onClick={() => setHojaActiva(h.id)}
                className={cn(
                  'border-b-2 px-3 py-1.5 text-sm font-medium transition-colors',
                  hojaActiva === h.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {etiqueta}
              </button>
              {!filtroGrupo && (
                <button
                  type="button"
                  title={`Exportar ${etiqueta}`}
                  disabled={exportandoHojaId === h.id}
                  onClick={async () => {
                    setExportandoHojaId(h.id);
                    try {
                      await exportarHojaXlsx(
                        h,
                        gruposExtra,
                        gruposOcultos,
                        miembrosExtra,
                        edits,
                        eliminadas,
                        etiqueta,
                      );
                    } finally {
                      setExportandoHojaId(null);
                    }
                  }}
                  className={cn(
                    'mb-1.5 flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground disabled:opacity-40',
                    exportandoHojaId === h.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  {exportandoHojaId === h.id ? (
                    <Spinner />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                  XLSX
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hoja.nombre} · {totalHoja} correos · {grupos.length} BP
          {grupos.length !== 1 ? 's' : ''}
        </p>
        {!soloLectura && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCreandoEquipo(true)}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo BP
            </button>
            <button
              type="button"
              onClick={() => setMostrandoEliminarBP(true)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
            >
              Eliminar BP
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {grupos.length === 0 && !busqueda ? null : grupos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Sin resultados para «{busqueda}».
          </p>
        ) : (
          grupos.map((g) => (
            <TablaGrupo
              key={g.nombre}
              grupo={g}
              columnas={columnas}
              edits={edits}
              eliminadas={eliminadas}
              onEdit={handleEdit}
              onEditMetrica={(label, valor) => handleEditMetrica(g.nombre, label, valor)}
              onEliminar={handleSolicitarEliminar}
              onTransferir={setTransfiriendo}
              soloLectura={soloLectura}
              esAdmin={esAdmin}
            />
          ))
        )}
      </div>

      {errorTransferir &&
        createPortal(
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-xl dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
            {errorTransferir}
            <button
              type="button"
              onClick={() => setErrorTransferir(null)}
              className="ml-3 font-semibold underline"
            >
              Cerrar
            </button>
          </div>,
          document.body,
        )}

      {transfiriendo &&
        createPortal(
          <ModalTransferirBP
            nombre={transfiriendo.nombre}
            todosBPs={todosBPs}
            pending={transferirPending}
            onTransferir={handleTransferir}
            onCancelar={() => setTransfiriendo(null)}
          />,
          document.body,
        )}

      {creandoMBP &&
        createPortal(
          <ModalNuevoEquipo
            titulo="Nuevo MBP"
            descripcion="Ingresa el nombre del nuevo MBP (hoja de correos)."
            placeholder="Ej: MBP Santiago"
            onCrear={handleCrearMBP}
            onCancelar={() => setCreandoMBP(false)}
          />,
          document.body,
        )}

      {creandoEquipo &&
        createPortal(
          <ModalNuevoEquipo
            onCrear={handleCrearEquipo}
            onCancelar={() => setCreandoEquipo(false)}
          />,
          document.body,
        )}

      {mostrandoEliminarBP &&
        createPortal(
          <ModalEliminarBP
            bps={bpsInfo}
            onEliminar={({ extraId, nombre }) => {
              setMostrandoEliminarBP(false);
              setConfirmandoEliminarGrupo({ extraId, nombre });
            }}
            onCerrar={() => setMostrandoEliminarBP(false)}
          />,
          document.body,
        )}

      {confirmandoEliminarGrupo &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => !eliminarGrupoPending && setConfirmandoEliminarGrupo(null)}
          >
            <div
              className="w-full max-w-xs space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">¿Eliminar BP?</h2>
                <p className="text-sm text-muted-foreground">
                  Esta acción eliminará el equipo permanentemente. No se puede deshacer.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmandoEliminarGrupo(null)}
                  disabled={eliminarGrupoPending}
                  className={BTN_SECONDARY}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarEliminarGrupo}
                  disabled={eliminarGrupoPending}
                  className={cn(BTN_DANGER, 'flex items-center gap-1.5')}
                >
                  {eliminarGrupoPending && <Spinner />}
                  {eliminarGrupoPending ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {confirming &&
        createPortal(
          <ConfirmModal
            nombre={confirming.nombre}
            onConfirmar={handleConfirmarEliminar}
            onCancelar={() => setConfirming(null)}
          />,
          document.body,
        )}

      {undoItem &&
        createPortal(
          <UndoToast nombre={undoItem.nombre} onDeshacer={handleDeshacer} />,
          document.body,
        )}
    </div>
  );
}
