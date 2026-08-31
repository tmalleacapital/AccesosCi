export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { redirect } from 'next/navigation';
import correosData from '@/data/correos.json';
import {
  leerEdicionesCorreos,
  leerGruposExtra,
  leerGruposOcultos,
  leerHistorial,
  leerHojasExtra,
  leerMiembrosExtra,
  leerPlataformas,
  leerSolicitudes,
  leerUsuarios,
} from '@/lib/db';
import { getSesion } from '@/lib/session';
import { logoutAction } from '@/app/actions';
import { SolicitudForm } from '@/components/SolicitudForm';
import { SolicitudesList } from '@/components/SolicitudesList';
import { DashboardTabs } from '@/components/DashboardTabs';
import { ListaCorreos } from '@/components/ListaCorreos';
import { EliminadosPanel } from '@/components/EliminadosPanel';
import { AdminUsuarios } from '@/components/AdminUsuarios';
import { HistorialPanel } from '@/components/HistorialPanel';
import { AutoRefresh } from '@/components/AutoRefresh';
import { EmpresaSwitcher } from '@/components/EmpresaSwitcher';
import { EMPRESA_DEFAULT, normalizarEmpresaId } from '@/lib/empresas';
import { calcularAmbitos } from '@/lib/services/acceso.service';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; empresa?: string }>;
}) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');

  const { creada, empresa: empresaParam } = await searchParams;
  const esEquipo = sesion.rol === 'equipo' || sesion.rol === 'admin';
  const esFinanzas = sesion.rol === 'finanzas';
  const esAdmin = sesion.rol === 'admin';
  const esMultiempresas = sesion.multiempresas === true;

  // Una persona puede tener varios cargos a la vez (ej. MBP de Forza Capital y
  // además líder de un BP dentro de ese mismo MBP): el acceso a "Lista de
  // correos" es la unión de todos ellos. Ver acceso.service.
  const ambitos = calcularAmbitos({
    email: sesion.email,
    rol: sesion.rol,
    grupoBp: sesion.grupoBp,
    asignaciones: sesion.asignaciones,
  });
  const tieneAmbitos = ambitos.length > 0;

  // Solo admin/finanzas pueden ver ambas empresas; el resto siempre opera en la default.
  const puedeVerAmbasEmpresas = esAdmin || esFinanzas;
  const empresaActiva = puedeVerAmbasEmpresas
    ? normalizarEmpresaId(empresaParam)
    : EMPRESA_DEFAULT;

  const [
    plataformas,
    todas,
    edicionesCorreos,
    gruposExtra,
    gruposOcultos,
    miembrosExtra,
    hojasExtra,
    usuarios,
    historial,
  ] = await Promise.all([
    leerPlataformas(),
    leerSolicitudes(),
    esEquipo || tieneAmbitos || esFinanzas ? leerEdicionesCorreos() : Promise.resolve({}),
    esAdmin || tieneAmbitos || esFinanzas ? leerGruposExtra() : Promise.resolve([]),
    esAdmin || tieneAmbitos || esFinanzas ? leerGruposOcultos() : Promise.resolve([]),
    esEquipo || tieneAmbitos || esFinanzas ? leerMiembrosExtra() : Promise.resolve([]),
    esAdmin || tieneAmbitos || esFinanzas ? leerHojasExtra() : Promise.resolve([]),
    esAdmin ? leerUsuarios() : Promise.resolve([]),
    esAdmin ? leerHistorial() : Promise.resolve([]),
  ]);

  const plataformasActivas = plataformas.filter((p) => p.activa);
  const solicitudes = esEquipo
    ? todas.filter((s) => s.empresa === empresaActiva)
    : todas.filter((s) => s.solicitanteEmail === sesion.email);

  // "Lista de correos" solo debe mostrar la estructura de la empresa activa:
  // los estáticos (correos.json) son siempre Capital Inteligente; lo demás
  // se filtra por la etiqueta `empresa` de cada hoja dinámica. Ojo: un BP
  // dinámico (grupos_extra) puede colgar de un MBP ESTÁTICO (ej. Vanema bajo
  // "Skala"), así que los ids estáticos también cuentan como "permitidos".
  const incluirEstaticosCorreos = empresaActiva === 'capital_inteligente';
  const hojaIdsEstaticos = new Set(
    (correosData as { hojas: { id: string }[] }).hojas.map((h) => h.id),
  );
  const hojasExtraEmpresa = hojasExtra.filter((h) => h.empresa === empresaActiva);
  const hojaIdsEmpresa = new Set([
    ...(incluirEstaticosCorreos ? hojaIdsEstaticos : []),
    ...hojasExtraEmpresa.map((h) => h.id),
  ]);
  const gruposExtraEmpresa = gruposExtra.filter((g) => hojaIdsEmpresa.has(g.hojaId));
  const miembrosExtraEmpresa = miembrosExtra.filter((m) => hojaIdsEmpresa.has(m.hojaId));
  const gruposOcultosEmpresa = incluirEstaticosCorreos
    ? gruposOcultos
    : gruposOcultos.filter((g) => hojaIdsEmpresa.has(g.hojaId));

  const labelRolBase =
    sesion.rol === 'admin'
      ? 'Administrador'
      : sesion.rol === 'equipo'
        ? 'Equipo de Accesos'
        : sesion.rol === 'bp'
          ? 'Business Partner'
          : sesion.rol === 'team_leader'
            ? 'Team Leader'
            : sesion.rol === 'mbp'
              ? 'MBP'
              : sesion.rol === 'finanzas'
                ? 'Finanzas'
                : 'Solicitante';

  const cargosExtra = sesion.asignaciones?.length ?? 0;
  const labelRol =
    cargosExtra > 0
      ? `${labelRolBase} · +${cargosExtra} cargo${cargosExtra !== 1 ? 's' : ''}`
      : labelRolBase;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <AutoRefresh />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0">
              <Image
                src="/logo.png"
                alt="Logo"
                width={1080}
                height={1350}
                className="h-10 w-10 object-contain invert dark:invert-0"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Solicitudes de Accesos</h1>
              <p className="text-xs text-muted-foreground">
                {sesion.nombre} · {labelRol}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {puedeVerAmbasEmpresas && <EmpresaSwitcher actual={empresaActiva} />}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-8 px-6 py-8">
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
              content: (
                <SolicitudForm
                  plataformas={plataformasActivas}
                  esMultiempresas={esMultiempresas}
                  empresaInicial={empresaActiva}
                />
              ),
            },
            {
              id: 'solicitudes',
              label: esEquipo ? 'Todas las solicitudes' : 'Mis solicitudes',
              badge: solicitudes.filter(
                (s) =>
                  s.estado === 'pendiente' ||
                  s.estado === 'esperando_salesforce' ||
                  s.estado === 'esperando_jira',
              ).length,
              content: (
                <SolicitudesList
                  solicitudes={solicitudes}
                  plataformas={plataformas}
                  esEquipo={esEquipo}
                  esAdmin={esAdmin}
                  gruposExtra={gruposExtra}
                  hojasExtra={hojasExtra}
                  usuarios={usuarios}
                  usuarioEmail={sesion.email}
                />
              ),
            },
            ...(esAdmin || tieneAmbitos || esFinanzas
              ? [
                  {
                    id: 'correos',
                    label: 'Lista de correos',
                    content: (
                      <ListaCorreos
                        edits={edicionesCorreos}
                        gruposExtra={gruposExtraEmpresa}
                        gruposOcultos={gruposOcultosEmpresa}
                        miembrosExtra={miembrosExtraEmpresa}
                        hojasExtra={hojasExtraEmpresa}
                        soloLectura={!esAdmin}
                        esAdmin={esAdmin}
                        filtroAmbitos={esAdmin || esFinanzas ? undefined : ambitos}
                        incluirEstaticos={incluirEstaticosCorreos}
                        empresaActiva={empresaActiva}
                      />
                    ),
                  },
                ]
              : []),
            ...(esEquipo || esFinanzas
              ? [
                  {
                    id: 'eliminados',
                    label: 'Eliminados',
                    content: (
                      <EliminadosPanel
                        edits={edicionesCorreos}
                        esAdmin={sesion.rol === 'admin'}
                        miembrosExtra={miembrosExtra}
                      />
                    ),
                  },
                ]
              : []),
            ...(esAdmin
              ? [
                  {
                    id: 'usuarios',
                    label: 'Administración',
                    content: (
                      <AdminUsuarios
                        usuarios={usuarios}
                        hojasExtra={hojasExtra}
                        gruposExtra={gruposExtra}
                        usuarioActual={sesion.email}
                      />
                    ),
                  },
                  {
                    id: 'historial',
                    label: 'Historial',
                    content: <HistorialPanel historial={historial} />,
                  },
                ]
              : []),
          ]}
        />
      </main>
    </div>
  );
}
