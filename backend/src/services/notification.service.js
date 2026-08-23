const webpush = require("web-push");
const User = require("../models/User");
const PushSubscription = require("../models/PushSubscription");
const { CATEGORIES, isValidCategory, wants, effectivePreferences } = require("./notificationCatalog");
const { sendMail, mailerReady } = require("./mailer.service");

/**
 * Fan-out for everything the system wants to tell somebody.
 *
 * Eligibility is decided by role and delivery by preference, and the two are
 * kept apart on purpose: a role says what you may be told, a preference says
 * what you actually want. A preference can only narrow a role, never widen it,
 * so muting a category cannot become a way to see something you should not.
 */

let vapidConfigured = null;

function configureVapid() {
  if (vapidConfigured !== null) return vapidConfigured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@waternet.local",
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

function pushReady() {
  return configureVapid();
}

function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Delivers to every device a user has registered.
 *
 * A push service answering 404 or 410 means the subscription is dead — the
 * browser was uninstalled, or the user revoked permission. Those are pruned
 * rather than retried, or the collection fills with endpoints that can never
 * succeed and every future send pays for them.
 */
async function pushToUser(userId, payload) {
  if (!pushReady()) return { sent: 0, pruned: 0, skipped: "no-vapid" };

  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
        sent += 1;
        await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastUsedAt: new Date() } });
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
          pruned += 1;
          return;
        }
        console.error(`push send failed (${status || "?"}):`, err?.message || err);
      }
    })
  );

  return { sent, pruned };
}

function emailHtml({ title, body, url }) {
  const link = url
    ? `<p><a href="${url}" style="color:#2563eb">Open in WaterNet</a></p>`
    : "";
  return (
    `<h2 style="margin:0 0 8px">${title}</h2>` +
    `<p style="margin:0 0 12px">${body}</p>` +
    link +
    `<p style="color:#6b7280;font-size:0.875em">${new Date().toUTCString()}</p>`
  );
}

/**
 * @param category  a key from the notification catalog
 * @param audience  { roles?, userIds? } — who is eligible before preferences
 * @param title/body/url  what the notification says and where it goes
 */
async function notify({ category, audience = {}, title, body, url = null, meta = {} }) {
  if (!isValidCategory(category)) {
    console.error(`notify(): unknown category "${category}"`);
    return { push: 0, email: 0, recipients: 0 };
  }

  const query = { active: true };
  if (audience.userIds?.length) {
    query._id = { $in: audience.userIds };
  } else {
    // Fall back to the roles the catalog says may receive this category, so a
    // caller that forgets an audience cannot accidentally notify nobody.
    query.role = { $in: audience.roles?.length ? audience.roles : CATEGORIES[category].roles };
  }

  const users = await User.find(query).lean();
  if (!users.length) return { push: 0, email: 0, recipients: 0 };

  let pushCount = 0;
  let emailCount = 0;
  const canEmail = mailerReady();

  await Promise.all(
    users.map(async (user) => {
      if (wants(user, category, "push")) {
        const result = await pushToUser(user._id, { title, body, url, category, meta });
        pushCount += result.sent;
      }

      if (canEmail && user.email && wants(user, category, "email")) {
        try {
          await sendMail({
            to: user.email,
            subject: `[WaterNet] ${title}`,
            html: emailHtml({ title, body, url })
          });
          emailCount += 1;
        } catch (err) {
          console.error(`notification email failed for ${user.email}:`, err?.message || err);
        }
      }
    })
  );

  return { push: pushCount, email: emailCount, recipients: users.length };
}

module.exports = {
  notify,
  pushToUser,
  pushReady,
  publicKey,
  effectivePreferences
};
