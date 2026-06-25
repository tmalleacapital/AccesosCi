'use client';

import { useActionState, useState } from 'react';
import type { Plataforma, TipoSolicitud } from '@/types';
import { crearSolicitudAction } from '@/app/actions';

const estadoInicial: { error?: string } = {};

const inputClass =
  'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary';

function validarRut(rut: string): boolean {
  const clean = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const expected = 11 - (sum % 11);
  const dvEsperado = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === dvEsperado;
}

function formatearRut(value: string): string {
  const clean = value
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}

export function SolicitudForm({ plataformas }: { plataformas: Plataforma[] }) {
  const [estado, formAction, pending] = useActionState(crearSolicitudAction, estadoInicial);
  const [tipo, setTipo] = useState<TipoSolicitud>('crear');
  const [rut, setRut] = useState('');
  const [rutError, setRutError] = useState('');

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <div>
        <label htmlFor="tipo" className="block text-sm font-medium text-foreground">
          Tipo de solicitud
        </label>
        <select
          id="tipo"
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoSolicitud)}
          className={inputClass}
        >
          <option value="crear">Crear acceso</option>
          <option value="modificar">Modificar acceso</option>
          <option value="baja">Dar de baja acceso</option>
        </select>
      </div>

      {tipo === 'crear' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre" name="nombre" />
          <Campo label="Segundo Nombre" name="segundoNombre" />
          <Campo label="Apellido Paterno" name="apellidoPaterno" />
          <Campo label="Apellido Materno" name="apellidoMaterno" />
          <Campo label="Celular" name="celular" placeholder="+56 9 1234 5678" />
          <Campo
            label="Correo Personal (envío de credenciales)"
            name="correoPersonal"
            type="email"
          />
          <div className="sm:col-span-2">
            <label htmlFor="rut" className="block text-sm font-medium text-foreground">
              RUT
            </label>
            <input
              id="rut"
              name="rut"
              type="text"
              required
              placeholder="12.345.678-9"
              value={rut}
              onChange={(e) => {
                const formatted = formatearRut(e.target.value);
                setRut(formatted);
                if (rutError) setRutError('');
              }}
              onBlur={() => {
                if (rut && !validarRut(rut)) setRutError('RUT inválido, ingresa un RUT real.');
                else setRutError('');
              }}
              className={`${inputClass} ${rutError ? 'border-rose-400' : ''}`}
            />
            {rutError && <p className="mt-1 text-xs text-rose-500">{rutError}</p>}
          </div>
        </div>
      )}

      {tipo === 'modificar' && (
        <div className="space-y-4">
          <Campo
            label="Correo @capitalinteligente.cl a modificar"
            name="correoCorporativo"
            type="email"
          />
          <div>
            <label htmlFor="detalle" className="block text-sm font-medium text-foreground">
              Detalle del cambio
            </label>
            <textarea id="detalle" name="detalle" rows={3} className={inputClass} />
          </div>
        </div>
      )}

      {tipo === 'baja' && (
        <div className="space-y-4">
          <Campo
            label="Correo @capitalinteligente.cl a dar de baja"
            name="correoCorporativo"
            type="email"
          />
          <Campo
            label="Si tiene Salesforce: ¿a quién se redistribuyen leads y cuentas?"
            name="redistribucionSalesforce"
            required={false}
          />
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Plataformas</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {plataformas.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <input type="checkbox" name="plataformas" value={p.id} />
              {p.nombre}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="comentario" className="block text-sm font-medium text-foreground">
          Comentarios <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea
          id="comentario"
          name="comentario"
          rows={3}
          placeholder="Información adicional relevante para esta solicitud…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {estado?.error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}

function Campo({
  label,
  name,
  type = 'text',
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className={inputClass}
      />
    </div>
  );
}
