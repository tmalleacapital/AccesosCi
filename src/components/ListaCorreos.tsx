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

interface Asesor {
  nombre: string;
  correo: string;
  estado: string;
  jira: boolean;
  slack: boolean;
  sf: string;
  tl: boolean;
  fechaEliminacion?: string;
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
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
}

function estKey(correo: string, campo: string) {
  return `${correo}||${campo}`;
}

function metricaKey(grupoNombre: string, label: string) {
  return `__metrica__:${grupoNombre}||${label}`;
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
          'cursor-pointer rounded px-0.5 hover:bg-muted/60 hover:underline hover:decoration-dotted',
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
      className="text-base leading-none focus:outline-none"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="w-80 space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
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
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
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
}: {
  asesor: Asesor;
  columnas: { jira: boolean; slack: boolean; sf: boolean; fecha: boolean };
  edits: Record<string, string>;
  onEdit: (campo: string, valor: string) => void;
  onEliminar: () => void;
  onTransferir: (datos: TransferirDatos) => void;
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

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/20">
      {/* Nombre */}
      <td className="px-3 py-2 text-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <CeldaTexto valor={nombre} onSave={(v) => onEdit('nombre', v)} className="truncate" />
          {tl && (
            <button
              type="button"
              title="T.L — clic para quitar"
              onClick={() => onEdit('tl', 'false')}
              className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400"
            >
              T.L
            </button>
          )}
          {!tl && (
            <button
              type="button"
              title="Marcar como Team Leader"
              onClick={() => onEdit('tl', 'true')}
              className="hidden rounded px-1 py-0.5 text-[10px] text-muted-foreground/30 hover:bg-muted hover:text-muted-foreground group-hover:inline"
            >
              T.L
            </button>
          )}
        </div>
      </td>

      {/* Correo */}
      <td className="max-w-0 px-3 py-2">
        <CeldaTexto
          valor={correo}
          onSave={(v) => onEdit('correo', v)}
          className="block truncate font-mono text-xs text-muted-foreground"
        />
      </td>

      {/* Estado */}
      <td className="px-3 py-2">
        <EstadoBadge estado={estado || 'Activo'} onSave={(v) => onEdit('estado', v)} />
      </td>

      {/* Jira */}
      {columnas.jira && (
        <td className="px-3 py-2 text-center">
          <ToggleBool valor={jira} onToggle={() => onEdit('jira', jira ? 'false' : 'true')} />
        </td>
      )}

      {/* Slack */}
      {columnas.slack && (
        <td className="px-3 py-2 text-center">
          <ToggleBool valor={slack} onToggle={() => onEdit('slack', slack ? 'false' : 'true')} />
        </td>
      )}

      {/* Salesforce */}
      {columnas.sf && (
        <td className="px-3 py-2">
          <CeldaSelect
            valor={sf}
            opciones={['', 'Portal', 'Cloud']}
            onSave={(v) => onEdit('sf', v)}
          />
        </td>
      )}

      {/* Fecha baja */}
      {columnas.fecha && (
        <td className="whitespace-nowrap px-3 py-2">
          <CeldaTexto
            valor={formatFecha(fecha)}
            onSave={(v) => onEdit('fechaEliminacion', v)}
            className="text-xs text-muted-foreground"
          />
        </td>
      )}

      {/* Acciones */}
      <td className="px-1 py-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            type="button"
            title="Transferir a otro BP"
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
            className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-sky-50 hover:text-sky-600 group-hover:opacity-100 dark:hover:bg-sky-950/40"
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
            onClick={onEliminar}
            className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40"
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
    .filter((a) => !eliminadas.has(a.correo) && edits[estKey(a.correo, 'eliminado')] !== 'true')
    .map((a) => ({
      sf: (edits[estKey(a.correo, 'sf')] ?? a.sf ?? '').trim(),
      estado: (edits[estKey(a.correo, 'estado')] ?? a.estado ?? 'Activo').toLowerCase(),
    }));

  const portalActivo = asesores.filter((a) => a.sf === 'Portal' && a.estado === 'activo').length;
  const salesCloud = asesores.filter((a) => a.sf === 'Cloud' && a.estado === 'activo').length;

  return grupo.metricas.map((m) => {
    if (m.label === 'Cuentas Portal Activo') return { ...m, valor: portalActivo };
    if (m.label === 'Cuentas SalesCloud') return { ...m, valor: salesCloud };
    if (m.label === 'Cuentas Portal Creadas') {
      // Baseline editable por el usuario; si no hay override usa el del JSON
      const rawBaseline = edits[metricaKey(grupo.nombre, 'Cuentas Portal Creadas')];
      const baseline = rawBaseline !== undefined ? parseInt(rawBaseline, 10) : m.valor;
      return { ...m, valor: Math.max(baseline, portalActivo) };
    }
    return m;
  });
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
          onClick={iniciar}
          onKeyDown={(e) => e.key === 'Enter' && iniciar()}
          className="cursor-pointer rounded hover:underline hover:decoration-dotted"
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
}: {
  grupo: Grupo;
  columnas: { jira: boolean; slack: boolean; sf: boolean; fecha: boolean };
  edits: Record<string, string>;
  eliminadas: Set<string>;
  onEdit: (correoOrig: string, campo: string, valor: string) => void;
  onEditMetrica: (label: string, valor: number) => void;
  onEliminar: (correo: string, nombre: string) => void;
  onTransferir: (datos: TransferirDatos) => void;
}) {
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
          m.label === 'Cuentas Portal Creadas' ? (
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
      </div>

      <div className="rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
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
                <th className="w-[104px] whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                  Fecha baja
                </th>
              )}
              <th className="w-16" />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="w-96 space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
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
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
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
  onCrear: (nombre: string) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nombre.trim()) onCrear(nombre.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="w-80 space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
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
            onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
            placeholder={placeholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nombre.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Crear
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
  onTransferir,
  onCancelar,
}: {
  nombre: string;
  todosBPs: BPDisponible[];
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancelar}
    >
      <div
        className="flex max-h-[80vh] w-96 flex-col space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
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
                      onClick={() => setSeleccionado({ hojaId: hoja.hojaId, grupoNombre: g })}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
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
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!seleccionado}
            onClick={() =>
              seleccionado && onTransferir(seleccionado.hojaId, seleccionado.grupoNombre)
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Transferir
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
}: {
  edits: Record<string, string>;
  gruposExtra?: GrupoExtra[];
  gruposOcultos?: { hojaId: string; nombre: string }[];
  miembrosExtra?: MiembroExtra[];
  hojasExtra?: HojaExtra[];
}) {
  const todasHojas = useMemo(
    () => [
      ...data.hojas,
      ...hojasExtra.map((h) => ({ id: h.id, nombre: h.nombre, grupos: [] as Grupo[] })),
    ],
    [hojasExtra],
  );

  const [hojaActiva, setHojaActiva] = useState(data.hojas[0]?.id);
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

  const [edits, actualizarEdits] = useOptimistic(
    editsInicial,
    (prev, update: { key: string; valor: string }) => ({ ...prev, [update.key]: update.valor }),
  );

  const hoja = todasHojas.find((h) => h.id === hojaActiva) ?? todasHojas[0];

  const gruposDinamicos = useMemo(
    () =>
      gruposExtra
        .filter((g) => g.hojaId === hoja.id)
        .map((g) => ({ nombre: g.nombre, asesores: [], metricas: [], extraId: g.id })),
    [gruposExtra, hoja.id],
  );

  const ocultoSet = useMemo(
    () => new Set(gruposOcultos.filter((g) => g.hojaId === hoja.id).map((g) => g.nombre)),
    [gruposOcultos, hoja.id],
  );

  const grupos = useMemo(() => {
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
    const q = busqueda.trim().toLowerCase();
    if (!q) return todos;
    return todos
      .map((g) => ({
        ...g,
        asesores: g.asesores.filter(
          (a) => a.nombre.toLowerCase().includes(q) || a.correo.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.asesores.length > 0);
  }, [hoja, gruposDinamicos, ocultoSet, busqueda, miembrosExtra]);

  const columnas = useMemo(() => {
    const all = grupos.flatMap((g) => g.asesores);
    return {
      jira: all.some((a) => a.jira),
      slack: all.some((a) => a.slack),
      sf: all.some((a) => !!a.sf),
      fecha: all.some((a) => !!a.fechaEliminacion),
    };
  }, [grupos]);

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

  function handleTransferir(hojaId: string, grupoNombre: string) {
    if (!transfiriendo) return;
    const datos = transfiriendo;
    setTransfiriendo(null);
    setErrorTransferir(null);
    startTransition(async () => {
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
      } catch (e) {
        setErrorTransferir(e instanceof Error ? e.message : 'Error al transferir el correo.');
      }
    });
  }

  function handleCrearEquipo(nombre: string) {
    setCreandoEquipo(false);
    startTransition(() => {
      crearGrupoAction(hoja.id, nombre);
    });
  }

  function handleCrearMBP(nombre: string) {
    setCreandoMBP(false);
    startTransition(() => {
      crearHojaAction(nombre);
    });
  }

  function handleConfirmarEliminarGrupo() {
    if (!confirmandoEliminarGrupo) return;
    const { extraId, nombre } = confirmandoEliminarGrupo;
    setConfirmandoEliminarGrupo(null);
    startTransition(() => {
      if (extraId) {
        eliminarGrupoAction(extraId);
      } else {
        ocultarGrupoAction(hoja.id, nombre);
      }
    });
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
            {totalGeneral} correos en {data.hojas.length} hojas · actualizado{' '}
            {formatFecha(data.actualizado)}
          </p>
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
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Tabs por hoja */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {todasHojas.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setHojaActiva(h.id)}
            className={cn(
              'border-b-2 px-3 py-1.5 text-sm font-medium transition-colors',
              hojaActiva === h.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {etiquetaHoja(h.nombre)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hoja.nombre} · {totalHoja} correos · {grupos.length} BP
          {grupos.length !== 1 ? 's' : ''}
        </p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmandoEliminarGrupo(null)}
          >
            <div
              className="w-80 space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
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
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarEliminarGrupo}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Sí, eliminar
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
