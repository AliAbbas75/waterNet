const { Resend } = require("resend");
const nodemailer = require("nodemailer");

/**
 * One way out to email.
 *
 * SMTP and Resend were each wired up separately at the call site, so a second
 * sender had to repeat the readiness checks and the transport choice. Both now
 * live here: callers ask whether mail can go out, then send.
 */

function smtpReady() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

function resendReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

function mailerReady() {
  return smtpReady() || resendReady();
}

async function sendViaSmtp({ to, subject, html }) {
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

async function sendViaResend({ to, subject, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, html });
}

/** Throws if neither transport is configured — callers check mailerReady first. */
async function sendMail({ to, subject, html }) {
  if (smtpReady()) return sendViaSmtp({ to, subject, html });
  if (resendReady()) return sendViaResend({ to, subject, html });
  throw new Error("No email transport configured");
}

module.exports = { sendMail, mailerReady, smtpReady, resendReady };
