'use client';

import { useMemo, useState, useTransition } from 'react';
import correosData from '@/data/correos.json';
import {
  actualizarRolUsuarioAction,
  crearAsignacionAction,
  crearUsuarioAction,
  eliminarAsignacionAction,
  eliminarUsuarioAction,
} from '@/app/actions';
import type { Rol, RolAsignable, Usuario } from '@/types';
import type { GrupoExtra, HojaExtra } from '@/lib/db';
import { cn } from '@/lib/utils';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/lib/buttonStyles';

interface Hoja {
  id: string;
  nombre: string;
  grupos: { nombre: string }[];
}

const data = correosData as { hojas: Hoja[] };

const ROLES: { value: Rol; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'equipo', label: 'Equipo de Accesos' },
  { value: 'bp', label: 'Business Partner' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'mbp', label: 'MBP' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'solicitante', label: 'Solicitante' },
];

/** team_leader tiene exactamente los mismos poderes que bp (mismo grupo asignable). */
function tieneGrupoBp(rol: Rol): boolean {
  return rol === 'bp' || rol === 'team_leader';
}

/** mbp ve todos los BP de un MBP: solo se asigna la hoja (MBP), no un grupo puntual. */
function tieneAsignacion(rol: Rol): boolean {
  return tieneGrupoBp(rol) || rol === 'mbp';
}

function useHojasDisponibles(hojasExtra: HojaExtra[], gruposExtra: GrupoExtra[]) {
  return useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; grupos: string[] }>();
    for (const h of data.hojas) {
      map.set(h.id, { id: h.id, nombre: h.nombre, grupos: h.grupos.map((g) => g.nombre) });
    }
    for (const h of hojasExtra) {
      if (!map.has(h.id)) map.set(h.id, { id: h.id, nombre: h.nombre, grupos: [] });
    }
    for (const g of gruposExtra) {
      const hoja = map.get(g.hojaId);
      if (hoja && !hoja.grupos.includes(g.nombre)) hoja.grupos.push(g.nombre);
    }
    return Array.from(map.values());
  }, [hojasExtra, gruposExtra]);
}

function SelectorGrupoBp({
  hojaId,
  grupoNombre,
  hojas,
  onChange,
  soloHoja = false,
}: {
  hojaId: string;
  grupoNombre: string;
  hojas: { id: string; nombre: string; grupos: string[] }[];
  onChange: (hojaId: string, grupoNombre: string) => void;
  /** mbp: solo elige el MBP completo, sin restringir a un grupo puntual. */
  soloHoja?: boolean;
}) {
  const hojaActual = hojas.find((h) => h.id === hojaId);
  return (
    <div className="flex w-full min-w-0 gap-1.5">
      <select
        value={hojaId}
        onChange={(e) => onChange(e.target.value, '')}
        className="w-0 min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">MBP…</option>
        {hojas.map((h) => (
          <option key={h.id} value={h.id}>
            {h.nombre}
          </option>
        ))}
      </select>
      {!soloHoja && (
        <select
          value={grupoNombre}
          disabled={!hojaActual}
          onChange={(e) => onChange(hojaId, e.target.value)}
          className="w-0 min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
        >
          <option value="">Grupo…</option>
          {hojaActual?.grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ModalNuevoUsuario({
  hojas,
  onCerrar,
}: {
  hojas: { id: string; nombre: string; grupos: string[] }[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('bp');
  const [hojaId, setHojaId] = useState('');
  const [grupoNombre, setGrupoNombre] = useState('');
  const [multiempresas, setMultiempresas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const grupoBp =
      rol === 'mbp'
        ? hojaId || undefined
        : tieneGrupoBp(rol) && hojaId && grupoNombre
          ? `${hojaId}|${grupoNombre}`
          : undefined;
    startTransition(async () => {
      const res = await crearUsuarioAction(email, nombre, rol, grupoBp, multiempresas);
      if (res.error) {
        setError(res.error);
        return;
      }
      onCerrar();
    });
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
        <h2 className="text-base font-semibold text-foreground">Nuevo usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Correo</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@capitalinteligente.cl"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {tieneAsignacion(rol) && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {rol === 'mbp' ? 'MBP que puede ver' : 'Grupo que puede ver (opcional)'}
              </label>
              <SelectorGrupoBp
                hojaId={hojaId}
                grupoNombre={grupoNombre}
                hojas={hojas}
                soloHoja={rol === 'mbp'}
                onChange={(h, g) => {
                  setHojaId(h);
                  setGrupoNombre(g);
                }}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={multiempresas}
              onChange={(e) => setMultiempresas(e.target.checked)}
              className="rounded border-border"
            />
            Multiempresas (puede elegir empresa en Nueva solicitud)
          </label>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className={BTN_SECONDARY}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nombre.trim() || !email.trim() || isPending}
              className={BTN_PRIMARY}
            >
              {isPending ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`animate-spin ${className}`}
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

const ROLES_ASIGNABLES: { value: RolAsignable; label: string }[] = [
  { value: 'bp', label: 'Business Partner' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'mbp', label: 'MBP (todo el MBP)' },
];

function ModalAsignaciones({
  usuario,
  hojas,
  onCerrar,
}: {
  usuario: Usuario;
  hojas: { id: string; nombre: string; grupos: string[] }[];
  onCerrar: () => void;
}) {
  const [rol, setRol] = useState<RolAsignable>('bp');
  const [hojaId, setHojaId] = useState('');
  const [grupoNombre, setGrupoNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hojaActual = hojas.find((h) => h.id === hojaId);
  const asignaciones = usuario.asignaciones ?? [];

  function nombreHoja(id: string) {
    return hojas.find((h) => h.id === id)?.nombre ?? id;
  }

  function handleAgregar() {
    setError(null);
    startTransition(async () => {
      const res = await crearAsignacionAction(
        usuario.email,
        rol,
        hojaId,
        grupoNombre || undefined,
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setHojaId('');
      setGrupoNombre('');
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold text-foreground">Cargos extra</h2>
          <p className="text-xs text-muted-foreground">
            {usuario.nombre} · además de su rol principal
          </p>
        </div>

        {asignaciones.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Sin cargos extra. Solo tiene el rol principal.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {asignaciones.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-foreground">
                    {ROLES_ASIGNABLES.find((r) => r.value === a.rol)?.label ?? a.rol}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {nombreHoja(a.hojaId)}
                    {a.grupoNombre ? ` · ${a.grupoNombre}` : ' · todos sus BP'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await eliminarAsignacionAction(a.id); })}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <label className="text-xs font-medium text-muted-foreground">Agregar cargo</label>
          <select
            value={rol}
            onChange={(e) => {
              setRol(e.target.value as RolAsignable);
              setGrupoNombre('');
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {ROLES_ASIGNABLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <select
              value={hojaId}
              onChange={(e) => {
                setHojaId(e.target.value);
                setGrupoNombre('');
              }}
              className="w-0 min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">MBP…</option>
              {hojas.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </select>
            {rol !== 'mbp' && (
              <select
                value={grupoNombre}
                disabled={!hojaActual}
                onChange={(e) => setGrupoNombre(e.target.value)}
                className="w-0 min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
              >
                <option value="">BP…</option>
                {hojaActual?.grupos.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            type="button"
            onClick={handleAgregar}
            disabled={isPending || !hojaId || (rol !== 'mbp' && !grupoNombre)}
            className={cn(BTN_PRIMARY, 'w-full')}
          >
            {isPending ? 'Guardando…' : 'Agregar cargo'}
          </button>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <button type="button" onClick={onCerrar} className={BTN_SECONDARY}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaUsuario({
  usuario,
  hojas,
  esYo,
  pending,
  onCambiarRol,
  onCambiarGrupo,
  onToggleMultiempresas,
  onGestionarCargos,
  onEliminar,
}: {
  usuario: Usuario;
  hojas: { id: string; nombre: string; grupos: string[] }[];
  esYo: boolean;
  pending: boolean;
  onCambiarRol: (email: string, rol: Rol) => void;
  onCambiarGrupo: (email: string, hojaId: string, grupoNombre: string) => void;
  onToggleMultiempresas: (email: string, multiempresas: boolean) => void;
  onGestionarCargos: (email: string) => void;
  onEliminar: (email: string) => void;
}) {
  const [hojaInicial, grupoInicial] = (usuario.grupoBp ?? '').split('|');
  const [hojaId, setHojaId] = useState(hojaInicial ?? '');
  const [grupoNombre, setGrupoNombre] = useState(grupoInicial ?? '');

  function handleSelectorChange(h: string, g: string) {
    setHojaId(h);
    setGrupoNombre(g);
    if (usuario.rol === 'mbp') {
      onCambiarGrupo(usuario.email, h, '');
      return;
    }
    // Solo guardamos cuando hay selección completa (MBP + grupo) o cuando se limpia el MBP.
    if ((h && g) || !h) {
      onCambiarGrupo(usuario.email, h, g);
    }
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="font-medium text-foreground">{usuario.nombre}</div>
          {pending && <Spinner className="text-muted-foreground" />}
        </div>
        <div className="font-mono text-xs text-muted-foreground">{usuario.email}</div>
      </td>
      <td className="px-3 py-2">
        <select
          value={usuario.rol}
          disabled={pending}
          onChange={(e) => onCambiarRol(usuario.email, e.target.value as Rol)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        {tieneAsignacion(usuario.rol) ? (
          <fieldset disabled={pending} className="contents">
            <SelectorGrupoBp
              hojaId={hojaId}
              grupoNombre={grupoNombre}
              hojas={hojas}
              soloHoja={usuario.rol === 'mbp'}
              onChange={handleSelectorChange}
            />
          </fieldset>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          disabled={pending}
          onClick={() => onGestionarCargos(usuario.email)}
          title="Cargos extra además del rol principal"
          className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
        >
          {(usuario.asignaciones?.length ?? 0) > 0
            ? `+${usuario.asignaciones!.length}`
            : 'Agregar'}
        </button>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          disabled={pending}
          checked={usuario.multiempresas === true}
          onChange={(e) => onToggleMultiempresas(usuario.email, e.target.checked)}
          title="Multiempresas"
          className="rounded border-border disabled:opacity-40"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          disabled={esYo || pending}
          title={esYo ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
          onClick={() => onEliminar(usuario.email)}
          className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

export function AdminUsuarios({
  usuarios,
  hojasExtra = [],
  gruposExtra = [],
  usuarioActual,
}: {
  usuarios: Usuario[];
  hojasExtra?: HojaExtra[];
  gruposExtra?: GrupoExtra[];
  usuarioActual: string;
}) {
  const [mostrandoModal, setMostrandoModal] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [eliminarPending, setEliminarPending] = useState(false);
  const [gestionandoCargos, setGestionandoCargos] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const hojas = useHojasDisponibles(hojasExtra, gruposExtra);

  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [usuarios],
  );

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuariosOrdenados;
    return usuariosOrdenados.filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [usuariosOrdenados, busqueda]);

  async function handleCambiarRol(email: string, rol: Rol) {
    const usuario = usuarios.find((u) => u.email === email);
    const grupoBp = tieneGrupoBp(rol) ? usuario?.grupoBp : undefined;
    setPendingEmail(email);
    try {
      await actualizarRolUsuarioAction(email, rol, grupoBp, usuario?.multiempresas);
    } finally {
      setPendingEmail(null);
    }
  }

  async function handleCambiarGrupo(email: string, hojaId: string, grupoNombre: string) {
    const usuario = usuarios.find((u) => u.email === email);
    if (!usuario) return;
    const grupoBp =
      usuario.rol === 'mbp'
        ? hojaId || undefined
        : hojaId && grupoNombre
          ? `${hojaId}|${grupoNombre}`
          : undefined;
    setPendingEmail(email);
    try {
      await actualizarRolUsuarioAction(email, usuario.rol, grupoBp, usuario.multiempresas);
    } finally {
      setPendingEmail(null);
    }
  }

  async function handleToggleMultiempresas(email: string, multiempresas: boolean) {
    const usuario = usuarios.find((u) => u.email === email);
    if (!usuario) return;
    setPendingEmail(email);
    try {
      await actualizarRolUsuarioAction(email, usuario.rol, usuario.grupoBp, multiempresas);
    } finally {
      setPendingEmail(null);
    }
  }

  async function handleEliminar() {
    if (!confirmandoEliminar || eliminarPending) return;
    const email = confirmandoEliminar;
    setEliminarPending(true);
    try {
      await eliminarUsuarioAction(email);
      setConfirmandoEliminar(null);
    } finally {
      setEliminarPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {usuariosFiltrados.length === usuarios.length
            ? `${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''}`
            : `${usuariosFiltrados.length} de ${usuarios.length} usuarios`}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => setMostrandoModal(true)}
            className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo usuario
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="w-[26%] px-3 py-2 font-semibold text-foreground">Nombre / Correo</th>
              <th className="w-[16%] px-3 py-2 font-semibold text-foreground">Rol principal</th>
              <th className="w-[26%] px-3 py-2 font-semibold text-foreground">Grupo BP</th>
              <th
                className="w-[12%] px-3 py-2 text-center font-semibold text-foreground"
                title="Cargos extra además del rol principal"
              >
                Cargos
              </th>
              <th
                className="w-[10%] px-3 py-2 text-center font-semibold text-foreground"
                title="Multiempresas"
              >
                Multi.
              </th>
              <th className="w-[10%] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin resultados para «{busqueda}».
                </td>
              </tr>
            )}
            {usuariosFiltrados.map((u) => (
              <FilaUsuario
                key={u.email}
                usuario={u}
                hojas={hojas}
                esYo={u.email.toLowerCase() === usuarioActual.toLowerCase()}
                pending={pendingEmail === u.email}
                onCambiarRol={handleCambiarRol}
                onCambiarGrupo={handleCambiarGrupo}
                onToggleMultiempresas={handleToggleMultiempresas}
                onGestionarCargos={setGestionandoCargos}
                onEliminar={setConfirmandoEliminar}
              />
            ))}
          </tbody>
        </table>
      </div>

      {mostrandoModal && (
        <ModalNuevoUsuario hojas={hojas} onCerrar={() => setMostrandoModal(false)} />
      )}

      {gestionandoCargos &&
        (() => {
          const u = usuarios.find((x) => x.email === gestionandoCargos);
          if (!u) return null;
          return (
            <ModalAsignaciones
              usuario={u}
              hojas={hojas}
              onCerrar={() => setGestionandoCargos(null)}
            />
          );
        })()}

      {confirmandoEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !eliminarPending && setConfirmandoEliminar(null)}
        >
          <div
            className="w-full max-w-xs space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-foreground">
              ¿Eliminar el acceso de <strong>{confirmandoEliminar}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoEliminar(null)}
                disabled={eliminarPending}
                className={BTN_SECONDARY}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={eliminarPending}
                className={cn(BTN_DANGER, 'flex items-center gap-1.5')}
              >
                {eliminarPending && <Spinner />}
                {eliminarPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
