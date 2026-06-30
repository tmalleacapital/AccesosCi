'use client';

import { useActionState } from 'react';
import { solicitarCodigoAction, verificarCodigoAction } from '@/app/actions';

const initialStep1 = {} as { error?: string; emailEnviado?: string };
const initialStep2 = {} as { error?: string; email?: string };

export default function LoginPage() {
  const [step1, step1Action, step1Pending] = useActionState(solicitarCodigoAction, initialStep1);
  const [step2, step2Action, step2Pending] = useActionState(verificarCodigoAction, initialStep2);

  const emailEnviado = step1?.emailEnviado;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Solicitudes de Accesos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa con tu cuenta @capitalinteligente.cl
        </p>

        {!emailEnviado ? (
          <form action={step1Action} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Correo corporativo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tucorreo@capitalinteligente.cl"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {step1?.error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
                {step1.error}
              </p>
            )}

            <button
              type="submit"
              disabled={step1Pending}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {step1Pending ? 'Enviando código…' : 'Enviar código de acceso'}
            </button>
          </form>
        ) : (
          <form action={step2Action} className="mt-6 space-y-4">
            <input type="hidden" name="email" value={emailEnviado} />

            <div>
              <p className="text-sm text-muted-foreground">
                Enviamos un código a{' '}
                <span className="font-medium text-foreground">{emailEnviado}</span>
              </p>
            </div>

            <div>
              <label htmlFor="codigo" className="block text-sm font-medium text-foreground">
                Código de verificación
              </label>
              <input
                id="codigo"
                name="codigo"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="123456"
                autoFocus
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg font-mono tracking-widest text-foreground outline-none focus:border-primary"
              />
            </div>

            {step2?.error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
                {step2.error}
              </p>
            )}

            {step1?.error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
                {step1.error}
              </p>
            )}

            <button
              type="submit"
              disabled={step2Pending}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {step2Pending ? 'Verificando…' : 'Ingresar'}
            </button>

            <button
              type="submit"
              formAction={step1Action}
              formNoValidate
              disabled={step1Pending}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {step1Pending ? 'Reenviando código…' : 'Volver a enviar código'}
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
