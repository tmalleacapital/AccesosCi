-- ============================================================
-- Nuevo rol "mbp": ve todos los BP de un MBP (grupo_bp guarda solo
-- el hojaId, sin "|grupoNombre"). Ejecutar una sola vez en el SQL
-- Editor de Supabase.
-- ============================================================

alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios
  add constraint usuarios_rol_check
  check (rol in ('solicitante', 'equipo', 'admin', 'bp', 'finanzas', 'team_leader', 'mbp'));
