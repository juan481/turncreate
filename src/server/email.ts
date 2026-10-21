import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const FROM = process.env.SES_FROM_EMAIL ?? "no-reply@turncreate.com.ar";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function safeHttpHref(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? escapeHtml(url.toString()) : null;
  } catch {
    return null;
  }
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.log("[email] SES no configurado — se omite envío a:", to, "|", subject);
    return;
  }
  await sesClient.send(
    new SendEmailCommand({
      Source: FROM,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
        },
      },
    }),
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────

type AppointmentDetails = {
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;   // "lunes 24 de septiembre"
  time: string;   // "10:00"
  address?: string;
  whatsapp?: string;
  managementUrl?: string;
  cancellationPolicy?: string;
};

function baseLayout(content: string, businessName: string) {
  const safeBusinessName = escapeHtml(businessName);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeBusinessName}</title>
<style>
  body { margin: 0; padding: 0; background: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrapper { max-width: 520px; margin: 0 auto; padding: 32px 16px; }
  .card { background: #fff; border-radius: 20px; padding: 32px; border: 1px solid #e5e5ea; }
  .logo { font-size: 18px; font-weight: 700; color: #7069e8; margin-bottom: 24px; }
  .logo span { color: #1d1d1f; }
  h1 { font-size: 22px; font-weight: 700; color: #1d1d1f; margin: 0 0 8px; }
  p { font-size: 15px; color: #3c3c43; line-height: 1.6; margin: 0 0 16px; }
  .detail-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
  .detail-icon { font-size: 18px; flex-shrink: 0; }
  .detail-text { font-size: 14px; color: #3c3c43; line-height: 1.4; }
  .detail-text strong { color: #1d1d1f; display: block; }
  .badge { display: inline-block; background: #f0effd; color: #7069e8; border-radius: 999px; padding: 6px 16px; font-size: 13px; font-weight: 600; margin: 8px 0 24px; }
  .footer { margin-top: 24px; font-size: 12px; color: #8e8e93; text-align: center; line-height: 1.6; }
  .divider { border: none; border-top: 1px solid #e5e5ea; margin: 24px 0; }
  .button { display: block; background: #7069e8; color: #fff !important; text-decoration: none; text-align: center; border-radius: 999px; padding: 12px 18px; font-size: 15px; font-weight: 700; margin: 20px 0 8px; }
</style>
</head>
<body>
<div class="wrapper">
<div class="card">
  <div class="logo">Turn<span>Create</span></div>
  ${content}
</div>
<div class="footer">
  Powered by TurnCreate · Este correo fue enviado automáticamente, no respondas aquí.<br />
  ${safeBusinessName}
</div>
</div>
</body>
</html>`;
}

export async function sendAppointmentConfirmation(
  to: string,
  details: AppointmentDetails,
) {
  const { clientName, businessName, serviceName, date, time, address, whatsapp, managementUrl, cancellationPolicy } = details;
  const managementHref = safeHttpHref(managementUrl);

  const html = baseLayout(
    `<h1>¡Turno confirmado! 🎉</h1>
<p>Hola <strong>${escapeHtml(clientName)}</strong>, tu turno está reservado. Te esperamos.</p>
<span class="badge">✓ Confirmado</span>
<div class="detail-row"><span class="detail-icon">✂️</span><div class="detail-text"><strong>${escapeHtml(serviceName)}</strong></div></div>
<div class="detail-row"><span class="detail-icon">📅</span><div class="detail-text"><strong>${escapeHtml(date)} a las ${escapeHtml(time)}</strong></div></div>
${address ? `<div class="detail-row"><span class="detail-icon">📍</span><div class="detail-text">${escapeHtml(address)}</div></div>` : ""}
${managementHref ? `<a class="button" href="${managementHref}">Ver o gestionar mi turno</a>` : ""}
${cancellationPolicy ? `<p style="font-size:13px;color:#8e8e93">${escapeHtml(cancellationPolicy)}</p>` : ""}
${whatsapp ? `<hr class="divider" /><p style="font-size:13px;color:#8e8e93">¿Necesitás cancelar o reprogramar? Escribinos por WhatsApp al <strong>${escapeHtml(whatsapp)}</strong>.</p>` : ""}`,
    businessName,
  );

  const text = `Turno confirmado en ${businessName}\n\nServicio: ${serviceName}\nFecha: ${date} a las ${time}${address ? `\nDirección: ${address}` : ""}${managementUrl ? `\nGestioná tu turno: ${managementUrl}` : ""}${cancellationPolicy ? `\n${cancellationPolicy}` : ""}${whatsapp ? `\n\nWhatsApp: ${whatsapp}` : ""}`;

  await sendEmail({ to, subject: `Turno confirmado — ${businessName}`, html, text });
}

export async function sendAppointmentManagementLink(to: string, details: AppointmentDetails) {
  const { clientName, businessName, serviceName, date, time, managementUrl, cancellationPolicy } = details;
  const managementHref = safeHttpHref(managementUrl);
  if (!managementHref) return;
  const html = baseLayout(
    `<h1>Recibimos tu reserva</h1>
<p>Hola <strong>${escapeHtml(clientName)}</strong>, guardá este enlace único para consultar, reprogramar o cancelar tu turno.</p>
<div class="detail-row"><span class="detail-icon">✂️</span><div class="detail-text"><strong>${escapeHtml(serviceName)}</strong></div></div>
<div class="detail-row"><span class="detail-icon">📅</span><div class="detail-text"><strong>${escapeHtml(date)} a las ${escapeHtml(time)}</strong></div></div>
<a class="button" href="${managementHref}">Gestionar mi turno</a>
${cancellationPolicy ? `<p style="font-size:13px;color:#8e8e93">${escapeHtml(cancellationPolicy)}</p>` : ""}`,
    businessName,
  );
  const text = `Reserva en ${businessName}\n${serviceName} · ${date} a las ${time}\nGestioná tu turno: ${managementUrl}${cancellationPolicy ? `\n${cancellationPolicy}` : ""}`;
  await sendEmail({ to, subject: `Gestioná tu turno — ${businessName}`, html, text });
}

export async function sendAppointmentReminder(
  to: string,
  details: AppointmentDetails,
) {
  const { clientName, businessName, serviceName, date, time, address, whatsapp } = details;

  const html = baseLayout(
    `<h1>Recordatorio de turno ⏰</h1>
<p>Hola <strong>${escapeHtml(clientName)}</strong>, te recordamos que mañana tenés turno.</p>
<div class="detail-row"><span class="detail-icon">✂️</span><div class="detail-text"><strong>${escapeHtml(serviceName)}</strong></div></div>
<div class="detail-row"><span class="detail-icon">📅</span><div class="detail-text"><strong>${escapeHtml(date)} a las ${escapeHtml(time)}</strong></div></div>
${address ? `<div class="detail-row"><span class="detail-icon">📍</span><div class="detail-text">${escapeHtml(address)}</div></div>` : ""}
${whatsapp ? `<hr class="divider" /><p style="font-size:13px;color:#8e8e93">¿No podés venir? Escribinos por WhatsApp al <strong>${escapeHtml(whatsapp)}</strong>.</p>` : ""}`,
    businessName,
  );

  const text = `Recordatorio de turno en ${businessName}\n\nMañana: ${serviceName} a las ${time}${address ? `\nDirección: ${address}` : ""}`;

  await sendEmail({ to, subject: `Recordatorio: turno mañana en ${businessName}`, html, text });
}

export async function sendAppointmentCancellation(
  to: string,
  details: AppointmentDetails & { reason?: string },
) {
  const { clientName, businessName, serviceName, date, time, reason, whatsapp } = details;

  const html = baseLayout(
    `<h1>Turno cancelado</h1>
<p>Hola <strong>${escapeHtml(clientName)}</strong>, tu turno fue cancelado.</p>
<div class="detail-row"><span class="detail-icon">✂️</span><div class="detail-text"><strong>${escapeHtml(serviceName)}</strong></div></div>
<div class="detail-row"><span class="detail-icon">📅</span><div class="detail-text">${escapeHtml(date)} a las ${escapeHtml(time)}</div></div>
${reason ? `<div class="detail-row"><span class="detail-icon">💬</span><div class="detail-text">${escapeHtml(reason)}</div></div>` : ""}
${whatsapp ? `<hr class="divider" /><p style="font-size:13px;color:#8e8e93">Para reservar un nuevo turno escribinos por WhatsApp al <strong>${escapeHtml(whatsapp)}</strong>.</p>` : ""}`,
    businessName,
  );

  await sendEmail({ to, subject: `Turno cancelado — ${businessName}`, html });
}
