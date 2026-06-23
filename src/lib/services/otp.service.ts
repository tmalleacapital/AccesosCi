import 'server-only';
import { createHmac, randomInt } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'sa_otp';
const TTL_MS = 10 * 60 * 1000;

function firmar(email: string, otp: string, expires: number): string {
  return createHmac('sha256', process.env.OTP_SECRET ?? '')
    .update(`${email}|${otp}|${expires}`)
    .digest('hex');
}

export function generarOtp(): string {
  return String(randomInt(100000, 999999));
}

export async function guardarOtp(email: string, otp: string): Promise<void> {
  const expires = Date.now() + TTL_MS;
  const firma = firmar(email, otp, expires);
  const store = await cookies();
  store.set(COOKIE, JSON.stringify({ email, otp, expires, firma }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
}

export async function verificarOtp(email: string, otp: string): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return false;
  try {
    const datos = JSON.parse(raw) as {
      email: string;
      otp: string;
      expires: number;
      firma: string;
    };
    if (datos.email !== email || datos.otp !== otp) return false;
    if (Date.now() > datos.expires) return false;
    return datos.firma === firmar(datos.email, datos.otp, datos.expires);
  } catch {
    return false;
  }
}

export async function limpiarOtp(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
