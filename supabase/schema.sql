-- ============================================================
-- Solicitudes de Accesos — Supabase Schema
-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- Plataformas
create table if not exists plataformas (
  id        text primary key,
  nombre    text    not null,
  facturable boolean not null default false,
  activa    boolean not null default true
);

-- Usuarios (solo roles; la autenticación es por OTP)
create table if not exists usuarios (
  email       text primary key,
  nombre      text not null,
  rol         text not null check (rol in ('solicitante', 'equipo', 'admin')),
  password_hash text not null default ''
);

-- Solicitudes
create table if not exists solicitudes (
  id                          text primary key,
  tipo                        text not null check (tipo in ('crear', 'modificar', 'baja')),
  solicitante_email           text not null,
  fecha_creacion              timestamptz not null default now(),
  estado                      text not null check (estado in ('pendiente', 'en_proceso', 'completada', 'rechazada')) default 'pendiente',
  datos                       jsonb not null,
  accesos                     jsonb not null default '[]'::jsonb,
  comentario                  text,
  correo_corporativo_asignado text
);

-- Índices útiles
create index if not exists solicitudes_solicitante_email_idx on solicitudes (solicitante_email);
create index if not exists solicitudes_tipo_idx on solicitudes (tipo);
create index if not exists solicitudes_fecha_creacion_idx on solicitudes (fecha_creacion desc);

-- ============================================================
-- Seed: datos iniciales
-- ============================================================

insert into plataformas (id, nombre, facturable, activa) values
  ('gmail',       'Gmail @capitalinteligente.cl', true, true),
  ('slack',       'Slack',                        true, true),
  ('salesforce',  'Salesforce',                   true, true),
  ('jira',        'Jira',                         true, true)
on conflict (id) do nothing;

insert into usuarios (email, nombre, rol, password_hash) values
  ('tmallea@capitalinteligente.cl',    'Tomás Mallea',      'admin',      ''),
  ('mguzman@capitalinteligente.cl',    'M. Guzmán',         'admin',      ''),
  ('cpeede@capitalinteligente.cl',     'C. Peede',          'admin',      ''),
  ('accesos@capitalinteligente.cl',    'Equipo de Accesos', 'equipo',     ''),
  ('solicitante@capitalinteligente.cl','Solicitante',       'solicitante','')
on conflict (email) do nothing;

-- Migración de solicitudes existentes desde JSON
insert into solicitudes
  (id, tipo, solicitante_email, fecha_creacion, estado, datos, accesos, comentario, correo_corporativo_asignado)
values
  (
    'CREA#3', 'crear', 'tmallea@capitalinteligente.cl',
    '2026-06-23T21:59:14.239Z', 'completada',
    '{"nombre":"Tomás","segundoNombre":"Sebastian","apellidoPaterno":"Mallea","apellidoMaterno":"Silva","celular":"+56959207461","correoPersonal":"tmallea@capitalinteligente.cl"}',
    '[{"plataformaId":"gmail","fechaSolicitud":"2026-06-23T21:59:14.239Z","estado":"completada"},{"plataformaId":"slack","fechaSolicitud":"2026-06-23T21:59:14.239Z","estado":"completada"},{"plataformaId":"salesforce","fechaSolicitud":"2026-06-23T21:59:14.239Z","estado":"completada"}]',
    'Bajo el alero de martin guzman',
    'tmallea@capitalinteligente.cl'
  ),
  (
    'CREA#2', 'crear', 'tmallea@capitalinteligente.cl',
    '2026-06-23T21:40:38.081Z', 'completada',
    '{"nombre":"Tomas","segundoNombre":"SEBA","apellidoPaterno":"Mallea","apellidoMaterno":"Prueba","celular":"+56959207461","correoPersonal":"tmallea@capitalinteligente.cl"}',
    '[{"plataformaId":"gmail","fechaSolicitud":"2026-06-23T21:40:38.081Z","estado":"completada"},{"plataformaId":"slack","fechaSolicitud":"2026-06-23T21:40:38.081Z","estado":"completada"},{"plataformaId":"salesforce","fechaSolicitud":"2026-06-23T21:40:38.081Z","estado":"completada"},{"plataformaId":"jira","fechaSolicitud":"2026-06-23T21:40:38.081Z","estado":"completada"}]',
    null,
    'tmallea@capitalinteligente.cl'
  ),
  (
    'CREA#1', 'crear', 'solicitante@capitalinteligente.cl',
    '2026-06-18T20:33:11.089Z', 'completada',
    '{"nombres":"Tomas","apellidos":"Mallea","telefono":"981704806","correoPersonal":"mallea@cl.cl"}',
    '[{"plataformaId":"gmail","fechaSolicitud":"2026-06-18T20:33:11.089Z","estado":"completada"},{"plataformaId":"salesforce","fechaSolicitud":"2026-06-18T20:33:11.089Z","estado":"completada"}]',
    null,
    null
  )
on conflict (id) do nothing;

-- Overrides manuales sobre el directorio de correos importado desde Excel.
create table if not exists correos_edits (
  correo text,
  campo  text,
  valor  text not null,
  primary key (correo, campo)
);
