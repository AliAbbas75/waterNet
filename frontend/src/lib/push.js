import { api } from "./api.js";

/**
 * Browser push plumbing.
 *
 * The permission prompt is only ever raised from an explicit user action in the
 * settings screen. Asking on page load is how sites get permanently blocked by
 * the browser, and a blocked origin cannot ask again.
 */

const SW_PATH = "/sw.js";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permissionState() {
  if (!pushSupported()) return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

// VAPID keys travel as base64url; PushManager wants raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function registration() {
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Registers this browser for push. Returns the subscription, or throws with a
 * message worth showing — the caller surfaces it rather than guessing.
 */
export async function enablePush(vapidPublicKey) {
  if (!pushSupported()) throw new Error("This browser does not support push notifications.");
  if (!vapidPublicKey) throw new Error("Push is not configured on the server.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
        : "Notification permission was dismissed."
    );
  }

  const reg = await registration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      // Chrome refuses a subscription that is not userVisibleOnly.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  const json = sub.toJSON();
  await api.post("/api/notifications/subscribe", {
    endpoint: json.endpoint,
    keys: json.keys
  });

  return sub;
}

/** Unregisters this device only; other devices keep receiving. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return false;
  const { endpoint } = sub.toJSON();
  // Drop the server record first: if unsubscribing locally succeeded but the
  // server row survived, it would keep sending to a dead endpoint until the
  // push service 410s it away.
  await api.del(`/api/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`);
  await sub.unsubscribe().catch(() => {});
  return true;
}
