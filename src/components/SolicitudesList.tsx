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
import { generarCorreoSugerido } from '@/lib/services/notificaciones.service';
import { DashboardTabs } from '@/components/DashboardTabs';

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

function DatosSolicitudResumen({
  solicitud,
  esEquipo,
}: {
  solicitud: Solicitud;
  esEquipo: boolean;
}) {
  if (solicitud.tipo === 'crear') {
    const d = solicitud.datos as DatosCreacion;
    const correoSugerido = generarCorreoSugerido(d.nombre, d.apellidoPaterno);
    return (
      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <Dato
          label="Nombre"
          valor={`${d.nombre}${d.segundoNombre ? ` ${d.segundoNombre}` : ''} ${d.apellidoPaterno} ${d.apellidoMaterno}`}
        />
        <Dato label="Celular" valor={d.celular} />
        <Dato label="Correo personal" valor={d.correoPersonal} />
        {esEquipo && (
          <div className="sm:col-span-2 mt-1 flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 dark:border-sky-800 dark:bg-sky-950">
            <span className="text-xs text-sky-600 dark:text-sky-400">Correo sugerido:</span>
            <span className="font-mono text-sm font-semibold text-sky-700 dark:text-sky-300">
              {correoSugerido}
            </span>
          </div>
        )}
      </dl>
    );
  }

  if (solicitud.tipo === 'modificar') {
    const d = solicitud.datos as DatosModificacion;
    return (
      <dl className="mt-3 grid gap-1 text-sm">
        <Dato label="Correo corporativo" valor={d.correoCorporativo} />
        <Dato label="Detalle" valor={d.detalle} />
      </dl>
    );
  }

  const d = solicitud.datos as DatosBaja;
  return (
    <dl className="mt-3 grid gap-1 text-sm">
      <Dato label="Correo a dar de baja" valor={d.correoCorporativo} />
      {d.redistribucionSalesforce && (
        <Dato label="Redistribución Salesforce" valor={d.redistribucionSalesforce} />
      )}
    </dl>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="text-foreground">{valor}</dd>
    </div>
  );
}

export function SolicitudesList({
  solicitudes,
  plataformas,
  esEquipo,
}: {
  solicitudes: Solicitud[];
  plataformas: Plataforma[];
  esEquipo: boolean;
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
            <ul className="space-y-4">
              {grupo.solicitudes.map((s) => (
                <SolicitudCard
                  key={s.id}
                  solicitud={s}
                  plataformas={plataformas}
                  esEquipo={esEquipo}
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
}: {
  solicitud: Solicitud;
  plataformas: Plataforma[];
  esEquipo: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {TIPO_LABEL[s.tipo]}
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${ESTADO_ESTILO[s.estado]}`}
          >
            {ESTADO_LABEL[s.estado]}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{fmtFecha(s.fechaCreacion)}</span>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
        {' · '}Solicitante: <span className="text-foreground">{s.solicitanteEmail}</span>
      </p>

      <DatosSolicitudResumen solicitud={s} esEquipo={esEquipo} />

      {s.comentario && (
        <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Comentario: </span>
          {s.comentario}
        </div>
      )}

      {s.correoCorporativoAsignado && (
        <p className="mt-1 text-sm text-muted-foreground">
          Correo asignado: <span className="text-foreground">{s.correoCorporativoAsignado}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
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

      {esEquipo && s.estado !== 'completada' && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <BotonEstado id={s.id} estado="en_proceso" label="Marcar en proceso" />
          {s.tipo === 'crear' ? (
            <CompletarCreacionForm
              id={s.id}
              correoSugerido={generarCorreoSugerido(
                (s.datos as DatosCreacion).nombre,
                (s.datos as DatosCreacion).apellidoPaterno,
              )}
            />
          ) : (
            <BotonEstado id={s.id} estado="completada" label="Marcar completada" />
          )}
          <BotonEstado id={s.id} estado="rechazada" label="Rechazar" />
        </div>
      )}
    </li>
  );
}

function CompletarCreacionForm({ id, correoSugerido }: { id: string; correoSugerido: string }) {
  return (
    <form action={cambiarEstadoAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value="completada" />
      <div>
        <label htmlFor={`correo-${id}`} className="block text-[11px] text-muted-foreground">
          Correo asignado
        </label>
        <input
          id={`correo-${id}`}
          name="correoCorporativoAsignado"
          type="email"
          required
          defaultValue={correoSugerido}
          className="w-64 rounded-md border border-sky-300 bg-background px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary dark:border-sky-700"
        />
      </div>
      <button
        type="submit"
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        Marcar completada
      </button>
    </form>
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
