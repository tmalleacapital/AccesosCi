import 'server-only';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function enviarCorreo(
  destinatario: string,
  asunto: string,
  html: string,
): Promise<void> {
  await transporter.sendMail({
    from: `"Accesos Capital Inteligente" <${process.env.SMTP_USER}>`,
    to: destinatario,
    subject: asunto,
    html,
  });
}

export async function enviarCodigoOtp(destinatario: string, codigo: string): Promise<void> {
  await transporter.sendMail({
    from: `"Accesos Capital Inteligente" <${process.env.SMTP_USER}>`,
    to: destinatario,
    subject: `Tu código de acceso: ${codigo}`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #111;">Código de verificación</h2>
        <p>Ingresa este código para acceder a <strong>Solicitudes de Accesos</strong>:</p>
        <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.4em; padding: 16px 0;">
          ${codigo}
        </div>
        <p style="color: #555;">Este código expira en <strong>10 minutos</strong>.</p>
        <p style="color: #999; font-size: 0.8rem;">Si no solicitaste este código, ignora este mensaje.</p>
      </div>
    `,
  });
}
