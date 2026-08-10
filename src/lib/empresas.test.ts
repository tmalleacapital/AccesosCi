import { describe, expect, it } from 'vitest';
import { EMPRESAS, EMPRESA_IDS, EMPRESA_DEFAULT, esEmpresaId, normalizarEmpresaId } from './empresas';

describe('EMPRESAS', () => {
  it('define Capital Inteligente y Capital Prime con su dominio', () => {
    expect(EMPRESAS.capital_inteligente.dominio).toBe('capitalinteligente.cl');
    expect(EMPRESAS.capital_prime.dominio).toBe('capitalprime.cl');
  });

  it('EMPRESA_IDS lista ambos ids', () => {
    expect(EMPRESA_IDS.sort()).toEqual(['capital_inteligente', 'capital_prime']);
  });
});

describe('esEmpresaId', () => {
  it('acepta los ids válidos', () => {
    expect(esEmpresaId('capital_inteligente')).toBe(true);
    expect(esEmpresaId('capital_prime')).toBe(true);
  });

  it('rechaza cualquier otro valor', () => {
    expect(esEmpresaId('otra_empresa')).toBe(false);
    expect(esEmpresaId('')).toBe(false);
  });
});

describe('normalizarEmpresaId', () => {
  it('devuelve el valor si es válido', () => {
    expect(normalizarEmpresaId('capital_prime')).toBe('capital_prime');
  });

  it('devuelve el default (capital_inteligente) para valores inválidos, null o undefined', () => {
    expect(normalizarEmpresaId('cualquier_cosa')).toBe(EMPRESA_DEFAULT);
    expect(normalizarEmpresaId(null)).toBe(EMPRESA_DEFAULT);
    expect(normalizarEmpresaId(undefined)).toBe(EMPRESA_DEFAULT);
  });
});
