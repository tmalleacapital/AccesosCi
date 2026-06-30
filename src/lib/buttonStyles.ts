/**
 * Estilos de botón centralizados. Usar con `cn()` para agregar clases
 * adicionales (ej. `cn(BTN_PRIMARY, 'flex items-center gap-1.5')`).
 *
 * Todos comparten `disabled:opacity-40` como único valor de opacity en
 * estado deshabilitado, para que el feedback visual sea consistente en
 * toda la app.
 */
export const BTN_PRIMARY =
  'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40';

export const BTN_SECONDARY =
  'rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40';

export const BTN_DANGER =
  'rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40';
