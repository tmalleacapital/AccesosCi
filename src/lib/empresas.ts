import type { EmpresaId } from '@/types';

export const EMPRESAS: Record<EmpresaId, { id: EmpresaId; nombre: string; dominio: string }> = {
  capital_inteligente: {
    id: 'capital_inteligente',
    nombre: 'Capital Inteligente',
    dominio: 'capitalinteligente.cl',
  },
  capital_prime: {
    id: 'capital_prime',
    nombre: 'Capital Prime',
    dominio: 'capitalprime.cl',
  },
};

export const EMPRESA_IDS = Object.keys(EMPRESAS) as EmpresaId[];

export const EMPRESA_DEFAULT: EmpresaId = 'capital_inteligente';

export function esEmpresaId(valor: string): valor is EmpresaId {
  return Object.prototype.hasOwnProperty.call(EMPRESAS, valor);
}

export function normalizarEmpresaId(valor: string | null | undefined): EmpresaId {
  return valor && esEmpresaId(valor) ? valor : EMPRESA_DEFAULT;
}
