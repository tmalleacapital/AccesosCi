-- Nodia deja de distinguir Portal/Cloud: pasa a ser un ticket único (sí/no),
-- igual que Jira y Hubix. Hubix y Nodia además dejan de tener costo asociado
-- (PRECIOS.slack = 0, PRECIOS.sf = 0); solo Jira mantiene precio.
--
-- Los badges "Cuentas Portal Activo/Creadas/SalesCloud" (editables a mano en
-- el encabezado de cada BP) también se eliminan: alimentaban un cálculo de
-- costo que ya no existe.

-- miembros_extra.sf: de texto ('Portal'/'Cloud'/'') a booleano.
alter table miembros_extra
  alter column sf drop default;
alter table miembros_extra
  alter column sf type boolean using (sf in ('Portal', 'Cloud'));
alter table miembros_extra
  alter column sf set default false;

-- correos_edits: los overrides de 'sf' migran de Portal/Cloud/vacío a 'true'/'false'.
update correos_edits
set valor = case when valor in ('Portal', 'Cloud') then 'true' else 'false' end
where campo = 'sf';

-- Los badges de "Cuentas Portal/SalesCloud" ya no se leen desde ningún lado.
delete from correos_edits where correo like '\_\_metrica\_\_:%';
