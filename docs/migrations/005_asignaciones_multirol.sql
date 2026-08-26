-- ============================================================
-- Multi-rol: una persona puede tener varios cargos a la vez.
-- Ej. cfigueroa es MBP de Forza Capital Y ADEMÁS líder del
-- "BP Forza Capital" que está dentro de ese mismo MBP.
--
-- El rol principal sigue viviendo en usuarios.rol/grupo_bp (no se
-- toca, para no alterar el acceso de nadie). Esta tabla agrega los
-- cargos EXTRA; el acceso efectivo es la unión de ambos.
--
-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- ============================================================

create table if not exists usuario_asignaciones (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  rol          text not null check (rol in ('bp', 'team_leader', 'mbp')),
  hoja_id      text not null,
  -- null cuando rol = 'mbp': cubre todos los BP de esa hoja.
  grupo_nombre text,
  creado_en    timestamptz not null default now()
);

create index if not exists usuario_asignaciones_email_idx
  on usuario_asignaciones (email);

-- Evita duplicar el mismo cargo. coalesce porque grupo_nombre es null
-- en las asignaciones de tipo mbp y null nunca es igual a null.
create unique index if not exists usuario_asignaciones_unico_idx
  on usuario_asignaciones (email, rol, hoja_id, coalesce(grupo_nombre, ''));
