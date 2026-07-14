'use client';

import Image from 'next/image';
import { useActionState, useEffect, useState } from 'react';
import { solicitarCodigoAction, verificarCodigoAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { BTN_PRIMARY } from '@/lib/buttonStyles';

const initialStep1 = {} as { error?: string; emailEnviado?: string };
const initialStep2 = {} as { error?: string; email?: string };

const COOLDOWN_S = 30;

export default function LoginPage() {
  const [step1, step1Action, step1Pending] = useActionState(solicitarCodigoAction, initialStep1);
  const [step2, step2Action, step2Pending] = useActionState(verificarCodigoAction, initialStep2);
  const [manualReset, setManualReset] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailEnviado = manualReset ? undefined : step1?.emailEnviado;

  function iniciarCooldown() {
    setCooldown(COOLDOWN_S);
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 h-16 w-16">
          <Image
            src="/logo.png"
            alt="Logo"
            width={1080}
            height={1350}
            className="h-16 w-16 object-contain invert dark:invert-0"
          />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Solicitudes de Accesos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa con tu cuenta @capitalinteligente.cl
        </p>

        {!emailEnviado ? (
          <form
            action={step1Action}
            onSubmit={() => setManualReset(false)}
            className="mt-6 space-y-4"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Correo corporativo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="tucorreo@capitalinteligente.cl"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {step1?.error && (
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
              >
                {step1.error}
              </p>
            )}

            <button
              type="submit"
              onClick={iniciarCooldown}
              disabled={step1Pending}
              className={cn(BTN_PRIMARY, 'w-full')}
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
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
              >
                {step2.error}
              </p>
            )}

            {step1?.error && (
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
              >
                {step1.error}
              </p>
            )}

            <button type="submit" disabled={step2Pending} className={cn(BTN_PRIMARY, 'w-full')}>
              {step2Pending ? 'Verificando…' : 'Ingresar'}
            </button>

            <button
              type="submit"
              formAction={step1Action}
              formNoValidate
              onClick={iniciarCooldown}
              disabled={step1Pending || cooldown > 0}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {step1Pending
                ? 'Reenviando código…'
                : cooldown > 0
                  ? `Reenviar en ${cooldown}s`
                  : 'Volver a enviar código'}
            </button>

            <button
              type="button"
              onClick={() => setManualReset(true)}
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
