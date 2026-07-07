'use client';

import { useMemo, useState } from 'react';
import type {
  DatosBaja,
  DatosCreacion,
  DatosModificacion,
  EstadoSolicitud,
  Plataforma,
  Solicitud,
  TipoSolicitud,
  Usuario,
} from '@/types';
import { cambiarEstadoAction } from '@/app/actions';
import { agruparPorTipo } from '@/lib/services/solicitudes.service';
import { DashboardTabs } from '@/components/DashboardTabs';
import { CompletarCreacionForm } from '@/components/CompletarCreacionForm';
import { BotonSubmit } from '@/components/BotonSubmit';
import correosData from '@/data/correos.json';
import type { GrupoExtra, HojaExtra } from '@/lib/db';

interface HojaEstaticaRaw {
  id: string;
  nombre: string;
}
const hojasEstaticas = (correosData as { hojas: HojaEstaticaRaw[] }).hojas;

function etiquetaBp(grupoBp: string, hojasExtra: HojaExtra[]): string {
  const sep = grupoBp.indexOf('|');
  if (sep === -1) return grupoBp;
  const hojaId = grupoBp.slice(0, sep);
  const grupoNombre = grupoBp.slice(sep + 1);
  const hojaEstatica = hojasEstaticas.find((h) => h.id === hojaId);
  const hojaLabel = hojaEstatica
    ? hojaEstatica.nombre.replace(/^MBP\s+/, '')
    : (hojasExtra.find((h) => h.id === hojaId)?.nombre ?? hojaId);
  return `${hojaLabel} · ${grupoNombre}`;
}

const RESPONSABLE_CORREO = 'tmallea@capitalinteligente.cl';
const RESPONSABLE_SALESFORCE = 'mguzman@capitalinteligente.cl';
const RESPONSABLE_JIRA = 'cpeede@capitalinteligente.cl';

const ESTADO_ESTILO: Record<EstadoSolicitud, string> = {
  pendiente:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
  en_proceso:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400',
  esperando_salesforce:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-400',
  esperando_jira:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400',
  completada:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  rechazada:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
};

const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  esperando_salesforce: 'Esperando Salesforce',
  esperando_jira: 'Esperando Jira',
  completada: 'Completada',
  rechazada: 'Rechazada',
};

const TIPO_LABEL: Record<TipoSolicitud, string> = {
  crear: 'Crear',
  modificar: 'Modificar',
  baja: 'Baja',
};

const GRUPO_TITULO: Record<TipoSolicitud, string> = {
  crear: 'Creación de accesos',
  modificar: 'Modificación de accesos',
  baja: 'Eliminación de accesos',
};

function EstadoVacio({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-12 text-center">
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/40"
      >
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
      <p className="text-sm text-muted-foreground">{mensaje}</p>
    </div>
  );
}

function nombrePlataforma(id: string, plataformas: Plataforma[]): string {
  return plataformas.find((p) => p.id === id)?.nombre ?? id;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function DatosSolicitudResumen({ solicitud }: { solicitud: Solicitud }) {
  if (solicitud.tipo === 'crear') {
    const d = solicitud.datos as DatosCreacion;
    const nombreCompleto = [d.nombre, d.segundoNombre, d.apellidoPaterno, d.apellidoMaterno]
      .filter(Boolean)
      .join(' ');
    return (
      <dl className="mt-2 grid gap-y-1 gap-x-6 text-sm sm:grid-cols-2">
        <div className="flex gap-2 sm:col-span-2">
          <dt className="text-muted-foreground shrink-0">Nombre</dt>
          <dd className="font-medium text-foreground">{nombreCompleto}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">RUT</dt>
          <dd className="text-foreground">{d.rut}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">Celular</dt>
          <dd className="text-foreground">{d.celular}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">Correo personal</dt>
          <dd className="text-foreground">{d.correoPersonal}</dd>
        </div>
      </dl>
    );
  }

  if (solicitud.tipo === 'modificar') {
    const d = solicitud.datos as DatosModificacion;
    return (
      <dl className="mt-2 grid gap-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">Correo corporativo</dt>
          <dd className="font-mono text-foreground">{d.correoCorporativo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">Detalle</dt>
          <dd className="text-foreground">{d.detalle}</dd>
        </div>
      </dl>
    );
  }

  const d = solicitud.datos as DatosBaja;
  return (
    <dl className="mt-2 grid gap-y-1 text-sm">
      <div className="flex gap-2">
        <dt className="text-muted-foreground shrink-0">Correo a dar de baja</dt>
        <dd className="font-mono text-foreground">{d.correoCorporativo}</dd>
      </div>
      {d.redistribucionSalesforce && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground shrink-0">Redistribución Salesforce</dt>
          <dd className="text-foreground">{d.redistribucionSalesforce}</dd>
        </div>
      )}
    </dl>
  );
}

export function SolicitudesList({
  solicitudes,
  plataformas,
  esEquipo,
  esAdmin = false,
  gruposExtra = [],
  hojasExtra = [],
  usuarios = [],
  usuarioEmail = '',
}: {
  solicitudes: Solicitud[];
  plataformas: Plataforma[];
  esEquipo: boolean;
  esAdmin?: boolean;
  gruposExtra?: GrupoExtra[];
  hojasExtra?: HojaExtra[];
  usuarios?: Usuario[];
  usuarioEmail?: string;
}) {
  const [filtroBp, setFiltroBp] = useState('');

  const bpPorEmail = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const u of usuarios) {
      if (u.grupoBp) mapa.set(u.email.toLowerCase(), u.grupoBp);
    }
    return mapa;
  }, [usuarios]);

  const bpOptions = useMemo(() => {
    const vistos = new Set<string>();
    const opciones: { valor: string; label: string }[] = [];
    for (const grupoBp of bpPorEmail.values()) {
      if (vistos.has(grupoBp)) continue;
      vistos.add(grupoBp);
      opciones.push({ valor: grupoBp, label: etiquetaBp(grupoBp, hojasExtra) });
    }
    return opciones.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [bpPorEmail, hojasExtra]);

  const solicitudesFiltradas =
    esAdmin && filtroBp
      ? solicitudes.filter((s) => bpPorEmail.get(s.solicitanteEmail.toLowerCase()) === filtroBp)
      : solicitudes;

  if (solicitudes.length === 0) {
    return <EstadoVacio mensaje="No hay solicitudes aún." />;
  }

  const grupos = agruparPorTipo(solicitudesFiltradas);

  return (
    <div className="space-y-3">
      {esAdmin && bpOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="filtro-bp" className="text-xs text-muted-foreground">
            Filtrar por BP
          </label>
          <select
            id="filtro-bp"
            value={filtroBp}
            onChange={(e) => setFiltroBp(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos los BP</option>
            {bpOptions.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <DashboardTabs
        size="sm"
        tabs={grupos.map((grupo) => ({
          id: grupo.tipo,
          label: GRUPO_TITULO[grupo.tipo],
          badge: grupo.solicitudes.filter(
            (s) =>
              s.estado === 'pendiente' ||
              s.estado === 'esperando_salesforce' ||
              s.estado === 'esperando_jira',
          ).length,
          content:
            grupo.solicitudes.length === 0 ? (
              <EstadoVacio mensaje="No hay solicitudes de este tipo." />
            ) : (
              <ul className="space-y-3">
                {grupo.solicitudes.map((s) => (
                  <SolicitudCard
                    key={s.id}
                    solicitud={s}
                    plataformas={plataformas}
                    esEquipo={esEquipo}
                    esAdmin={esAdmin}
                    gruposExtra={gruposExtra}
                    hojasExtra={hojasExtra}
                    usuarioEmail={usuarioEmail}
                  />
                ))}
              </ul>
            ),
        }))}
      />
    </div>
  );
}

function SolicitudCard({
  solicitud: s,
  plataformas,
  esEquipo,
  esAdmin,
  gruposExtra,
  hojasExtra,
  usuarioEmail,
}: {
  solicitud: Solicitud;
  plataformas: Plataforma[];
  esEquipo: boolean;
  esAdmin: boolean;
  gruposExtra: GrupoExtra[];
  hojasExtra: HojaExtra[];
  usuarioEmail: string;
}) {
  const esTmallea = usuarioEmail === RESPONSABLE_CORREO;
  const esMguzman = usuarioEmail === RESPONSABLE_SALESFORCE;
  const esCpeede = usuarioEmail === RESPONSABLE_JIRA;
  const enEsperaSalesforce = s.estado === 'esperando_salesforce';
  const enEsperaJira = s.estado === 'esperando_jira';
  const enEspera = enEsperaSalesforce || enEsperaJira;
  const estadoActivo = s.estado !== 'completada' && s.estado !== 'rechazada';

  const idsAccesos = new Set(s.accesos.map((a) => a.plataformaId));
  const tieneSalesforce = plataformas.some(
    (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('salesforce'),
  );
  const tieneJira = plataformas.some(
    (p) => idsAccesos.has(p.id) && p.nombre.toLowerCase().includes('jira'),
  );

  // Próximo estado cuando tmallea completa paso 1
  const nextEstado: EstadoSolicitud = tieneSalesforce
    ? 'esperando_salesforce'
    : tieneJira
      ? 'esperando_jira'
      : 'completada';

  // Un admin puede completar cualquier paso, aunque le corresponda a otra persona.
  const puedeCompletarSalesforce = esEquipo && (esMguzman || esAdmin) && enEsperaSalesforce;
  const puedeCompletarJira = esEquipo && (esCpeede || esAdmin) && enEsperaJira;
  const puedeAccionarTmallea = esEquipo && (esTmallea || esAdmin) && estadoActivo && !enEspera;
  const puedeAccionarGeneral =
    esEquipo && estadoActivo && !enEspera && s.tipo !== 'crear' && s.tipo !== 'baja';
  // Un admin siempre puede rechazar, aunque el paso actual le corresponda a otra persona.
  const soloRechazoAdmin =
    esAdmin &&
    estadoActivo &&
    !puedeAccionarTmallea &&
    !puedeAccionarGeneral &&
    !puedeCompletarSalesforce &&
    !puedeCompletarJira;

  const puedeAccionar =
    puedeAccionarTmallea ||
    puedeAccionarGeneral ||
    puedeCompletarSalesforce ||
    puedeCompletarJira ||
    soloRechazoAdmin;

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {TIPO_LABEL[s.tipo]}
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${ESTADO_ESTILO[s.estado]}`}
          >
            {ESTADO_LABEL[s.estado]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="truncate font-mono text-xs text-muted-foreground" title={s.id}>
            {s.id}
          </span>
          <span className="text-xs text-muted-foreground">{fmtFecha(s.fechaCreacion)}</span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="space-y-3 px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Solicitante: <span className="font-mono text-foreground">{s.solicitanteEmail}</span>
        </p>

        <DatosSolicitudResumen solicitud={s} />

        {s.comentario && (
          <p className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
            &ldquo;{s.comentario}&rdquo;
          </p>
        )}

        {/* Plataformas solicitadas */}
        {s.accesos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {s.accesos.map((a) => (
              <span
                key={a.plataformaId}
                className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                title={`Solicitado: ${fmtFecha(a.fechaSolicitud)}`}
              >
                {nombrePlataforma(a.plataformaId, plataformas)}
              </span>
            ))}
          </div>
        )}

        {/* Correo asignado */}
        {s.correoCorporativoAsignado && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Correo creado:</span>
            <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {s.correoCorporativoAsignado}
            </span>
          </div>
        )}
      </div>

      {/* Acciones */}
      {puedeAccionar && (
        <div className="space-y-2 border-t border-border bg-muted/10 px-5 py-3">
          {/* Paso 2: mguzman completa Salesforce */}
          {puedeCompletarSalesforce && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Correo creado:{' '}
                <span className="font-mono font-medium text-foreground">
                  {s.correoCorporativoAsignado}
                </span>
                . Marca el ticket como completado una vez creada la cuenta en Salesforce.
              </p>
              <BotonEstado id={s.id} estado="completada" label="Completar ticket" />
            </div>
          )}

          {/* Paso 3: cpeede completa Jira */}
          {puedeCompletarJira && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Correo creado:{' '}
                <span className="font-mono font-medium text-foreground">
                  {s.correoCorporativoAsignado}
                </span>
                . Marca el ticket como completado una vez creada la cuenta en Jira.
              </p>
              <BotonEstado id={s.id} estado="completada" label="Completar ticket" />
            </div>
          )}

          {/* Paso 1: tmallea actúa en tickets crear activos */}
          {puedeAccionarTmallea && s.tipo === 'crear' && (
            <>
              <CompletarCreacionForm id={s.id} gruposExtra={gruposExtra} hojasExtra={hojasExtra} nextEstado={nextEstado} />
              <div className="flex gap-2 border-t border-border/50 pt-2">
                <BotonEstado id={s.id} estado="en_proceso" label="Marcar en proceso" />
                <BotonEstado id={s.id} estado="rechazada" label="Rechazar" />
              </div>
            </>
          )}

          {/* Paso 1: tmallea saca Gmail/Slack en tickets de baja */}
          {puedeAccionarTmallea && s.tipo === 'baja' && (
            <div className="flex flex-wrap gap-2">
              <BotonEstado id={s.id} estado={nextEstado} label="Completado paso 1 (Gmail/Slack)" />
              <BotonEstado id={s.id} estado="en_proceso" label="Marcar en proceso" />
              <BotonEstado id={s.id} estado="rechazada" label="Rechazar" />
            </div>
          )}

          {/* Tickets no-crear/no-baja para cualquier miembro del equipo */}
          {puedeAccionarGeneral && (
            <div className="flex flex-wrap gap-2">
              <BotonEstado id={s.id} estado="en_proceso" label="Marcar en proceso" />
              <BotonEstado id={s.id} estado="completada" label="Marcar completada" />
              <BotonEstado id={s.id} estado="rechazada" label="Rechazar" />
            </div>
          )}

          {/* Cualquier admin puede rechazar, aunque el paso actual no le corresponda */}
          {soloRechazoAdmin && (
            <div className="flex flex-wrap gap-2">
              <BotonEstado id={s.id} estado="rechazada" label="Rechazar" />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function BotonEstado({
  id,
  estado,
  label,
}: {
  id: string;
  estado: EstadoSolicitud;
  label: string;
}) {
  return (
    <form action={cambiarEstadoAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <BotonSubmit label={label} />
    </form>
  );
}
