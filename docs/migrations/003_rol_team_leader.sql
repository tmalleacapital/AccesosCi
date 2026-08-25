-- ============================================================
-- Nuevo rol "team_leader" (mismos poderes que "bp"). Ejecutar
-- una sola vez en el SQL Editor de Supabase.
-- ============================================================

alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios
  add constraint usuarios_rol_check
  check (rol in ('solicitante', 'equipo', 'admin', 'bp', 'finanzas', 'team_leader'));
