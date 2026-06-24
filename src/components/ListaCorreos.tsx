'use client';

import { startTransition, useMemo, useOptimistic, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import correosData from '@/data/correos.json';
import { editarCorreoAction } from '@/app/actions';

interface Asesor {
  nombre: string;
  correo: string;
  estado: string;
  jira: boolean;
  slack: boolean;
  sf: string;
  tl: boolean;
  fechaEliminacion?: string;
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

// ─── Fila de asesor ──────────────────────────────────────────────────────────

function FilaAsesor({
  asesor,
  columnas,
  edits,
  onEdit,
}: {
  asesor: Asesor;
  columnas: { jira: boolean; slack: boolean; sf: boolean; fecha: boolean };
  edits: Record<string, string>;
  onEdit: (campo: string, valor: string) => void;
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
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      {/* Nombre */}
      <td className="px-3 py-2 text-foreground">
        <div className="flex items-center gap-1.5">
          <CeldaTexto valor={nombre} onSave={(v) => onEdit('nombre', v)} />
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
    </tr>
  );
}

// ─── Tabla de grupo ──────────────────────────────────────────────────────────

function calcularMetricasDinamicas(
  grupo: Grupo,
  edits: Record<string, string>,
): { label: string; valor: number }[] {
  const asesores = grupo.asesores.map((a) => ({
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
  onEdit,
  onEditMetrica,
}: {
  grupo: Grupo;
  columnas: { jira: boolean; slack: boolean; sf: boolean; fecha: boolean };
  edits: Record<string, string>;
  onEdit: (correoOrig: string, campo: string, valor: string) => void;
  onEditMetrica: (label: string, valor: number) => void;
}) {
  const metricas = useMemo(() => calcularMetricasDinamicas(grupo, edits), [grupo, edits]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{grupo.nombre}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {grupo.asesores.length}
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
            </tr>
          </thead>
          <tbody>
            {grupo.asesores.map((a, i) => (
              <FilaAsesor
                key={`${a.correo}-${i}`}
                asesor={a}
                columnas={columnas}
                edits={edits}
                onEdit={(campo, valor) => onEdit(a.correo, campo, valor)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ListaCorreos({ edits: editsInicial }: { edits: Record<string, string> }) {
  const [hojaActiva, setHojaActiva] = useState(data.hojas[0]?.id);
  const [busqueda, setBusqueda] = useState('');

  const [edits, actualizarEdits] = useOptimistic(
    editsInicial,
    (prev, update: { key: string; valor: string }) => ({ ...prev, [update.key]: update.valor }),
  );

  const hoja = data.hojas.find((h) => h.id === hojaActiva) ?? data.hojas[0];

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return hoja.grupos;
    return hoja.grupos
      .map((g) => ({
        ...g,
        asesores: g.asesores.filter(
          (a) => a.nombre.toLowerCase().includes(q) || a.correo.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.asesores.length > 0);
  }, [hoja, busqueda]);

  const columnas = useMemo(() => {
    const all = hoja.grupos.flatMap((g) => g.asesores);
    return {
      jira: all.some((a) => a.jira),
      slack: all.some((a) => a.slack),
      sf: all.some((a) => a.sf),
      fecha: all.some((a) => a.fechaEliminacion),
    };
  }, [hoja]);

  const totalHoja = hoja.grupos.reduce((n, g) => n + g.asesores.length, 0);
  const totalGeneral = data.hojas.reduce(
    (n, h) => n + h.grupos.reduce((m, g) => m + g.asesores.length, 0),
    0,
  );

  function handleEdit(correoOrig: string, campo: string, valor: string) {
    const key = estKey(correoOrig, campo);
    startTransition(() => {
      actualizarEdits({ key, valor });
      editarCorreoAction(correoOrig, campo, valor);
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
        <p className="text-xs text-muted-foreground">
          {totalGeneral} correos en {data.hojas.length} hojas · actualizado {data.actualizado}
        </p>
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
        {data.hojas.map((h) => (
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

      <p className="text-xs text-muted-foreground">
        {hoja.nombre} · {totalHoja} correos · {hoja.grupos.length} equipo
        {hoja.grupos.length !== 1 ? 's' : ''}
      </p>

      <div className="space-y-6">
        {grupos.length === 0 ? (
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
              onEdit={handleEdit}
              onEditMetrica={(label, valor) => handleEditMetrica(g.nombre, label, valor)}
            />
          ))
        )}
      </div>
    </div>
  );
}
