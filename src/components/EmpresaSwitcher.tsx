'use client';

import { useRouter } from 'next/navigation';
import type { EmpresaId } from '@/types';
import { EMPRESAS, EMPRESA_IDS } from '@/lib/empresas';

export function EmpresaSwitcher({ actual }: { actual: EmpresaId }) {
  const router = useRouter();

  return (
    <select
      value={actual}
      onChange={(e) => router.push(`/?empresa=${e.target.value}`)}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      title="Cambiar de empresa"
    >
      {EMPRESA_IDS.map((id) => (
        <option key={id} value={id}>
          {EMPRESAS[id].nombre}
        </option>
      ))}
    </select>
  );
}
