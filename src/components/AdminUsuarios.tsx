'use client';

import { useMemo, useState, useTransition } from 'react';
import correosData from '@/data/correos.json';
import {
  actualizarRolUsuarioAction,
  crearUsuarioAction,
  eliminarUsuarioAction,
} from '@/app/actions';
import type { Rol, Usuario } from '@/types';
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
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'solicitante', label: 'Solicitante' },
];

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
}: {
  hojaId: string;
  grupoNombre: string;
  hojas: { id: string; nombre: string; grupos: string[] }[];
  onChange: (hojaId: string, grupoNombre: string) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const grupoBp = rol === 'bp' && hojaId && grupoNombre ? `${hojaId}|${grupoNombre}` : undefined;
    startTransition(async () => {
      const res = await crearUsuarioAction(email, nombre, rol, grupoBp);
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
          {rol === 'bp' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Grupo que puede ver (opcional)
              </label>
              <SelectorGrupoBp
                hojaId={hojaId}
                grupoNombre={grupoNombre}
                hojas={hojas}
                onChange={(h, g) => {
                  setHojaId(h);
                  setGrupoNombre(g);
                }}
              />
            </div>
          )}
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

function FilaUsuario({
  usuario,
  hojas,
  esYo,
  pending,
  onCambiarRol,
  onCambiarGrupo,
  onEliminar,
}: {
  usuario: Usuario;
  hojas: { id: string; nombre: string; grupos: string[] }[];
  esYo: boolean;
  pending: boolean;
  onCambiarRol: (email: string, rol: Rol) => void;
  onCambiarGrupo: (email: string, hojaId: string, grupoNombre: string) => void;
  onEliminar: (email: string) => void;
}) {
  const [hojaInicial, grupoInicial] = (usuario.grupoBp ?? '').split('|');
  const [hojaId, setHojaId] = useState(hojaInicial ?? '');
  const [grupoNombre, setGrupoNombre] = useState(grupoInicial ?? '');

  function handleSelectorChange(h: string, g: string) {
    setHojaId(h);
    setGrupoNombre(g);
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
        {usuario.rol === 'bp' ? (
          <fieldset disabled={pending} className="contents">
            <SelectorGrupoBp
              hojaId={hojaId}
              grupoNombre={grupoNombre}
              hojas={hojas}
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

  const hojas = useHojasDisponibles(hojasExtra, gruposExtra);

  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [usuarios],
  );

  async function handleCambiarRol(email: string, rol: Rol) {
    const usuario = usuarios.find((u) => u.email === email);
    const grupoBp = rol === 'bp' ? usuario?.grupoBp : undefined;
    setPendingEmail(email);
    try {
      await actualizarRolUsuarioAction(email, rol, grupoBp);
    } finally {
      setPendingEmail(null);
    }
  }

  async function handleCambiarGrupo(email: string, hojaId: string, grupoNombre: string) {
    const usuario = usuarios.find((u) => u.email === email);
    if (!usuario) return;
    const grupoBp = hojaId && grupoNombre ? `${hojaId}|${grupoNombre}` : undefined;
    setPendingEmail(email);
    try {
      await actualizarRolUsuarioAction(email, usuario.rol, grupoBp);
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
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
        </p>
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="w-[35%] px-3 py-2 font-semibold text-foreground">Nombre / Correo</th>
              <th className="w-[20%] px-3 py-2 font-semibold text-foreground">Rol</th>
              <th className="w-[35%] px-3 py-2 font-semibold text-foreground">Grupo BP</th>
              <th className="w-[10%] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {usuariosOrdenados.map((u) => (
              <FilaUsuario
                key={u.email}
                usuario={u}
                hojas={hojas}
                esYo={u.email.toLowerCase() === usuarioActual.toLowerCase()}
                pending={pendingEmail === u.email}
                onCambiarRol={handleCambiarRol}
                onCambiarGrupo={handleCambiarGrupo}
                onEliminar={setConfirmandoEliminar}
              />
            ))}
          </tbody>
        </table>
      </div>

      {mostrandoModal && (
        <ModalNuevoUsuario hojas={hojas} onCerrar={() => setMostrandoModal(false)} />
      )}

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
