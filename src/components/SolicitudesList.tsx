import type {
  DatosBaja,
  DatosCreacion,
  DatosModificacion,
  EstadoSolicitud,
  Plataforma,
  Solicitud,
  TipoSolicitud,
} from '@/types';
import { cambiarEstadoAction } from '@/app/actions';
import { agruparPorTipo } from '@/lib/services/solicitudes.service';
import { DashboardTabs } from '@/components/DashboardTabs';
import { CompletarCreacionForm } from '@/components/CompletarCreacionForm';
import type { GrupoExtra } from '@/lib/db';

const ESTADO_ESTILO: Record<EstadoSolicitud, string> = {
  pendiente:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
  en_proceso:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400',
  completada:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  rechazada:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
};

const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
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
  gruposExtra = [],
}: {
  solicitudes: Solicitud[];
  plataformas: Plataforma[];
  esEquipo: boolean;
  gruposExtra?: GrupoExtra[];
}) {
  if (solicitudes.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No hay solicitudes aún.
      </p>
    );
  }

  const grupos = agruparPorTipo(solicitudes);

  return (
    <DashboardTabs
      size="sm"
      tabs={grupos.map((grupo) => ({
        id: grupo.tipo,
        label: GRUPO_TITULO[grupo.tipo],
        badge: grupo.solicitudes.length,
        content:
          grupo.solicitudes.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No hay solicitudes de este tipo.
            </p>
          ) : (
            <ul className="space-y-3">
              {grupo.solicitudes.map((s) => (
                <SolicitudCard
                  key={s.id}
                  solicitud={s}
                  plataformas={plataformas}
                  esEquipo={esEquipo}
                  gruposExtra={gruposExtra}
                />
              ))}
            </ul>
          ),
      }))}
    />
  );
}

function SolicitudCard({
  solicitud: s,
  plataformas,
  esEquipo,
  gruposExtra,
}: {
  solicitud: Solicitud;
  plataformas: Plataforma[];
  esEquipo: boolean;
  gruposExtra: GrupoExtra[];
}) {
  const puedeAccionar = esEquipo && s.estado !== 'completada' && s.estado !== 'rechazada';

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {TIPO_LABEL[s.tipo]}
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${ESTADO_ESTILO[s.estado]}`}
          >
            {ESTADO_LABEL[s.estado]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
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

        {/* Correo asignado (solo cuando completada) */}
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
          {s.tipo === 'crear' ? (
            <>
              <CompletarCreacionForm id={s.id} gruposExtra={gruposExtra} />
              <div className="flex gap-2 border-t border-border/50 pt-2">
                <BotonEstado id={s.id} estado="en_proceso" label="Marcar en proceso" />
                <BotonEstado id={s.id} estado="rechazada" label="Rechazar" />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <BotonEstado id={s.id} estado="en_proceso" label="Marcar en proceso" />
              <BotonEstado id={s.id} estado="completada" label="Marcar completada" />
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
      <button
        type="submit"
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        {label}
      </button>
    </form>
  );
}
