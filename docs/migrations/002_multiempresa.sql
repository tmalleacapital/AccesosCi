-- ============================================================
-- Soporte multi-empresa (Capital Inteligente / Capital Prime).
-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- ============================================================

alter table hojas_extra
  add column if not exists empresa text not null default 'capital_inteligente';
alter table hojas_extra
  add constraint hojas_extra_empresa_check
  check (empresa in ('capital_inteligente', 'capital_prime'));

alter table solicitudes
  add column if not exists empresa text not null default 'capital_inteligente';
alter table solicitudes
  add constraint solicitudes_empresa_check
  check (empresa in ('capital_inteligente', 'capital_prime'));

alter table usuarios
  add column if not exists multiempresas boolean not null default false;
