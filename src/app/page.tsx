import { redirect } from 'next/navigation';
import {
  leerEdicionesCorreos,
  leerGruposExtra,
  leerGruposOcultos,
  leerPlataformas,
  leerSolicitudes,
} from '@/lib/db';
import { getSesion } from '@/lib/session';
import { logoutAction } from '@/app/actions';
import { SolicitudForm } from '@/components/SolicitudForm';
import { SolicitudesList } from '@/components/SolicitudesList';
import { DashboardTabs } from '@/components/DashboardTabs';
import { DirectorioEquipos } from '@/components/DirectorioEquipos';
import { ListaCorreos } from '@/components/ListaCorreos';
import { EliminadosPanel } from '@/components/EliminadosPanel';
import { construirDirectorio } from '@/lib/services/solicitudes.service';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string }>;
}) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');

  const { creada } = await searchParams;
  const esEquipo = sesion.rol === 'equipo' || sesion.rol === 'admin';

  const [plataformas, todas, edicionesCorreos, gruposExtra, gruposOcultos] = await Promise.all([
    leerPlataformas(),
    leerSolicitudes(),
    esEquipo ? leerEdicionesCorreos() : Promise.resolve({}),
    sesion.rol === 'admin' ? leerGruposExtra() : Promise.resolve([]),
    sesion.rol === 'admin' ? leerGruposOcultos() : Promise.resolve([]),
  ]);

  const countEliminados = Object.entries(edicionesCorreos).filter(
    ([k, v]) => k.endsWith('||eliminado') && v === 'true',
  ).length;
  const plataformasActivas = plataformas.filter((p) => p.activa);
  const solicitudes = esEquipo ? todas : todas.filter((s) => s.solicitanteEmail === sesion.email);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Solicitudes de Accesos</h1>
            <p className="text-xs text-muted-foreground">
              {sesion.nombre} ·{' '}
              {sesion.rol === 'admin'
                ? 'Administrador'
                : sesion.rol === 'equipo'
                  ? 'Equipo de Accesos'
                  : 'Solicitante'}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-8">
        {creada && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            Solicitud enviada. Se notificó a accesos@capitalinteligente.cl.
          </p>
        )}

        <DashboardTabs
          tabInicial={creada ? 'solicitudes' : undefined}
          tabs={[
            {
              id: 'nueva',
              label: 'Nueva solicitud',
              content: <SolicitudForm plataformas={plataformasActivas} />,
            },
            {
              id: 'solicitudes',
              label: esEquipo ? 'Todas las solicitudes' : 'Mis solicitudes',
              badge: solicitudes.filter((s) => s.estado === 'pendiente').length,
              content: (
                <SolicitudesList
                  solicitudes={solicitudes}
                  plataformas={plataformas}
                  esEquipo={esEquipo}
                />
              ),
            },
            ...(esEquipo
              ? [
                  {
                    id: 'equipos',
                    label: 'Equipos',
                    content: (
                      <DirectorioEquipos
                        directorio={construirDirectorio(todas)}
                        plataformas={plataformas}
                      />
                    ),
                  },
                ]
              : []),
            ...(sesion.rol === 'admin'
              ? [
                  {
                    id: 'correos',
                    label: 'Lista de correos',
                    content: (
                      <ListaCorreos
                        edits={edicionesCorreos}
                        gruposExtra={gruposExtra}
                        gruposOcultos={gruposOcultos}
                      />
                    ),
                  },
                ]
              : []),
            ...(esEquipo
              ? [
                  {
                    id: 'eliminados',
                    label: 'Eliminados',
                    badge: countEliminados || undefined,
                    content: (
                      <EliminadosPanel edits={edicionesCorreos} esAdmin={sesion.rol === 'admin'} />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </main>
    </div>
  );
}
