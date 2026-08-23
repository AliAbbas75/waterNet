const { Resend } = require("resend");
const nodemailer = require("nodemailer");

/**
 * One way out to email.
 *
 * SMTP and Resend were each wired up separately at the call site, so a second
 * sender had to repeat the readiness checks and the transport choice. Both now
 * live here: callers ask whether mail can go out, then send.
 */

// Most cloud hosts block outbound SMTP rather than refusing it, so a socket to
// port 587 hangs instead of failing. Without a deadline the request that is
// waiting on it hangs too, and a login times out with nothing to show for it.
const SMTP_TIMEOUT_MS = 10_000;

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
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

async function sendViaResend({ to, subject, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, html });

  // The SDK reports API failures in the response rather than throwing, so an
  // awaited call returns perfectly normally after the server refused it. That
  // turned every rejection — an unverified sending domain, a bad key, a
  // suppressed address — into a silent success: nothing delivered, nothing
  // logged, and the caller told it had sent.
  if (error) {
    const err = new Error(error.message || "Resend rejected the message");
    err.statusCode = error.statusCode;
    err.name = error.name || "ResendError";
    throw err;
  }
}

/**
 * Sends, preferring SMTP and falling back to Resend.
 *
 * The fallback is between transports, not just a choice made once: SMTP being
 * configured is not evidence it works, and on a host that blocks port 587 the
 * only working path is the HTTPS API. Throws only when every configured
 * transport has actually been tried and failed.
 */
async function sendMail({ to, subject, html }) {
  const failures = [];

  if (smtpReady()) {
    try {
      await sendViaSmtp({ to, subject, html });
      return { transport: "smtp" };
    } catch (err) {
      failures.push(`smtp: ${err.code || err.message}`);
      console.error(
        `Mail over SMTP failed (${err.code || err.message}). ` +
          `Outbound SMTP is blocked on most cloud hosts — an HTTPS mail API is the way out.`
      );
    }
  }

  if (resendReady()) {
    try {
      await sendViaResend({ to, subject, html });
      return { transport: "resend" };
    } catch (err) {
      failures.push(`resend: ${err.message}`);
      console.error(`Mail over Resend failed: ${err.message}`);
    }
  }

  throw new Error(
    failures.length ? `No transport delivered the message — ${failures.join("; ")}` : "No email transport configured"
  );
}

module.exports = { sendMail, mailerReady, smtpReady, resendReady };
