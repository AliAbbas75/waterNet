const { Resend } = require("resend");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const SEVERITY_LABEL = { CRITICAL: "CRITICAL", WARN: "Warning", INFO: "Info" };
const TYPE_LABEL = {
  QUALITY_UNSAFE: "Water Quality Unsafe",
  DEVICE_OFFLINE: "Device Offline",
  LOW_INVENTORY: "Low Inventory",
  AVAILABILITY_CHANGE: "Availability Change"
};

// Which roles receive email for each alert type
const NOTIFY_ROLES = {
  QUALITY_UNSAFE:    ["ADMIN", "SUPER_ADMIN", "MAINTAINER"],
  DEVICE_OFFLINE:    ["ADMIN", "SUPER_ADMIN", "MAINTAINER"],
  AVAILABILITY_CHANGE: ["ADMIN", "SUPER_ADMIN"],
  LOW_INVENTORY:     ["ADMIN", "SUPER_ADMIN"]
};

function buildSubject(alert) {
  const sev = SEVERITY_LABEL[alert.severity] || alert.severity;
  const type = TYPE_LABEL[alert.type] || alert.type;
  return `[WaterNet ${sev}] ${type}`;
}

function buildHtml(alert) {
  const color = alert.severity === "CRITICAL" ? "#dc2626" : "#d97706";
  return (
    `<h2 style="color:${color}">${buildSubject(alert)}</h2>` +
    `<p>${alert.message}</p>` +
    `<p style="color:#6b7280;font-size:0.875em">` +
    `Alert ID: ${alert._id} &nbsp;|&nbsp; ${new Date(alert.createdAt).toUTCString()}` +
    `</p>`
  );
}

async function sendViaSmtp(to, subject, html) {
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

async function sendViaResend(to, subject, html) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, html });
}

async function notifyAdminsOfAlert(alert) {
  const smtpReady = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM;
  const resendReady = process.env.RESEND_API_KEY && process.env.RESEND_FROM;
  if (!smtpReady && !resendReady) return;

  const roles = NOTIFY_ROLES[alert.type] || ["ADMIN", "SUPER_ADMIN"];

  const recipients = await User.find(
    { role: { $in: roles }, active: true, email: { $exists: true, $ne: null } },
    { email: 1 }
  ).lean();

  if (!recipients.length) return;

  const subject = buildSubject(alert);
  const html = buildHtml(alert);

  for (const user of recipients) {
    try {
      if (smtpReady) {
        await sendViaSmtp(user.email, subject, html);
      } else {
        await sendViaResend(user.email, subject, html);
      }
    } catch (err) {
      console.error(`Alert notification failed for ${user.email}:`, err?.message || err);
    }
  }
}

module.exports = { notifyAdminsOfAlert };
